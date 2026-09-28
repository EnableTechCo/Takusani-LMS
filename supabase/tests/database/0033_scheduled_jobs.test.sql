-- Scheduled database jobs (S3-10, ADR-025). Uses the local seed: learner@, coordinator@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(39);

\set learner 00000000-0000-4000-8000-000000000001
\set coordinator 00000000-0000-4000-8000-000000000005

-- ---------------------------------------------------------------------------------------------------------------
-- The catalogue and the scheduler agree
-- ---------------------------------------------------------------------------------------------------------------

select set_eq(
  $$ select jobname, schedule, command from cron.job where jobname in (select name from audit.scheduled_jobs) $$,
  $$ select name, schedule, format('select audit.run_job(%L)', name) from audit.scheduled_jobs where kind = 'recurring' $$,
  'every recurring job is scheduled in pg_cron, through the wrapper, on its catalogue schedule');
select set_eq($$ select name from audit.scheduled_jobs order by name $$,
  $$ values ('expire-upload-intents'), ('purge-job-history'), ('purge-rate-buckets'), ('release-notice'), ('release-scheduled-notices') $$,
  'the first jobs are registered');
select is_empty($$
  select name from audit.scheduled_jobs j
  where j.kind = 'recurring' and (to_regprocedure(j.handler || '()') is null
     or (select p.prorettype from pg_proc p where p.oid = to_regprocedure(j.handler || '()')) <> 'integer'::regtype)
$$, 'every recurring handler takes nothing and returns how much it did');
select is_empty($$
  select name from audit.scheduled_jobs j
  where j.kind = 'one_shot' and (to_regprocedure(j.handler || '(text)') is null
     or (select p.prorettype from pg_proc p where p.oid = to_regprocedure(j.handler || '(text)')) <> 'integer'::regtype)
$$, 'every one-shot handler takes its domain object and returns how much it did');

-- Nobody outside the database runs a job; only the uptime check reads their health.
select ok(not has_function_privilege('authenticated', 'audit.run_job(text)', 'execute')
      and not has_function_privilege('service_role', 'audit.run_job(text)', 'execute')
      and not has_function_privilege('anon', 'audit.run_job(text)', 'execute'),
  'no request role can run a job');
select ok(not has_function_privilege('authenticated', 'audit.run_once(text, text)', 'execute')
      and not has_function_privilege('service_role', 'audit.run_once(text, text)', 'execute'),
  'no request role can run a one-shot job');
select ok(has_function_privilege('service_role', 'api.scheduled_job_health()', 'execute')
      and not has_function_privilege('authenticated', 'api.scheduled_job_health()', 'execute')
      and not has_function_privilege('anon', 'api.scheduled_job_health()', 'execute'),
  'only the server reads job health');
select ok(not has_table_privilege('service_role', 'audit.scheduled_runs', 'select')
      and not has_table_privilege('authenticated', 'audit.scheduled_runs', 'select'),
  'the heartbeats are not readable directly');

-- ---------------------------------------------------------------------------------------------------------------
-- Recurring jobs and heartbeats
-- ---------------------------------------------------------------------------------------------------------------

create temp table job_effects (object_key text);
create function pg_temp.does_two() returns integer language sql as $$
  insert into job_effects values ('recurring'), ('recurring'); select 2 $$;
create function pg_temp.breaks() returns integer language plpgsql as $$
begin
  insert into job_effects values ('should not stay');
  raise exception 'the disk is full' using errcode = '53100';
end $$;
insert into audit.scheduled_jobs (name, kind, description, handler, schedule, heartbeat_within) values
  ('test-works', 'recurring', 'Test.', 'pg_temp.does_two', '* * * * *', interval '1 hour'),
  ('test-breaks', 'recurring', 'Test.', 'pg_temp.breaks', '* * * * *', interval '1 hour');

select is(audit.run_job('test-works'), 2, 'a job returns how much it did');
select results_eq($$ select status, processed, error_code, finished_at >= started_at from audit.scheduled_runs
                    where job_name = 'test-works' $$,
  $$ values ('succeeded'::text, 2, null::text, true) $$, 'and leaves a heartbeat saying so');
select is(audit.run_job('test-breaks'), null, 'a failing job returns nothing');
select results_eq($$ select status, error_code, error_message, processed from audit.scheduled_runs
                    where job_name = 'test-breaks' $$,
  $$ values ('failed'::text, '53100'::text, 'the disk is full'::text, null::integer) $$,
  'its failure is recorded with the error');
select is((select count(*)::int from job_effects where object_key = 'should not stay'), 0,
  'and what it did before failing is undone');
select throws_ok($$ select audit.run_job('no-such-job') $$, 'P0001', 'no recurring job named no-such-job',
  'an unknown job is an error');

-- ---------------------------------------------------------------------------------------------------------------
-- One-shot jobs: once per domain object
-- ---------------------------------------------------------------------------------------------------------------

