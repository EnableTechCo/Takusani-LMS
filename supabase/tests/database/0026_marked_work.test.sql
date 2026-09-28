-- The learner's view of their marked work (S3-03; FR-606, FR-607). Uses the local seed: the published task in
-- "2026 Intake B", the enrolled learner, assessor@ (who decides the result) and coordinator@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(16);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- The learner hands in a version and the assessor finalises it "not yet competent" (released at once). Returns the
-- result. Runs as postgres, then leaves the caller as postgres.
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
\set coordinator 00000000-0000-4000-8000-000000000005
\set grounds '''I want to understand why criterion 2 has 2 of 5 and no comment next to it at all.'''

reset role;
select pg_temp.released_result() as result \gset

-- A request that was not accepted shows nothing
select pg_temp.act_as(:'learner');
select appeal_id as refused from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid()) \gset
reset role;
select pg_temp.act_as(:'coordinator');
select is(status, 'ok', 'the coordinator records the first request as inadmissible')
from api.decide_appeal_admissibility(:'refused', false, 'The comments are on your result page.');
reset role;
select pg_temp.act_as(:'learner');
select is(status, 'refused', 'a request that was not accepted shows no marked work') from api.view_my_marked_work(:'refused');

-- Until it is granted, nothing is shown
select appeal_id as script from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid()) \gset
select appeal_id as remark from api.lodge_appeal(:'result', 'remark', :grounds, gen_random_uuid()) \gset
select is(status, 'not_granted', 'a request still being checked shows nothing yet') from api.view_my_marked_work(:'script');
select is(status, 'not_a_view', 'a re-mark request is not a view of the marked work') from api.view_my_marked_work(:'remark');
reset role;
select is((select count(*)::int from appeals.appeal_events where event = 'script_viewed'), 0,
  'and no opening was recorded');

-- Granted: the work, the marks and feedback of the decision appealed, and the time left (FR-606, FR-607)
select pg_temp.act_as(:'coordinator');
select is(status, 'ok', 'the coordinator grants the view') from api.decide_appeal_admissibility(:'script', true);
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status, outcome, feedback, assessor_name, jsonb_array_length(marks), marks -> 0 ->> 'comment',
                   assessed_version ->> 'version_number', views from api.view_my_marked_work(%L) $$, :'script'),
  $$ values ('ok'::text, 'not_yet_competent'::text, 'The retention schedule is missing.'::text, 'Nomsa Dlamini'::text,
             3, 'Every record is there.'::text, '1'::text, 1) $$,
  'the learner sees the outcome, every criterion with its comment, the feedback and the version assessed');
select results_eq(
  format($$ select f ->> 'filename', f ->> 'bucket', (f ->> 'object_key') like '%%.pdf'
            from api.view_my_marked_work(%L), jsonb_array_elements(files) f $$, :'script'),
  $$ values ('portfolio.pdf'::text, 'submissions'::text, true) $$, 'and the files that were assessed');
reset role;
select is(
  (select count(*)::int from appeals.appeal_events where appeal_id = :'script' and event = 'script_viewed'
     and actor_id = :'learner'),
  2, 'each opening is recorded on the appeal, by the learner (FR-606)');
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select appeal_deadline_at = (select appeal_deadline_at from api.get_my_result(%L)), remark_standing,
                   remark_appeal_id, decision_final from api.view_my_marked_work(%L) $$, :'result', :'script'),
  format($$ values (true, 'open'::text, %L::uuid, false) $$, :'remark'),
  'the page has the result''s own appeal deadline and knows a re-mark is already open (FR-607)');
select results_eq(
  format($$ select views, first_viewed_at < clock_timestamp() from api.view_my_marked_work(%L) $$, :'script'),
  $$ values (4, true) $$, 'the count of openings grows; the first opening stays the first');
reset role;
select is((select deadline_at from appeals.appeals where id = :'script'),
  (select appeal_deadline_at from assessment.results where id = :'result'),
  'viewing does not move the appeal deadline (P-08)');

-- Nobody else
select pg_temp.act_as(:'assessor');
select is(status, 'not_found', 'nobody else opens the learner''s view') from api.view_my_marked_work(:'script');
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select is(status, 'unauthenticated', 'nor someone not signed in') from api.view_my_marked_work(:'script');

-- The coordinator sees the openings on the appeal's record
reset role;
select pg_temp.act_as(:'coordinator');
select is(
  (select count(*)::int from api.get_appeal_to_coordinate(:'script'), jsonb_array_elements(events) e
   where e ->> 'event' = 'script_viewed'),
  4, 'the coordinator sees every opening on the record');
reset role;
select throws_ok(format($$ delete from appeals.appeal_events where appeal_id = %L $$, :'script'), '42501', null,
  'and the openings cannot be removed');

select * from finish();
rollback;
