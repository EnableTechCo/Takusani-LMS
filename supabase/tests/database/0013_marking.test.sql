-- The marking workspace (S2-07, FR-401 to FR-405): scope, taking an item, the draft, and reading evidence.
-- Uses the local seed: the published task, the enrolled learner, assessor@ (global assessor) and staff@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(27);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

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
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set staff 00000000-0000-4000-8000-000000000007
\set task 10000000-0000-4000-8000-000000000020

-- The learner hands work in, which puts it in the queue.
reset role;
select pg_temp.finalised_file(:'task', 'portfolio.pdf') as file1 \gset
select (select object_key from submissions.stored_files where id = :'file1') as key1 \gset
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', null)),
           gen_random_uuid()) $$, :'task', :'file1'),
  $$ values ('ok'::text) $$, 'the learner submits');
reset role;
select (select i.id from assessment.assessment_instances i
        join assessment.results r on r.id = i.result_id
        where r.learner_id = :'learner' and i.state = 'to_mark') as instance \gset

-- Scope (FR-401)
select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select instance_state, learner_name, task_title, version_number from api.list_marking_queue()
            where instance_id = %L $$, :'instance'),
  $$ values ('to_mark'::text, 'Lerato Mokoena'::text, 'Task 3: Workplace records portfolio'::text, 1) $$,
  'an assessor whose role covers the cohort sees the work in their queue');

reset role;
select pg_temp.act_as(:'facilitator');
select is_empty($$ select * from api.list_marking_queue() $$, 'someone without the assessor role has no queue');
select is_empty(format($$ select * from api.get_marking_item(%L) $$, :'instance'),
  'and cannot open the item');
reset role;
select results_eq(
  format($$ select actor_id::text, details ->> 'reason' from audit.events
            where action = 'assessment.access_refused' and object_id = %L $$, :'instance'),
  format($$ values (%L::text, 'outside_scope'::text) $$, :'facilitator'),
  'and the attempt is written to the audit log with who tried');

select pg_temp.act_as(:'learner');
select is_empty(format($$ select * from api.get_marking_item(%L) $$, :'instance'),
  'a learner cannot open the marking of their own work');

-- The item, as the assessor sees it
reset role;
select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select learner_name, moderation_policy, jsonb_array_length(criteria), jsonb_array_length(versions),
                   (versions -> 0 ->> 'assessed')::boolean, draft is null
            from api.get_marking_item(%L) $$, :'instance'),
  $$ values ('Lerato Mokoena'::text, 'not_moderated'::text, 3, 1, true, true) $$,
  'the item carries the rubric, the versions (this one marked as the one assessed) and no draft yet');

-- Taking the item
select results_eq(
  format($$ select status from api.save_marking_draft(%L, 0, '[]'::jsonb, null, null, null, null, null) $$, :'instance'),
  $$ values ('not_your_item'::text) $$, 'a draft cannot be saved before the item is taken');
select results_eq(format($$ select status from api.take_marking(%L) $$, :'instance'),
  $$ values ('ok'::text) $$, 'the assessor takes the item');
select results_eq(format($$ select status from api.take_marking(%L) $$, :'instance'),
  $$ values ('ok'::text) $$, 'taking it again is harmless');
reset role;
select results_eq(
  format($$ select state, assessor_id::text from assessment.assessment_instances where id = %L $$, :'instance'),
  format($$ values ('marking'::text, %L::text) $$, :'assessor'),
  'the item is now being marked by that assessor');

select pg_temp.act_as(:'staff');
select results_eq(format($$ select status from api.take_marking(%L) $$, :'instance'),
  $$ values ('allocated_to_someone_else'::text) $$, 'another assessor cannot take an item someone is marking');
select results_eq(
  format($$ select status from api.save_marking_draft(%L, 0, '[]'::jsonb, 'Mine now', null, null, null, null) $$,
    :'instance'),
  $$ values ('not_your_item'::text) $$, 'nor save a draft on it');
select results_eq(
  format($$ select assessor_name from api.get_marking_item(%L) $$, :'instance'),
  $$ values ('Nomsa Dlamini'::text) $$, 'but can see who has it');

