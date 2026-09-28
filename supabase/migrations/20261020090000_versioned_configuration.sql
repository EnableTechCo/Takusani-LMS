-- Versioned configuration (S3-09; FR-108, FR-109, NFR-09; screens X-05, X-06). The settings that shape academic and
-- account outcomes are never edited. A change is a new version: the value, the value it replaces, the moment it takes
-- effect (now, or the start of a later day), who recorded it and why. Earlier versions stay on record, and a change
-- scheduled for a later day can be cancelled before it takes effect (the cancellation is its own record).
--
-- A change never reaches back. Whatever depends on a setting copies the value in force when it happens: a released
-- result keeps the appeal closing day it was given; an upload intent keeps its size limit; an exam attempt will keep
-- the integrity settings it started with, and a moderation cycle the sampling rule it was frozen with.
--
-- In use from this migration: the appeal window (read at release, so each result's deadline uses the version in force
-- then), the appeal reply turnaround, the sign-in lockout limits, the largest upload, and the late-work policy offered
-- by default for a new task. The moderation and exam settings are recorded now and read by those modules when they
-- are built (S4, S5). Credit values per unit are already versioned in programmes.unit_credit_values; they gain a
-- reason, and are changed through their own command here.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

-- What can be configured, and what a change affects. Rows are the catalogue, maintained by migrations.
create table audit.configuration_keys (
  key text primary key,
  group_key text not null,
  group_label text not null,
  group_order integer not null,
  sort_order integer not null,
  label text not null,
  description text not null,
  value_type text not null check (value_type in ('integer', 'choice')),
  unit_label text,
  min_value integer,
  max_value integer,
  -- For a choice: [{value, label}].
  choices jsonb,
  affects text not null,
  does_not_affect text not null,
  -- False while the module that reads it is still to be built.
  in_use boolean not null,
  constraint integer_has_range check (value_type <> 'integer' or (min_value is not null and max_value is not null)),
  constraint choice_has_choices check (value_type <> 'choice' or jsonb_typeof(choices) = 'array')
);

create table audit.configuration_versions (
  id bigint generated always as identity primary key,
  key text not null references audit.configuration_keys (key),
  version integer not null check (version >= 1),
  value jsonb not null,
  -- The value this version replaces, as it stood when recorded; null for the first.
  previous_value jsonb,
  effective_from timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  recorded_by uuid references identity.profiles (id),
  recorded_at timestamptz not null default now(),
  unique (key, version)
);

create index configuration_versions_key_idx on audit.configuration_versions (key, effective_from desc);

-- Cancelling a change before it takes effect. Its own record, so versions are never touched.
create table audit.configuration_cancellations (
  version_id bigint primary key references audit.configuration_versions (id),
  cancelled_at timestamptz not null default now(),
  cancelled_by uuid not null references identity.profiles (id),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000)
);

revoke all on table audit.configuration_keys, audit.configuration_versions, audit.configuration_cancellations
  from public, anon, authenticated, service_role;

create trigger configuration_versions_append_only
  before update or delete on audit.configuration_versions
  for each row execute function audit.forbid_mutation();
create trigger configuration_versions_append_only_truncate
  before truncate on audit.configuration_versions
  for each statement execute function audit.forbid_mutation();
create trigger configuration_cancellations_append_only
  before update or delete on audit.configuration_cancellations
  for each row execute function audit.forbid_mutation();
create trigger configuration_cancellations_append_only_truncate
  before truncate on audit.configuration_cancellations
  for each statement execute function audit.forbid_mutation();

alter table programmes.unit_credit_values add column reason text check (reason is null or char_length(btrim(reason)) between 1 and 1000);

-- ---------------------------------------------------------------------------------------------------------------
-- The catalogue and the first versions
-- ---------------------------------------------------------------------------------------------------------------

insert into audit.configuration_keys (key, group_key, group_label, group_order, sort_order, label, description,
  value_type, unit_label, min_value, max_value, choices, affects, does_not_affect, in_use) values
