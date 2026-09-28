-- Attendance register and lecture recordings (S3-12; FR-208, FR-209; CR-03, CR-13; screens F-04, F-07, L-04).
--
-- Register (FR-209, CR-03). Teams attendance is never read: a facilitator who sets work in the cohort marks each
-- learner on the session's roster present or absent, once the session has started. The first save captures the whole
-- register, so every learner on the roster must be marked. After that, any change is an amendment and needs a reason.
-- Every capture and amendment is kept, one row per learner, in an append-only log with the previous mark, and is
-- audited. A register version on the session stops two people saving over each other: a save names the version it
-- saw and is refused as 'stale' if someone saved since. The roster is the cohort's active learners, plus anyone
-- already marked who has since left, so a mark is never lost from view. A cancelled session has no register.
--
-- Recordings (FR-208, CR-13). A recording is a material of its own category in the material library, published and
-- scheduled like any other. A link (Teams, Stream, OneDrive, YouTube) is preferred: it streams from where it is
-- hosted, and the LMS streams no media (NFR-01). An upload goes to its own private "recordings" bucket for video and
-- audio, within the configured "Largest recording" (recording.max_mb, S3-09), and learners download it through a
-- short-lived signed link. The facilitator says whether captions or a transcript are available, and learners see when
-- they are not (accessibility audit, 1.2.x). The file scan (S3-11) recognises the recording types.

-- ---------------------------------------------------------------------------------------------------------------
-- Recordings: bucket, category, captions
-- ---------------------------------------------------------------------------------------------------------------

-- 50 MB is the storage limit on the current plan; recording.max_mb can lower it, never raise it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 52428800, array['video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table learning.materials
  add column category text not null default 'material' check (category in ('material', 'recording')),
  add column has_captions boolean not null default false;

create policy "upload a recording only to an authorised key"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and submissions.may_upload_object(auth.uid(), bucket_id, name));

create policy "finish a recording upload in progress"
  on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and submissions.may_upload_object(auth.uid(), bucket_id, name))
  with check (bucket_id = 'recordings' and submissions.may_upload_object(auth.uid(), bucket_id, name));

create policy "read a recording you uploaded or may open"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings'
    and (submissions.owns_upload(auth.uid(), bucket_id, name) or learning.may_read_material(auth.uid(), bucket_id, name))
  );

