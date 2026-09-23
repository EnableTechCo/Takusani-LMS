-- Upload intents (S2-03, ADR-007, register G3): who may be authorised to upload, and what finalisation accepts.
-- The end-to-end path, including a 25 MB upload interrupted part way, is scripts/check-resumable-upload.mjs; the
-- refusals that need a clock or an object planted by hand are here.
-- Uses the local seed: the published task "Task 3: Workplace records portfolio" and the enrolled learner.
create extension if not exists pgtap with schema extensions;

begin;
select plan(23);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- Puts an object in Storage the way a finished upload would, so finalisation has something to read.
create function pg_temp.place_object(p_key text, p_bytes bigint, p_type text) returns void language sql as $$
  insert into storage.objects (bucket_id, name, metadata)
  values ('submissions', p_key, jsonb_build_object('size', p_bytes, 'mimetype', p_type))
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set task 10000000-0000-4000-8000-000000000020
\set pdf application/pdf

-- Who may be authorised
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(
  format($$ select status from api.authorise_upload('task_submission', %L, 'notes.pdf', %L, 1024) $$, :'task', :'pdf'),
  $$ values ('forbidden'::text) $$, 'someone who is not the task audience cannot be authorised to upload');

reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status from api.authorise_upload('material', %L, 'notes.pdf', %L, 1024) $$, :'task', :'pdf'),
  $$ values ('invalid_context'::text) $$, 'only contexts we have built are accepted');
select results_eq(
  format($$ select status, max_bytes from api.authorise_upload('task_submission', %L, 'walkthrough.mov',
           'video/quicktime', 1024) $$, :'task'),
  $$ values ('type_not_allowed'::text, 26214400::bigint) $$, 'a video is refused, and the limit is stated');
select results_eq(
  format($$ select status from api.authorise_upload('task_submission', %L, 'huge.pdf', %L, 26214401) $$, :'task', :'pdf'),
  $$ values ('too_large'::text) $$, 'a file over the bucket limit is refused before it is uploaded');
select results_eq(
  format($$ select status from api.authorise_upload('task_submission', %L, 'notes.pdf', %L, 1024, 'not-a-hash') $$,
    :'task', :'pdf'),
  $$ values ('invalid_checksum'::text) $$, 'a malformed checksum is refused');

select (select intent_id from api.authorise_upload(
  'task_submission', :'task', 'portfolio.pdf', :'pdf', 4096,
  'a3f1c0de00000000000000000000000000000000000000000000000000000000',
  '00000000-0000-4000-8000-0000000000f1')) as intent \gset

reset role;
select (select object_key from submissions.file_upload_intents where id = :'intent') as key \gset
select results_eq(
  format($$ select profile_id, context_type, bucket, max_bytes, expires_at > now()
            from submissions.file_upload_intents where id = %L $$, :'intent'),
  format($$ values (%L::uuid, 'task_submission'::text, 'submissions'::text, 26214400::bigint, true) $$, :'learner'),
  'the intent records the person, the context, the bucket, the limit and its own expiry');
select matches(:'key'::text, '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'::text,
  'the object key is random and carries nothing from the file name');

-- The storage rule is the gate, so it is exercised through a real write to storage.objects as the learner would.
select ok(submissions.may_upload_object(:'learner', 'submissions', :'key'),
  'the learner may write the key their intent names');
select ok(not submissions.may_upload_object(:'facilitator', 'submissions', :'key'),
  'nobody else may write it');

select pg_temp.act_as(:'learner');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata) values ('submissions', 'some/other/key.pdf', '{}'::jsonb) $$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'writing a key no intent authorises is refused by the storage policy itself');
select results_eq(format($$ select status from api.finalise_upload(%L) $$, :'intent'),
  $$ values ('not_uploaded'::text) $$, 'finalising before the object exists is refused');

reset role;
select pg_temp.place_object(:'key', 9999, :'pdf');
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status, bytes, media_type from api.finalise_upload(%L) $$, :'intent'),
  format($$ values ('ok'::text, 9999::bigint, %L::text) $$, :'pdf'),
  'finalisation takes the size and type from Storage, not from what the browser declared');
select results_eq(format($$ select status from api.finalise_upload(%L) $$, :'intent'),
  $$ values ('already_finalised'::text) $$, 'finalising twice does not record the file twice');
-- Filtered to this intent: a local database may hold files from earlier runs of the upload check.
select results_eq(
  format($$ select original_filename, bytes from api.list_my_uploads(%L) where intent_id = %L $$, :'task', :'intent'),
  $$ values ('portfolio.pdf'::text, 9999::bigint) $$, 'the file is listed for the next submission');
reset role;
select ok(not submissions.may_upload_object(:'learner', 'submissions', :'key'),
  'once finalised, the key can no longer be written to');
select pg_temp.act_as(:'learner');

-- An upload that finishes after the intent expires is not accepted: the intent is the control (ADR-007).
select (select intent_id from api.authorise_upload('task_submission', :'task', 'late.pdf', :'pdf', 2048)) as late \gset

reset role;
select (select object_key from submissions.file_upload_intents where id = :'late') as late_key \gset
update submissions.file_upload_intents set expires_at = now() - interval '1 minute' where id = :'late';
select pg_temp.place_object(:'late_key', 2048, :'pdf');
select ok(not submissions.may_upload_object(:'learner', 'submissions', :'late_key'),
  'an expired intent stops authorising its key');
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.finalise_upload(%L) $$, :'late'),
  $$ values ('expired'::text) $$, 'and the object that arrived late is refused at finalisation');

-- Someone else's intent is not theirs to finalise.
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.finalise_upload(%L) $$, :'late'),
  $$ values ('intent_not_found'::text) $$, 'another person cannot finalise an intent that is not theirs');

-- Removing a file that was uploaded but not handed in (bug fix: it used to come back after a reload)
reset role;
select (select sf.id from submissions.stored_files sf where sf.intent_id = :'intent') as file_id \gset
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.discard_upload(%L) $$, :'file_id'),
  $$ values ('not_found'::text) $$, 'nobody else can remove the learner''s file');
reset role;
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.discard_upload(%L) $$, :'file_id'),
  $$ values ('ok'::text) $$, 'the learner removes a file they have not handed in');
select is_empty(format($$ select * from api.list_my_uploads(%L) where file_id = %L $$, :'task', :'file_id'),
  'it is no longer listed, so it does not come back after a reload');
select results_eq(
  format($$ select status from api.submit_task(%L, jsonb_build_array(jsonb_build_object('file_id', %L::uuid)),
           gen_random_uuid()) $$, :'task', :'file_id'),
  $$ values ('file_not_available'::text) $$, 'and it cannot be handed in');
select results_eq(format($$ select status from api.discard_upload(%L) $$, :'file_id'),
  $$ values ('ok'::text) $$, 'removing it twice is harmless');
reset role;

select * from finish();
rollback;