('moderation.sampling.rule', 'moderation', 'Moderation sampling', 1, 1, 'Sampling rule',
 'How the random part of each moderation sample is drawn, on top of the mandatory inclusions.',
 'choice', null, null, null,
 '[{"value": "stratified", "label": "Stratified by assessor, outcome and unit; random within each group"}]',
 'Every sample drawn on or after the day it takes effect.',
 'Cycles already frozen keep the rule they were frozen with. Every Not yet competent decision and every first-time assessor''s decisions are always sampled.',
 false),
('moderation.sampling.percentage', 'moderation', 'Moderation sampling', 1, 2, 'Sampling percentage',
 'The share of Competent results drawn at random into each sample, on top of the mandatory inclusions.',
 'integer', '%', 5, 100, null,
 'Every sample drawn on or after the day it takes effect, in every moderated cohort.',
 'Cycles already frozen keep the percentage and the sample they were frozen with. A sample is never redrawn.',
 false),
('moderation.hold.max_days', 'moderation', 'Moderation sampling', 1, 3, 'Maximum hold before an alert',
 'How long a result may wait for moderation before coordinators are alerted.',
 'integer', 'days', 1, 90, null,
 'The alert for every result held on or after the day it takes effect.',
 'Nothing is released or changed by the alert; it only asks for attention.',
 false),
('exam.integrity.threshold', 'exam', 'Exam integrity', 2, 1, 'Events before an attempt is marked for review',
 'How many leave-the-window events mark an exam attempt for the assessor''s attention. Never shown to learners.',
 'integer', 'events', 1, 20, null,
 'Exam attempts started on or after the day it takes effect.',
 'Attempts already started keep the settings they started with. An integrity event never ends or decides an attempt.',
 false),
('exam.integrity.return_grace_seconds', 'exam', 'Exam integrity', 2, 2, 'Grace before leaving the window is recorded',
 'How long a learner may be away from the exam window before it is recorded as an event.',
 'integer', 'seconds', 0, 120, null,
 'Exam attempts started on or after the day it takes effect.',
 'Attempts already started keep the settings they started with.',
 false),
('exam.accept_grace_seconds', 'exam', 'Exam integrity', 2, 3, 'Grace for answers that arrive after time is up',
 'How long after an attempt''s time is up its last answers are still accepted, for a slow connection.',
 'integer', 'seconds', 0, 120, null,
 'Exam attempts started on or after the day it takes effect.',
 'Attempts already started keep the grace they started with.',
 false),
('appeal.window_days', 'appeals', 'Appeals and late work', 3, 1, 'Appeal window',
 'How many calendar days a learner has to appeal, counted from the day the result is released, to the end of the last day.',
 'integer', 'days', 1, 30, null,
 'Results released on or after the moment it takes effect.',
 'A result already released keeps the appeal closing day it was given.',
 true),
('appeal.turnaround_working_days', 'appeals', 'Appeals and late work', 3, 2, 'Appeal reply promised',
 'The reply a learner is promised on their appeal receipt, in working days.',
 'integer', 'working days', 1, 30, null,
 'Receipts and appeal pages from the moment it takes effect.',
 'Receipts already sent keep the promise they made.',
 true),
('submission.late_policy', 'appeals', 'Appeals and late work', 3, 3, 'Late work, for a new task',
 'What happens to work handed in after the due time, as offered when a facilitator sets a new task. They can choose otherwise for a task.',
 'choice', null, null, null,
 '[{"value": "accept_and_flag", "label": "Accept late work and mark it late"}, {"value": "closed_at_due", "label": "Close the task at the due time"}]',
 'The choice offered first on the form for new tasks.',
 'Tasks already set keep the policy they were set with.',
 true),
('upload.max_mb', 'uploads', 'File uploads', 5, 1, 'Largest file',
 'The largest file a learner or facilitator may upload, in megabytes. At most 25, the storage limit.',
 'integer', 'MB', 1, 25, null,
 'Uploads started on or after the moment it takes effect.',
 'Files already uploaded stay as they are, and an upload in progress keeps the limit it started with.',
 true),