-- The storage policies' check, now for either bucket (same signature, so the grant stands).
create or replace function learning.may_read_material(p_profile_id uuid, p_bucket text, p_object_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket in ('materials', 'recordings') and exists (
    select 1
    from learning.materials m
    join submissions.stored_files sf on sf.id = m.stored_file_id
    where sf.bucket = p_bucket and sf.object_key = p_object_key
      and (learning.is_released_to(p_profile_id, m.id) or learning.can_edit_material(p_profile_id, m.id))
  )
$$;

insert into audit.configuration_keys (key, group_key, group_label, group_order, sort_order, label, description,
  value_type, unit_label, min_value, max_value, choices, affects, does_not_affect, in_use) values
('recording.max_mb', 'uploads', 'File uploads', 5, 2, 'Largest recording',
 'The largest lecture recording a facilitator may upload, in megabytes. At most 50, the storage limit. A link to the recording is preferred.',
 'integer', 'MB', 1, 50, null,
 'Recording uploads started on or after the moment it takes effect.',
 'Recordings already uploaded stay as they are, and an upload in progress keeps the limit it started with.',
 true);

insert into audit.configuration_versions (key, version, value, previous_value, effective_from, reason)
values ('recording.max_mb', 1, '50', null, '-infinity', 'The value in use when recordings were introduced (S3-12).');

-- A new recording: a material of the recording category. Same rules as a new material.
create function api.create_recording(
  p_cohort_id uuid,
  p_title text,
  p_description text default '',
  p_module_id uuid default null
)
returns table (status text, material_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status = 'active') then
    return query select 'cohort_not_found'::text, null::uuid; return;
  end if;
  if not submissions.can_set_work(v_actor, p_cohort_id) then return query select 'forbidden'::text, null::uuid; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    return query select 'invalid_title'::text, null::uuid; return;
  end if;
  if char_length(coalesce(p_description, '')) > 5000 then return query select 'invalid_description'::text, null::uuid; return; end if;
  if p_module_id is not null and not exists (
    select 1 from programmes.modules mo join programmes.cohorts c on c.programme_id = mo.programme_id
    where mo.id = p_module_id and c.id = p_cohort_id
  ) then
    return query select 'module_not_in_programme'::text, null::uuid; return;
  end if;

  insert into learning.materials (cohort_id, module_id, title, description, category, created_by)
  values (p_cohort_id, p_module_id, btrim(p_title), coalesce(p_description, ''), 'recording', v_actor)
  returning id into v_id;

  perform audit.append('learning.material_created', 'material', v_id::text, '{}'::jsonb, 'facilitator', null,
    jsonb_build_object('title', btrim(p_title), 'module_id', p_module_id, 'state', 'draft', 'category', 'recording'),
    'cohort', p_cohort_id);
  return query select 'ok'::text, v_id;
end
$$;

-- Whether a recording has captions or a transcript. Learners are shown when it does not.
create function api.set_recording_captions(p_material_id uuid, p_has_captions boolean)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_material learning.materials;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_material from learning.materials m where m.id = p_material_id for update;
  if not found or not learning.can_edit_material(v_actor, p_material_id) then
    return query select 'not_found'::text; return;
  end if;
  if v_material.category <> 'recording' then return query select 'not_a_recording'::text; return; end if;
  if v_material.state = 'archived' then return query select 'archived'::text; return; end if;
  if p_has_captions is null then return query select 'invalid_captions'::text; return; end if;
  if v_material.has_captions = p_has_captions then return query select 'ok'::text; return; end if;

  update learning.materials m set has_captions = p_has_captions, updated_at = now() where m.id = p_material_id;
  perform audit.append('learning.recording_captions_set', 'material', p_material_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('has_captions', v_material.has_captions), jsonb_build_object('has_captions', p_has_captions),
    'cohort', v_material.cohort_id);
  return query select 'ok'::text;
end
$$;

revoke all on function api.create_recording(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function api.set_recording_captions(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function api.create_recording(uuid, text, text, uuid) to authenticated;
grant execute on function api.set_recording_captions(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Attendance register
-- ---------------------------------------------------------------------------------------------------------------

alter table learning.sessions
  add column register_version integer not null default 0 check (register_version >= 0),
  add column register_captured_at timestamptz,
  add column register_captured_by uuid references identity.profiles (id),
  add constraint register_capture_is_recorded check (
    (register_version = 0) = (register_captured_at is null) and (register_captured_at is null) = (register_captured_by is null)
  );

-- The current mark for each learner on the session's register.
create table learning.attendance (
  session_id uuid not null references learning.sessions (id),
  learner_id uuid not null references identity.profiles (id),
  status text not null check (status in ('present', 'absent')),
  marked_by uuid not null references identity.profiles (id),
  marked_at timestamptz not null,
  primary key (session_id, learner_id)
);

-- Append-only: every mark as captured, and every amendment with the mark it replaced and why (FR-209).
create table learning.attendance_changes (
  id bigint generated always as identity primary key,
  session_id uuid not null references learning.sessions (id),
  learner_id uuid not null references identity.profiles (id),
  kind text not null check (kind in ('captured', 'amended')),
  previous_status text check (previous_status in ('present', 'absent')),
  status text not null check (status in ('present', 'absent')),
  reason text check (char_length(btrim(reason)) between 1 and 500),
  register_version integer not null check (register_version >= 1),
  changed_by uuid not null references identity.profiles (id),
  changed_at timestamptz not null default now(),
  constraint amendment_has_reason check (kind = 'captured' or reason is not null),
  constraint capture_has_no_previous check (kind = 'amended' or previous_status is null)
);

create index attendance_changes_session_idx on learning.attendance_changes (session_id, changed_at desc);
create index attendance_learner_idx on learning.attendance (learner_id);

revoke all on table learning.attendance, learning.attendance_changes from public, anon, authenticated, service_role;
revoke update, delete, truncate on learning.attendance_changes from public, anon, authenticated, service_role;

create trigger attendance_changes_append_only
  before update or delete on learning.attendance_changes
  for each row execute function audit.forbid_mutation();

create trigger attendance_changes_append_only_truncate
  before truncate on learning.attendance_changes
  for each statement execute function audit.forbid_mutation();

-- Who is on a session's register: the cohort's active learners, and anyone already marked.
create function learning.session_roster(p_session_id uuid)
returns table (learner_id uuid, full_name text, learner_number text, enrolled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.learner_number, e.profile_id is not null
  from identity.profiles p
  join learning.sessions s on s.id = p_session_id
  left join programmes.enrolments e on e.cohort_id = s.cohort_id and e.profile_id = p.id and e.status = 'active'
  where e.profile_id is not null
     or exists (select 1 from learning.attendance a where a.session_id = p_session_id and a.learner_id = p.id)
$$;

revoke all on function learning.session_roster(uuid) from public, anon, authenticated, service_role;

-- Capture or amend the register. p_marks: [{"learner_id": ..., "status": "present" | "absent"}]. The first save
-- must mark everyone on the roster; later saves change only the marks given, and need a reason. p_expected_version is
-- the register version the facilitator saw (0 before it is captured).
create function api.save_register(
  p_session_id uuid,
  p_marks jsonb,
  p_expected_version integer,
  p_reason text default null
)
returns table (status text, register_version integer, changed integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session learning.sessions;
  v_version integer;
  v_kind text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_mark record;
  v_changed integer := 0;
  v_present integer;
  v_absent integer;
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer; return; end if;
  select * into v_session from learning.sessions s where s.id = p_session_id for update;
  if not found or not submissions.can_set_work(v_actor, v_session.cohort_id) then
    return query select 'not_found'::text, null::integer, null::integer; return;
  end if;
  if v_session.state = 'cancelled' then
    return query select 'session_cancelled'::text, v_session.register_version, null::integer; return;
  end if;
  if v_session.starts_at > now() then
    return query select 'not_started'::text, v_session.register_version, null::integer; return;
  end if;
  if p_expected_version is distinct from v_session.register_version then
    return query select 'stale'::text, v_session.register_version, null::integer; return;
  end if;

  -- The marks: well formed, each learner once, each on the roster.
  if jsonb_typeof(coalesce(p_marks, 'null'::jsonb)) <> 'array' or exists (
    select 1 from jsonb_array_elements(p_marks) m
    where jsonb_typeof(m) <> 'object'
       or coalesce(m ->> 'status', '') not in ('present', 'absent')
       or coalesce(m ->> 'learner_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) or (select count(*) from jsonb_array_elements(p_marks)) <> (
    select count(distinct m ->> 'learner_id') from jsonb_array_elements(p_marks) m
  ) then
    return query select 'invalid_marks'::text, v_session.register_version, null::integer; return;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_marks) m
    where not exists (select 1 from learning.session_roster(p_session_id) r where r.learner_id = (m ->> 'learner_id')::uuid)
  ) then
    return query select 'not_on_roster'::text, v_session.register_version, null::integer; return;
  end if;

  v_version := v_session.register_version + 1;

  if v_session.register_version = 0 then
    -- Capture: everyone on the roster, at once.
    if exists (
      select 1 from learning.session_roster(p_session_id) r
      where not exists (select 1 from jsonb_array_elements(p_marks) m where (m ->> 'learner_id')::uuid = r.learner_id)
    ) or jsonb_array_length(p_marks) = 0 then
      return query select 'incomplete'::text, v_session.register_version, null::integer; return;
    end if;
    v_kind := 'captured';
  else
    v_kind := 'amended';
    -- Checked before anything is written: an amendment that changes a mark needs its reason.
    if exists (
      select 1 from jsonb_array_elements(p_marks) m
      left join learning.attendance a on a.session_id = p_session_id and a.learner_id = (m ->> 'learner_id')::uuid
      where a.status is distinct from m ->> 'status'
    ) then
      if v_reason is null then
        return query select 'reason_required'::text, v_session.register_version, null::integer; return;
      end if;
      if char_length(v_reason) > 500 then
        return query select 'reason_too_long'::text, v_session.register_version, null::integer; return;
      end if;
    end if;
  end if;

  for v_mark in
    select (m ->> 'learner_id')::uuid as learner_id, m ->> 'status' as status, a.status as previous
    from jsonb_array_elements(p_marks) m
    left join learning.attendance a on a.session_id = p_session_id and a.learner_id = (m ->> 'learner_id')::uuid
  loop
    continue when v_mark.previous is not distinct from v_mark.status;

    insert into learning.attendance (session_id, learner_id, status, marked_by, marked_at)
    values (p_session_id, v_mark.learner_id, v_mark.status, v_actor, now())
    on conflict (session_id, learner_id)
    do update set status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at;

    insert into learning.attendance_changes (
      session_id, learner_id, kind, previous_status, status, reason, register_version, changed_by
    )
    values (
      p_session_id, v_mark.learner_id, case when v_mark.previous is null and v_kind = 'captured' then 'captured' else 'amended' end,
      v_mark.previous, v_mark.status, case when v_kind = 'amended' then v_reason end, v_version, v_actor
    );
    v_before := v_before || jsonb_build_object('learner_id', v_mark.learner_id, 'status', v_mark.previous);
    v_after := v_after || jsonb_build_object('learner_id', v_mark.learner_id, 'status', v_mark.status);
    v_changed := v_changed + 1;
  end loop;

  if v_changed = 0 then
    return query select 'unchanged'::text, v_session.register_version, 0; return;
  end if;

  update learning.sessions s
  set register_version = v_version,
      register_captured_at = coalesce(s.register_captured_at, now()),
      register_captured_by = coalesce(s.register_captured_by, v_actor)
  where s.id = p_session_id;

  select count(*) filter (where a.status = 'present'), count(*) filter (where a.status = 'absent')
  into v_present, v_absent
  from learning.attendance a where a.session_id = p_session_id;

  perform audit.append(
    case when v_kind = 'captured' then 'learning.register_captured' else 'learning.register_amended' end,
    'session', p_session_id::text,
    jsonb_build_object('register_version', v_version, 'present', v_present, 'absent', v_absent, 'reason', v_reason),
    'facilitator',
    case when v_kind = 'amended' then v_before end, v_after, 'cohort', v_session.cohort_id);
  return query select 'ok'::text, v_version, v_changed;
end
$$;

-- F-07: the session, its roster with each learner's mark, and every amendment, newest first.
create function api.get_register(p_session_id uuid)
returns table (
  session_id uuid,
  title text,
  cohort_name text,
  starts_at timestamptz,
  duration_minutes integer,
  state text,
  register_version integer,
  captured_at timestamptz,
  captured_by_name text,
  roster jsonb,
  amendments jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, c.name, s.starts_at, s.duration_minutes, s.state, s.register_version,
    s.register_captured_at, cap.full_name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'learner_id', r.learner_id, 'full_name', r.full_name, 'learner_number', r.learner_number,
        'enrolled', r.enrolled, 'status', a.status) order by r.full_name)
      from learning.session_roster(s.id) r
      left join learning.attendance a on a.session_id = s.id and a.learner_id = r.learner_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'learner_name', l.full_name, 'previous_status', ch.previous_status, 'status', ch.status,
        'reason', ch.reason, 'changed_by_name', by_p.full_name, 'changed_at', ch.changed_at,
        'register_version', ch.register_version) order by ch.changed_at desc, ch.id desc)
      from learning.attendance_changes ch
      join identity.profiles l on l.id = ch.learner_id
      join identity.profiles by_p on by_p.id = ch.changed_by
      where ch.session_id = s.id and ch.kind = 'amended'
    ), '[]'::jsonb)
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  left join identity.profiles cap on cap.id = s.register_captured_by
  where s.id = p_session_id and submissions.can_set_work(auth.uid(), s.cohort_id)