create temp table job_switches (object_key text primary key, mode text);
create function pg_temp.once(p_key text) returns integer language plpgsql as $$
declare v_mode text;
begin
  select mode into v_mode from job_switches where object_key = p_key;
  if v_mode = 'break' then raise exception 'not yet'; end if;
  if v_mode = 'nothing' then return null; end if;
  insert into job_effects values (p_key);
  return 1;
end $$;
insert into audit.scheduled_jobs (name, kind, description, handler)
values ('test-once', 'one_shot', 'Test.', 'pg_temp.once');

select is(audit.run_once('test-once', 'cycle-1'), 'done', 'a one-shot job runs for its object');
select is(audit.run_once('test-once', 'cycle-1'), 'already_done', 'and a second trigger for the same object does nothing');
select is((select count(*)::int from job_effects where object_key = 'cycle-1'), 1, 'so the work is done once');
select is(audit.run_once('test-once', 'cycle-2'), 'done', 'another object is its own run');

insert into job_switches values ('cycle-3', 'break');
select is(audit.run_once('test-once', 'cycle-3'), 'failed', 'a failed one-shot run says so');
select results_eq($$ select status, error_message from audit.scheduled_runs where job_name = 'test-once' and object_key = 'cycle-3' $$,
  $$ values ('failed'::text, 'not yet'::text) $$, 'and is recorded against its object');
update job_switches set mode = null where object_key = 'cycle-3';
select is(audit.run_once('test-once', 'cycle-3'), 'done', 'the next trigger tries it again');

insert into job_switches values ('cycle-4', 'nothing');
select is(audit.run_once('test-once', 'cycle-4'), 'nothing_to_do', 'a handler with nothing to do is not recorded as done');
select is_empty($$ select 1 from audit.scheduled_runs where job_name = 'test-once' and object_key = 'cycle-4' $$,
  'so it can run later');
select throws_ok($$ select audit.run_once('test-once', '  ') $$, 'P0001', 'a one-shot run needs its domain object',
  'a one-shot run must name its object');
select throws_ok($$ insert into audit.scheduled_runs (job_name, object_key, started_at, finished_at, status, processed)
                    values ('test-once', 'cycle-1', now(), now(), 'succeeded', 1) $$, '23505', null,
  'the database itself refuses a second success for one object');

-- ---------------------------------------------------------------------------------------------------------------
-- Scheduled notices, one run per notice
-- ---------------------------------------------------------------------------------------------------------------

insert into notifications.notices (id, title, body, audience, send_at, created_by) values
  ('30000000-0000-4000-8000-0000000000a1', 'First', 'Body.', 'everyone', now() - interval '2 minutes', :'coordinator'),
  ('30000000-0000-4000-8000-0000000000a2', 'Second', 'Body.', 'everyone', now() - interval '1 minute', :'coordinator');
create function public.test_break_first_notice() returns trigger language plpgsql as $$
begin
  if new.id = '30000000-0000-4000-8000-0000000000a1' then raise exception 'delivery broke'; end if;
  return new;
end $$;
create trigger test_break_first_notice before update on notifications.notices
  for each row execute function public.test_break_first_notice();

select is(audit.run_job('release-scheduled-notices'), 1, 'a failing notice does not hold back the next one');
select results_eq($$ select id::text, state from notifications.notices
                    where id::text like '30000000-0000-4000-8000-0000000000a_' order by id $$,
  $$ values ('30000000-0000-4000-8000-0000000000a1'::text, 'scheduled'::text),
            ('30000000-0000-4000-8000-0000000000a2', 'sent') $$,
  'the second is sent and the first stays scheduled');
select results_eq($$ select object_key, status from audit.scheduled_runs where job_name = 'release-notice' order by object_key $$,
  $$ values ('30000000-0000-4000-8000-0000000000a1'::text, 'failed'::text),
            ('30000000-0000-4000-8000-0000000000a2', 'succeeded') $$,
  'each notice has its own run, and the failure is on record');

drop trigger test_break_first_notice on notifications.notices;
select is(notifications.release_due_notices(), 1, 'the failed notice goes out on the next run');
select is(audit.run_once('release-notice', '30000000-0000-4000-8000-0000000000a2'), 'already_done',
  'and a sent notice is never sent again');

-- ---------------------------------------------------------------------------------------------------------------
-- Upload intent expiry
-- ---------------------------------------------------------------------------------------------------------------