('identity.lockout.max_failures', 'sign_in', 'Sign-in protection', 6, 1, 'Wrong passwords before sign-in is paused',
 'How many wrong passwords in a row, within the counting window, pause new sign-ins to an account.',
 'integer', 'attempts', 3, 20, null,
 'Wrong passwords counted from the moment it takes effect.',
 'A pause already in force keeps its end time. A session already open is never affected.',
 true),
('identity.lockout.window_minutes', 'sign_in', 'Sign-in protection', 6, 2, 'Counting window',
 'How long wrong passwords are counted together.',
 'integer', 'minutes', 5, 120, null,
 'Wrong passwords counted from the moment it takes effect.',
 'A pause already in force keeps its end time.',
 true),
('identity.lockout.lock_minutes', 'sign_in', 'Sign-in protection', 6, 3, 'How long sign-in is paused',
 'How long new sign-ins stay paused once the limit is reached.',
 'integer', 'minutes', 5, 1440, null,
 'Pauses that start from the moment it takes effect.',
 'A pause already in force keeps its end time.',
 true);

-- Version 1 of each: the value the LMS has used so far, in force from the start.
insert into audit.configuration_versions (key, version, value, previous_value, effective_from, reason)
select k.key, 1, v.value, null, '-infinity', 'The value in use when configuration was introduced (S3-09).'
from audit.configuration_keys k
join (values
  ('moderation.sampling.rule', '"stratified"'::jsonb),
  ('moderation.sampling.percentage', '10'),
  ('moderation.hold.max_days', '21'),
  ('exam.integrity.threshold', '3'),
  ('exam.integrity.return_grace_seconds', '10'),
  ('exam.accept_grace_seconds', '30'),
  ('appeal.window_days', '7'),
  ('appeal.turnaround_working_days', '5'),
  ('submission.late_policy', '"accept_and_flag"'),
  ('upload.max_mb', '25'),
  ('identity.lockout.max_failures', '5'),
  ('identity.lockout.window_minutes', '15'),
  ('identity.lockout.lock_minutes', '15')
) v(key, value) on v.key = k.key;

-- ---------------------------------------------------------------------------------------------------------------
-- Reading a setting
-- ---------------------------------------------------------------------------------------------------------------

-- The version in force at an instant: the latest version whose effective time has come, and which was not cancelled.
create function audit.config_version(p_key text, p_at timestamptz default now())
returns audit.configuration_versions
language sql
stable
security definer
set search_path = ''
as $$
  select v.* from audit.configuration_versions v
  where v.key = p_key and v.effective_from <= p_at
    and not exists (select 1 from audit.configuration_cancellations c where c.version_id = v.id)
  order by v.effective_from desc, v.version desc
  limit 1
$$;

