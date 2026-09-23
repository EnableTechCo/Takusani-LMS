-- An upload answers a particular evidence requirement (S2-05, FR-311). Recording that on the intent means a
-- learner who closes the page and comes back finds each file against the requirement they chose it for, instead of
-- a loose pile they must sort out again.
--
-- Replacing api.authorise_upload and api.list_my_uploads changes their parameters and columns, so both are dropped
-- and created again, and their grants given again.

alter table submissions.file_upload_intents
  add column requirement_id uuid references submissions.task_evidence_requirements (id);

drop function api.authorise_upload(text, uuid, text, text, bigint, text, uuid);

create function api.authorise_upload(
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
    jsonb_build_object('task_id', p_context_id), 'learner', null,
    jsonb_build_object('filename', v_filename, 'declared_bytes', p_bytes, 'declared_media_type', p_media_type),
    null, null);

  return query select 'ok'::text, v_intent.id, v_intent.bucket, v_intent.object_key, v_intent.max_bytes,
    v_intent.expires_at;
end
$$;

drop function api.list_my_uploads(uuid);

create function api.list_my_uploads(p_task_id uuid)
returns table (
  file_id uuid,
  intent_id uuid,
  requirement_id uuid,
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
  select sf.id, sf.intent_id, i.requirement_id, sf.original_filename, sf.bytes, sf.media_type, sf.scan_state,
         sf.accepted_at
  from submissions.stored_files sf
  join submissions.file_upload_intents i on i.id = sf.intent_id
  where i.profile_id = auth.uid()
    and i.context_type = 'task_submission'
    and i.context_id = p_task_id
    and i.consumed_at is null
  order by sf.accepted_at
$$;

revoke all on function api.authorise_upload(text, uuid, text, text, bigint, text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function api.list_my_uploads(uuid) from public, anon, authenticated, service_role;

grant execute on function api.authorise_upload(text, uuid, text, text, bigint, text, uuid, uuid) to authenticated;
grant execute on function api.list_my_uploads(uuid) to authenticated;
