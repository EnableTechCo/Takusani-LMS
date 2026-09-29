-- Freeze and sample (S4-06; FR-501 to FR-506; NFR-06; ADR-019): the population is claimed and digested, the sample
-- is drawn deterministically with mandatory inclusions, moderators are allocated with exclusions, a scheduled cycle
-- freezes by itself, and a retry or a race returns the same sample (transaction tests 5 and 14).
create extension if not exists pgtap with schema extensions;

begin;
select plan(31);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

create function pg_temp.held_result(p_learner uuid, p_name text, p_item uuid, p_assessor uuid, p_outcome text, p_decided_at timestamptz)
returns uuid language plpgsql as $$
declare
  v_result uuid;
  v_decision uuid;
begin
  if not exists (select 1 from identity.profiles where id = p_learner) then
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', p_learner, 'authenticated', 'authenticated',
            'pgtap.' || p_learner::text || '@takusani.test', now(), now());
    insert into identity.profiles (id, full_name) values (p_learner, p_name);
    insert into programmes.enrolments (cohort_id, profile_id) values ('10000000-0000-4000-8000-000000000010', p_learner);
  end if;
  insert into assessment.results (assessable_item_id, learner_id, state) values (p_item, p_learner, 'held')
  returning id into v_result;
  insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, created_at, remediation, resubmission_days)
  values (v_result, 'assessment', p_outcome, p_assessor, 'assessor', 'Judged against every criterion.', p_decided_at,
          case when p_outcome = 'not_yet_competent' then 'Add the retention schedule.' end,
          case when p_outcome = 'not_yet_competent' then 14 end)
  returning id into v_decision;
  update assessment.results set current_decision_id = v_decision where id = v_result;
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set moderator 00000000-0000-4000-8000-000000000004
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set cohort 10000000-0000-4000-8000-000000000010

update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = :'cohort';
insert into assessment.assessable_items (cohort_id, kind, task_id, title)
values (:'cohort', 'task', '10000000-0000-4000-8000-000000000020', 'Task 3: Workplace records portfolio');
select id as item3 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000020' \gset
insert into programmes.units (id, qualification_id, code, title)
values ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'U4', 'Communicate in the workplace');
insert into programmes.modules (id, programme_id, unit_id, code, title)
values ('10000000-0000-4000-8000-000000000044', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'M4', 'Business communication');
insert into submissions.tasks (id, cohort_id, module_id, title, brief, submission_type, state, published_at, due_at)
values ('10000000-0000-4000-8000-000000000024', :'cohort', '10000000-0000-4000-8000-000000000044',
        'Task 4: Business communication report', 'Write the report.', 'file_upload', 'published', now(), now() + interval '30 days'),
       ('10000000-0000-4000-8000-000000000025', :'cohort', '10000000-0000-4000-8000-000000000044',
        'Task 5: Presentation', 'Present it.', 'file_upload', 'published', now(), now() + interval '30 days');
insert into assessment.assessable_items (id, cohort_id, kind, task_id, title)
values ('10000000-0000-4000-8000-000000000124', :'cohort', 'task', '10000000-0000-4000-8000-000000000024', 'Task 4: Business communication report'),
       ('10000000-0000-4000-8000-000000000125', :'cohort', 'task', '10000000-0000-4000-8000-000000000025', 'Task 5: Presentation');
\set item4 10000000-0000-4000-8000-000000000124
\set item5 10000000-0000-4000-8000-000000000125

-- Nomsa (assessor@) has history: a signed-off cycle elsewhere lists a decision of hers, so she is not first-time.
insert into moderation.cycles (id, cohort_id, name, state, frozen_at, planned_by)
values ('90000000-0000-4000-8000-0000000000a1', :'cohort', 'Earlier cycle', 'signed_off', now() - interval '60 days', :'coordinator');
insert into moderation.populations (cycle_id, size, digest, basis)
values ('90000000-0000-4000-8000-0000000000a1', 1, repeat('a', 64),
        jsonb_build_array(jsonb_build_object('result_id', gen_random_uuid(), 'assessor_id', :'assessor', 'outcome', 'competent')));
update moderation.cycle_scope set open = false where cycle_id = '90000000-0000-4000-8000-0000000000a1';

-- Six results waiting: four Competent by Nomsa on Task 3, one Not yet competent by Zanele on Task 3, one by Nomsa on Task 4.
select pg_temp.held_result(:'learner', 'Lerato Mokoena', :'item3', :'assessor', 'competent', now() - interval '4 days') as r1 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000101', 'Sipho Dlamini', :'item3', :'assessor', 'competent', now() - interval '3 days') as r2 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000102', 'Naledi Botha', :'item3', :'staff', 'not_yet_competent', now() - interval '2 days') as r3 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000103', 'Kagiso Mahlangu', :'item3', :'assessor', 'competent', now() - interval '1 day') as r4 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000104', 'Bongani Sithole', :'item3', :'assessor', 'competent', now() - interval '12 hours') as r5 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000101', 'Sipho Dlamini', :'item4', :'assessor', 'competent', now() - interval '3 hours') as r6 \gset

