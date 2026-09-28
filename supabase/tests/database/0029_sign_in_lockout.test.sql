-- Account lockout on new sign-ins (S3-06; FR-106; ADR-026; transaction test 20). Uses the local seed: the learner,
-- coordinator@ and admin@. The sign-in handler's functions run as service_role, as the server calls them.
create extension if not exists pgtap with schema extensions;

begin;
select plan(27);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- Wrong passwords, as the sign-in handler records them. Call as postgres; leaves the caller as postgres.
create function pg_temp.fail(p_email text, p_times integer) returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  for i in 1 .. p_times loop
    perform api.record_sign_in_failure(p_email);
  end loop;
  perform set_config('role', 'postgres', true);
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set coordinator 00000000-0000-4000-8000-000000000005
\set admin 00000000-0000-4000-8000-000000000006

-- Nothing is revealed for an unknown email, and nothing is recorded
select set_config('role', 'service_role', true);
select is(api.sign_in_gate('nobody@takusani.test'), false, 'an unknown email is never locked');
select api.record_sign_in_failure('nobody@takusani.test');
reset role;
select is((select count(*)::int from identity.sign_in_failures), 0, 'and a wrong password for it records nothing');

-- Counting: four wrong passwords do not lock; the fifth does
reset role;
select pg_temp.fail('learner@takusani.test', 4);
select set_config('role', 'service_role', true);
select is(api.sign_in_gate('LEARNER@takusani.test'), false, 'four wrong passwords do not lock (any letter case)');
reset role;
select pg_temp.fail('learner@takusani.test', 1);
select set_config('role', 'service_role', true);
select is(api.sign_in_gate('learner@takusani.test'), true, 'the fifth within 15 minutes locks new sign-ins');
reset role;
select results_eq(
  format($$ select failures, locked_until = locked_at + interval '15 minutes' from identity.sign_in_failures
            where profile_id = %L $$, :'learner'),
  $$ values (5, true) $$, 'for 15 minutes');
select is((select count(*)::int from audit.events where action = 'identity.sign_in_locked' and object_id = :'learner'), 1,
  'the lock is audited');
select is((select count(*)::int from notifications.notifications where recipient_id = :'learner' and event_type = 'sign_in_locked'),
  1, 'and the person is told');

-- While locked: more failures do not extend it, and a correct password does not clear it
select locked_until as first_until from identity.sign_in_failures where profile_id = :'learner' \gset
reset role;
select pg_temp.fail('learner@takusani.test', 3);
select set_config('role', 'service_role', true);
select api.record_sign_in_success('learner@takusani.test');
reset role;
select is((select locked_until from identity.sign_in_failures where profile_id = :'learner'), :'first_until'::timestamptz,
  'failures while locked do not extend the lock, and a success does not clear it');

-- Transaction test 20: an existing session keeps working while new sign-ins are locked
select pg_temp.act_as(:'learner');
select results_eq($$ select status, roles from api.my_access() $$, $$ values ('active'::text, array['learner']) $$,
  'the signed-in learner''s session still works');
select lives_ok($$ select * from api.list_my_tasks() $$, 'and so do their commands');
reset role;
select is((select status from identity.profiles where id = :'learner'), 'active',
  'the account itself stays active: a lock is not a deactivation');

-- Expiry: once the time is up, the lock ends by itself, and the expiry is audited
update identity.sign_in_failures set locked_at = now() - interval '16 minutes', locked_until = now() - interval '1 second'
where profile_id = :'learner';
select set_config('role', 'service_role', true);
select is(api.sign_in_gate('learner@takusani.test'), false, 'an expired lock no longer blocks sign-in');
reset role;
select results_eq(
  format($$ select failures, locked_until from identity.sign_in_failures where profile_id = %L $$, :'learner'),
  $$ values (0, null::timestamptz) $$, 'and the count starts again');
select is((select count(*)::int from audit.events where action = 'identity.sign_in_lock_expired' and object_id = :'learner'), 1,
  'the expiry is audited');

-- The window: failures older than 15 minutes do not add up
update identity.sign_in_failures set failures = 4, window_started_at = now() - interval '20 minutes'
where profile_id = :'learner';
select set_config('role', 'service_role', true);
select api.record_sign_in_failure('learner@takusani.test');
reset role;
select is((select failures from identity.sign_in_failures where profile_id = :'learner'), 1,
  'a failure after the window starts a new count');
select set_config('role', 'service_role', true);
select api.record_sign_in_success('learner@takusani.test');
reset role;
select is((select failures from identity.sign_in_failures where profile_id = :'learner'), 0, 'a correct password clears the count');

-- Email recovery clears a lock
reset role;
select pg_temp.fail('learner@takusani.test', 5);
reset role;
select pg_temp.act_as(:'learner');
select is(status, 'ok', 'signing in through a password-reset link clears the lock') from api.clear_my_sign_in_lock();
reset role;
select set_config('role', 'service_role', true);
select is(api.sign_in_gate('learner@takusani.test'), false, 'so new sign-ins work again');
reset role;
select is((select count(*)::int from audit.events where action = 'identity.sign_in_lock_cleared' and object_id = :'learner'), 1,
  'and the recovery is audited');

-- An administrator unlocks (FR-106)
reset role;
select pg_temp.fail('learner@takusani.test', 5);
reset role;
select pg_temp.act_as(:'admin');
select results_eq($$ select count(*)::int from api.list_sign_in_locks() $$, $$ values (1) $$,
  'the administrator sees the locked account');
reset role;
select pg_temp.act_as(:'coordinator');
select is(status, 'forbidden', 'only an administrator unlocks') from api.unlock_account(:'learner');
select is_empty($$ select * from api.list_sign_in_locks() $$, 'and only an administrator sees the locks');
reset role;
select pg_temp.act_as(:'admin');
select is(status, 'ok', 'the administrator unlocks the account') from api.unlock_account(:'learner');
select is(status, 'not_locked', 'unlocking again changes nothing') from api.unlock_account(:'learner');
reset role;
select results_eq(
  format($$ select (select count(*)::int from audit.events where action = 'identity.sign_in_unlocked' and object_id = %L and actor_id = %L),
                   (select count(*)::int from notifications.notifications where recipient_id = %L and event_type = 'sign_in_unlocked') $$,
         :'learner', :'admin', :'learner'),
  $$ values (1, 1) $$, 'the unlock is audited with the administrator, and the person is told');

-- The handler's functions are for the server only
select pg_temp.act_as(:'learner');
select throws_ok($$ select api.record_sign_in_failure('coordinator@takusani.test') $$, '42501', null,
  'a signed-in person cannot count failures against someone else');
reset role;
set local role anon;
select throws_ok($$ select api.sign_in_gate('learner@takusani.test') $$, '42501', null,
  'and nobody can ask whether an account is locked without the secret key');

select * from finish();
rollback;
