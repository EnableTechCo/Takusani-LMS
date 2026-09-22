-- Programmes, cohorts and enrolments (S1-16): who can create what, scoped coordination, and enrolment rules.
-- Uses the local seed: coordinator@ (global coordinator), learner@, staff@, and the CBA-NQF4 programme.
create extension if not exists pgtap with schema extensions;

begin;
select plan(24);

-- Switch to a signed-in user. Call only as postgres: `reset role` first, since authenticated cannot run it.
create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A person with one coordinator role in a given scope (as postgres).
create function pg_temp.new_coordinator(p_email text, p_scope identity.scope_type, p_key uuid) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email, now(), now());
  insert into identity.profiles (id, full_name) values (v_id, p_email);
  insert into identity.role_assignments (profile_id, role, scope_type, scope_key) values (v_id, 'coordinator', p_scope, p_key);
  return v_id;
end $$;

\set coordinator 00000000-0000-4000-8000-000000000005
\set learner 00000000-0000-4000-8000-000000000001
\set programme 10000000-0000-4000-8000-000000000001
\set seed_cohort 10000000-0000-4000-8000-000000000010

-- programmes: global coordinators only
reset role;
select pg_temp.act_as(:'learner');
select results_eq($$ select status from api.create_programme('NEW-1', 'A programme') $$, $$ values ('forbidden'::text) $$,
  'a learner cannot create a programme');
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq($$ select status from api.create_programme('bad code!', 'A programme') $$, $$ values ('invalid_code'::text) $$,
  'a programme code is upper case letters, digits and dashes');
select results_eq($$ select status from api.create_programme('ops-2027', 'Operations', 5::smallint) $$, $$ values ('ok'::text) $$,
  'a global coordinator creates a programme (the code is upper-cased)');
select results_eq($$ select status from api.create_programme('OPS-2027', 'Again') $$, $$ values ('code_taken'::text) $$,
  'programme codes are unique');
select (select programme_id from api.create_programme('OTHER-1', 'Other programme')) as other_programme \gset

-- qualifications, units with a versioned credit value, modules
select (select qualification_id from api.create_qualification(:'programme', 'Q-2', 'Second qualification')) as qualification \gset
select results_eq(
  format($$ select status from api.create_unit(%L, 'U9', 'Unit nine', 8) $$, :'qualification'),
  $$ values ('ok'::text) $$, 'a coordinator creates a unit');
reset role;
select results_eq(
  format($$ select c.credits from programmes.unit_credit_values c join programmes.units u on u.id = c.unit_id
            where u.qualification_id = %L and u.code = 'U9' $$, :'qualification'),
  $$ values (8) $$, 'the unit credit value is recorded as a versioned entry');
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select status from api.create_unit(%L, 'U10', 'Unit ten', -1) $$, :'qualification'),
  $$ values ('invalid_credits'::text) $$, 'credits cannot be negative');
select results_eq(
  format($$ select status from api.create_module(%L, 'M9', 'Module', '10000000-0000-4000-8000-000000000003') $$, :'other_programme'),
  $$ values ('unit_not_in_programme'::text) $$, 'a module can only link a unit of its own programme');

-- cohorts
select results_eq(
  format($$ select status from api.create_cohort(%L, '2027 Intake A', '2027-02-01', '2027-01-01') $$, :'programme'),
  $$ values ('invalid_dates'::text) $$, 'a cohort cannot end before it starts');
select (select cohort_id from api.create_cohort(:'programme', '2027 Intake A', '2027-02-01', '2027-12-15')) as cohort \gset
reset role;
select results_eq(
  format($$ select moderation_policy, policy_version from programmes.cohort_moderation_state where cohort_id = %L $$, :'cohort'),
  $$ values ('not_moderated'::text, 1) $$, 'every new cohort has its moderation policy row, not moderated at go-live');
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select status from api.create_cohort(%L, '2027 Intake A', '2027-02-01', '2027-12-15') $$, :'programme'),
  $$ values ('name_taken'::text) $$, 'cohort names are unique within a programme');

-- scope: a coordinator for one programme, and one for one cohort
reset role;
select pg_temp.new_coordinator('programme.coordinator@takusani.test', 'programme', :'programme') as scoped \gset
select pg_temp.new_coordinator('cohort.coordinator@takusani.test', 'cohort', :'seed_cohort') as cohort_only \gset
select pg_temp.act_as(:'scoped');
select results_eq($$ select status from api.create_programme('NOPE-1', 'Not allowed') $$, $$ values ('forbidden'::text) $$,
  'a programme-scoped coordinator cannot create programmes');
select results_eq(
  format($$ select status from api.create_cohort(%L, '2027 Intake B', '2027-02-01', '2027-12-15') $$, :'programme'),
  $$ values ('ok'::text) $$, 'a programme-scoped coordinator creates cohorts in their programme');
select results_eq(
  format($$ select status from api.create_cohort(%L, 'Elsewhere', '2027-02-01', '2027-12-15') $$, :'other_programme'),
  $$ values ('forbidden'::text) $$, 'but not in another programme');
select ok((select bool_and(programme_id = :'programme'::uuid) from api.list_cohorts()),
  'a programme-scoped coordinator lists only cohorts of that programme');
reset role;
select pg_temp.act_as(:'cohort_only');
select results_eq($$ select count(*)::int from api.list_cohorts() $$, $$ values (1) $$,
  'a cohort-scoped coordinator lists only their cohort');
select results_eq(
  format($$ select status from api.enrol_learner(%L, 'learner@takusani.test') $$, :'cohort'),
  $$ values ('forbidden'::text) $$, 'and cannot enrol learners in another cohort');

-- enrolment
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.enrol_learner(%L, 'nobody@takusani.test') $$, :'cohort'),
  $$ values ('account_not_found'::text) $$, 'enrolling an unknown email is refused');
select results_eq(format($$ select status from api.enrol_learner(%L, 'staff@takusani.test') $$, :'cohort'),
  $$ values ('not_a_learner'::text) $$, 'only learners can be enrolled');
select results_eq(format($$ select status from api.enrol_learner(%L, ' LEARNER@takusani.test ') $$, :'cohort'),
  $$ values ('ok'::text) $$, 'a coordinator enrols a learner by email, ignoring case and spaces');
select results_eq(format($$ select status from api.enrol_learner(%L, 'learner@takusani.test') $$, :'cohort'),
  $$ values ('already_enrolled'::text) $$, 'the same learner is not enrolled twice');
select results_eq(format($$ select full_name, status from api.list_enrolments(%L) $$, :'cohort'),
  $$ values ('Lerato Mokoena'::text, 'active'::text) $$, 'the cohort lists its enrolled learner');

reset role;
select results_eq(
  format($$ select acting_role, scope_type, scope_key, after ->> 'status' from audit.events
            where action = 'programmes.learner_enrolled' and scope_key = %L $$, :'cohort'),
  format($$ values ('coordinator'::text, 'cohort'::text, %L::uuid, 'active'::text) $$, :'cohort'),
  'enrolment is audited with the acting role and the cohort as scope');

select pg_temp.act_as(:'learner');
select is_empty(format($$ select * from api.list_enrolments(%L) $$, :'cohort'), 'a learner cannot list the enrolments of a cohort');

select * from finish();
rollback;
