-- The learner's result (S2-09, FR-316, FR-317, NFR-11, BR-04): what a learner may read, held and released.
-- Uses the local seed: the published task in "2026 Intake B" (not moderated), the enrolled learner, assessor@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(22);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- The learner hands in a version, and the assessor takes it and saves a draft. Returns the instance. Runs as
-- postgres, then leaves the caller as postgres.
create function pg_temp.ready_item(p_outcome text) returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_learner uuid := '00000000-0000-4000-8000-000000000001';
  v_assessor uuid := '00000000-0000-4000-8000-000000000003';
  v_intent uuid;
  v_file uuid;
  v_key text := v_task::text || '/' || v_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  v_instance uuid;
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

  select i.id into v_instance from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  where r.learner_id = v_learner and i.state = 'to_mark';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_assessor, 'role', 'authenticated')::text, true);
  perform api.take_marking(v_instance);
  perform api.save_marking_draft(v_instance, 0,
    '[{"ordinal": 1, "points": 9, "comment": "Every record is there."}, {"ordinal": 2, "points": 2, "comment": " "}]'::jsonb,
    'Clear filing; the retention schedule is missing.', p_outcome, 'Judged against every criterion.',
    case when p_outcome = 'not_yet_competent' then 'Add the retention schedule.' end,
    case when p_outcome = 'not_yet_competent' then 14 end);
  perform set_config('role', 'postgres', true);
  return v_instance;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set staff 00000000-0000-4000-8000-000000000007
\set cohort 10000000-0000-4000-8000-000000000010

-- Being assessed: the learner reads their own submission and nothing about the outcome (BR-04)
reset role;
select pg_temp.ready_item('not_yet_competent') as nyc \gset
select r.id as result from assessment.results r join assessment.assessment_instances i on i.result_id = r.id
where i.id = :'nyc' \gset

reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select state, moderated, outcome, released_at, appeal_deadline_at, remediation, remediation_deadline_at,
                   feedback, assessor_name, marks, assessed_version, first_viewed_at
            from api.get_my_result(%L) $$, :'result'),
  $$ values ('held'::text, false, null::text, null::timestamptz, null::timestamptz, null::text, null::timestamptz,
             null::text, null::text, null::jsonb, null::jsonb, null::timestamptz) $$,
  'while it is being assessed, no outcome, marks, feedback, assessor or dates reach the learner');
select results_eq(
  format($$ select latest_version ->> 'version_number', latest_version ->> 'files', latest_version ->> 'bytes'
            from api.get_my_result(%L) $$, :'result'),
  $$ values ('1'::text, '1'::text, '2048'::text) $$, 'the learner sees the version they handed in');
select results_eq($$ select state, outcome, released_at from api.list_my_results() $$,
  $$ values ('held'::text, null::text, null::timestamptz) $$, 'the list shows it as held, with no outcome or date');

-- Nobody else reads it through the learner's function
reset role;
select pg_temp.act_as(:'assessor');
select is_empty(format($$ select * from api.get_my_result(%L) $$, :'result'),
  'the assessor does not read the result through the learner''s function');
select is_empty($$ select * from api.list_my_results() $$, 'and has no results of their own in the list');
reset role;
select pg_temp.act_as(:'staff');
select is_empty(format($$ select * from api.get_my_result(%L) $$, :'result'), 'nor does anyone else');
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select is_empty(format($$ select * from api.get_my_result(%L) $$, :'result'), 'nor does someone not signed in');

-- A draft finalised, but the result is not read before release: opening it records nothing
reset role;
select is_empty(format($$ select * from assessment.result_first_views where result_id = %L $$, :'result'),
  'opening a held result records no first view');

-- Released: outcome, marks per criterion, feedback, remediation and both deadlines (FR-316, FR-317)
reset role;
select pg_temp.act_as(:'assessor');
select is(status, 'ok', 'the assessor finalises version 1 as not yet competent') from api.finalise_decision(:'nyc', 1);
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select state, outcome, remediation, feedback, assessor_name, released_at is not null,
                   appeal_deadline_at > released_at, remediation_deadline_at - released_at
            from api.get_my_result(%L) $$, :'result'),
  $$ values ('released'::text, 'not_yet_competent'::text, 'Add the retention schedule.'::text,
             'Clear filing; the retention schedule is missing.'::text, 'Nomsa Dlamini'::text, true, true,
             interval '14 days') $$,
  'once released, the learner reads the outcome, remediation, feedback, assessor and both deadlines');
