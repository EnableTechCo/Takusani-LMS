-- The appeal reviewer's workspace and conclusion (S3-04; FR-609 to FR-611; BR-02, BR-03; transaction test 9). Uses
-- the local seed: the published task in "2026 Intake B", the enrolled learner, assessor@ (who decides the result),
-- moderator@, coordinator@, and staff@, who is allocated as the reviewer (tier 1).
create extension if not exists pgtap with schema extensions;

begin;
select plan(38);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- The learner hands in a version and the assessor finalises it "not yet competent", 11 of 20 (released at once).
-- Returns the result. Runs as postgres, then leaves the caller as postgres.
create function pg_temp.released_result() returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_learner uuid := '00000000-0000-4000-8000-000000000001';
  v_assessor uuid := '00000000-0000-4000-8000-000000000003';
  v_intent uuid;
  v_file uuid;
  v_key text := v_task::text || '/' || v_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  v_instance uuid;
  v_result uuid;
begin
  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, object_key, original_filename, declared_media_type, declared_bytes,
    max_bytes, allowed_media_types, expires_at, finalised_at
  )
  values (v_learner, 'task_submission', v_task, v_key, 'portfolio.pdf', 'application/pdf', 2048, 26214400,
    array['application/pdf'], now() + interval '2 hours', now())
  returning id into v_intent;
  insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
  values (v_intent, 'submissions', v_key, 'portfolio.pdf', 2048, 'application/pdf', v_learner)
  returning id into v_file;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_learner, 'role', 'authenticated')::text, true);
  perform api.submit_task(v_task, jsonb_build_array(jsonb_build_object('file_id', v_file, 'requirement_id', null)),
    gen_random_uuid());
  perform set_config('role', 'postgres', true);

  select i.id, r.id into v_instance, v_result from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  where r.learner_id = v_learner and i.state = 'to_mark';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_assessor, 'role', 'authenticated')::text, true);
  perform api.take_marking(v_instance);
  perform api.save_marking_draft(v_instance, 0,
    '[{"ordinal": 1, "points": 9, "comment": "Every record is there."}, {"ordinal": 2, "points": 2, "comment": ""}]'::jsonb,
    'The retention schedule is missing.', 'not_yet_competent', 'Judged against every criterion.',
    'Add the retention schedule.', 14);
  perform api.finalise_decision(v_instance, 1);
  perform set_config('role', 'postgres', true);
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set moderator 00000000-0000-4000-8000-000000000004
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set grounds '''Criterion 2 asks for the retention rules. Page 4 of my portfolio sets them out, with the schedule.'''
\set remarked '''[{"ordinal": 1, "points": 9, "comment": "Every record is there."}, {"ordinal": 2, "points": 5, "comment": "The schedule is on page 4."}, {"ordinal": 3, "points": 4, "comment": ""}]'''

reset role;
select pg_temp.released_result() as result \gset
select current_decision_id as appealed, release_seq as first_seq from assessment.results where id = :'result' \gset

select pg_temp.act_as(:'learner');
select appeal_id as appeal from api.lodge_appeal(:'result', 'remark', :grounds, gen_random_uuid()) \gset
reset role;
select pg_temp.act_as(:'coordinator');
select status as admitted from api.decide_appeal_admissibility(:'appeal', true) \gset
select status as allocated from api.allocate_appeal_reviewer(:'appeal', :'staff') \gset
select is(:'admitted' || ' ' || :'allocated', 'ok ok', 'the appeal is admitted and allocated to staff@');

-- R-01 and R-02 (FR-609)
reset role;
select pg_temp.act_as(:'staff');
select results_eq($$ select state, learner_name from api.list_my_reviews() $$,
  $$ values ('allocated'::text, 'Lerato Mokoena'::text) $$, 'the reviewer lists the appeal allocated to them');
reset role;
select pg_temp.act_as(:'moderator');
select is(status, 'not_found', 'nobody but the allocated reviewer opens the review') from api.open_appeal_review(:'appeal');
select is_empty($$ select * from api.list_my_reviews() $$, 'and nobody else lists it');
reset role;
select pg_temp.act_as(:'staff');
select results_eq(
  format($$ select status, state, grounds, appealed_outcome, assessor_name, jsonb_array_length(marks),
                   jsonb_array_length(files), jsonb_array_length(decisions), moderation_findings, conflict, result_changed
            from api.open_appeal_review(%L) $$, :'appeal'),
  $$ values ('ok'::text, 'under_review'::text,
             'Criterion 2 asks for the retention rules. Page 4 of my portfolio sets them out, with the schedule.'::text,
             'not_yet_competent'::text, 'Nomsa Dlamini'::text, 3, 1, 1, '[]'::jsonb, false, false) $$,
  'the reviewer sees the grounds, the decision appealed with its marks, the work, the chain and the findings');
