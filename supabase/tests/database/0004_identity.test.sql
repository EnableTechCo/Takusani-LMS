-- Identity: who can see and create accounts, the audit trail, and the role-assignment rules.
-- Uses the local seed accounts (supabase/seed.sql).
create extension if not exists pgtap with schema extensions;

begin;
select plan(20);

-- Switch to a signed-in user. Call only as postgres: `reset role` first, since authenticated cannot run it.
create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

create function pg_temp.new_auth_user(p_email text) returns uuid language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', p_email, now(), now())
  returning id
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set admin 00000000-0000-4000-8000-000000000006
\set staff 00000000-0000-4000-8000-000000000007

select pg_temp.new_auth_user('new.person@takusani.test') as new_user \gset

-- my_access
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  $$ select full_name, roles from api.my_access() $$,
  $$ values ('Lerato Mokoena'::text, array['learner']::text[]) $$,
  'a learner sees their own name and role'
);
reset role;
select pg_temp.act_as(:'staff');
select results_eq(
  $$ select roles from api.my_access() $$,
  $$ values (array['facilitator', 'assessor', 'moderator', 'coordinator']::text[]) $$,
  'roles come back in the documented order'
);

-- list_accounts and create_account refuse anyone who is not an administrator
reset role;
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_accounts() $$, 'a learner lists no accounts');
select results_eq(
  format($$ select status from api.create_account(%L, 'New Person', 'learner') $$, :'new_user'),
  $$ values ('forbidden'::text) $$,
  'a learner cannot create an account'
);
reset role;
select pg_temp.act_as(:'staff');
select results_eq(
  format($$ select status from api.create_account(%L, 'New Person', 'learner') $$, :'new_user'),
  $$ values ('forbidden'::text) $$,
  'a coordinator cannot create an account'
);

-- an administrator can
reset role;
select pg_temp.act_as(:'admin');
select ok((select count(*) from api.list_accounts()) >= 7, 'an administrator lists every account');
select results_eq(
  format($$ select status from api.create_account(%L, 'New Person', 'bogus') $$, :'new_user'),
  $$ values ('invalid_role'::text) $$,
  'an unknown role is refused'
);
select results_eq(
  format($$ select status, profile_id from api.create_account(%L, '  New Person ', 'learner', 'KSI-2026-9999') $$, :'new_user'),
  format($$ values ('ok'::text, %L::uuid) $$, :'new_user'),
  'an administrator creates an account'
);
select results_eq(
  format($$ select status from api.create_account(%L, 'New Person', 'learner') $$, :'new_user'),
  $$ values ('already_exists'::text) $$,
  'the same user cannot get a second profile'
);
select results_eq(
  format($$ select full_name, roles from api.list_accounts() where profile_id = %L $$, :'new_user'),
  $$ values ('New Person'::text, array['learner']::text[]) $$,
  'the new account has a trimmed name and its role'
);

reset role;

-- audit
select results_eq(
  format($$ select actor_id, action from audit.events where object_id = %L order by id $$, :'new_user'),
  format($$ values (%L::uuid, 'identity.account_created'::text), (%L::uuid, 'identity.role_assigned'::text) $$, :'admin', :'admin'),
  'account creation and role assignment are audited with the administrator as actor'
);
select throws_ok(
  $$ delete from audit.events $$,
  '42501', null,
  'audit events cannot be deleted'
);

-- role assignments
select throws_ok(
  format($$ insert into identity.role_assignments (profile_id, role) values (%L, 'learner') $$, :'new_user'),
  '23P01', null,
  'the same role and scope cannot overlap in time'
);
select lives_ok(
  format($$ insert into identity.role_assignments (profile_id, role, scope_type, scope_key)
            values (%L, 'learner', 'cohort', gen_random_uuid()) $$, :'new_user'),
  'the same role in a different scope is allowed'
);
select throws_ok(
  format($$ insert into identity.role_assignments (profile_id, role, scope_type) values (%L, 'assessor', 'cohort') $$, :'new_user'),
  '23514', null,
  'a scoped role needs its scope key'
);

-- a deactivated account keeps its history but loses its workspaces
update identity.profiles set status = 'deactivated', deactivated_at = now() where id = :'learner';
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  $$ select status, roles from api.my_access() $$,
  $$ values ('deactivated'::text, '{}'::text[]) $$,
  'a deactivated account has no current roles'
);

-- provisioning is for service_role only
reset role;
select ok(not has_function_privilege('authenticated', 'api.provision_account(uuid, text, text, text)', 'EXECUTE'),
  'a signed-in person cannot provision accounts');
select ok(not has_function_privilege('authenticated', 'api.provision_role(uuid, text)', 'EXECUTE'),
  'a signed-in person cannot provision roles');
select results_eq(
  format($$ select api.provision_role(%L, 'assessor'), api.provision_role(%L, 'assessor') $$, :'new_user', :'new_user'),
  $$ values ('ok'::text, 'already_held'::text) $$,
  'service provisioning adds a role once'
);

-- anonymous callers get nothing
reset role;
select ok(not has_function_privilege('anon', 'api.my_access()', 'EXECUTE'), 'anon cannot call my_access');

select * from finish();
rollback;
