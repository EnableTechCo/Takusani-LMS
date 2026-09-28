-- Scheduled database jobs (S3-10; ADR-025 points 2 and 4; operations, "Asynchronous processing").
--
-- Pure-database schedules run on Supabase Cron (pg_cron), so they keep running when Vercel is unreachable and on any
-- hosting plan. Every job is listed in audit.scheduled_jobs and runs through one wrapper that records a heartbeat in
-- audit.scheduled_runs: when it started and finished, how much it did, and, if it failed, the error. A failure is
-- caught and recorded, so it never goes unseen the way a bare pg_cron job's failure does.
--
-- Two kinds of job:
--   * recurring: pg_cron calls audit.run_job(name) on its schedule; every run leaves a heartbeat;
--   * one-shot: work on one domain object, run through audit.run_once(name, object key). It succeeds at most once
--     per object: uniqueness is by the domain object, never by clock time, so a duplicate or late trigger is
--     harmless. A failed attempt is recorded and tried again on the next trigger.
--
-- The first jobs:
--   * release-scheduled-notices (every minute): moves onto the framework. Each notice is now a one-shot run of its
--     own, so a notice that fails is recorded and retried without holding back the others, which before this would
--     all have rolled back with it;
--   * expire-upload-intents (every 10 minutes): marks unfinalised intents whose time has passed as expired, and
--     deletes expired intents after 7 days when no object was ever uploaded for them. An intent with an object stays
--     for the Storage clean-up, which needs the Storage API and so runs outside the database;
--   * purge-job-history (daily): pg_cron's own run log after 7 days, heartbeats after 30 days (failures after 90;
--     one-shot successes are kept, as they are the record that the work was done), and archived queue messages
--     after 30 days (the delivery ledger in notification_deliveries is kept).
--
-- The data model's rate_buckets and idempotency_records do not exist yet: every command so far stores its client
-- identifier with its own domain record, and the two rate limits count their own rows (upload intents, sign-in
-- failures). Whichever ticket introduces them adds its purge job here, as one catalogue row and one handler.
--
-- A missed heartbeat is the alert: api.scheduled_job_health() reports each job's last success and whether it is
-- overdue, and GET /api/health/jobs returns 503 for the uptime monitor when any job is.

-- ---------------------------------------------------------------------------------------------------------------
-- Catalogue and heartbeats
-- ---------------------------------------------------------------------------------------------------------------

-- Rows are maintained by migrations. The handler is a schema-qualified function name: () returns integer for a
-- recurring job, (text) returns integer for a one-shot job. It returns how many things it did; a one-shot handler
-- returns null when there was nothing to do, which is not recorded as done.
create table audit.scheduled_jobs (
  name text primary key check (name ~ '^[a-z][a-z0-9-]{2,62}$'),
  kind text not null check (kind in ('recurring', 'one_shot')),
  description text not null,
  handler text not null check (handler ~ '^[a-z_]+\.[a-z_]+$'),
  -- pg_cron syntax, in UTC.
  schedule text,
  -- A recurring job is overdue when it has not succeeded for this long.
  heartbeat_within interval,
  registered_at timestamptz not null default now(),
  constraint recurring_is_scheduled check (
    (kind = 'recurring') = (schedule is not null and heartbeat_within is not null)
  )
);

create table audit.scheduled_runs (
  id bigint generated always as identity primary key,
  job_name text not null references audit.scheduled_jobs (name),
  -- The domain object of a one-shot run; null for a recurring run.
  object_key text check (char_length(object_key) between 1 and 200),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  status text not null check (status in ('succeeded', 'failed')),
  processed integer check (processed >= 0),
  error_code text,
  error_message text check (char_length(error_message) <= 500),
  constraint failure_is_recorded check ((status = 'failed') = (error_code is not null)),
  constraint finished_after_start check (finished_at >= started_at)
);

-- A one-shot job succeeds at most once per domain object.
create unique index scheduled_runs_once_idx on audit.scheduled_runs (job_name, object_key)
  where object_key is not null and status = 'succeeded';
create index scheduled_runs_recent_idx on audit.scheduled_runs (job_name, finished_at desc);

revoke all on table audit.scheduled_jobs from public, anon, authenticated, service_role;
revoke all on table audit.scheduled_runs from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Running a job
-- ---------------------------------------------------------------------------------------------------------------