$$;

revoke all on function api.save_register(uuid, jsonb, integer, text) from public, anon, authenticated, service_role;
revoke all on function api.get_register(uuid) from public, anon, authenticated, service_role;
grant execute on function api.save_register(uuid, jsonb, integer, text) to authenticated;
grant execute on function api.get_register(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Existing functions, regenerated: uploads pick the recordings bucket and limit; reads carry the category
-- ---------------------------------------------------------------------------------------------------------------

-- The upload authorisation from 20261020090000, choosing the recordings bucket and limit for a recording.
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
    -- A recording goes to its own bucket, within its own limit.
    v_bucket := case when exists (
      select 1 from learning.materials m where m.id = p_context_id and m.category = 'recording'
    ) then 'recordings' else 'materials' end;
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
  v_max_bytes := least(v_max_bytes, audit.config_int(case when v_bucket = 'recordings' then 'recording.max_mb' else 'upload.max_mb' end)::bigint * 1024 * 1024);

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

-- The material reads from 20261008090000, each with the category and captions added.

drop function api.list_materials();

create function api.list_materials()
returns table (
  id uuid,
  title text,
  cohort_name text,
  module_title text,
  kind text,
  category text,
  has_captions boolean,
  state text,
  release_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, c.name, mo.title, m.kind, m.category, m.has_captions, m.state, m.release_at, m.updated_at
  from learning.materials m
  join programmes.cohorts c on c.id = m.cohort_id
  left join programmes.modules mo on mo.id = m.module_id
  where submissions.can_set_work(auth.uid(), m.cohort_id)
  order by m.state = 'archived', m.updated_at desc
$$;

revoke all on function api.list_materials() from public, anon, authenticated, service_role;
grant execute on function api.list_materials() to authenticated;

drop function api.get_material(uuid);

create function api.get_material(p_material_id uuid)
returns table (
  id uuid,
  cohort_id uuid,
  cohort_name text,
  programme_id uuid,
  module_id uuid,
  title text,
  description text,
  kind text,
  category text,
  has_captions boolean,
  link_url text,
  file_id uuid,
  file_name text,
  file_bytes bigint,
  file_media_type text,
  state text,
  release_at timestamptz,
  opened_by integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.cohort_id, c.name, c.programme_id, m.module_id, m.title, m.description, m.kind, m.category, m.has_captions, m.link_url,
    sf.id, sf.original_filename, sf.bytes, sf.media_type, m.state, m.release_at,
    (select count(distinct ev.learner_id)::integer from learning.material_access_events ev where ev.material_id = m.id)
  from learning.materials m
  join programmes.cohorts c on c.id = m.cohort_id
  left join submissions.stored_files sf on sf.id = m.stored_file_id
  where m.id = p_material_id and learning.can_edit_material(auth.uid(), m.id)
$$;

revoke all on function api.get_material(uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_material(uuid) to authenticated;

drop function api.list_my_materials(text);

create function api.list_my_materials(p_search text default null)
returns table (
  id uuid,
  title text,
  description text,
  cohort_name text,
  module_code text,
  module_title text,
  kind text,
  category text,
  has_captions boolean,
  link_host text,
  file_bytes bigint,
  file_media_type text,
  release_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, m.description, c.name, mo.code, mo.title, m.kind, m.category, m.has_captions,
    case when m.kind = 'link' then substring(m.link_url from '^https://([^/:?#]+)') end,
    sf.bytes, sf.media_type, m.release_at
  from learning.materials m
  join programmes.cohorts c on c.id = m.cohort_id
  left join programmes.modules mo on mo.id = m.module_id
  left join submissions.stored_files sf on sf.id = m.stored_file_id
  where learning.is_released_to(auth.uid(), m.id)
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or (m.title || ' ' || m.description || ' ' || coalesce(mo.title, '') || ' ' || coalesce(mo.code, ''))
         ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by mo.code nulls last, m.release_at desc, m.title
$$;

revoke all on function api.list_my_materials(text) from public, anon, authenticated, service_role;
grant execute on function api.list_my_materials(text) to authenticated;

drop function api.get_my_material(uuid);

create function api.get_my_material(p_material_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  module_title text,
  kind text,
  category text,
  has_captions boolean,
  link_url text,
  file_bucket text,
  file_key text,
  file_name text,
  file_bytes bigint,
  file_media_type text,
  release_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, m.description, mo.title, m.kind, m.category, m.has_captions, m.link_url, sf.bucket, sf.object_key, sf.original_filename,
    sf.bytes, sf.media_type, m.release_at
  from learning.materials m
  left join programmes.modules mo on mo.id = m.module_id
  left join submissions.stored_files sf on sf.id = m.stored_file_id
  where m.id = p_material_id and learning.is_released_to(auth.uid(), m.id)
$$;

revoke all on function api.get_my_material(uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_my_material(uuid) to authenticated;

-- The signed-in settings from 20261020090000, with the largest recording.
drop function api.public_settings();

create function api.public_settings()
returns table (late_policy text, upload_max_mb integer, appeal_window_days integer, appeal_turnaround_working_days integer,
  recording_max_mb integer)
language sql
stable
security definer
set search_path = ''
as $$
  select audit.config_text('submission.late_policy'), audit.config_int('upload.max_mb'),
    audit.config_int('appeal.window_days'), audit.config_int('appeal.turnaround_working_days'),
    audit.config_int('recording.max_mb')
  where auth.uid() is not null
$$;

revoke all on function api.public_settings() from public, anon, authenticated, service_role;
grant execute on function api.public_settings() to authenticated;