create function audit.config_int(p_key text, p_at timestamptz default now())
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select ((audit.config_version(p_key, p_at)).value #>> '{}')::integer
$$;

create function audit.config_text(p_key text, p_at timestamptz default now())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select (audit.config_version(p_key, p_at)).value #>> '{}'
$$;

revoke all on function audit.config_version(text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function audit.config_int(text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function audit.config_text(text, timestamptz) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- The settings in use, now read from configuration
-- ---------------------------------------------------------------------------------------------------------------

-- The appeal deadline uses the window in force at the moment of release, so a later change never reaches back.
create or replace function assessment.appeal_deadline(p_released_at timestamptz, p_days integer default null)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (((p_released_at at time zone 'Africa/Johannesburg')::date
           + (coalesce(p_days, audit.config_int('appeal.window_days', p_released_at)) + 1)) || ' 00:00')::timestamp
           at time zone 'Africa/Johannesburg'
$$;

create or replace function appeals.turnaround_working_days()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select audit.config_int('appeal.turnaround_working_days')
$$;

create or replace function identity.lockout_policy()
returns table (max_failures integer, failure_window interval, lock_period interval)
language sql
stable
security definer
set search_path = ''
as $$
  select audit.config_int('identity.lockout.max_failures'),
    make_interval(mins => audit.config_int('identity.lockout.window_minutes')),
    make_interval(mins => audit.config_int('identity.lockout.lock_minutes'))
$$;

-- Uploads: the configured largest file, never above the bucket's own limit.
create or replace function api.authorise_upload(
  p_context_type text,
  p_context_id uuid,
  p_filename text,
  p_media_type text,
  p_bytes bigint,
  p_sha256 text default null,
  p_client_upload_id uuid default null,
  p_requirement_id uuid default null
)
returns table (
  status text,
  intent_id uuid,
  bucket text,
  object_key text,
  max_bytes bigint,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_bucket text;
  v_role text;
  v_max_bytes bigint;
  v_allowed text[];
  v_extension text;
  v_key text;
  v_intent submissions.file_upload_intents;
  v_filename text := btrim(coalesce(p_filename, ''));
begin
  if v_actor is null then
    return query select 'unauthenticated'::text, null::uuid, null::text, null::text, null::bigint, null::timestamptz;
    return;
  end if;

  -- A retry of the same authorisation returns the first intent, so a dropped response cannot strand an object key.
  if p_client_upload_id is not null then
    select * into v_intent from submissions.file_upload_intents
    where profile_id = v_actor and client_upload_id = p_client_upload_id;
    if found then
      return query select 'ok'::text, v_intent.id, v_intent.bucket, v_intent.object_key, v_intent.max_bytes,
        v_intent.expires_at;
      return;
    end if;
  end if;

  if p_context_type = 'task_submission' then
    v_bucket := 'submissions';
    v_role := 'learner';
    if not submissions.is_audience(v_actor, p_context_id) then
      return query select 'forbidden'::text, null::uuid, null::text, null::text, null::bigint, null::timestamptz;
      return;
    end if;
    if p_requirement_id is not null and not exists (
      select 1 from submissions.task_evidence_requirements r
      where r.id = p_requirement_id and r.task_id = p_context_id
    ) then
      return query select 'requirement_not_on_task'::text, null::uuid, null::text, null::text, null::bigint,
        null::timestamptz;
      return;
    end if;
  elsif p_context_type = 'material' then
    v_bucket := 'materials';
    v_role := 'facilitator';
    if p_requirement_id is not null then
      return query select 'invalid_context'::text, null::uuid, null::text, null::text, null::bigint, null::timestamptz;
      return;
    end if;
    if not learning.can_edit_material(v_actor, p_context_id)
       or exists (select 1 from learning.materials m where m.id = p_context_id and m.state = 'archived') then
      return query select 'forbidden'::text, null::uuid, null::text, null::text, null::bigint, null::timestamptz;
      return;
    end if;
  else
    return query select 'invalid_context'::text, null::uuid, null::text, null::text, null::bigint, null::timestamptz;
    return;
  end if;

  select b.file_size_limit, b.allowed_mime_types into v_max_bytes, v_allowed
  from storage.buckets b where b.id = v_bucket;
  v_max_bytes := least(v_max_bytes, audit.config_int('upload.max_mb')::bigint * 1024 * 1024);

  if char_length(v_filename) not between 1 and 255 then
    return query select 'invalid_filename'::text, null::uuid, null::text, null::text, null::bigint, null::timestamptz;
    return;
  end if;
  if p_media_type is null or not (p_media_type = any (v_allowed)) then
    return query select 'type_not_allowed'::text, null::uuid, null::text, null::text, v_max_bytes, null::timestamptz;
    return;
  end if;
  if p_bytes is null or p_bytes <= 0 or p_bytes > v_max_bytes then
    return query select 'too_large'::text, null::uuid, null::text, null::text, v_max_bytes, null::timestamptz;
    return;
  end if;
  if p_sha256 is not null and p_sha256 !~ '^[a-f0-9]{64}$' then
    return query select 'invalid_checksum'::text, null::uuid, null::text, null::text, v_max_bytes, null::timestamptz;
    return;
  end if;
  if (select count(*) from submissions.file_upload_intents
      where profile_id = v_actor and created_at > now() - interval '1 hour') >= 30 then
    return query select 'rate_limited'::text, null::uuid, null::text, null::text, v_max_bytes, null::timestamptz;
    return;
  end if;

  v_extension := lower(coalesce(substring(v_filename from '\.([A-Za-z0-9]{1,8})$'), ''));
  v_key := p_context_id::text || '/' || v_actor::text || '/' || gen_random_uuid()::text
    || case when v_extension = '' then '' else '.' || v_extension end;

  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, bucket, object_key, original_filename, declared_media_type,
    declared_bytes, declared_sha256, max_bytes, allowed_media_types, client_upload_id, expires_at, requirement_id
  )
  values (
    v_actor, p_context_type, p_context_id, v_bucket, v_key, v_filename, p_media_type,
    p_bytes, p_sha256, v_max_bytes, v_allowed, p_client_upload_id, now() + interval '2 hours', p_requirement_id
  )
  returning * into v_intent;

  perform audit.append('submissions.upload_authorised', 'upload_intent', v_intent.id::text,
    jsonb_build_object('context_type', p_context_type, 'context_id', p_context_id), v_role, null,
    jsonb_build_object('filename', v_filename, 'declared_bytes', p_bytes, 'declared_media_type', p_media_type),
    null, null);

  return query select 'ok'::text, v_intent.id, v_intent.bucket, v_intent.object_key, v_intent.max_bytes,
    v_intent.expires_at;
end
$$;


-- ---------------------------------------------------------------------------------------------------------------
-- Commands (administrators)
-- ---------------------------------------------------------------------------------------------------------------

-- p_effective_on: today for an immediate change, or a later day (from its start, SAST). One scheduled change per
-- setting at a time. Refusals: unauthenticated, forbidden, not_found, invalid_value (with the allowed range),
-- invalid_date, reason_required, reason_too_long, unchanged, change_already_scheduled.
create function api.record_configuration_version(p_key text, p_value text, p_effective_on date, p_reason text)
returns table (status text, version integer, effective_from timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_key audit.configuration_keys;
  v_value jsonb;
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_from timestamptz;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_version integer;
  v_previous jsonb;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::timestamptz; return; end if;
  if not identity.has_role(v_actor, 'administrator') then
    return query select 'forbidden'::text, null::integer, null::timestamptz; return;
  end if;
  -- One change at a time per setting.
  select * into v_key from audit.configuration_keys k where k.key = p_key for update;
  if not found then return query select 'not_found'::text, null::integer, null::timestamptz; return; end if;

  if v_key.value_type = 'integer' then
    if btrim(coalesce(p_value, '')) !~ '^\d+$'
       or btrim(p_value)::bigint not between v_key.min_value and v_key.max_value then
      return query select 'invalid_value'::text, null::integer, null::timestamptz; return;
    end if;
    v_value := to_jsonb(btrim(p_value)::integer);
  else
    if not exists (select 1 from jsonb_array_elements(v_key.choices) c where c ->> 'value' = p_value) then
      return query select 'invalid_value'::text, null::integer, null::timestamptz; return;
    end if;
    v_value := to_jsonb(p_value);
  end if;
  if p_effective_on is null or p_effective_on < v_today then
    return query select 'invalid_date'::text, null::integer, null::timestamptz; return;
  end if;
  if v_reason = '' then return query select 'reason_required'::text, null::integer, null::timestamptz; return; end if;
  if char_length(v_reason) > 1000 then return query select 'reason_too_long'::text, null::integer, null::timestamptz; return; end if;
  if exists (
    select 1 from audit.configuration_versions v
    where v.key = p_key and v.effective_from > now()
      and not exists (select 1 from audit.configuration_cancellations c where c.version_id = v.id)
  ) then
    return query select 'change_already_scheduled'::text, null::integer, null::timestamptz; return;
  end if;

  v_from := case when p_effective_on = v_today then now()
                 else (p_effective_on::text || ' 00:00')::timestamp at time zone 'Africa/Johannesburg' end;
  v_previous := (audit.config_version(p_key, v_from)).value;
  if v_previous = v_value then return query select 'unchanged'::text, null::integer, null::timestamptz; return; end if;

  select coalesce(max(v.version), 0) + 1 into v_version from audit.configuration_versions v where v.key = p_key;
  insert into audit.configuration_versions (key, version, value, previous_value, effective_from, reason, recorded_by)
  values (p_key, v_version, v_value, v_previous, v_from, v_reason, v_actor);

  perform audit.append('audit.configuration_changed', 'configuration', p_key,
    jsonb_build_object('version', v_version, 'reason', v_reason), 'administrator',
    jsonb_build_object('value', v_previous), jsonb_build_object('value', v_value, 'effective_from', v_from),
    'global', null);
  return query select 'ok'::text, v_version, v_from;
end
$$;

-- Cancels a change that has not taken effect yet. Refusals: unauthenticated, forbidden, not_found, already_in_force,
-- already_cancelled, reason_required.
create function api.cancel_configuration_version(p_key text, p_version integer, p_reason text)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_version audit.configuration_versions;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  if not identity.has_role(v_actor, 'administrator') then return query select 'forbidden'::text; return; end if;
  perform 1 from audit.configuration_keys k where k.key = p_key for update;
  select * into v_version from audit.configuration_versions v where v.key = p_key and v.version = p_version;
  if not found then return query select 'not_found'::text; return; end if;
  if exists (select 1 from audit.configuration_cancellations c where c.version_id = v_version.id) then
    return query select 'already_cancelled'::text; return;
  end if;
  if v_version.effective_from <= now() then return query select 'already_in_force'::text; return; end if;
  if v_reason = '' or char_length(v_reason) > 1000 then return query select 'reason_required'::text; return; end if;

  insert into audit.configuration_cancellations (version_id, cancelled_by, reason) values (v_version.id, v_actor, v_reason);
  perform audit.append('audit.configuration_change_cancelled', 'configuration', p_key,
    jsonb_build_object('version', p_version, 'reason', v_reason), 'administrator',
    jsonb_build_object('value', v_version.value, 'effective_from', v_version.effective_from), null, 'global', null);
  return query select 'ok'::text;
end
$$;

-- A unit's credit value (FR-108): a new effective-dated value, never an edit. Refusals: unauthenticated, forbidden,
-- not_found, invalid_value, invalid_date, reason_required, unchanged, change_already_scheduled.
create function api.set_unit_credit_value(p_unit_id uuid, p_credits integer, p_effective_on date, p_reason text)
returns table (status text, effective_from timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_from timestamptz;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_previous integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::timestamptz; return; end if;
  if not identity.has_role(v_actor, 'administrator') then return query select 'forbidden'::text, null::timestamptz; return; end if;
  perform 1 from programmes.units u where u.id = p_unit_id for update;
  if not found then return query select 'not_found'::text, null::timestamptz; return; end if;
  if p_credits is null or p_credits not between 0 and 1000 then
    return query select 'invalid_value'::text, null::timestamptz; return;
  end if;
  if p_effective_on is null or p_effective_on < v_today then
    return query select 'invalid_date'::text, null::timestamptz; return;
  end if;
  if v_reason = '' or char_length(v_reason) > 1000 then return query select 'reason_required'::text, null::timestamptz; return; end if;
  if exists (select 1 from programmes.unit_credit_values cv where cv.unit_id = p_unit_id and cv.effective_from > now()) then
    return query select 'change_already_scheduled'::text, null::timestamptz; return;
  end if;
  v_from := case when p_effective_on = v_today then now()
                 else (p_effective_on::text || ' 00:00')::timestamp at time zone 'Africa/Johannesburg' end;
  select cv.credits into v_previous from programmes.unit_credit_values cv
  where cv.unit_id = p_unit_id and cv.effective_from <= v_from order by cv.effective_from desc limit 1;
  if v_previous = p_credits then return query select 'unchanged'::text, null::timestamptz; return; end if;

  insert into programmes.unit_credit_values (unit_id, credits, effective_from, set_by, reason)
  values (p_unit_id, p_credits, v_from, v_actor, v_reason);
  perform audit.append('programmes.unit_credits_changed', 'unit', p_unit_id::text, jsonb_build_object('reason', v_reason),
    'administrator', jsonb_build_object('credits', v_previous),
    jsonb_build_object('credits', p_credits, 'effective_from', v_from), 'global', null);
  return query select 'ok'::text, v_from;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads (administrators)
-- ---------------------------------------------------------------------------------------------------------------

-- X-05: every setting with the value in force, since when, who recorded it, and any change scheduled.
create function api.list_configuration()
returns table (
  key text,
  group_key text,
  group_label text,
  label text,
  value_type text,
  unit_label text,
  choices jsonb,
  in_use boolean,
  value jsonb,
  version integer,
  effective_from timestamptz,
  recorded_by_name text,
  scheduled_value jsonb,
  scheduled_from timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select k.key, k.group_key, k.group_label, k.label, k.value_type, k.unit_label, k.choices, k.in_use,
    cur.value, cur.version, cur.effective_from, rp.full_name, nxt.value, nxt.effective_from
  from audit.configuration_keys k
  cross join lateral (select * from audit.config_version(k.key)) cur
  left join identity.profiles rp on rp.id = cur.recorded_by
  left join lateral (
    select v.value, v.effective_from from audit.configuration_versions v
    where v.key = k.key and v.effective_from > now()
      and not exists (select 1 from audit.configuration_cancellations c where c.version_id = v.id)
    order by v.effective_from limit 1
  ) nxt on true
  where identity.has_role(auth.uid(), 'administrator')
  order by k.group_order, k.sort_order
$$;

-- X-06: one setting, its catalogue entry, the value in force, and every version with its state.
create function api.get_configuration_key(p_key text)
returns table (
  key text,
  group_label text,
  label text,
  description text,
  value_type text,
  unit_label text,
  min_value integer,
  max_value integer,
  choices jsonb,
  affects text,
  does_not_affect text,
  in_use boolean,
  current_version integer,
  versions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select k.key, k.group_label, k.label, k.description, k.value_type, k.unit_label, k.min_value, k.max_value, k.choices,
    k.affects, k.does_not_affect, k.in_use, (audit.config_version(k.key)).version,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'version', v.version, 'value', v.value, 'previous_value', v.previous_value,
               'effective_from', case when v.effective_from = '-infinity' then null else v.effective_from end,
               'reason', v.reason, 'recorded_by_name', rp.full_name, 'recorded_at', v.recorded_at,
               'cancelled_at', c.cancelled_at, 'cancelled_by_name', cp.full_name, 'cancel_reason', c.reason,
               'state', case when c.version_id is not null then 'cancelled'
                             when v.effective_from > now() then 'scheduled'
                             when v.id = (audit.config_version(k.key)).id then 'in_force'
                             else 'superseded' end)
             order by v.version desc)
      from audit.configuration_versions v
      left join audit.configuration_cancellations c on c.version_id = v.id
      left join identity.profiles rp on rp.id = v.recorded_by
      left join identity.profiles cp on cp.id = c.cancelled_by
      where v.key = k.key
    ), '[]'::jsonb)
  from audit.configuration_keys k
  where k.key = p_key and identity.has_role(auth.uid(), 'administrator')
$$;

-- Credit values per unit: the value in force, and any change scheduled.
create function api.list_unit_credit_values()
returns table (
  unit_id uuid,
  unit_code text,
  unit_title text,
  programme_title text,
  credits integer,
  effective_from timestamptz,
  set_by_name text,
  scheduled_credits integer,
  scheduled_from timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.code, u.title, pr.title, cur.credits, cur.effective_from, sp.full_name, nxt.credits, nxt.effective_from
  from programmes.units u
  join programmes.qualifications q on q.id = u.qualification_id
  join programmes.programmes pr on pr.id = q.programme_id
  left join lateral (
    select cv.* from programmes.unit_credit_values cv
    where cv.unit_id = u.id and cv.effective_from <= now() order by cv.effective_from desc limit 1
  ) cur on true
  left join identity.profiles sp on sp.id = cur.set_by
  left join lateral (
    select cv.credits, cv.effective_from from programmes.unit_credit_values cv
    where cv.unit_id = u.id and cv.effective_from > now() order by cv.effective_from limit 1
  ) nxt on true
  where identity.has_role(auth.uid(), 'administrator')
  order by pr.title, u.code
$$;

create function api.get_unit_credit_history(p_unit_id uuid)
returns table (
  unit_code text,
  unit_title text,
  programme_title text,
  versions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.code, u.title, pr.title,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'credits', cv.credits, 'effective_from', cv.effective_from, 'set_by_name', sp.full_name,
               'set_at', cv.set_at, 'reason', cv.reason,
               'state', case when cv.effective_from > now() then 'scheduled'
                             when cv.effective_from = (select max(x.effective_from) from programmes.unit_credit_values x
                                                       where x.unit_id = u.id and x.effective_from <= now())
                               then 'in_force'
                             else 'superseded' end)
             order by cv.effective_from desc)
      from programmes.unit_credit_values cv left join identity.profiles sp on sp.id = cv.set_by
      where cv.unit_id = u.id
    ), '[]'::jsonb)
  from programmes.units u
  join programmes.qualifications q on q.id = u.qualification_id
  join programmes.programmes pr on pr.id = q.programme_id
  where u.id = p_unit_id and identity.has_role(auth.uid(), 'administrator')
$$;

-- The settings the application states to anyone signed in: the late-work policy a new task offers, the largest
-- upload, the appeal window and the reply promised. Nothing sensitive: the exam and moderation settings stay private.
create function api.public_settings()
returns table (late_policy text, upload_max_mb integer, appeal_window_days integer, appeal_turnaround_working_days integer)
language sql
stable
security definer
set search_path = ''
as $$
  select audit.config_text('submission.late_policy'), audit.config_int('upload.max_mb'),
    audit.config_int('appeal.window_days'), audit.config_int('appeal.turnaround_working_days')
  where auth.uid() is not null
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.record_configuration_version(text, text, date, text) from public, anon, authenticated, service_role;
revoke all on function api.cancel_configuration_version(text, integer, text) from public, anon, authenticated, service_role;
revoke all on function api.set_unit_credit_value(uuid, integer, date, text) from public, anon, authenticated, service_role;
revoke all on function api.list_configuration() from public, anon, authenticated, service_role;
revoke all on function api.get_configuration_key(text) from public, anon, authenticated, service_role;
revoke all on function api.list_unit_credit_values() from public, anon, authenticated, service_role;
revoke all on function api.get_unit_credit_history(uuid) from public, anon, authenticated, service_role;
revoke all on function api.public_settings() from public, anon, authenticated, service_role;

grant execute on function api.record_configuration_version(text, text, date, text) to authenticated;
grant execute on function api.cancel_configuration_version(text, integer, text) to authenticated;
grant execute on function api.set_unit_credit_value(uuid, integer, date, text) to authenticated;
grant execute on function api.list_configuration() to authenticated;
grant execute on function api.get_configuration_key(text) to authenticated;
grant execute on function api.list_unit_credit_values() to authenticated;
grant execute on function api.get_unit_credit_history(uuid) to authenticated;
grant execute on function api.public_settings() to authenticated;
