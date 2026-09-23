-- Upload intents and the submissions bucket (S2-03, ADR-007, register G3): evidence goes straight from the browser
-- to private Storage, and is only accepted after finalisation. LMS-api-design.md "Coursework submission";
-- LMS-data-model.md "Submissions and files".
--
-- The two steps, and why:
--   1. api.authorise_upload() decides whether this person may upload for this task, and records an intent: one
--      random object key, the limits, and a short expiry. A Supabase upload carries no per-upload size or type
--      limit and a signed token outlives a short expiry, so the intent, checked at finalisation, is the control.
--   2. api.finalise_upload() reads the object's real size and type from Storage's own metadata, checks them against
--      the intent, and records the file. An object that never arrived, arrived late, or is too big is refused, and
--      the intent stays unfinalised so nothing can be submitted with it.
--
-- The browser uploads with its own session (the resumable TUS endpoint), not a service key, so the storage policies
-- below are the gate: a learner may create exactly the object key an unexpired, unfinalised intent of theirs names,
-- and may never overwrite or delete it. Storage exposes no content hash, so the learner's declared checksum is kept
-- as declared; the authoritative SHA-256 and type detection belong to the scan step (submission_checks, later).

-- ---------------------------------------------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------------------------------------------

-- Private, with the bucket's own first gate on size and type. 25 MB matches the brief in the prototype.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png'
])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create table submissions.file_upload_intents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references identity.profiles (id),
  -- What the file is for. Learning material and administrative uploads join this list with their own tickets.
  context_type text not null check (context_type in ('task_submission')),
  context_id uuid not null,
  bucket text not null default 'submissions',
  object_key text not null unique,
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  declared_media_type text not null,
  declared_bytes bigint not null check (declared_bytes > 0),
  -- Recorded as declared: Storage cannot confirm it (ADR-007).
  declared_sha256 text check (declared_sha256 ~ '^[a-f0-9]{64}$'),
  max_bytes bigint not null check (max_bytes > 0),
  allowed_media_types text[] not null,
  -- A retried authorisation returns the first intent instead of leaking a second object key.
  client_upload_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  finalised_at timestamptz,
  consumed_at timestamptz,
  unique (profile_id, client_upload_id)
);

-- One row per accepted object: what Storage actually holds, not what the browser promised.
create table submissions.stored_files (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references submissions.file_upload_intents (id),
  bucket text not null,
  object_key text not null,
  original_filename text not null,
  bytes bigint not null check (bytes > 0),
  media_type text not null,
  declared_sha256 text,
  -- Filled by the scan step, which also detects the real media type; until then the file is not trusted content.
  sha256 text,
  scan_state text not null default 'pending' check (scan_state in ('pending', 'clean', 'infected', 'failed')),
  uploaded_by uuid not null references identity.profiles (id),
  accepted_at timestamptz not null default now(),
  unique (bucket, object_key)
);

create index file_upload_intents_profile_idx on submissions.file_upload_intents (profile_id, created_at desc);
create index stored_files_uploader_idx on submissions.stored_files (uploaded_by);

revoke all on table submissions.file_upload_intents, submissions.stored_files
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Storage policies: the browser uploads with its own session, so these are the gate
-- ---------------------------------------------------------------------------------------------------------------

-- Is this object key one that an unexpired, unfinalised intent of this person's authorises?
create function submissions.may_upload_object(p_profile_id uuid, p_bucket text, p_object_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from submissions.file_upload_intents i
    where i.profile_id = p_profile_id
      and i.bucket = p_bucket
      and i.object_key = p_object_key
      and i.expires_at > now()
      and i.finalised_at is null
  )
$$;

revoke all on function submissions.may_upload_object(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function submissions.may_upload_object(uuid, text, text) to authenticated;

create policy "upload only an authorised key"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and submissions.may_upload_object(auth.uid(), bucket_id, name));

-- The resumable protocol writes the row as the upload proceeds, so the same rule allows those writes; a key whose
-- intent has expired or been finalised stops being writable, which is what makes the intent the control.
create policy "finish an upload in progress"
  on storage.objects for update to authenticated
  using (bucket_id = 'submissions' and submissions.may_upload_object(auth.uid(), bucket_id, name))
  with check (bucket_id = 'submissions' and submissions.may_upload_object(auth.uid(), bucket_id, name));

create policy "read your own uploads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and exists (
      select 1 from submissions.file_upload_intents i
      where i.bucket = storage.objects.bucket_id and i.object_key = storage.objects.name
        and i.profile_id = auth.uid()
    )
  );

-- No delete policy: evidence is never removed by the person who uploaded it (ADR-016, immutable records).

-- ---------------------------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------------------------