select is(status, 'ok', 'opening it again is fine') from api.open_appeal_review(:'appeal');
reset role;
select is((select count(*)::int from appeals.appeal_events where appeal_id = :'appeal' and event = 'review_opened'), 1,
  'opening the review is recorded once, and the appeal is under review');
select ok(appeals.may_read_review_evidence(:'staff', 'submissions',
            (select sf.object_key from submissions.stored_files sf limit 1)),
  'the reviewer may read the work under review');
select ok(not appeals.may_read_review_evidence(:'moderator', 'submissions',
            (select sf.object_key from submissions.stored_files sf limit 1)),
  'someone who is not the reviewer may not');

-- The outcome follows from the marks (FR-610)
select is(appeals.outcome_category('not_yet_competent', 11, 'competent', 18), 'amended_up', 'NYC to competent is amended upward');
select is(appeals.outcome_category('competent', 18, 'not_yet_competent', 11), 'amended_down', 'competent to NYC is amended downward');
select is(appeals.outcome_category('not_yet_competent', 11, 'not_yet_competent', 13), 'amended_up', 'a higher total, same outcome, is upward');
select is(appeals.outcome_category('not_yet_competent', 11, 'not_yet_competent', 11), 'upheld', 'the same outcome and total is upheld');

-- What is refused
select pg_temp.act_as(:'moderator');
select is(status, 'not_found', 'only the allocated reviewer concludes')
from api.conclude_appeal(:'appeal', 'competent', :remarked, 'Criterion 2 is met.');
reset role;
select pg_temp.act_as(:'staff');
select is(status, 'invalid_outcome', 'the outcome is competent or not yet competent')
from api.conclude_appeal(:'appeal', 'excellent', :remarked, 'Criterion 2 is met.');
select is(status, 'reasons_required', 'reasons are required (FR-610)')
from api.conclude_appeal(:'appeal', 'competent', :remarked, '  ');
select is(status, 'invalid_points', 'a mark above the criterion''s maximum is refused')
from api.conclude_appeal(:'appeal', 'competent', '[{"ordinal": 1, "points": 11, "comment": ""}]', 'Reasons.');
select is(status, 'invalid_scores', 'a criterion the task does not have is refused')
from api.conclude_appeal(:'appeal', 'competent', '[{"ordinal": 9, "points": 1, "comment": ""}]', 'Reasons.');
select is(status, 'remediation_required', 'not yet competent carries what to do (P-09)')
from api.conclude_appeal(:'appeal', 'not_yet_competent', :remarked, 'Reasons.');
select is(status, 'resubmission_days_required', 'and, when amended, a new resubmission period')
from api.conclude_appeal(:'appeal', 'not_yet_competent', :remarked, 'Reasons.', 'Add the index.');

-- Transaction test 9: a reviewer who has since taken an assessment decision on the result is refused
reset role;
savepoint conflict;
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id,
                                  remediation, resubmission_days)
values (:'result', 'assessment', 'not_yet_competent', :'staff', 'assessor', 'Marked it after the allocation.',
        :'appealed', 'Add the schedule.', 14);
select pg_temp.act_as(:'staff');
select is(conflict, true, 'the workspace shows the conflict') from api.open_appeal_review(:'appeal');
select is(status, 'separation_of_duties_conflict', 'and the conclusion is refused, even though the allocation was fine')
from api.conclude_appeal(:'appeal', 'competent', :remarked, 'Criterion 2 is met.');
reset role;
select is((select count(*)::int from appeals.appeal_events where appeal_id = :'appeal' and event = 'conclusion_refused'), 1,
  'the refusal is on the appeal''s record');
rollback to savepoint conflict;

-- Concluded: amended upward to competent (FR-610, FR-611)
select pg_temp.act_as(:'staff');
select gen_random_uuid() as command \gset
select results_eq(
  format($$ select status, outcome_category from api.conclude_appeal(%L, 'competent', %L, %L, null, null, %L) $$,
         :'appeal', :remarked, 'Criterion 2 is met: the schedule is on page 4.', :'command'),
  $$ values ('ok'::text, 'amended_up'::text) $$, 'the reviewer concludes: competent, 18 of 20, amended upward');

