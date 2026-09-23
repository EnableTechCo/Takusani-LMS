-- Versioned submissions (S2-04, FR-308 to FR-311, BR-03): what is accepted, what is refused, what is kept.
-- Uses the local seed: the published task "Task 3: Workplace records portfolio" and the enrolled learner.
create extension if not exists pgtap with schema extensions;

begin;
select plan(23);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A finalised file for the learner, as an upload would leave it (the upload path itself is 0010).
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
\set task 10000000-0000-4000-8000-000000000020

-- Evidence requirements are set on the draft, like the rubric
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(
  format($$ select status from api.set_task_requirements(%L, '[{"title": "Access register"}]'::jsonb) $$, :'task'),
  $$ values ('not_a_draft'::text) $$, 'a published task keeps the requirements it was published with');

reset role;
-- The seeded task is already published, so requirements are planted directly for the rest of the test.
insert into submissions.task_evidence_requirements (task_id, ordinal, title, guidance, mandatory)
values (:'task', 1, 'Access register', 'A PDF of the register for the last six months.', true),
       (:'task', 2, 'Filing index', null, true),
       (:'task', 3, 'Anything else you want considered', null, false);
select (select id from submissions.task_evidence_requirements where task_id = :'task' and ordinal = 1) as req1 \gset
select (select id from submissions.task_evidence_requirements where task_id = :'task' and ordinal = 2) as req2 \gset
select (select id from submissions.task_evidence_requirements where task_id = :'task' and ordinal = 3) as req3 \gset
select pg_temp.finalised_file(:'task', 'register.pdf') as file1 \gset
select pg_temp.finalised_file(:'task', 'index.pdf') as file2 \gset
select pg_temp.finalised_file(:'task', 'notes.pdf') as file3 \gset
select pg_temp.finalised_file(:'task', 'register-v2.pdf') as file4 \gset

-- Who may submit
select pg_temp.act_as(:'facilitator');
select results_eq(
  format($$ select status from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           gen_random_uuid()) $$, :'task', :'file1', :'req1'),
  $$ values ('forbidden'::text) $$, 'someone who is not the audience cannot submit');

reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status, detail from api.submit_task(%L, '[]'::jsonb, gen_random_uuid()) $$, :'task'),
  $$ values ('missing_evidence'::text, 'Access register'::text) $$,
  'a mandatory requirement with no file blocks the submission, and is named');
select results_eq(
  format($$ select status, detail from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           gen_random_uuid()) $$, :'task', :'file1', :'req1'),
  $$ values ('missing_evidence'::text, 'Filing index'::text) $$,
  'the next missing requirement is named in turn');
select results_eq(
  format($$ select status from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           null) $$, :'task', :'file1', :'req1'),
  $$ values ('client_submission_id_required'::text) $$, 'a submission must carry the learner attempt identifier');

-- A first version
\set attempt1 00000000-0000-4000-8000-0000000000b1
select results_eq(
  format($$ select status, version_number, is_late from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid),
                             jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           %L) $$, :'task', :'file1', :'req1', :'file2', :'req2', :'attempt1'),
  $$ values ('ok'::text, 1, false) $$, 'the first version is accepted, on time');

reset role;
select results_eq(
  format($$ select v.version_number, v.is_late, v.supersedes_version_id is null, count(f.*)::int
            from submissions.submission_versions v
            join submissions.submissions s on s.id = v.submission_id
            left join submissions.submission_files f on f.version_id = v.id
            where s.task_id = %L group by 1,2,3 $$, :'task'),
  $$ values (1, false, true, 2) $$, 'it holds both files and supersedes nothing');
select matches(
  (select receipt_reference from submissions.submission_versions limit 1),
  '^SUB-[0-9]{8}-[0-9A-F]{4}$', 'the receipt reads like the one on the prototype, SUB-20260904-7K2M');
select is_empty(
  format($$ select 1 from submissions.file_upload_intents i join submissions.stored_files sf on sf.intent_id = i.id
            where sf.id in (%L, %L) and i.consumed_at is null $$, :'file1', :'file2'),
  'the files it used are consumed, so they cannot be handed in again');

