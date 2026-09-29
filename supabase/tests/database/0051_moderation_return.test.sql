-- Return for re-marking (S4-08; FR-509, FR-410; BR-03): a moderator returns an item with corrections and a deadline,
-- the assessor and the coordinator are told, the assessor re-marks from the returned decision, the new decision
-- supersedes the original on a result that stays held, and the moderator reviews again. Builds on a frozen cycle as
-- 0049 makes it.
create extension if not exists pgtap with schema extensions;

begin;
select plan(53);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A learner's decided, held result with one submitted version and one file (as in 0049).
create function pg_temp.held_result(p_learner uuid, p_name text, p_item uuid, p_assessor uuid, p_outcome text, p_decided_at timestamptz)
returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_result uuid;
  v_decision uuid;
  v_submission uuid;
  v_version uuid;
  v_instance uuid;
  v_intent uuid;
  v_file uuid;
  v_key text;
begin
  if not exists (select 1 from identity.profiles where id = p_learner) then
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', p_learner, 'authenticated', 'authenticated',
            'pgtap.' || p_learner::text || '@takusani.test', now(), now());
    insert into identity.profiles (id, full_name, learner_number) values (p_learner, p_name, 'KSI-' || right(p_learner::text, 4));
    insert into programmes.enrolments (cohort_id, profile_id) values ('10000000-0000-4000-8000-000000000010', p_learner);
  end if;
  v_key := v_task::text || '/' || p_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, object_key, original_filename, declared_media_type, declared_bytes,
    max_bytes, allowed_media_types, expires_at, finalised_at)
  values (p_learner, 'task_submission', v_task, v_key, 'portfolio.pdf', 'application/pdf', 2048, 26214400,
    array['application/pdf'], now() + interval '2 hours', now())
  returning id into v_intent;
  insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
  values (v_intent, 'submissions', v_key, 'portfolio.pdf', 2048, 'application/pdf', p_learner)
  returning id into v_file;
  insert into submissions.submissions (task_id, profile_id) values (v_task, p_learner) returning id into v_submission;
  insert into submissions.submission_versions (submission_id, version_number, submitted_at, is_late, receipt_reference)
  values (v_submission, 1, p_decided_at - interval '1 day', false, 'SUB-' || left(gen_random_uuid()::text, 8))
  returning id into v_version;
  insert into submissions.submission_files (version_id, stored_file_id) values (v_version, v_file);
  insert into assessment.results (assessable_item_id, learner_id, state) values (p_item, p_learner, 'held')
  returning id into v_result;
  insert into assessment.assessment_instances (result_id, submission_version_id, assessor_id, state)
  values (v_result, v_version, p_assessor, 'decided') returning id into v_instance;
  insert into assessment.decisions (result_id, instance_id, type, outcome, actor_id, acting_role, justification, created_at,
                                    scores, feedback, remediation, resubmission_days)
  values (v_result, v_instance, 'assessment', p_outcome, p_assessor, 'assessor', 'Judged against every criterion.', p_decided_at,
          '[{"ordinal": 1, "points": 3, "comment": "Clear index."}]'::jsonb, 'Well organised.',
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
insert into submissions.task_criteria (task_id, ordinal, title, descriptor, points)
values ('10000000-0000-4000-8000-000000000020', 1, 'Filing index', 'Others can find records from it.', 4)
on conflict do nothing;

-- Nomsa (assessor@) decided both results; Thabo (moderator@) holds them; Zanele (staff@) is the other moderator.
select pg_temp.held_result(:'learner', 'Lerato Mokoena', :'item3', :'assessor', 'competent', now() - interval '3 days') as r1 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000102', 'Naledi Botha', :'item3', :'assessor', 'not_yet_competent', now() - interval '2 days') as r2 \gset
select id as decision1 from assessment.decisions where result_id = :'r1' \gset
select id as instance1 from assessment.assessment_instances where result_id = :'r1' \gset

select pg_temp.act_as(:'coordinator');
select cycle_id as cycle from api.plan_moderation_cycle(:'cohort', 'Term 3 assignments', array[:'item3']::uuid[]) \gset
select results_eq(format($$ select status, population, sample from api.freeze_moderation_cycle(%L, 1) $$, :'cycle'),
  $$ values ('ok'::text, 2, 2) $$, 'the cycle is frozen with both results sampled');
reset role;
update moderation.sample_items set moderator_id = :'moderator', state = 'allocated', allocated_at = now() where cycle_id = :'cycle';
select id as item1 from moderation.sample_items where cycle_id = :'cycle' and result_id = :'r1' \gset
select id as item2 from moderation.sample_items where cycle_id = :'cycle' and result_id = :'r2' \gset
select ((now() at time zone 'Africa/Johannesburg')::date)::text as today \gset

-- ---------------------------------------------------------------------------------------------------------------
-- Returning an item (FR-509)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'moderator');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'disagree', 'AC 3.1 is not evidenced.') $$, :'item1'),
  $$ values ('corrections_required'::text) $$, 'a disagreement needs the required corrections');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'disagree', 'AC 3.1 is not evidenced.', 'Mark AC 3.1 against the test sheet.') $$, :'item1'),
  $$ values ('invalid_due_on'::text) $$, 'and a deadline');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'disagree', 'AC 3.1 is not evidenced.', 'Mark AC 3.1 against the test sheet.', %L::date) $$, :'item1', :'today'),
  $$ values ('invalid_due_on'::text) $$, 'after today');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'disagree', 'AC 3.1 is not evidenced.', 'Mark AC 3.1 against the test sheet.', %L::date + 91) $$, :'item1', :'today'),
  $$ values ('invalid_due_on'::text) $$, 'and within ninety days');
