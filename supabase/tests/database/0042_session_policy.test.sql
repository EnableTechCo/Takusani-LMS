-- Signing out after inactivity (S4-14; A11Y-07): the setting and the read the app uses.
create extension if not exists pgtap with schema extensions;

begin;
select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set admin 00000000-0000-4000-8000-000000000006

select results_eq(
  $$ select value_type, unit_label, min_value, max_value, in_use from audit.configuration_keys
     where key = 'identity.session.idle_minutes' $$,
  $$ values ('integer'::text, 'minutes'::text, 5, 480, true) $$,
  'the inactivity limit is a versioned setting, in minutes, from 5 to 480, in use');
select is(audit.config_int('identity.session.idle_minutes'), 30, 'it starts at 30 minutes, as the product owner set');

select pg_temp.act_as(:'learner');
select results_eq($$ select idle_minutes from api.get_session_policy() $$, $$ values (30) $$,
  'anyone signed in reads the limit that applies to them');
reset role;

select pg_temp.act_as(:'admin');
select is(status, 'ok', 'an administrator changes it, with a reason')
from api.record_configuration_version('identity.session.idle_minutes', '45', current_date, 'Longer marking sessions.');
reset role;
select pg_temp.act_as(:'learner');
select results_eq($$ select idle_minutes from api.get_session_policy() $$, $$ values (45) $$,
  'and the new limit applies at once');
reset role;

select pg_temp.act_as(:'admin');
select is(status, 'invalid_value', 'a limit under five minutes is refused')
from api.record_configuration_version('identity.session.idle_minutes', '2', current_date, 'Too short.');
reset role;

select set_config('request.jwt.claims', '', true);
set local role authenticated;
select is_empty($$ select * from api.get_session_policy() $$, 'without a user, nothing');

select * from finish();
rollback;