-- A scheduled cycle over both assignments, and one with nothing to freeze
select pg_temp.act_as(:'coordinator');
select cycle_id as cycle from api.plan_moderation_cycle(:'cohort', 'Term 3 assignments', array[:'item3', :'item4']::uuid[], '{}', null, null, now() + interval '1 minute') \gset
select cycle_id as empty_cycle from api.plan_moderation_cycle(:'cohort', 'Nothing yet', array[:'item5']::uuid[]) \gset

select results_eq(format($$ select status from api.freeze_moderation_cycle(%L, 2) $$, :'cycle'),
  $$ values ('stale_version'::text) $$, 'freezing checks the version');
select results_eq(format($$ select status from api.freeze_moderation_cycle(%L, 1) $$, :'empty_cycle'),
  $$ values ('nothing_to_freeze'::text) $$, 'a cycle with nothing waiting in scope cannot be frozen');
reset role;
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.freeze_moderation_cycle(%L, 1) $$, :'cycle'),
  $$ values ('not_found'::text) $$, 'someone outside the cohort''s coordinators cannot freeze it');
reset role;

-- The scheduler freezes it at its start (FR-501)
select is(moderation.freeze_due_cycles(), 0, 'before its start, the scheduler leaves a cycle alone');
update moderation.cycles set scheduled_start_at = now() - interval '1 minute' where id = :'cycle';
select is(moderation.freeze_due_cycles(), 1, 'at its start, the scheduler freezes it');
select results_eq(
  format($$ select job_name, status, processed from audit.scheduled_runs where object_key = %L $$, :'cycle'),
  $$ values ('freeze-moderation-cycle'::text, 'succeeded'::text, 6) $$, 'as a one-shot run that records the population size');
select results_eq(format($$ select state, version from moderation.cycles where id = %L $$, :'cycle'),
  $$ values ('frozen'::text, 2) $$, 'the cycle is frozen');
select is(moderation.freeze_due_cycles(), 0, 'and the scheduler does not freeze it twice');

-- The population (FR-506, FR-505)
select results_eq(
  format($$ select size, frozen_by, digest ~ '^[0-9a-f]{64}$', jsonb_array_length(basis) from moderation.populations where cycle_id = %L $$, :'cycle'),
  $$ values (6, null::uuid, true, 6) $$, 'six results are the population, digested, with their basis; the scheduler has no actor');
select results_eq(
  format($$ select count(*) from assessment.results where hold_cycle_id = %L $$, :'cycle'),
  $$ values (6::bigint) $$, 'every one of them is held in the cycle');
select results_eq(
  format($$ select digest = encode(extensions.digest((select string_agg(id::text, ',' order by id) from assessment.results where hold_cycle_id = %L), 'sha256'), 'hex')
            from moderation.populations where cycle_id = %L $$, :'cycle', :'cycle'),
  $$ values (true) $$, 'the digest is the sha256 of the result ids in order');
select results_eq(
  format($$ select (e ->> 'first_time')::boolean, e ->> 'assessor_name' from moderation.populations pp, jsonb_array_elements(pp.basis) e
            where pp.cycle_id = %L and (e ->> 'result_id')::uuid = %L $$, :'cycle', :'r3'),
  $$ values (true, 'Zanele Khumalo'::text) $$, 'Zanele is a first-time assessor: no decision of hers is in a signed-off cycle');
select results_eq(
  format($$ select (e ->> 'first_time')::boolean from moderation.populations pp, jsonb_array_elements(pp.basis) e
            where pp.cycle_id = %L and (e ->> 'result_id')::uuid = %L $$, :'cycle', :'r1'),
  $$ values (false) $$, 'Nomsa is not: the earlier signed-off cycle holds a decision of hers');

-- The sample (FR-502, FR-503): every NYC, then 10% of each stratum of the rest, rounded up
select results_eq(
  format($$ select mandatory_nyc, mandatory_first_time, random_draw, percentage, rule_version, algorithm_version, population_digest = pp.digest
            from moderation.samples s join moderation.populations pp on pp.cycle_id = s.cycle_id where s.cycle_id = %L $$, :'cycle'),
  $$ values (1, 0, 2, 10, 1, '1'::text, true) $$,
  'one Not yet competent, no first-time inclusions beyond it, and one from each of the two Competent strata');
select results_eq(
  format($$ select inclusion_reason, stratum from moderation.sample_items where cycle_id = %L and result_id = %L $$, :'cycle', :'r3'),
  $$ values ('nyc'::text, 'Not yet competent'::text) $$, 'the Not yet competent decision is in, as mandatory');
select results_eq(
  format($$ select e ->> 'stratum', (e ->> 'population')::int, (e ->> 'sampled')::int from moderation.samples s, jsonb_array_elements(s.strata) e
            where s.cycle_id = %L order by (e ->> 'population')::int desc $$, :'cycle'),
  $$ values ('Nomsa Dlamini · Competent · Unit U3'::text, 4, 1), ('Not yet competent'::text, 1, 1), ('Nomsa Dlamini · Competent · Unit U4'::text, 1, 1) $$,
  'the strata record says how each stratum was drawn');