select results_eq(format($$ select status, finding_id is not null, return_id is not null from api.record_moderation_finding(%L, 'disagree', 'AC 3.1 is not evidenced.', 'Mark AC 3.1 against the test sheet.', %L::date + 7) $$, :'item1', :'today'),
  $$ values ('ok'::text, true, true) $$, 'the moderator returns the item with corrections and a deadline');
select results_eq(format($$ select state, jsonb_array_length(returns), returns -> 0 ->> 'corrections', (returns -> 0 ->> 'due_on')::date = %L::date + 7, returns -> 0 ->> 'remarked_at', returns -> 0 ->> 'assessor_name' from api.open_sample_item(%L) $$, :'today', :'item1'),
  $$ values ('returned'::text, 1, 'Mark AC 3.1 against the test sheet.'::text, true, null::text, 'Nomsa Dlamini'::text) $$,
  'the item is returned, and says what was asked and of whom');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'agree', 'Changed my mind.') $$, :'item1'),
  $$ values ('item_returned'::text) $$, 'nothing more is recorded on it until the assessor re-marks');
select results_eq(format($$ select my_items, my_concluded, my_returned, my_remarked from api.list_my_moderation_cycles() $$),
  $$ values (2, 0, 1, 0) $$, 'the moderator''s cycle counts the return');
select results_eq(format($$ select state, due_on = %L::date + 7 from api.list_my_sample_items(%L) where item_id = %L $$, :'today', :'cycle', :'item1'),
  $$ values ('returned'::text, true) $$, 'and their item list shows the deadline');
reset role;

select results_eq(format($$ select state, assessor_id from assessment.assessment_instances where id = %L $$, :'instance1'),
  format($$ values ('returned'::text, %L::uuid) $$, :'assessor'), 'the assessment instance is returned to its assessor');
select is((select state from assessment.results where id = :'r1'), 'held', 'the result stays held');
select results_eq(
  $$ select event_type, recipient_id, payload ->> 'learner_name', payload ->> 'moderator_name' from notifications.notifications
     where event_type in ('moderation_item_returned', 'moderation_return_logged') order by event_type, recipient_id $$,
  format($$ values ('moderation_item_returned'::text, %L::uuid, 'Lerato Mokoena'::text, 'Thabo Nkosi'::text),
                   ('moderation_return_logged', %L::uuid, 'Lerato Mokoena', 'Thabo Nkosi'),
                   ('moderation_return_logged', %L::uuid, 'Lerato Mokoena', 'Thabo Nkosi') $$, :'assessor', :'coordinator', :'staff'),
  'the assessor and every coordinator of the cohort are told (FR-509)');
select results_eq(
  format($$ select action, details ->> 'assessor_id', acting_role from audit.events where action = 'moderation.item_returned' and object_id = %L $$, :'item1'),
  format($$ values ('moderation.item_returned'::text, %L::text, 'moderator'::text) $$, :'assessor'), 'and the return is audited');

-- Only one open return per item; a second disagreement cannot land while it is open (the api refuses first).
select throws_ok(format($$ insert into moderation.returns (sample_item_id, cycle_id, finding_id, moderator_id, decision_id, instance_id, assessor_id, corrections, due_on)
  select sample_item_id, cycle_id, finding_id, moderator_id, decision_id, instance_id, assessor_id, corrections, due_on from moderation.returns where sample_item_id = %L $$, :'item1'),
  '23505', null, 'one return is open per item at a time');

-- Coordinator's reads
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select returned, sampled from api.list_moderation_cycles(%L) where id = %L $$, :'cohort', :'cycle'),
  $$ values (1, 2) $$, 'the cycle list counts the open return');