insert into submissions.file_upload_intents (
  profile_id, context_type, context_id, object_key, original_filename, declared_media_type, declared_bytes,
  max_bytes, allowed_media_types, expires_at, finalised_at, expired_at
) values
  (:'learner', 'task_submission', gen_random_uuid(), 'test/lapsed.pdf', 'lapsed.pdf', 'application/pdf', 10, 100,
   array['application/pdf'], now() - interval '1 minute', null, null),
  (:'learner', 'task_submission', gen_random_uuid(), 'test/live.pdf', 'live.pdf', 'application/pdf', 10, 100,
   array['application/pdf'], now() + interval '1 hour', null, null),
  (:'learner', 'task_submission', gen_random_uuid(), 'test/finalised.pdf', 'finalised.pdf', 'application/pdf', 10, 100,
   array['application/pdf'], now() - interval '1 hour', now() - interval '2 hours', null),
  (:'learner', 'task_submission', gen_random_uuid(), 'test/old-empty.pdf', 'old-empty.pdf', 'application/pdf', 10, 100,
   array['application/pdf'], now() - interval '9 days', null, now() - interval '8 days'),
  (:'learner', 'task_submission', gen_random_uuid(), 'test/old-with-object.pdf', 'old.pdf', 'application/pdf', 10, 100,
   array['application/pdf'], now() - interval '9 days', null, now() - interval '8 days');
insert into storage.objects (bucket_id, name, metadata)
values ('submissions', 'test/old-with-object.pdf', '{"size": 10}'::jsonb);

select is(audit.run_job('expire-upload-intents'), 2, 'the job expires one intent and removes one');
select results_eq($$ select object_key, expired_at is not null from submissions.file_upload_intents
                    where object_key like 'test/%' order by object_key $$,
  $$ values ('test/finalised.pdf'::text, false), ('test/lapsed.pdf', true), ('test/live.pdf', false),
            ('test/old-with-object.pdf', true) $$,
  'a lapsed intent is expired; a live or finalised one is not; an old one with nothing uploaded is removed');
select throws_ok($$ update submissions.file_upload_intents set expired_at = now() where object_key = 'test/finalised.pdf' $$,
  '23514', null, 'a finalised upload can never be marked expired');

-- ---------------------------------------------------------------------------------------------------------------
-- Purging history
-- ---------------------------------------------------------------------------------------------------------------

insert into audit.scheduled_runs (job_name, object_key, started_at, finished_at, status, processed, error_code) values
  ('test-works', null, now() - interval '31 days', now() - interval '31 days', 'succeeded', 1, null),
  ('test-breaks', null, now() - interval '31 days', now() - interval '31 days', 'failed', null, 'XX000'),
  ('test-breaks', null, now() - interval '91 days', now() - interval '91 days', 'failed', null, 'XX000'),
  ('test-once', 'cycle-old', now() - interval '400 days', now() - interval '400 days', 'succeeded', 1, null);
insert into cron.job_run_details (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
values (1, 999999, 1, 'postgres', 'postgres', 'select 1', 'succeeded', '1 row', now() - interval '8 days', now() - interval '8 days');
insert into pgmq.a_notification_delivery (msg_id, read_ct, enqueued_at, archived_at, vt, message)
values (999999, 1, now() - interval '31 days', now() - interval '31 days', now() - interval '31 days', '{}'::jsonb);

select ok(audit.run_job('purge-job-history') >= 4, 'the purge removes old history');
select results_eq($$ select job_name, status, extract(day from now() - finished_at)::int from audit.scheduled_runs
                    where finished_at < now() - interval '30 days' order by 1 $$,
  $$ values ('test-breaks'::text, 'failed'::text, 31), ('test-once', 'succeeded', 400) $$,
  'recent failures and every one-shot success are kept; old heartbeats and old failures go');
select ok(not exists (select 1 from cron.job_run_details where runid = 999999)
      and not exists (select 1 from pgmq.a_notification_delivery where msg_id = 999999),
  'the scheduler''s old run log and old archived queue messages go');

-- ---------------------------------------------------------------------------------------------------------------
-- Health: a missed heartbeat
-- ---------------------------------------------------------------------------------------------------------------

select results_eq($$ select job_name, scheduled, last_status, overdue from api.scheduled_job_health()
                    where job_name in ('expire-upload-intents', 'purge-job-history', 'release-notice') order by 1 $$,
  $$ values ('expire-upload-intents'::text, true, 'succeeded'::text, false), ('purge-job-history', true, 'succeeded', false),
            ('release-notice', null, 'succeeded', false) $$,
  'jobs that have just run are healthy, and a one-shot job is never overdue');

delete from audit.scheduled_runs where job_name = 'expire-upload-intents';
update audit.scheduled_jobs set registered_at = now() - interval '31 minutes' where name = 'expire-upload-intents';
select results_eq($$ select last_success_at, overdue from api.scheduled_job_health() where job_name = 'expire-upload-intents' $$,
  $$ values (null::timestamptz, true) $$, 'a job that has not succeeded within its heartbeat is overdue');

select cron.unschedule('purge-job-history');
select results_eq($$ select scheduled, overdue from api.scheduled_job_health() where job_name = 'purge-job-history' $$,
  $$ values (false, true) $$, 'a job missing from the scheduler is overdue at once');

select * from finish();
rollback;