select results_eq(
  format($$ select si.result_id from moderation.sample_items si where si.cycle_id = %L and si.stratum = 'Nomsa Dlamini · Competent · Unit U3' $$, :'cycle'),
  format($$ select r.id from assessment.results r join moderation.samples s on s.cycle_id = %L
            where r.hold_cycle_id = %L and r.assessable_item_id = %L and r.id <> %L
            order by md5(s.seed || r.id::text), r.id limit 1 $$, :'cycle', :'cycle', :'item3', :'r3'),
  'the random pick is the first lot by md5(seed, result id): the same seed always gives the same item (FR-505)');

-- Allocation (FR-504): in turn among the cohort's moderators, never to one who assessed the result
select results_eq(
  format($$ select p.full_name from moderation.sample_items si join identity.profiles p on p.id = si.moderator_id
            where si.cycle_id = %L and si.result_id = %L $$, :'cycle', :'r3'),
  $$ values ('Thabo Nkosi'::text) $$, 'Zanele assessed the Not yet competent result, so Thabo moderates it');
select results_eq(
  format($$ select count(*) filter (where moderator_id is not null), count(distinct moderator_id) from moderation.sample_items where cycle_id = %L $$, :'cycle'),
  $$ values (3::bigint, 2::bigint) $$, 'every sampled item is allocated, shared between the two moderators');

-- What the coordinator reads
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select frozen_by_name, population, sample_size, mandatory_nyc, random_draw, unallocated, jsonb_array_length(allocations), jsonb_array_length(strata)
            from api.get_moderation_sample(%L) $$, :'cycle'),
  $$ values (null::text, 6, 3, 1, 2, 0, 2, 3) $$, 'the sample record: the population, the draw, who holds the items');
select results_eq(
  format($$ select state, held, sampled from api.list_moderation_cycles(%L) where id = %L $$, :'cohort', :'cycle'),
  $$ values ('frozen'::text, 6, 3) $$, 'the cycles list says how many are held and sampled');
select results_eq(
  format($$ select waiting, held from api.get_moderation_pool(%L) where item_id = %L $$, :'cohort', :'item3'),
  $$ values (0, 5) $$, 'the pool shows the assignment''s results held, none waiting');

-- A retry, and a coordinator racing the scheduler, get the same sample (transaction tests 5 and 14)
select results_eq(format($$ select status, population, sample from api.freeze_moderation_cycle(%L, 2, 'another seed') $$, :'cycle'),
  $$ values ('ok'::text, 6, 3) $$, 'freezing a frozen cycle answers with the sample it has');
reset role;
select results_eq(
  format($$ select count(*), (select seed from moderation.samples where cycle_id = %L) <> 'another seed' from moderation.sample_items where cycle_id = %L $$, :'cycle', :'cycle'),
  $$ values (3::bigint, true) $$, 'nothing was redrawn and the seed did not change');

-- A result decided after the freeze waits for the next cycle (transaction test 13)
select pg_temp.held_result('00000000-0000-4000-8000-000000000105', 'Late Learner', :'item3', :'assessor', 'competent', now()) as r7 \gset
select results_eq(format($$ select hold_cycle_id is null, moderation.is_waiting(r) from assessment.results r where r.id = %L $$, :'r7'),
  $$ values (true, true) $$, 'a result decided after the freeze is not in the population and waits');
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select waiting, held, open_cycle_state from api.get_moderation_pool(%L) where item_id = %L $$, :'cohort', :'item3'),
  $$ values (1, 5, 'frozen'::text) $$, 'the pool says so, and that the open cycle over the item is already frozen');
select results_eq(format($$ select status from api.cancel_moderation_cycle(%L, 2, 'Too late') $$, :'cycle'),
  $$ values ('not_planned'::text) $$, 'a frozen cycle cannot be cancelled');
reset role;

-- The scheduler and the audit trail
select is(moderation.freeze_due_cycles(), 0, 'a scheduled cycle with nothing to freeze is left alone');
select results_eq(
  format($$ select details ->> 'scheduled', (details ->> 'population')::int, (details ->> 'sample')::int, acting_role
            from audit.events where action = 'moderation.cycle_frozen' and object_id = %L $$, :'cycle'),
  $$ values ('true'::text, 6, 3, 'system'::text) $$, 'the freeze is one audit event, marked as the scheduler''s');
select results_eq(
  $$ select jobname, schedule from cron.job where jobname = 'freeze-due-moderation-cycles' $$,
  $$ values ('freeze-due-moderation-cycles'::text, '* * * * *'::text) $$, 'the recurring job runs every minute');
select throws_like(
  format($$ update moderation.populations set size = 7 where cycle_id = %L $$, :'cycle'),
  '%append-only%', 'the population cannot be changed');

select * from finish();
rollback;