select results_eq(format($$ select state, due_on = %L::date + 7, returned_at is not null from api.list_cycle_sample_items(%L) where item_id = %L $$, :'today', :'cycle', :'item1'),
  $$ values ('returned'::text, true, true) $$, 'and the cycle detail shows the item returned with its deadline');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- The assessor re-marks (FR-410)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.start_remark(%L) $$, :'instance1'),
  $$ values ('not_found'::text) $$, 'someone outside the assessing scope cannot start the re-mark');
reset role;
select pg_temp.act_as(:'staff');
select results_eq(format($$ select status from api.start_remark(%L) $$, :'instance1'),
  $$ values ('not_your_item'::text) $$, 'nor another assessor in scope: the re-mark is the original assessor''s');
reset role;
select id as instance_r2 from assessment.assessment_instances where result_id = :'r2' \gset
select pg_temp.act_as(:'assessor');
select results_eq($$ select learner_name, item_title, cycle_name, moderator_name, corrections, overdue, outcome, instance_state from api.list_my_returned_items() $$,
  $$ values ('Lerato Mokoena'::text, 'Task 3: Workplace records portfolio'::text, 'Term 3 assignments'::text, 'Thabo Nkosi'::text,
             'Mark AC 3.1 against the test sheet.'::text, false, 'competent'::text, 'returned'::text) $$,
  'the assessor sees the item returned to them, with the corrections and the original decision (A-04)');
select results_eq(format($$ select stage, return_due_on = %L::date + 7 from api.list_my_release_status() where decision_id = %L $$, :'today', :'decision1'),
  $$ values ('returned'::text, true) $$, 'and their release status says it is returned to them');
select results_eq(format($$ select status from api.finalise_decision(%L, 1) $$, :'instance1'),
  $$ values ('not_open_for_marking'::text) $$, 'a returned item is not finalised until the re-mark is started');
select results_eq(format($$ select status from api.start_remark(%L) $$, :'item1'),
  $$ values ('not_found'::text) $$, 'the re-mark starts from the instance, not the sample item');
select results_eq(format($$ select status, instance_version, draft_version from api.start_remark(%L) $$, :'instance1'),
  $$ values ('ok'::text, 3, 1) $$, 'the assessor starts the re-mark');
select results_eq(format($$ select instance_state, draft ->> 'outcome', draft -> 'scores' -> 0 ->> 'points', draft ->> 'justification', jsonb_array_length(returns), returns -> 0 ->> 'remarked_at' from api.get_marking_item(%L) $$, :'instance1'),
  $$ values ('marking'::text, 'competent'::text, '3'::text, 'Judged against every criterion.'::text, 1, null::text) $$,
  'the draft starts from the returned decision, and the workspace shows the open return');
select results_eq(format($$ select status, instance_version, draft_version from api.start_remark(%L) $$, :'instance1'),
  $$ values ('ok'::text, 3, 1) $$, 'starting it again is harmless');
select results_eq(format($$ select status from api.start_remark(%L) $$, :'instance_r2'),
  $$ values ('not_returned'::text) $$, 'an item that was not returned cannot be re-marked');
select results_eq(format($$ select status, draft_version from api.save_marking_draft(%L, 1, '[{"ordinal": 1, "points": 2, "comment": "AC 3.1 partly met."}]'::jsonb, 'Well organised.', 'not_yet_competent', 'AC 3.1 needs the test sheet.', 'Add the test sheet.', 14) $$, :'instance1'),
  $$ values ('ok'::text, 2) $$, 'the assessor corrects the draft');
select results_eq(format($$ select status, result_state, released_at from api.finalise_decision(%L, 2) $$, :'instance1'),
  $$ values ('ok'::text, 'held'::text, null::timestamptz) $$, 'and finalises the re-mark: a new decision, still held');
select decision_id as decision2 from api.finalise_decision(:'instance1', 2) \gset
select results_eq(format($$ select status, decision_id = %L from api.finalise_decision(%L, 2) $$, :'decision2', :'instance1'),
  $$ values ('already_finalised'::text, true) $$, 'a repeat names the latest decision');
reset role;

select results_eq(format($$ select d.outcome, d.supersedes_decision_id = %L, d.instance_id = %L from assessment.decisions d where d.id = %L $$, :'decision1', :'instance1', :'decision2'),
  $$ values ('not_yet_competent'::text, true, true) $$, 'the new decision supersedes the original on the same instance (FR-410, BR-03)');
select results_eq(format($$ select current_decision_id = %L, state, hold_cycle_id = %L from assessment.results where id = %L $$, :'decision2', :'cycle', :'r1'),
  $$ values (true, 'held'::text, true) $$, 'the result points at it, stays held, and stays in the cycle');
select is((select count(*)::int from assessment.decisions where result_id = :'r1'), 2, 'the original stays on record');
select results_eq(format($$ select remarked_at is not null, remark_decision_id = %L from moderation.returns where sample_item_id = %L $$, :'decision2', :'item1'),
  $$ values (true, true) $$, 'the return is closed by the decision that answered it');
