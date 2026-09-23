-- The result aggregate and immutable decisions (S2-06, ADR-021, BR-03; test plan, transaction test 11).
-- Uses the local seed: the published task and the enrolled learner.
create extension if not exists pgtap with schema extensions;

begin;
select plan(26);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A finalised file, as an upload leaves one.
create function pg_temp.finalised_file(p_task uuid, p_name text) returns uuid language plpgsql as $$
declare
  v_learner uuid := '00000000-0000-4000-8000-000000000001';
  v_intent uuid;
  v_file uuid;
  v_key text := p_task::text || '/' || v_learner::text || '/' || gen_random_uuid()::text || '.pdf';
begin
  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, object_key, original_filename, declared_media_type, declared_bytes,
    max_bytes, allowed_media_types, expires_at, finalised_at
  )
  values (v_learner, 'task_submission', p_task, v_key, p_name, 'application/pdf', 2048, 26214400,
    array['application/pdf'], now() + interval '2 hours', now())
  returning id into v_intent;
  insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
  values (v_intent, 'submissions', v_key, p_name, 2048, 'application/pdf', v_learner)
  returning id into v_file;
  return v_file;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set task 10000000-0000-4000-8000-000000000020

-- Publishing gives a task its assessable item (the seeded task was published before this migration, so the first
-- submission makes it).
reset role;
select pg_temp.finalised_file(:'task', 'portfolio.pdf') as file1 \gset
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status, version_number from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', null)),
           gen_random_uuid()) $$, :'task', :'file1'),
  $$ values ('ok'::text, 1) $$, 'the learner submits version 1');

reset role;
select results_eq(
  format($$ select kind, title from assessment.assessable_items where task_id = %L $$, :'task'),
  $$ values ('task'::text, 'Task 3: Workplace records portfolio'::text) $$,
  'the task has one assessable item, which results point at');
select results_eq(
  format($$ select r.state, r.released_at is null, i.state, count(*) over ()
            from assessment.results r
            join assessment.assessment_instances i on i.result_id = r.id
            join assessment.assessable_items ai on ai.id = r.assessable_item_id
            where ai.task_id = %L and r.learner_id = %L $$, :'task', :'learner'),
  $$ values ('held'::text, true, 'to_mark'::text, 1::bigint) $$,
  'submitting opens one instance on a held result: nothing is released by handing work in');

select (select r.id from assessment.results r
        join assessment.assessable_items ai on ai.id = r.assessable_item_id
        where ai.task_id = :'task' and r.learner_id = :'learner') as result \gset

-- A resubmission belongs to the same result, so the chain reads as one story (ADR-021)
select pg_temp.finalised_file(:'task', 'portfolio-v2.pdf') as file2 \gset
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status, version_number from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', null)),
           gen_random_uuid()) $$, :'task', :'file2'),
  $$ values ('ok'::text, 2) $$, 'the learner submits version 2');
reset role;
select results_eq(
  format($$ select count(*)::int from assessment.results r
            join assessment.assessable_items ai on ai.id = r.assessable_item_id where ai.task_id = %L $$, :'task'),
  $$ values (1) $$, 'there is still one result for the learner and the task');
select results_eq(
  format($$ select state, count(*)::int from assessment.assessment_instances where result_id = %L
            group by state order by state $$, :'result'),
  $$ values ('superseded'::text, 1), ('to_mark'::text, 1) $$,
  'the earlier instance is superseded, not removed: what was marked before stays readable');

-- Decisions: one root, no forks, append-only
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
values (:'result', 'assessment', 'not_yet_competent', :'assessor', 'assessor', 'The retention schedule is missing.')
returning id as decision1 \gset
update assessment.results set current_decision_id = :'decision1' where id = :'result';

select results_eq(
  format($$ select current_decision_id = %L, state from assessment.results where id = %L $$, :'decision1', :'result'),
  $$ values (true, 'held'::text) $$, 'the result points at its current decision and is still held');
select throws_ok(
  format($$ insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
            values (%L, 'assessment', 'competent', %L, 'assessor', 'Second root.') $$, :'result', :'assessor'),
  '23505', null, 'a result cannot have a second root decision');

insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
values (:'result', 'assessment', 'competent', :'assessor', 'assessor', 'Resubmission meets every criterion.', :'decision1')
returning id as decision2 \gset
select throws_ok(
  format($$ insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
            values (%L, 'appeal', 'competent', %L, 'assessor', 'Forking the chain.', %L) $$,
    :'result', :'assessor', :'decision1'),
  '23505', null, 'two decisions cannot supersede the same one: the chain is a line, not a fork');

select throws_ok(
  format($$ update assessment.decisions set outcome = 'competent' where id = %L $$, :'decision1'),
  '42501', 'UPDATE on assessment.decisions is not allowed: the table is append-only',
  'a decision cannot be edited, even by the owner of the database (test plan 11)');