-- The draft (FR-403 to FR-405)
reset role;
select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select status, draft_version from api.save_marking_draft(%L, 0,
           '[{"ordinal": 1, "points": 8, "comment": "Register complete."}]'::jsonb,
           null, null, null, null, null) $$, :'instance'),
  $$ values ('ok'::text, 1) $$, 'an incomplete draft is saved: scores first, the outcome later');
select results_eq(
  format($$ select status from api.save_marking_draft(%L, 1, '[{"ordinal": 1, "points": 11}]'::jsonb,
           null, null, null, null, null) $$, :'instance'),
  $$ values ('invalid_points'::text) $$, 'points cannot exceed what the rubric row is worth');
select results_eq(
  format($$ select status from api.save_marking_draft(%L, 1, '[{"ordinal": 9, "points": 1}]'::jsonb,
           null, null, null, null, null) $$, :'instance'),
  $$ values ('invalid_points'::text) $$, 'nor be given for a row the rubric does not have');
select results_eq(
  format($$ select status from api.save_marking_draft(%L, 1, '[]'::jsonb, null, 'excellent', null, null, null) $$,
    :'instance'),
  $$ values ('invalid_outcome'::text) $$, 'the outcome is competent or not yet competent, nothing else');
select results_eq(
  format($$ select status from api.save_marking_draft(%L, 1, '[]'::jsonb, null, null, null, null, 0) $$, :'instance'),
  $$ values ('invalid_resubmission_days'::text) $$, 'a resubmission period is at least one day');
select results_eq(
  format($$ select status, draft_version from api.save_marking_draft(%L, 1,
           '[{"ordinal": 1, "points": 8}, {"ordinal": 2, "points": 2}, {"ordinal": 3, "points": 4}]'::jsonb,
           'The register is complete; the retention schedule is not cited.', 'not_yet_competent',
           'Criterion 2 is not met: the schedule is missing.', 'Add the retention schedule you work to.', 14) $$,
    :'instance'),
  $$ values ('ok'::text, 2) $$, 'a complete draft with the outcome, justification and remediation is saved');
select results_eq(
  format($$ select status, draft_version from api.save_marking_draft(%L, 1, '[]'::jsonb, 'From an old tab',
           null, null, null, null) $$, :'instance'),
  $$ values ('stale_version'::text, 2) $$,
  'a save from an older version is refused and says which version is current, so nothing is overwritten');
select results_eq(
  format($$ select draft ->> 'outcome', (draft ->> 'resubmission_days')::int, (draft ->> 'version')::int
            from api.get_marking_item(%L) $$, :'instance'),
  $$ values ('not_yet_competent'::text, 14, 2) $$, 'reopening the item brings the draft back');

-- Evidence (the storage policy)
reset role;
select ok(assessment.may_read_evidence(:'assessor', 'submissions', :'key1'),
  'the assessor may read the files of work they may mark');
select ok(not assessment.may_read_evidence(:'facilitator', 'submissions', :'key1'),
  'someone who may not mark it may not read them');

-- Reading from Storage as the signed-in person: every read policy on the bucket runs, so a policy that cannot run
-- breaks all reads. This is the check that would have caught the S2-03 policy that queried a table directly.
insert into storage.objects (bucket_id, name, metadata)
values ('submissions', :'key1', '{"size": 2048, "mimetype": "application/pdf"}'::jsonb);
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select count(*)::int from storage.objects where bucket_id = 'submissions' and name = %L $$, :'key1'),
  $$ values (1) $$, 'the assessor can read the evidence object through Storage''s own rules');
reset role;
select pg_temp.act_as(:'learner');
select results_eq(format($$ select count(*)::int from storage.objects where bucket_id = 'submissions' and name = %L $$, :'key1'),
  $$ values (1) $$, 'the learner can read their own upload');
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select count(*)::int from storage.objects where bucket_id = 'submissions' and name = %L $$, :'key1'),
  $$ values (0) $$, 'someone else sees nothing, and gets no error either');
reset role;

select * from finish();
rollback;