select is((select state from moderation.sample_items where id = :'item1'), 'remarked', 'the sample item is re-marked');
select results_eq(format($$ select recipient_id, payload ->> 'learner_name', link from notifications.notifications where event_type = 'moderation_item_remarked' $$),
  format($$ values (%L::uuid, 'Lerato Mokoena'::text, %L::text) $$, :'moderator', '/moderate/cycles/' || :'cycle' || '/items/' || :'item1'),
  'the moderator is told to review it again');
select results_eq(format($$ select (details ->> 'remark')::boolean from audit.events where action = 'assessment.decision_finalised' and object_id = %L $$, :'decision2'),
  $$ values (true) $$, 'the finalise audit event says it was a re-mark');
select is((select count(*)::int from audit.events where action = 'moderation.item_remarked' and object_id = :'item1'), 1, 'and the item''s re-mark is audited');

select pg_temp.act_as(:'assessor');
select is_empty($$ select * from api.list_my_returned_items() $$, 'nothing is returned to the assessor any more');
select results_eq(format($$ select stage from api.list_my_release_status() where decision_id in (%L, %L) order by decided_at $$, :'decision1', :'decision2'),
  $$ values ('replaced'::text), ('in_moderation'::text) $$, 'the original is replaced and the re-mark is in moderation');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- The moderator reviews again
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'moderator');
select results_eq(format($$ select o.state, o.outcome, jsonb_array_length(o.decisions), o.decisions -> 0 ->> 'current', o.decisions -> 1 ->> 'current', o.findings -> 0 ->> 'on_current', l.remarked_at is not null from api.open_sample_item(%L) o join api.list_my_sample_items(%L) l on l.item_id = o.item_id $$, :'item1', :'cycle'),
  $$ values ('remarked'::text, 'not_yet_competent'::text, 2, 'true'::text, 'false'::text, 'false'::text, true) $$,
  'the moderator sees the revised decision, the original beside it, and the earlier finding marked as on the original');
select results_eq(format($$ select my_concluded, my_returned, my_remarked from api.list_my_moderation_cycles() $$),
  $$ values (0, 0, 1) $$, 'the cycle counts the re-marked item');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'agree', 'AC 3.1 is now judged correctly.') $$, :'item1'),
  $$ values ('ok'::text) $$, 'the moderator agrees with the revised decision');
select results_eq(format($$ select state, my_concluded from api.open_sample_item(%L) $$, :'item1'),
  $$ values ('agreed'::text, 1) $$, 'and the item is concluded');
-- A second return on the other item, then re-marked, then returned again: the loop repeats.
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'disagree', 'Remediation too vague.', 'Say which records are missing.', %L::date + 3) $$, :'item2', :'today'),
  $$ values ('ok'::text) $$, 'another item is returned');
reset role;
select pg_temp.act_as(:'assessor');
select instance_id as instance2 from api.list_my_returned_items() \gset
select results_eq(format($$ select status from api.start_remark(%L) $$, :'instance2'), $$ values ('ok'::text) $$, 'the assessor starts that re-mark');
select results_eq(format($$ select status from api.save_marking_draft(%L, 1, '[{"ordinal": 1, "points": 1, "comment": "Thin."}]'::jsonb, null, 'not_yet_competent', 'Two records missing.', 'Add the access register and the filing index.', 14) $$, :'instance2'),
  $$ values ('ok'::text) $$, 'corrects it');
select results_eq(format($$ select status from api.finalise_decision(%L, 2) $$, :'instance2'), $$ values ('ok'::text) $$, 'and finalises');
reset role;
select pg_temp.act_as(:'moderator');
select results_eq(format($$ select status, return_id is not null from api.record_moderation_finding(%L, 'disagree', 'Still vague.', 'Name each record and where it should be filed.', %L::date + 5) $$, :'item2', :'today'),
  $$ values ('ok'::text, true) $$, 'the moderator can return a re-marked item again');
select results_eq(format($$ select state, jsonb_array_length(returns), jsonb_array_length(findings) from api.open_sample_item(%L) $$, :'item2'),
  $$ values ('returned'::text, 2, 2) $$, 'with both returns and both findings on record');
reset role;

-- Open allocations (FR-105): the return depends on the assessor role.
select results_eq(format($$ select kind, items from identity.open_allocations(%L) order by kind $$, :'assessor'),
  $$ values ('remark'::text, 1) $$, 'an open return counts as the assessor''s open work');

-- Privileges
select table_privs_are('moderation', 'returns', 'authenticated', array[]::text[], 'authenticated has no privilege on returns');
select function_privs_are('moderation', 'record_remark', array['uuid', 'uuid', 'uuid', 'uuid'], 'authenticated', array[]::text[], 'nor on the re-mark helper');

select * from finish();
rollback;
