-- Moderation cycles (S4-05; FR-501, FR-506; ADR-019; P-02): planning with an explicit scope, one open cycle per
-- item, cancelling only while planned, and the pending pool. Uses the local seed: coordinator@ covers "2026 Intake B",
-- which has one assignment (Task 3) in unit U3; a second unit and assignment are added here.
create extension if not exists pgtap with schema extensions;

begin;
select plan(30);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A learner with a decided, held result for an item: the pending pool as finalisation leaves it in a moderated cohort.
create function pg_temp.held_result(p_learner uuid, p_name text, p_item uuid, p_assessor uuid, p_decided_at timestamptz)
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
  insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, created_at)
  values (v_result, 'assessment', 'competent', p_assessor, 'assessor', 'Meets every criterion.', p_decided_at)
  returning id into v_decision;
  update assessment.results set current_decision_id = v_decision where id = v_result;
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set cohort 10000000-0000-4000-8000-000000000010
\set unit3 10000000-0000-4000-8000-000000000003
-- The seeded assignment has no assessable item until someone hands in; give it one, as a submission would.
insert into assessment.assessable_items (cohort_id, kind, task_id, title)
values (:'cohort', 'task', '10000000-0000-4000-8000-000000000020', 'Task 3: Workplace records portfolio');
select id as item3 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000020' \gset

-- A second unit with its own assignment, so scope by unit can be told apart from scope by item.
insert into programmes.units (id, qualification_id, code, title)
values ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'U4', 'Communicate in the workplace');
insert into programmes.modules (id, programme_id, unit_id, code, title)
values ('10000000-0000-4000-8000-000000000044', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'M4', 'Business communication');
insert into submissions.tasks (id, cohort_id, module_id, title, brief, submission_type, state, published_at, due_at)
values ('10000000-0000-4000-8000-000000000024', :'cohort', '10000000-0000-4000-8000-000000000044',
        'Task 4: Business communication report', 'Write the report.', 'file_upload', 'published', now(),
        now() + interval '30 days');
insert into assessment.assessable_items (id, cohort_id, kind, task_id, title)
values ('10000000-0000-4000-8000-000000000124', :'cohort', 'task', '10000000-0000-4000-8000-000000000024',
        'Task 4: Business communication report');
\set item4 10000000-0000-4000-8000-000000000124
\set unit4 10000000-0000-4000-8000-000000000004

-- Not moderated yet: nothing can be planned
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.plan_moderation_cycle(%L, 'Term 3', array[%L]::uuid[]) $$, :'cohort', :'item3'),
  $$ values ('not_moderated'::text) $$, 'a cycle needs a moderated cohort');
reset role;

update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = :'cohort';
select pg_temp.held_result(:'learner', 'Lerato Mokoena', :'item3', :'assessor', now() - interval '4 days') as r1 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000101', 'Sipho Dlamini', :'item3', :'assessor', now() - interval '2 days') as r2 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000102', 'Naledi Botha', :'item3', :'staff', now() - interval '1 day') as r3 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000101', 'Sipho Dlamini', :'item4', :'assessor', now() - interval '3 hours') as r4 \gset

-- Refusals, in words
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.plan_moderation_cycle(%L, 'Term 3', array[%L]::uuid[]) $$, :'cohort', :'item3'),
  $$ values ('forbidden'::text) $$, 'a learner cannot plan a cycle');
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.plan_moderation_cycle(%L, '  ', array[%L]::uuid[]) $$, :'cohort', :'item3'),
  $$ values ('invalid_name'::text) $$, 'a cycle needs a name');
select results_eq(format($$ select status from api.plan_moderation_cycle(%L, 'Term 3', array[gen_random_uuid()]::uuid[]) $$, :'cohort'),
  $$ values ('unknown_item'::text) $$, 'the items must be the cohort''s own');
select results_eq(format($$ select status from api.plan_moderation_cycle(%L, 'Term 3', '{}', array[gen_random_uuid()]::uuid[]) $$, :'cohort'),
  $$ values ('unknown_unit'::text) $$, 'and the units the programme''s own');
select results_eq(format($$ select status from api.plan_moderation_cycle(%L, 'Term 3') $$, :'cohort'),
  $$ values ('empty_scope'::text) $$, 'a scope cannot be empty');
select results_eq(format($$ select status from api.plan_moderation_cycle(%L, 'Term 3', array[%L]::uuid[], '{}', '2026-10-01', '2026-09-01') $$, :'cohort', :'item3'),
  $$ values ('invalid_period'::text) $$, 'a period runs forwards');
select results_eq(format($$ select status from api.plan_moderation_cycle(%L, 'Term 3', array[%L]::uuid[], '{}', null, null, now() - interval '1 hour') $$, :'cohort', :'item3'),
  $$ values ('start_in_past'::text) $$, 'a scheduled start is in the future');

-- Planning by item, then by unit
select cycle_id as term3 from api.plan_moderation_cycle(:'cohort', 'Term 3 assignments', array[:'item3']::uuid[], '{}', null, null, now() + interval '7 days') \gset
select ok(:'term3' is not null, 'a cycle is planned by item, with a scheduled start');
select results_eq(
  format($$ select status, conflict_item_title, conflict_cycle_name, conflict_cycle_state from api.plan_moderation_cycle(%L, 'Again', array[%L]::uuid[]) $$, :'cohort', :'item3'),
  $$ values ('scope_overlap'::text, 'Task 3: Workplace records portfolio'::text, 'Term 3 assignments'::text, 'planned'::text) $$,
  'an item in an open cycle cannot join another: the reply names the item and the cycle');