reset role;
select current_decision_id as appeal_decision from assessment.results where id = :'result' \gset
select results_eq(
  format($$ select type, outcome, supersedes_decision_id, actor_id, justification from assessment.decisions where id = %L $$,
         :'appeal_decision'),
  format($$ values ('appeal'::text, 'competent'::text, %L::uuid, %L::uuid, 'Criterion 2 is met: the schedule is on page 4.'::text) $$,
         :'appealed', :'staff'),
  'a new appeal decision supersedes the one appealed (FR-611)');
select is((select count(*)::int from assessment.decisions where result_id = :'result'), 2,
  'and the original decision is kept (BR-03)');
select results_eq(
  format($$ select state, release_seq > %s, appeal_deadline_at = released_at, remediation_deadline_at from assessment.results
            where id = %L $$, :'first_seq', :'result'),
  $$ values ('released'::text, true, true, null::timestamptz) $$,
  'the amended result is released at once with a new sequence number, its appeal window closed, no resubmission');
select results_eq(
  format($$ select state, outcome_category, conclusion_decision_id from appeals.appeals where id = %L $$, :'appeal'),
  format($$ values ('concluded'::text, 'amended_up'::text, %L::uuid) $$, :'appeal_decision'),
  'the appeal is concluded with its outcome');
select is((select count(*)::int from audit.events where action = 'appeals.appeal_concluded' and object_id = :'appeal'), 1,
  'and the conclusion is audited');

-- Who is told (FR-611)
select results_eq(
  format($$ select event_type, payload ->> 'category' from notifications.notifications
            where recipient_id = %L and event_type in ('appeal_decided', 'result_released') order by created_at, event_type $$,
         :'learner'),
  $$ values ('appeal_decided'::text, 'amended_up'::text), ('result_released', null) $$,
  'the learner is told the appeal was decided, and not sent a second "result released"');
select results_eq(
  format($$ select recipient_id, link like '/coordinate/appeals/%%' from notifications.notifications
            where event_key = 'appeal_concluded:%s' order by recipient_id $$, :'appeal'),
  format($$ values (%L::uuid, false), (%L::uuid, true) $$, :'assessor', :'coordinator'),
  'the assessor and the coordinator are told; the reviewer is not told of their own decision');

-- Replays and a second conclusion
select pg_temp.act_as(:'staff');
select results_eq(
  format($$ select status, decision_id from api.conclude_appeal(%L, 'competent', %L, 'Again.', null, null, %L) $$,
         :'appeal', :remarked, :'command'),
  format($$ values ('ok'::text, %L::uuid) $$, :'appeal_decision'), 'a retry of the same command returns the same decision');
select is(status, 'already_concluded', 'a second, different conclusion is refused')
from api.conclude_appeal(:'appeal', 'not_yet_competent', :remarked, 'Changed my mind.', 'Add it.', 7, gen_random_uuid());

-- The learner's result is the appeal decision: final, and the reviewer is not named (FR-613, UX Q7)
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select outcome, decided_on_appeal, assessor_name, feedback from api.get_my_result(%L) $$, :'result'),
  $$ values ('competent'::text, true, null::text, 'Criterion 2 is met: the schedule is on page 4.'::text) $$,
  'the learner sees the new outcome and the reasons, without the reviewer''s name');
select is(decided_on_appeal, true, 'the results list marks it as decided on appeal') from api.list_my_results();
select is(status, 'decision_final', 'and it cannot be appealed')
from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid());

-- The coordinator sees the outcome and the step
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select outcome_category, (select e ->> 'category' from jsonb_array_elements(events) e where e ->> 'event' = 'concluded')
            from api.get_appeal_to_coordinate(%L) $$, :'appeal'),
  $$ values ('amended_up'::text, 'amended_up'::text) $$, 'the coordinator sees the outcome and the concluded step');
reset role;
select pg_temp.act_as(:'staff');
select results_eq(
  format($$ select state, outcome_category, conclusion ->> 'outcome', (conclusion ->> 'total')::int from api.open_appeal_review(%L) $$,
         :'appeal'),
  $$ values ('concluded'::text, 'amended_up'::text, 'competent'::text, 18) $$,
  'the reviewer can still read the concluded review');

select * from finish();
rollback;