-- What pg_cron calls. Runs the handler, records the heartbeat, and returns how much it did, or null if it failed.
-- The handler runs in a subtransaction, so a failure undoes its work but not the record of the failure.
create function audit.run_job(p_job text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job audit.scheduled_jobs;
  v_started timestamptz := clock_timestamp();
  v_processed integer;
  v_state text;
  v_message text;
begin
  select * into v_job from audit.scheduled_jobs j where j.name = p_job and j.kind = 'recurring';
  if not found then raise exception 'no recurring job named %', p_job; end if;

  begin
    execute format('select %s()', v_job.handler) into v_processed;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    insert into audit.scheduled_runs (job_name, started_at, finished_at, status, error_code, error_message)
    values (p_job, v_started, clock_timestamp(), 'failed', v_state, left(v_message, 500));
    return null;
  end;

  insert into audit.scheduled_runs (job_name, started_at, finished_at, status, processed)
  values (p_job, v_started, clock_timestamp(), 'succeeded', coalesce(v_processed, 0));
  return coalesce(v_processed, 0);
end
$$;

-- Work on one domain object, done at most once. Returns 'done', 'already_done', 'nothing_to_do' (the handler found
-- nothing to do, so it may be tried again) or 'failed' (recorded, and tried again on the next trigger). Two callers
-- for the same object wait for each other, so the second sees the first's success.
create function audit.run_once(p_job text, p_object_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job audit.scheduled_jobs;
  v_started timestamptz;
  v_processed integer;
  v_state text;
  v_message text;
begin
  select * into v_job from audit.scheduled_jobs j where j.name = p_job and j.kind = 'one_shot';
  if not found then raise exception 'no one-shot job named %', p_job; end if;
  if p_object_key is null or btrim(p_object_key) = '' then raise exception 'a one-shot run needs its domain object'; end if;

  perform pg_advisory_xact_lock(hashtextextended('audit.run_once:' || p_job || ':' || p_object_key, 0));
  if exists (
    select 1 from audit.scheduled_runs r
    where r.job_name = p_job and r.object_key = p_object_key and r.status = 'succeeded'
  ) then
    return 'already_done';
  end if;

  v_started := clock_timestamp();
  begin
    execute format('select %s($1)', v_job.handler) using p_object_key into v_processed;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    insert into audit.scheduled_runs (job_name, object_key, started_at, finished_at, status, error_code, error_message)
    values (p_job, p_object_key, v_started, clock_timestamp(), 'failed', v_state, left(v_message, 500));
    return 'failed';
  end;
  if v_processed is null then return 'nothing_to_do'; end if;

  insert into audit.scheduled_runs (job_name, object_key, started_at, finished_at, status, processed)
  values (p_job, p_object_key, v_started, clock_timestamp(), 'succeeded', v_processed);
  return 'done';
end
$$;

revoke all on function audit.run_job(text) from public, anon, authenticated, service_role;
revoke all on function audit.run_once(text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Scheduled notices (S2-17), onto the framework
-- ---------------------------------------------------------------------------------------------------------------

-- One notice, as a one-shot run. Null when it is no longer scheduled or another run holds it.
create function notifications.release_notice(p_notice_id text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select notifications.deliver_notice(p_notice_id::uuid)
$$;

-- Every scheduled notice whose time has come, each on its own, so one failure holds back no other.
create or replace function notifications.release_due_notices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_released integer := 0;
begin
  for v_id in
    select n.id from notifications.notices n where n.state = 'scheduled' and n.send_at <= now() order by n.send_at
  loop
    if audit.run_once('release-notice', v_id::text) = 'done' then v_released := v_released + 1; end if;
  end loop;
  return v_released;
end
$$;

revoke all on function notifications.release_notice(text) from public, anon, authenticated, service_role;
revoke all on function notifications.release_due_notices() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Upload intent expiry
-- ---------------------------------------------------------------------------------------------------------------

alter table submissions.file_upload_intents
  add column expired_at timestamptz,
  add constraint expired_only_if_unfinalised check (expired_at is null or finalised_at is null);

create index file_upload_intents_expiring_idx on submissions.file_upload_intents (expires_at)
  where finalised_at is null and expired_at is null;
create index file_upload_intents_expired_idx on submissions.file_upload_intents (expired_at)
  where expired_at is not null;

-- Nothing can be uploaded or finalised against an intent after its time (the storage policy and finalise_upload
-- both check expires_at), so marking it expired changes no outcome: it records the state, and after 7 days removes
-- an intent that never had an object. Returns how many intents it expired or removed.
create function submissions.expire_upload_intents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
  v_removed integer;
begin
  update submissions.file_upload_intents i
  set expired_at = now()
  where i.finalised_at is null and i.expired_at is null and i.expires_at <= now();
  get diagnostics v_expired = row_count;

  delete from submissions.file_upload_intents i
  where i.expired_at < now() - interval '7 days'
    and not exists (select 1 from storage.objects o where o.bucket_id = i.bucket and o.name = i.object_key);
  get diagnostics v_removed = row_count;

  return v_expired + v_removed;
end
$$;

revoke all on function submissions.expire_upload_intents() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Purging job history
-- ---------------------------------------------------------------------------------------------------------------

create function audit.purge_job_history()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_total integer := 0;
begin
  delete from cron.job_run_details d where d.end_time < now() - interval '7 days';
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  delete from audit.scheduled_runs r
  where r.object_key is null and r.status = 'succeeded' and r.finished_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  delete from audit.scheduled_runs r where r.status = 'failed' and r.finished_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  delete from pgmq.a_notification_delivery a where a.archived_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  return v_total;
end
$$;

revoke all on function audit.purge_job_history() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- The jobs
-- ---------------------------------------------------------------------------------------------------------------

insert into audit.scheduled_jobs (name, kind, description, handler, schedule, heartbeat_within) values
('release-scheduled-notices', 'recurring', 'Sends each scheduled notice whose time has come.',
 'notifications.release_due_notices', '* * * * *', interval '5 minutes'),
('release-notice', 'one_shot', 'Sends one scheduled notice, once.',
 'notifications.release_notice', null, null),
('expire-upload-intents', 'recurring',
 'Marks upload intents whose time has passed as expired, and removes them after 7 days if nothing was uploaded.',
 'submissions.expire_upload_intents', '*/10 * * * *', interval '30 minutes'),
('purge-job-history', 'recurring',
 'Removes the scheduler''s run log after 7 days, heartbeats after 30, and archived queue messages after 30.',
 'audit.purge_job_history', '20 0 * * *', interval '26 hours');

-- pg_cron replaces a job of the same name, so the notices job keeps its name and now runs through the wrapper.
select cron.schedule(j.name, j.schedule, format('select audit.run_job(%L)', j.name))
from audit.scheduled_jobs j
where j.kind = 'recurring'
order by j.name;

-- ---------------------------------------------------------------------------------------------------------------
-- Health, for the uptime monitor
-- ---------------------------------------------------------------------------------------------------------------

-- Every job, its last run and last success, failures in the last day, and whether a recurring job is overdue: not
-- scheduled in pg_cron, or no success within its heartbeat (counted from when it was registered if it has never
-- run). Job names and counts only; no error text leaves the database.
create function api.scheduled_job_health()
returns table (
  job_name text,
  kind text,
  schedule text,
  heartbeat_within_seconds integer,
  scheduled boolean,
  last_run_at timestamptz,
  last_status text,
  last_success_at timestamptz,
  failures_last_day integer,
  overdue boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    j.name,
    j.kind,
    j.schedule,
    extract(epoch from j.heartbeat_within)::integer,
    case when j.kind = 'recurring'
      then exists (select 1 from cron.job c where c.jobname = j.name and c.active) end,
    last_run.finished_at,
    last_run.status,
    last_success.finished_at,
    (select count(*)::integer from audit.scheduled_runs r
     where r.job_name = j.name and r.status = 'failed' and r.finished_at > now() - interval '1 day'),
    j.kind = 'recurring' and (
      not exists (select 1 from cron.job c where c.jobname = j.name and c.active)
      or coalesce(last_success.finished_at, j.registered_at) < now() - j.heartbeat_within
    )
  from audit.scheduled_jobs j
  left join lateral (
    select r.finished_at, r.status from audit.scheduled_runs r
    where r.job_name = j.name order by r.finished_at desc limit 1
  ) last_run on true
  left join lateral (
    select r.finished_at from audit.scheduled_runs r
    where r.job_name = j.name and r.status = 'succeeded' order by r.finished_at desc limit 1
  ) last_success on true
  order by j.name
$$;

revoke all on function api.scheduled_job_health() from public, anon, authenticated, service_role;
grant execute on function api.scheduled_job_health() to service_role;