select results_eq(
  format($$ select m ->> 'ordinal', m ->> 'title', m ->> 'max_points', m ->> 'points', m ->> 'comment'
            from api.get_my_result(%L), jsonb_array_elements(marks) m $$, :'result'),
  $$ values ('1'::text, 'Records are complete'::text, '10'::text, '9'::text, 'Every record is there.'::text),
            ('2', 'Retention rules applied', '5', '2', null),
            ('3', 'Filing is traceable', '5', null, null) $$,
  'every criterion is listed with its maximum; unmarked ones and blank comments come back empty');
select results_eq(
  format($$ select assessed_version ->> 'version_number', assessed_version ? 'receipt_reference'
            from api.get_my_result(%L) $$, :'result'),
  $$ values ('1'::text, true) $$, 'the page names the version that was assessed');

-- First opened by the learner (NFR-11): recorded once per release, and never changed
reset role;
select results_eq(
  format($$ select count(*)::int, bool_and(learner_id = %L) from assessment.result_first_views
            where result_id = %L $$, :'learner', :'result'),
  $$ values (1, true) $$, 'opening the released result records the first view');
reset role;
select pg_temp.act_as(:'learner');
select first_viewed_at as first_view from api.get_my_result(:'result') \gset
reset role;
select results_eq(
  format($$ select count(*)::int from assessment.result_first_views where result_id = %L $$, :'result'),
  $$ values (1) $$, 'opening it again adds nothing');
select throws_ok(
  format($$ update assessment.result_first_views set first_viewed_at = now() - interval '1 day'
            where result_id = %L $$, :'result'),
  '42501', null, 'the first view cannot be rewritten');
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  $$ select state, outcome, appeal_deadline_at is not null, remediation_deadline_at is not null
     from api.list_my_results() $$,
  $$ values ('released'::text, 'not_yet_competent'::text, true, true) $$,
  'the list shows the released outcome with its appeal and resubmission deadlines');

-- A resubmission waits behind the released result; the result shown stays the released one
reset role;
select pg_temp.ready_item('competent') as resubmission \gset
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select state, outcome, assessed_version ->> 'version_number', latest_version ->> 'version_number'
            from api.get_my_result(%L) $$, :'result'),
  $$ values ('released'::text, 'not_yet_competent'::text, '1'::text, '2'::text) $$,
  'while version 2 is being assessed, the released outcome for version 1 still stands');

-- Its release is a new release: first opened again, and no remediation for a Competent outcome
reset role;
select pg_temp.act_as(:'assessor');
select is(status, 'ok', 'the assessor finalises version 2 as Competent') from api.finalise_decision(:'resubmission', 1);
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select outcome, remediation, remediation_deadline_at, assessed_version ->> 'version_number'
            from api.get_my_result(%L) $$, :'result'),
  $$ values ('competent'::text, null::text, null::timestamptz, '2'::text) $$,
  'the Competent decision on version 2 carries no remediation or resubmission deadline');
reset role;
select results_eq(
  format($$ select count(*)::int from assessment.result_first_views where result_id = %L $$, :'result'),
  $$ values (2) $$, 'each release is first opened on its own');

-- In a moderated cohort a finalised decision stays held, and the learner still reads nothing (test plan 13)
update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = :'cohort';
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000c2', 'authenticated',
        'authenticated', 'pgtap.result@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values ('00000000-0000-4000-8000-0000000000c2', 'pgTAP Held Learner');
insert into programmes.enrolments (cohort_id, profile_id) values (:'cohort', '00000000-0000-4000-8000-0000000000c2');
insert into assessment.results (assessable_item_id, learner_id)
select ai.id, '00000000-0000-4000-8000-0000000000c2' from assessment.assessable_items ai
where ai.task_id = '10000000-0000-4000-8000-000000000020'
returning id as held_result \gset
insert into assessment.assessment_instances (result_id, assessor_id, state)
values (:'held_result', :'assessor', 'marking') returning id as held_instance \gset
insert into assessment.marking_drafts (instance_id, assessor_id, outcome, justification, feedback)
values (:'held_instance', :'assessor', 'competent', 'Meets every criterion.', 'Well done.');
reset role;
select pg_temp.act_as(:'assessor');
select is(status, 'ok', 'the moderated decision is finalised') from api.finalise_decision(:'held_instance', 1);
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000c2');
select results_eq(
  format($$ select state, moderated, outcome, feedback, marks, released_at from api.get_my_result(%L) $$,
    :'held_result'),
  $$ values ('held'::text, true, null::text, null::text, null::jsonb, null::timestamptz) $$,
  'a decided but held result shows nothing of the decision to its learner');

select * from finish();
rollback;
