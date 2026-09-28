-- The facilitator's submission dashboard and reminders (S2-16; FR-210, FR-211, FR-212). Uses the local seed:
-- facilitator@ sets work in "2026 Intake B", where learner@ is enrolled; Task 3 is published there.
create extension if not exists pgtap with schema extensions;

begin;
select plan(22);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A learner hands in Task 3 (runs as postgres; leaves the caller as postgres).
create function pg_temp.hand_in(p_learner uuid) returns void language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_intent uuid;
  v_file uuid;
  v_key text := v_task::text || '/' || p_learner::text || '/' || gen_random_uuid()::text || '.pdf';
begin
  insert into submissions.file_upload_intents (profile_id, context_type, context_id, object_key, original_filename,
    declared_media_type, declared_bytes, max_bytes, allowed_media_types, expires_at, finalised_at)
  values (p_learner, 'task_submission', v_task, v_key, 'work.pdf', 'application/pdf', 1024, 26214400,
    array['application/pdf'], now() + interval '2 hours', now()) returning id into v_intent;
  insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
  values (v_intent, 'submissions', v_key, 'work.pdf', 1024, 'application/pdf', p_learner) returning id into v_file;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_learner, 'role', 'authenticated')::text, true);
  perform api.submit_task(v_task, jsonb_build_array(jsonb_build_object('file_id', v_file, 'requirement_id', null)),
    gen_random_uuid());
  perform set_config('role', 'postgres', true);
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set late_learner 00000000-0000-4000-8000-0000000000e1
\set quiet_learner 00000000-0000-4000-8000-0000000000e2
\set cohort 10000000-0000-4000-8000-000000000010
\set task 10000000-0000-4000-8000-000000000020

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :'late_learner', 'authenticated', 'authenticated', 'late@takusani.test', now(), now()),
       ('00000000-0000-0000-0000-000000000000', :'quiet_learner', 'authenticated', 'authenticated', 'quiet@takusani.test', now(), now());
insert into identity.profiles (id, full_name, learner_number)
values (:'late_learner', 'Thandi Late', 'KSI-9101'), (:'quiet_learner', 'Zola Quiet', 'KSI-9102');
insert into programmes.enrolments (cohort_id, profile_id) values (:'cohort', :'late_learner'), (:'cohort', :'quiet_learner');

-- Before anyone hands in
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select audience, submitted, late, outstanding from api.list_task_submission_counts(%L) $$, :'cohort'),
  $$ values (3, 0, 0, 3) $$, 'all three learners are outstanding');

-- One on time; the due time passes; one late; one uploads a file but does not hand in
reset role;
select pg_temp.hand_in(:'learner');
update submissions.tasks set due_at = now() - interval '42 minutes' where id = :'task';
select pg_temp.hand_in(:'late_learner');
insert into submissions.file_upload_intents (profile_id, context_type, context_id, object_key, original_filename,
  declared_media_type, declared_bytes, max_bytes, allowed_media_types, expires_at, finalised_at)
values (:'quiet_learner', 'task_submission', :'task', :'task' || '/' || :'quiet_learner' || '/draft.pdf', 'draft.pdf',
  'application/pdf', 1024, 26214400, array['application/pdf'], now() + interval '2 hours', now())
returning id as quiet_intent \gset
insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
values (:'quiet_intent', 'submissions', :'task' || '/' || :'quiet_learner' || '/draft.pdf', 'draft.pdf', 1024,
  'application/pdf', :'quiet_learner');

select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select audience, submitted, late, outstanding from api.list_task_submission_counts(%L) $$, :'cohort'),
  $$ values (3, 1, 1, 1) $$, 'one on time, one late, one outstanding (FR-210)');
select results_eq(format($$ select full_name, status, latest_version, files_waiting from api.list_task_submissions(%L) $$, :'task'),
  $$ values ('Zola Quiet'::text, 'outstanding'::text, null::integer, true),
            ('Thandi Late', 'late', 1, false),
            ('Lerato Mokoena', 'submitted', 1, false) $$,
  'the learners, outstanding first, with files uploaded but not handed in flagged');
select results_eq(format($$ select late_by_seconds between 2400 and 2700 from api.list_task_submissions(%L) where status = 'late' $$, :'task'),
  $$ values (true) $$, 'how late it was is given');

