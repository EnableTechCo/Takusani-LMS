-- Audit log (S1-14, X-09): what an identity change records, and who can read the log.
create extension if not exists pgtap with schema extensions;

begin;
select plan(10);

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

select pg_temp.new_auth_user('audit.person@takusani.test') as new_user \gset

reset role;
select pg_temp.act_as(:'admin');
select results_eq(
  format($$ select status from api.create_account(%L, 'Audit Person', 'assessor') $$, :'new_user'),
  $$ values ('ok'::text) $$,
  'an administrator creates an account'
);

reset role;
select results_eq(
  format($$ select action, acting_role, scope_type from audit.events where object_id = %L order by id $$, :'new_user'),
  $$ values ('identity.account_created'::text, 'administrator'::text, 'global'::text),
            ('identity.role_assigned'::text, 'administrator'::text, 'global'::text) $$,
  'each change records the acting role and scope'
);
select results_eq(
  format($$ select after ->> 'full_name', after ->> 'status', before from audit.events
            where object_id = %L and action = 'identity.account_created' $$, :'new_user'),
  $$ values ('Audit Person'::text, 'active'::text, null::jsonb) $$,
  'account creation records the new values and no before'
);
select results_eq(
  format($$ select after ->> 'role' from audit.events where object_id = %L and action = 'identity.role_assigned' $$, :'new_user'),
  $$ values ('assessor'::text) $$,
  'a role assignment records the role'
);

-- the log: administrators only
reset role;
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_audit_events() $$, 'a learner sees no audit entries');

reset role;
select pg_temp.act_as(:'admin');
select results_eq(
  format($$ select actor_email, object_label from api.list_audit_events(p_object_id => %L) limit 1 $$, :'new_user'),
  $$ values ('admin@takusani.test'::text, 'Audit Person'::text) $$,
  'an administrator sees who acted and on whom'
);
select results_eq(
  format($$ select count(*)::int from api.list_audit_events(p_action => 'identity.role_assigned', p_object_id => %L) $$, :'new_user'),
  $$ values (1) $$,
  'entries filter by action'
);
select results_eq(
  format($$ select count(*)::int from api.list_audit_events(p_actor_email => ' ADMIN@takusani.test ', p_object_id => %L) $$, :'new_user'),
  $$ values (2) $$,
  'entries filter by the actor''s email, ignoring case and spaces'
);
select results_eq(
  $$ select count(*)::int from api.list_audit_events(p_before_id => (select min(id) from api.list_audit_events())) $$,
  $$ values (0) $$,
  'paging past the oldest entry returns nothing'
);

reset role;
select throws_ok(
  $$ update audit.events set action = 'identity.tampered' $$,
  '42501', null,
  'audit entries cannot be changed'
);

select * from finish();
rollback;
