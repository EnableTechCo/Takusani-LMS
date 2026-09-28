-- Learner appeal tracking (S3-05; FR-612, FR-613). Uses the local seed: the published task in "2026 Intake B", the
-- enrolled learner, assessor@ (who decides the result), coordinator@, and staff@ as the reviewer.
create extension if not exists pgtap with schema extensions;

begin;
select plan(9);

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
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set grounds '''Criterion 2 asks for the retention rules. Page 4 of my portfolio sets them out, with the schedule.'''
\set lower '''[{"ordinal": 1, "points": 7, "comment": "Two records are missing."}, {"ordinal": 2, "points": 2, "comment": ""}]'''

reset role;
select pg_temp.released_result() as result \gset
select pg_temp.act_as(:'learner');
select appeal_id as appeal from api.lodge_appeal(:'result', 'remark', :grounds, gen_random_uuid()) \gset
reset role;
select pg_temp.act_as(:'coordinator');
select status as admitted from api.decide_appeal_admissibility(:'appeal', true) \gset
select status as allocated from api.allocate_appeal_reviewer(:'appeal', :'staff') \gset
reset role;
select pg_temp.act_as(:'staff');
select status as opened from api.open_appeal_review(:'appeal') \gset

-- While it is being reviewed, the learner sees the steps and nothing of an outcome
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select state, outcome_category, decided_outcome, reasons, (select array_agg(e ->> 'event') from jsonb_array_elements(events) e)
            from api.get_my_appeal(%L) $$, :'appeal'),
  $$ values ('under_review'::text, null::text, null::text, null::text, array['lodged', 'admitted', 'allocated', 'review_opened']) $$,
  'while under review the learner sees each step, dated, and no outcome');

-- Decided: amended downward to not yet competent, 9 of 20, with what to do in 10 days (P-09)
reset role;
select pg_temp.act_as(:'staff');
select is(status, 'ok', 'the reviewer concludes: not yet competent, 9 of 20')
from api.conclude_appeal(:'appeal', 'not_yet_competent', :lower, 'Two records in criterion 1 are not in the portfolio.',
  'Add the two missing records.', 10, gen_random_uuid());
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select state, outcome_category, decided_outcome, decided_points, reasons, decided_remediation
            from api.get_my_appeal(%L) $$, :'appeal'),
  $$ values ('concluded'::text, 'amended_down'::text, 'not_yet_competent'::text, 9,
             'Two records in criterion 1 are not in the portfolio.'::text, 'Add the two missing records.'::text) $$,
  'the learner reads how it was decided, the new outcome and total, and the reasons (FR-612)');
select is(appealed_outcome, 'not_yet_competent', 'and still sees what was appealed') from api.get_my_appeal(:'appeal');
reset role;
select remediation_deadline_at as deadline from assessment.results where id = :'result' \gset
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select decided_remediation_deadline_at = %L::timestamptz, decided_remediation_deadline_at > now() + interval '9 days'
            from api.get_my_appeal(%L) $$, :'deadline', :'appeal'),
  $$ values (true, true) $$, 'with the new resubmission deadline, 10 days from the decision');
select is(events -> -1 ->> 'event', 'concluded', 'the last step is the decision') from api.get_my_appeal(:'appeal');
-- staff@ is also one of the cohort's coordinators, and is named as such; nowhere as the reviewer.
select ok(position('Zanele' in (select (to_jsonb(x) - 'coordinator_names')::text from api.get_my_appeal(:'appeal') x)) = 0,
  'the reviewer is not named anywhere in what the learner reads (UX Q7)');
select is(outcome_category, 'amended_down', 'the learner''s list shows how it was decided') from api.list_my_appeals();

reset role;
select pg_temp.act_as(:'staff');
select is_empty(format($$ select * from api.get_my_appeal(%L) $$, :'appeal'), 'nobody else reads it as theirs');

select * from finish();
rollback;