-- The learner's history (F-09)
select results_eq(format($$ select task_title, status, jsonb_array_length(versions), jsonb_array_length(reminders)
                            from api.get_learner_submission_history(%L) $$, :'learner'),
  $$ values ('Task 3: Workplace records portfolio'::text, 'submitted'::text, 1, 0) $$,
  'one learner''s history: the task, where they stand, and each version');
select results_eq(format($$ select versions -> 0 ->> 'receipt_reference' like 'SUB-%%' from api.get_learner_submission_history(%L) $$, :'learner'),
  $$ values (true) $$, 'with the receipt of each version');

-- Reminders (FR-212)
select results_eq(format($$ select status from api.send_task_reminder(%L, array[%L]::uuid[], '   ') $$, :'task', :'quiet_learner'),
  $$ values ('invalid_message'::text) $$, 'a reminder needs a message');
select results_eq(format($$ select status from api.send_task_reminder(%L, array[]::uuid[], 'Please hand in.') $$, :'task'),
  $$ values ('no_learners'::text) $$, 'and someone to send it to');
select results_eq(
  format($$ select status, sent, skipped_submitted, skipped_recent from api.send_task_reminder(%L, array[%L, %L, %L]::uuid[],
    'Task 3 is overdue. Hand it in today, even if it is not perfect.') $$, :'task', :'quiet_learner', :'learner', :'late_learner'),
  $$ values ('ok'::text, 1, 2, 0) $$, 'only the outstanding learner is reminded; those who handed in are skipped');
select results_eq(
  format($$ select status, sent, skipped_recent from api.send_task_reminder(%L, array[%L]::uuid[], 'Again') $$, :'task', :'quiet_learner'),
  $$ values ('ok'::text, 0, 1) $$, 'a second reminder within the hour is skipped, so a double click sends one');
select results_eq(format($$ select last_reminder_at is not null from api.list_task_submissions(%L) where status = 'outstanding' $$, :'task'),
  $$ values (true) $$, 'the dashboard shows when the learner was last reminded');
select results_eq(format($$ select jsonb_array_length(reminders), reminders -> 0 ->> 'sent_by' from api.get_learner_submission_history(%L) $$, :'quiet_learner'),
  $$ values (1, 'Pieter van Wyk'::text) $$, 'and it is logged against the learner''s record, with who sent it');

reset role;
select results_eq(format($$ select count(*)::int from submissions.task_reminders where learner_id = %L $$, :'quiet_learner'),
  $$ values (1) $$, 'one reminder row for the learner');
select throws_ok(format($$ update submissions.task_reminders set message = 'changed' where learner_id = %L $$, :'quiet_learner'),
  '42501', null, 'the reminder log is append-only');
select results_eq(format($$ select audit.events.after ->> 'sent' from audit.events where action = 'submissions.reminder_sent' order by occurred_at limit 1 $$),
  $$ values ('1'::text) $$, 'sending is audited with the count');

-- The learner is told
select pg_temp.act_as(:'quiet_learner');
select results_eq($$ select event_type, link from api.list_my_notifications('deadlines') where event_type = 'task_reminder' $$,
  format($$ values ('task_reminder'::text, '/learn/tasks/' || %L) $$, :'task'), 'the reminded learner gets it under Deadlines');
select is_empty($$ select * from api.list_task_submission_counts('10000000-0000-4000-8000-000000000010') $$,
  'a learner cannot see the dashboard');
select is_empty(format($$ select * from api.list_task_submissions(%L) $$, :'task'), 'nor the learners of a task');
select is_empty(format($$ select * from api.get_learner_submission_history(%L) $$, :'learner'), 'nor another learner''s history');
select results_eq(format($$ select status from api.send_task_reminder(%L, array[%L]::uuid[], 'Hi') $$, :'task', :'learner'),
  $$ values ('forbidden'::text) $$, 'nor send reminders');

-- No outcomes here (P0-10 boundaries): the reads carry no outcome, mark or decision column
reset role;
select is_empty($$ select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'api' and p.proname in ('list_task_submissions', 'get_learner_submission_history')
                     and (pg_get_function_result(p.oid) ilike '%outcome%' or pg_get_function_result(p.oid) ilike '%mark%') $$,
  'the dashboard reads return no outcome or mark');
select results_eq(format($$ select count(*)::int from notifications.notifications where event_type = 'task_reminder' $$),
  $$ values (1) $$, 'one reminder notification in all');

select * from finish();
rollback;