-- A retry of the same attempt is not a second version (UX flow A, E7)
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status, version_number, detail from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid),
                             jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           %L) $$, :'task', :'file1', :'req1', :'file2', :'req2', :'attempt1'),
  $$ values ('ok'::text, 1, 'retry'::text) $$, 'a retry returns the first receipt, not a new version');
reset role;
select results_eq(
  format($$ select count(*)::int from submissions.submission_versions v join submissions.submissions s on s.id = v.submission_id
            where s.task_id = %L $$, :'task'),
  $$ values (1) $$, 'and there is still only one version on record');

-- A file already in a version cannot be used again
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid),
                             jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           gen_random_uuid()) $$, :'task', :'file1', :'req1', :'file2', :'req2'),
  $$ values ('file_not_available'::text) $$, 'a file already handed in cannot be handed in a second time');

-- Version 2 keeps version 1 (FR-310)
\set attempt2 00000000-0000-4000-8000-0000000000b2
select results_eq(
  format($$ select status, version_number from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid),
                             jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           %L) $$, :'task', :'file4', :'req1', :'file3', :'req2', :'attempt2'),
  $$ values ('ok'::text, 2) $$, 'a second version is accepted');
reset role;
select results_eq(
  format($$ select v2.version_number, v1.version_number
            from submissions.submission_versions v2
            join submissions.submission_versions v1 on v1.id = v2.supersedes_version_id
            join submissions.submissions s on s.id = v2.submission_id
            where s.task_id = %L $$, :'task'),
  $$ values (2, 1) $$, 'version 2 records which version it supersedes, and version 1 is still there');

-- Nothing may be edited or removed afterwards (BR-03)
select throws_ok(
  $$ update submissions.submission_versions set is_late = true where version_number = 1 $$,
  '42501', 'UPDATE on submissions.submission_versions is not allowed: the table is append-only',
  'a version cannot be edited, not even by the owner of the database');
select throws_ok(
  $$ delete from submissions.submission_files $$,
  '42501', 'DELETE on submissions.submission_files is not allowed: the table is append-only',
  'nor can the files of a version be removed');

-- The learner's own view
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select jsonb_array_length(versions), jsonb_array_length(requirements) from api.get_my_task(%L) $$, :'task'),
  $$ values (2, 3) $$, 'the learner sees both versions and all three requirements');
select results_eq(
  format($$ select (versions -> 0 ->> 'version_number')::int, jsonb_array_length(versions -> 0 -> 'files')
            from api.get_my_task(%L) $$, :'task'),
  $$ values (2, 2) $$, 'newest version first, with its files');

-- Lateness is the server's decision (FR-309)
reset role;
update submissions.tasks set due_at = now() - interval '2 hours' where id = :'task';
select pg_temp.finalised_file(:'task', 'late-register.pdf') as file5 \gset
select pg_temp.finalised_file(:'task', 'late-index.pdf') as file6 \gset
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status, version_number, is_late from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid),
                             jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           gen_random_uuid()) $$, :'task', :'file5', :'req1', :'file6', :'req2'),
  $$ values ('ok'::text, 3, true) $$, 'work handed in after the due date is accepted and marked late');
reset role;
select ok(
  (select late_by_seconds from submissions.submission_versions where version_number = 3) between 7100 and 7300,
  'and how late it was is recorded, so a grace period can be decided later without rewriting history');

-- A task that closes at its due date refuses late work instead
update submissions.tasks set late_policy = 'closed_at_due' where id = :'task';
select pg_temp.finalised_file(:'task', 'too-late.pdf') as file7 \gset
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status from api.submit_task(%L,
           jsonb_build_array(jsonb_build_object('file_id', %L::uuid, 'requirement_id', %L::uuid)),
           gen_random_uuid()) $$, :'task', :'file7', :'req1'),
  $$ values ('closed'::text) $$, 'when the task closes at the due date, late work is refused outright');

-- Audit
reset role;
select results_eq(
  $$ select acting_role, after ->> 'is_late' from audit.events
     where action = 'submissions.version_submitted' and (after ->> 'version')::int = 3 $$,
  $$ values ('learner'::text, 'true'::text) $$, 'each submitted version is audited, lateness included');
select results_eq(
  $$ select count(*)::int from audit.events where action = 'submissions.version_submitted' $$,
  $$ values (3) $$, 'and a retry did not write a second audit entry');

select * from finish();
rollback;