-- Step 1. Authorise one upload: decide, record the intent, hand back the key and the limits.
create function api.authorise_upload(
  p_context_type text,
  p_context_id uuid,
  p_filename text,
  p_media_type text,
  p_bytes bigint,
  p_sha256 text default null,
  p_client_upload_id uuid default null
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
  v_bucket text := 'submissions';
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

  if p_context_type <> 'task_submission' then
    return query select 'invalid_context'::text, null::uuid, null::text, null::text, null::bigint, null::timestamptz;
    return;
  end if;
  -- The learner must be the audience of the published task (FR-202), which is also what makes the key predictable
  -- only to them.
  if not submissions.is_audience(v_actor, p_context_id) then
    return query select 'forbidden'::text, null::uuid, null::text, null::text, null::bigint, null::timestamptz;
    return;
  end if;

  select b.file_size_limit, b.allowed_mime_types into v_max_bytes, v_allowed
  from storage.buckets b where b.id = v_bucket;

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
  -- 30 an hour per person (API design). Bulk administrative uploads get their own command.
  if (select count(*) from submissions.file_upload_intents
      where profile_id = v_actor and created_at > now() - interval '1 hour') >= 30 then
    return query select 'rate_limited'::text, null::uuid, null::text, null::text, v_max_bytes, null::timestamptz;
    return;
  end if;

  -- The key is random and carries no filename: nothing about it can be guessed or overwritten.
  v_extension := lower(coalesce(substring(v_filename from '\.([A-Za-z0-9]{1,8})$'), ''));
  v_key := p_context_id::text || '/' || v_actor::text || '/' || gen_random_uuid()::text
    || case when v_extension = '' then '' else '.' || v_extension end;

  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, bucket, object_key, original_filename, declared_media_type,
    declared_bytes, declared_sha256, max_bytes, allowed_media_types, client_upload_id, expires_at
  )
  values (
    v_actor, p_context_type, p_context_id, v_bucket, v_key, v_filename, p_media_type,
    p_bytes, p_sha256, v_max_bytes, v_allowed, p_client_upload_id, now() + interval '2 hours'
  )
  returning * into v_intent;

  perform audit.append('submissions.upload_authorised', 'upload_intent', v_intent.id::text,
    jsonb_build_object('task_id', p_context_id), 'learner', null,
    jsonb_build_object('filename', v_filename, 'declared_bytes', p_bytes, 'declared_media_type', p_media_type),
    null, null);

  return query select 'ok'::text, v_intent.id, v_intent.bucket, v_intent.object_key, v_intent.max_bytes,
    v_intent.expires_at;
end
$$;

-- Step 2. Finalise: the object must exist under the intent's key, inside the intent's expiry and limits. Storage's
-- metadata is the authority on size and type, not the browser's declaration.
create function api.finalise_upload(p_intent_id uuid)
returns table (status text, file_id uuid, bytes bigint, media_type text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_intent submissions.file_upload_intents;
  v_object record;
  v_bytes bigint;
  v_type text;
  v_file uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::bigint, null::text; return; end if;

  select * into v_intent from submissions.file_upload_intents where id = p_intent_id for update;
  if not found or v_intent.profile_id <> v_actor then
    return query select 'intent_not_found'::text, null::uuid, null::bigint, null::text; return;
  end if;
  if v_intent.finalised_at is not null then
    select sf.id, sf.bytes, sf.media_type into v_file, v_bytes, v_type
    from submissions.stored_files sf where sf.intent_id = v_intent.id;
    return query select 'already_finalised'::text, v_file, v_bytes, v_type; return;
  end if;

  select o.metadata into v_object
  from storage.objects o
  where o.bucket_id = v_intent.bucket and o.name = v_intent.object_key;
  if not found then
    return query select 'not_uploaded'::text, null::uuid, null::bigint, null::text; return;
  end if;

  -- Late object: the intent's expiry is the control, so an upload that finishes after it is not accepted.
  if v_intent.expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::bigint, null::text; return;
  end if;

  v_bytes := (v_object.metadata ->> 'size')::bigint;
  v_type := coalesce(v_object.metadata ->> 'mimetype', 'application/octet-stream');
  if v_bytes is null or v_bytes <= 0 then
    return query select 'not_uploaded'::text, null::uuid, null::bigint, null::text; return;
  end if;
  if v_bytes > v_intent.max_bytes then
    return query select 'too_large'::text, null::uuid, v_bytes, v_type; return;
  end if;
  if not (v_type = any (v_intent.allowed_media_types)) then
    return query select 'type_not_allowed'::text, null::uuid, v_bytes, v_type; return;
  end if;

  insert into submissions.stored_files (
    intent_id, bucket, object_key, original_filename, bytes, media_type, declared_sha256, uploaded_by
  )
  values (
    v_intent.id, v_intent.bucket, v_intent.object_key, v_intent.original_filename, v_bytes, v_type,
    v_intent.declared_sha256, v_actor
  )
  returning id into v_file;

  update submissions.file_upload_intents set finalised_at = now() where id = v_intent.id;

  perform audit.append('submissions.upload_finalised', 'stored_file', v_file::text,
    jsonb_build_object('task_id', v_intent.context_id, 'intent_id', v_intent.id), 'learner', null,
    jsonb_build_object('bytes', v_bytes, 'media_type', v_type, 'declared_bytes', v_intent.declared_bytes),
    null, null);

  return query select 'ok'::text, v_file, v_bytes, v_type;
end
$$;

-- What the learner has finalised for a task and not yet submitted: what the submit screen lists (S2-04).
create function api.list_my_uploads(p_task_id uuid)
returns table (
  file_id uuid,
  intent_id uuid,
  original_filename text,
  bytes bigint,
  media_type text,
  scan_state text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sf.id, sf.intent_id, sf.original_filename, sf.bytes, sf.media_type, sf.scan_state, sf.accepted_at
  from submissions.stored_files sf
  join submissions.file_upload_intents i on i.id = sf.intent_id
  where i.profile_id = auth.uid()
    and i.context_type = 'task_submission'
    and i.context_id = p_task_id
    and i.consumed_at is null
  order by sf.accepted_at
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.authorise_upload(text, uuid, text, text, bigint, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function api.finalise_upload(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_uploads(uuid) from public, anon, authenticated, service_role;

grant execute on function api.authorise_upload(text, uuid, text, text, bigint, text, uuid) to authenticated;
grant execute on function api.finalise_upload(uuid) to authenticated;
grant execute on function api.list_my_uploads(uuid) to authenticated;
