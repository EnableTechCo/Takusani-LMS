-- Versioned configuration (S3-09; FR-108, FR-109, NFR-09). Uses the local seed: admin@, coordinator@, the learner
-- and the seeded unit.
create extension if not exists pgtap with schema extensions;

begin;
select plan(34);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set coordinator 00000000-0000-4000-8000-000000000005
\set admin 00000000-0000-4000-8000-000000000006

-- The values in use until now are version 1 of each setting
select is(audit.config_int('appeal.window_days'), 7, 'the appeal window starts at 7 days');
select is(audit.config_int('upload.max_mb'), 25, 'the largest upload starts at 25 MB');
select is(audit.config_text('submission.late_policy'), 'accept_and_flag', 'late work is accepted and marked by default');
select is((select count(*)::int from audit.configuration_keys k
            where not exists (select 1 from audit.configuration_versions v where v.key = k.key and v.version = 1)), 0,
  'every setting has a first version');

-- Recording a change (FR-109): value, previous value, effective time, who and why
select pg_temp.act_as(:'coordinator');
select is(status, 'forbidden', 'only an administrator changes configuration')
from api.record_configuration_version('appeal.window_days', '10', current_date, 'Policy change.');
reset role;
select pg_temp.act_as(:'admin');
select is(status, 'invalid_value', 'a value outside the allowed range is refused')
from api.record_configuration_version('appeal.window_days', '45', current_date, 'Policy change.');
select is(status, 'invalid_value', 'so is a choice that does not exist')
from api.record_configuration_version('submission.late_policy', 'shrug', current_date, 'Policy change.');
select is(status, 'invalid_date', 'a change cannot take effect in the past')
from api.record_configuration_version('appeal.window_days', '10', current_date - 1, 'Policy change.');
select is(status, 'reason_required', 'a reason is required')
from api.record_configuration_version('appeal.window_days', '10', current_date, '  ');
select is(status, 'unchanged', 'recording the value already in force changes nothing')
from api.record_configuration_version('appeal.window_days', '7', current_date, 'Same again.');
select is(status, 'not_found', 'an unknown setting is refused')
from api.record_configuration_version('nothing.here', '1', current_date, 'Policy change.');

select results_eq(
  $$ select status, version from api.record_configuration_version('appeal.window_days', '10', current_date,
       'Academic board decision AB/2026/14: ten days from 2027.') $$,
  $$ values ('ok'::text, 2) $$, 'an immediate change is recorded as version 2');
reset role;
select results_eq(
  $$ select value, previous_value, recorded_by, reason from audit.configuration_versions
     where key = 'appeal.window_days' and version = 2 $$,
  $$ values ('10'::jsonb, '7'::jsonb, '00000000-0000-4000-8000-000000000006'::uuid,
             'Academic board decision AB/2026/14: ten days from 2027.'::text) $$,
  'with the previous value, who recorded it and why');
select is(audit.config_int('appeal.window_days'), 10, 'and it is in force at once');
select is((select count(*)::int from audit.events where action = 'audit.configuration_changed' and object_id = 'appeal.window_days'), 1,
  'the change is audited');
select throws_ok($$ update audit.configuration_versions set value = '8' where key = 'appeal.window_days' $$, '42501', null,
  'a version can never be edited (NFR-09)');

-- A change never reaches back: a deadline uses the window in force at the moment of release
select is(assessment.appeal_deadline('2026-09-01 12:00:00+02'::timestamptz), '2026-09-09 00:00:00+02'::timestamptz,
  'a result released before the change keeps its seven days');
select ok(assessment.appeal_deadline(now()) >= ((now() at time zone 'Africa/Johannesburg')::date + 11)::timestamp at time zone 'Africa/Johannesburg',
  'a result released now gets the ten days in force now');

-- Scheduling and cancelling a later change
select pg_temp.act_as(:'admin');
select results_eq(
  $$ select status, version, effective_from = ((current_date + 10)::text || ' 00:00')::timestamp at time zone 'Africa/Johannesburg'
     from api.record_configuration_version('upload.max_mb', '20', current_date + 10, 'Storage review SR-3.') $$,
  $$ values ('ok'::text, 2, true) $$, 'a change can be scheduled for the start of a later day');
reset role;
select is(audit.config_int('upload.max_mb'), 25, 'until then the value in force is unchanged');
select is(audit.config_int('upload.max_mb', now() + interval '11 days'), 20, 'and from that day the new value applies');
select pg_temp.act_as(:'admin');
select is(status, 'change_already_scheduled', 'only one change can be waiting at a time')
from api.record_configuration_version('upload.max_mb', '15', current_date + 20, 'Another review.');
select is(status, 'ok', 'a scheduled change can be cancelled before it takes effect')
from api.cancel_configuration_version('upload.max_mb', 2, 'Review withdrawn.');
select is(status, 'already_cancelled', 'and cancelled only once') from api.cancel_configuration_version('upload.max_mb', 2, 'Again.');
select is(status, 'already_in_force', 'a change in force cannot be cancelled')
from api.cancel_configuration_version('appeal.window_days', 2, 'Too late.');
reset role;
select is(audit.config_int('upload.max_mb', now() + interval '11 days'), 25, 'the cancelled change never takes effect');

-- The sign-in limits come from configuration too
select pg_temp.act_as(:'admin');
select is(status, 'ok', 'the administrator lowers the wrong-password limit to 3')
from api.record_configuration_version('identity.lockout.max_failures', '3', current_date, 'Security review SEC-7.');
reset role;
select is((select max_failures from identity.lockout_policy()), 3, 'and the sign-in handler counts to 3 from now');

-- Credit values per unit: effective-dated, with a reason
select id as unit from programmes.units limit 1 \gset
select pg_temp.act_as(:'admin');
select is(status, 'ok', 'a unit''s credit value changes from today')
from api.set_unit_credit_value(:'unit', 13, current_date, 'SAQA registration update 2026.');
select results_eq(format($$ select credits, set_by_name from api.list_unit_credit_values() where unit_id = %L $$, :'unit'),
  $$ values (13, 'Sipho Mahlangu'::text) $$, 'the value in force shows who set it');
select is(status, 'unchanged', 'the same value again changes nothing')
from api.set_unit_credit_value(:'unit', 13, current_date, 'Again.');

-- Reads
reset role;
select pg_temp.act_as(:'admin');
select results_eq(
  $$ select value, version, in_use from api.list_configuration() where key = 'appeal.window_days' $$,
  $$ values ('10'::jsonb, 2, true) $$, 'the administrator lists each setting with its value and version');
select results_eq(
  $$ select jsonb_array_length(versions), versions -> 0 ->> 'state', versions -> 1 ->> 'state'
     from api.get_configuration_key('upload.max_mb') $$,
  $$ values (2, 'cancelled'::text, 'in_force'::text) $$, 'and each version with its state');
reset role;
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_configuration() $$, 'nobody else reads the configuration');

select * from finish();
rollback;