select results_eq(
  format($$ select status, conflict_cycle_name from api.plan_moderation_cycle(%L, 'Unit 3', '{}', array[%L]::uuid[]) $$, :'cohort', :'unit3'),
  $$ values ('scope_overlap'::text, 'Term 3 assignments'::text) $$, 'nor can its whole unit');
select cycle_id as unit4cycle from api.plan_moderation_cycle(:'cohort', 'Unit 4 in full', '{}', array[:'unit4']::uuid[], '2026-09-01', null) \gset
select ok(:'unit4cycle' is not null, 'a cycle is planned by whole unit, with a period from');
select results_eq(
  format($$ select status, conflict_cycle_name from api.plan_moderation_cycle(%L, 'Task 4 alone', array[%L]::uuid[]) $$, :'cohort', :'item4'),
  $$ values ('scope_overlap'::text, 'Unit 4 in full'::text) $$, 'an item covered through its unit is covered');

-- What the planning page reads
select results_eq(
  format($$ select name, state, waiting, held, items ->> 0 is not null, (items -> 0 ->> 'via_unit_id') is not null
            from api.list_moderation_cycles(%L) order by planned_at $$, :'cohort'),
  $$ values ('Term 3 assignments'::text, 'planned'::text, 3, 0, true, false),
            ('Unit 4 in full'::text, 'planned'::text, 1, 0, true, true) $$,
  'the cycles say how many waiting results they would claim now, and how each item came in');
select results_eq(
  format($$ select title, waiting, held, released, open_cycle_name, assessors from api.get_moderation_pool(%L) order by title $$, :'cohort'),
  $$ values ('Task 3: Workplace records portfolio'::text, 3, 0, 0, 'Term 3 assignments'::text,
             '[{"name": "Nomsa Dlamini", "count": 2}, {"name": "Zanele Khumalo", "count": 1}]'::jsonb),
            ('Task 4: Business communication report'::text, 1, 0, 0, 'Unit 4 in full'::text,
             '[{"name": "Nomsa Dlamini", "count": 1}]'::jsonb) $$,
  'the pool shows waiting results by item, who decided them, and the cycle that covers the item');
select results_eq(
  format($$ select moderation_policy, max_hold_days, sampling_percentage, sampling_rule, waiting, held, planned_cycles, frozen_cycles,
            oldest_waiting_at < now() - interval '3 days' from api.get_moderation_summary(%L) $$, :'cohort'),
  $$ values ('moderated'::text, 21, 10, 'stratified'::text, 4, 0, 2, 0, true) $$,
  'the summary carries the settings in force and the pool''s size and age');
reset role;
select results_eq(
  $$ select count(*) from audit.events where action = 'moderation.cycle_planned' $$,
  $$ values (2::bigint) $$, 'each planned cycle is an audit event');
select throws_like(
  format($$ insert into moderation.cycle_scope (cycle_id, assessable_item_id) values (%L, %L) $$, :'unit4cycle', :'item3'),
  '%cycle_scope_one_open_per_item%', 'the database itself refuses a second open cycle for an item');

-- Cancelling: only while planned, with a reason; the results stay waiting
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.cancel_moderation_cycle(%L, 1, 'Not needed') $$, :'term3'),
  $$ values ('not_found'::text) $$, 'someone outside the cohort''s coordinators does not see the cycle');
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.cancel_moderation_cycle(%L, 2, 'Not needed') $$, :'term3'),
  $$ values ('stale_version'::text) $$, 'cancelling checks the version');
select results_eq(format($$ select status from api.cancel_moderation_cycle(%L, 1, ' ') $$, :'term3'),
  $$ values ('reason_required'::text) $$, 'and needs a reason');
select results_eq(format($$ select status from api.cancel_moderation_cycle(%L, 1, 'Replanning with Task 4') $$, :'term3'),
  $$ values ('ok'::text) $$, 'a planned cycle is cancelled');
select results_eq(format($$ select status from api.cancel_moderation_cycle(%L, 2, 'Again') $$, :'term3'),
  $$ values ('not_planned'::text) $$, 'but only once');
select results_eq(
  format($$ select state, cancelled_by_name, cancel_reason, version from api.list_moderation_cycles(%L) where id = %L $$, :'cohort', :'term3'),
  $$ values ('cancelled'::text, 'Ayesha Patel'::text, 'Replanning with Task 4'::text, 2) $$,
  'the list says who cancelled it and why');
select results_eq(
  format($$ select waiting, open_cycle_name from api.get_moderation_pool(%L) where item_id = %L $$, :'cohort', :'item3'),
  $$ values (3, null::text) $$, 'the results stay waiting, and the item is free for another cycle');
select cycle_id as term3b from api.plan_moderation_cycle(:'cohort', 'Term 3 assignments, second plan', array[:'item3']::uuid[]) \gset
select ok(:'term3b' is not null, 'so a new cycle can cover it');
reset role;
select results_eq(
  format($$ select open from moderation.cycle_scope where cycle_id = %L $$, :'term3'),
  $$ values (false) $$, 'a cancelled cycle''s scope is closed in the database');
select results_eq(
  $$ select count(*) from audit.events where action = 'moderation.cycle_cancelled' $$,
  $$ values (1::bigint) $$, 'the cancellation is an audit event');

-- Frozen cycles (S4-06) cannot be cancelled: the state guard
update moderation.cycles set state = 'frozen', frozen_at = now() where id = :'term3b';
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.cancel_moderation_cycle(%L, 1, 'Too late') $$, :'term3b'),
  $$ values ('not_planned'::text) $$, 'a frozen cycle cannot be cancelled');
reset role;

select results_eq(
  $$ select count(*) from pg_indexes where schemaname = 'moderation' and indexname = 'cycle_scope_one_open_per_item' $$,
  $$ values (1::bigint) $$, 'the exclusion rule is an index, not only a check in a function');

select * from finish();
rollback;