select throws_ok(
  format($$ delete from assessment.decisions where id = %L $$, :'decision1'),
  '42501', 'DELETE on assessment.decisions is not allowed: the table is append-only',
  'nor deleted');

-- The current pointer must belong to this result
select throws_ok(
  format($$ update assessment.results set current_decision_id = gen_random_uuid() where id = %L $$, :'result'),
  '23503', null, 'the current decision must be one of this result''s own decisions');

-- Releasing: once, and all of it together
select lives_ok(
  format($$ update assessment.results set state = 'released', current_decision_id = %L where id = %L $$,
    :'decision2', :'result'),
  'a held result is released');
select results_eq(
  format($$ select state, released_at is not null, release_seq is not null, appeal_deadline_at is not null
            from assessment.results where id = %L $$, :'result'),
  $$ values ('released'::text, true, true, true) $$,
  'release writes the time, the sequence number and the appeal deadline together');
select results_eq(
  format($$ select (appeal_deadline_at at time zone 'Africa/Johannesburg')::date
                   - (released_at at time zone 'Africa/Johannesburg')::date
            from assessment.results where id = %L $$, :'result'),
  $$ values (8) $$, 'the appeal deadline is the start of the eighth day, so seven whole days are available');
select results_eq(
  format($$ select extract(hour from appeal_deadline_at at time zone 'Africa/Johannesburg')::int
            from assessment.results where id = %L $$, :'result'),
  $$ values (0) $$, 'and it falls at the start of that day, not at the time of release');

select throws_like(
  format($$ update assessment.results set released_at = now() - interval '5 days' where id = %L $$, :'result'),
  '%written once%', 'the release time cannot be back-dated afterwards');
select throws_like(
  format($$ update assessment.results set release_seq = release_seq + 1000 where id = %L $$, :'result'),
  '%written once%', 'nor can the release sequence be changed');
select throws_like(
  format($$ update assessment.results set state = 'held' where id = %L $$, :'result'),
  '%cannot be held again%', 'a released result cannot be put back on hold');

-- Ordering for external feeds, and for holding more than one result at a time
reset role;
insert into assessment.results (assessable_item_id, learner_id)
select ai.id, '00000000-0000-4000-8000-000000000007' from assessment.assessable_items ai where ai.task_id = :'task'
returning id as other_result \gset
select throws_like(
  format($$ update assessment.results set released_at = now(), release_seq = 99 where id = %L $$, :'other_result'),
  '%no release facts yet%', 'a held result cannot be given release facts without being released');
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
values (:'other_result', 'assessment', 'competent', :'assessor', 'assessor', 'Meets every criterion.')
returning id as decision3 \gset
update assessment.results set state = 'released', current_decision_id = :'decision3' where id = :'other_result';
select ok(
  (select release_seq from assessment.results where id = :'other_result')
    > (select release_seq from assessment.results where id = :'result'),
  'each release takes the next sequence number, so an external feed can never miss a late release');

-- A "not yet competent" result keeps the learner's whole resubmission period from release, not from the decision
insert into assessment.results (assessable_item_id, learner_id, remediation_period)
select ai.id, '00000000-0000-4000-8000-000000000006', interval '14 days'
from assessment.assessable_items ai where ai.task_id = :'task'
returning id as nyc_result \gset
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
values (:'nyc_result', 'assessment', 'not_yet_competent', :'assessor', 'assessor', 'Two records are missing.')
returning id as decision4 \gset
update assessment.results set state = 'released', current_decision_id = :'decision4' where id = :'nyc_result';
select results_eq(
  format($$ select (remediation_deadline_at - released_at) = interval '14 days' from assessment.results where id = %L $$,
    :'nyc_result'),
  $$ values (true) $$, 'the time to resubmit runs from release, so a long hold delays it rather than eating it');

-- Nothing here is reachable from a browser
select pg_temp.act_as(:'learner');
select throws_ok(format($$ select count(*) from assessment.results where id = %L $$, :'result'), '42501', null,
  'a learner cannot read the results table directly');
select throws_ok($$ insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
                    values (gen_random_uuid(), 'assessment', 'competent', gen_random_uuid(), 'assessor', 'Mine now.') $$,
  '42501', null, 'nor write a decision');

reset role;
select results_eq(
  format($$ select version >= 2 from assessment.results where id = %L $$, :'result'),
  $$ values (true) $$, 'every change to a result bumps its version, for optimistic locking later');
select results_eq(
  $$ select count(*)::int from assessment.decisions where result_id is not null $$,
  $$ values (4) $$, 'all four decisions are on record, none replaced');

select * from finish();
rollback;
