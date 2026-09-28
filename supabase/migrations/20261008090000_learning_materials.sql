-- Learning materials and access logging (S2-14; FR-204, FR-301; screens F-04, L-04, L-05).
--
-- A facilitator adds material for a cohort they set work in: a file or a link, tagged to one of the programme's
-- modules. It is a draft until published; publishing now or at a later time is the same act, and a material with a
-- later release time is "Scheduled". Visibility is decided when the material is read (published and the release time
-- has passed), so a scheduled material appears on time without any scheduled job.
--
-- Files reuse the resumable upload flow (ADR-007): an intent with context "material", the object in a private
-- "materials" bucket, finalised against Storage's own metadata. Learners never read the bucket directly: the server
-- signs a short-lived link, and the storage policy allows that only for a learner the material is released to.
--
-- Opening a material appends a learner access event (FR-301), coalesced to one per learner, material and 30 minutes.
-- It feeds engagement reporting only, and is written after the page is sent, so a logging failure never blocks access.
--
-- Not here: programme-wide materials across cohorts, recordings as their own type (FR-208, with sessions), notes
-- attached to a material (FR-306), and engagement reports.

-- ---------------------------------------------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png'
])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table submissions.file_upload_intents drop constraint file_upload_intents_context_type_check;
alter table submissions.file_upload_intents
  add constraint file_upload_intents_context_type_check check (context_type in ('task_submission', 'material'));

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create table learning.materials (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references programmes.cohorts (id),
  module_id uuid references programmes.modules (id),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  kind text check (kind in ('file', 'link')),
  link_url text check (link_url ~ '^https://[^\s]+$' and char_length(link_url) <= 2000),
  stored_file_id uuid references submissions.stored_files (id),
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  -- When learners can see it. In the future while published, the material is "Scheduled".
  release_at timestamptz,
  created_by uuid not null references identity.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_matches_kind check (
    (kind is null and link_url is null and stored_file_id is null)
    or (kind = 'link' and link_url is not null and stored_file_id is null)
    or (kind = 'file' and stored_file_id is not null and link_url is null)
  ),
  constraint published_has_content_and_time check (state <> 'published' or (kind is not null and release_at is not null))
);

create index materials_cohort_idx on learning.materials (cohort_id, state, release_at);

-- Append-only (data model): who opened which material, and when. Engagement reporting only.
create table learning.material_access_events (
  id bigint generated always as identity primary key,
  material_id uuid not null references learning.materials (id),
  learner_id uuid not null references identity.profiles (id),
  opened_at timestamptz not null default now()
);

create index material_access_recent_idx on learning.material_access_events (material_id, learner_id, opened_at desc);

revoke all on table learning.materials, learning.material_access_events from public, anon, authenticated, service_role;
revoke update, delete, truncate on learning.material_access_events from public, anon, authenticated, service_role;

create trigger material_access_events_append_only
  before update or delete on learning.material_access_events
  for each row execute function audit.forbid_mutation();

create trigger material_access_events_append_only_truncate
  before truncate on learning.material_access_events
  for each statement execute function audit.forbid_mutation();

-- ---------------------------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------------------------

-- Who may add and change a material: whoever may set work in its cohort (S2-02).
create function learning.can_edit_material(p_profile_id uuid, p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from learning.materials m
    where m.id = p_material_id and submissions.can_set_work(p_profile_id, m.cohort_id)
  )
$$;

-- Released to this learner: published, its release time has passed, and they are actively enrolled in its cohort.
create function learning.is_released_to(p_profile_id uuid, p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from learning.materials m
    join programmes.enrolments e on e.cohort_id = m.cohort_id and e.profile_id = p_profile_id and e.status = 'active'
    where m.id = p_material_id and m.state = 'published' and m.release_at <= now()
  )
$$;

-- The storage policy's check for signing a download link: a released material's file, or one the person may edit.
-- Called by the policy as the signed-in role, so that role executes it (allow-list); it reads tables as its owner.
create function learning.may_read_material(p_profile_id uuid, p_bucket text, p_object_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket = 'materials' and exists (
    select 1
    from learning.materials m
    join submissions.stored_files sf on sf.id = m.stored_file_id
    where sf.bucket = p_bucket and sf.object_key = p_object_key
      and (learning.is_released_to(p_profile_id, m.id) or learning.can_edit_material(p_profile_id, m.id))
  )
$$;

revoke all on function learning.can_edit_material(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function learning.is_released_to(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function learning.may_read_material(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function learning.may_read_material(uuid, text, text) to authenticated;

create policy "upload material only to an authorised key"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and submissions.may_upload_object(auth.uid(), bucket_id, name));

create policy "finish a material upload in progress"
  on storage.objects for update to authenticated
  using (bucket_id = 'materials' and submissions.may_upload_object(auth.uid(), bucket_id, name))
  with check (bucket_id = 'materials' and submissions.may_upload_object(auth.uid(), bucket_id, name));

create policy "read material you uploaded or may open"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'materials'
    and (submissions.owns_upload(auth.uid(), bucket_id, name) or learning.may_read_material(auth.uid(), bucket_id, name))
  );

-- ---------------------------------------------------------------------------------------------------------------
-- Uploads: the material context (same signature, so the grants stand)
-- ---------------------------------------------------------------------------------------------------------------

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
-- Commands (facilitators)
-- ---------------------------------------------------------------------------------------------------------------

create function api.create_material(p_cohort_id uuid, p_title text, p_description text default '', p_module_id uuid default null)
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

  insert into learning.materials (cohort_id, module_id, title, description, created_by)
  values (p_cohort_id, p_module_id, btrim(p_title), coalesce(p_description, ''), v_actor)
  returning id into v_id;

  perform audit.append('learning.material_created', 'material', v_id::text, '{}'::jsonb, 'facilitator', null,
    jsonb_build_object('title', btrim(p_title), 'module_id', p_module_id, 'state', 'draft'), 'cohort', p_cohort_id);
  return query select 'ok'::text, v_id;
end
$$;

-- Title, description, module, and the link (null leaves the content as it is). An archived material is not changed.
create function api.update_material(
  p_material_id uuid,
  p_title text,
  p_description text,
  p_module_id uuid default null,
  p_link_url text default null
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_material learning.materials;
  v_link text := nullif(btrim(coalesce(p_link_url, '')), '');
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_material from learning.materials m where m.id = p_material_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if not learning.can_edit_material(v_actor, p_material_id) then return query select 'forbidden'::text; return; end if;
  if v_material.state = 'archived' then return query select 'archived'::text; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then return query select 'invalid_title'::text; return; end if;
  if char_length(coalesce(p_description, '')) > 5000 then return query select 'invalid_description'::text; return; end if;
  if p_module_id is not null and not exists (
    select 1 from programmes.modules mo join programmes.cohorts c on c.programme_id = mo.programme_id
    where mo.id = p_module_id and c.id = v_material.cohort_id
  ) then
    return query select 'module_not_in_programme'::text; return;
  end if;
  if v_link is not null and (v_link !~ '^https://[^\s]+$' or char_length(v_link) > 2000) then
    return query select 'invalid_link'::text; return;
  end if;

  update learning.materials m
  set title = btrim(p_title), description = coalesce(p_description, ''), module_id = p_module_id,
      kind = case when v_link is not null then 'link' else m.kind end,
      link_url = case when v_link is not null then v_link else m.link_url end,
      stored_file_id = case when v_link is not null then null else m.stored_file_id end,
      updated_at = now()
  where m.id = p_material_id;

  perform audit.append('learning.material_updated', 'material', p_material_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('title', v_material.title, 'module_id', v_material.module_id, 'kind', v_material.kind,
                       'link_url', v_material.link_url),
    jsonb_build_object('title', btrim(p_title), 'module_id', p_module_id,
                       'kind', coalesce(case when v_link is not null then 'link' end, v_material.kind),
                       'link_url', coalesce(v_link, v_material.link_url)),
    'cohort', v_material.cohort_id);
  return query select 'ok'::text;
end
$$;

-- Makes an uploaded file the material's content. Only a finalised upload made for this material by this person.
create function api.attach_material_file(p_material_id uuid, p_file_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_material learning.materials;
  v_intent submissions.file_upload_intents;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_material from learning.materials m where m.id = p_material_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if not learning.can_edit_material(v_actor, p_material_id) then return query select 'forbidden'::text; return; end if;
  if v_material.state = 'archived' then return query select 'archived'::text; return; end if;

  select i.* into v_intent
  from submissions.stored_files sf join submissions.file_upload_intents i on i.id = sf.intent_id
  where sf.id = p_file_id for update of i;
  if not found or v_intent.profile_id <> v_actor or v_intent.context_type <> 'material'
     or v_intent.context_id <> p_material_id or v_intent.discarded_at is not null then
    return query select 'file_not_available'::text; return;
  end if;

  update submissions.file_upload_intents i set consumed_at = coalesce(i.consumed_at, now()) where i.id = v_intent.id;
  update learning.materials m
  set kind = 'file', stored_file_id = p_file_id, link_url = null, updated_at = now()
  where m.id = p_material_id;

  perform audit.append('learning.material_file_attached', 'material', p_material_id::text,
    jsonb_build_object('file_id', p_file_id), 'facilitator', jsonb_build_object('stored_file_id', v_material.stored_file_id),
    jsonb_build_object('stored_file_id', p_file_id), 'cohort', v_material.cohort_id);
  return query select 'ok'::text;
end
$$;

-- Publish now (p_release_at null) or at a later time (scheduled). Also moves a scheduled material's time, or
-- releases it at once. Needs content: a file or a link.
create function api.publish_material(p_material_id uuid, p_release_at timestamptz default null)
returns table (status text, release_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_material learning.materials;
  v_release timestamptz := coalesce(p_release_at, now());
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::timestamptz; return; end if;
  select * into v_material from learning.materials m where m.id = p_material_id for update;
  if not found then return query select 'not_found'::text, null::timestamptz; return; end if;
  if not learning.can_edit_material(v_actor, p_material_id) then return query select 'forbidden'::text, null::timestamptz; return; end if;
  if v_material.state = 'archived' then return query select 'archived'::text, null::timestamptz; return; end if;
  if v_material.kind is null then return query select 'no_content'::text, null::timestamptz; return; end if;
  if v_release < now() - interval '1 minute' then return query select 'release_in_past'::text, null::timestamptz; return; end if;
  if v_material.state = 'published' and v_material.release_at <= now() then
    return query select 'already_released'::text, v_material.release_at; return;
  end if;

  update learning.materials m set state = 'published', release_at = greatest(v_release, now()), updated_at = now()
  where m.id = p_material_id
  returning m.release_at into v_release;

  perform audit.append('learning.material_published', 'material', p_material_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('state', v_material.state, 'release_at', v_material.release_at),
    jsonb_build_object('state', 'published', 'release_at', v_release), 'cohort', v_material.cohort_id);
  return query select 'ok'::text, v_release;
end
$$;

-- Archive: learners no longer see it; it stays on record.
create function api.archive_material(p_material_id uuid)
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
  if not found then return query select 'not_found'::text; return; end if;
  if not learning.can_edit_material(v_actor, p_material_id) then return query select 'forbidden'::text; return; end if;
  if v_material.state = 'archived' then return query select 'ok'::text; return; end if;
  update learning.materials m set state = 'archived', updated_at = now() where m.id = p_material_id;
  perform audit.append('learning.material_archived', 'material', p_material_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('state', v_material.state), jsonb_build_object('state', 'archived'), 'cohort', v_material.cohort_id);
  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads (facilitators)
-- ---------------------------------------------------------------------------------------------------------------

create function api.list_materials()
returns table (
  id uuid,
  title text,
  cohort_name text,
  module_title text,
  kind text,
  state text,
  release_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, c.name, mo.title, m.kind, m.state, m.release_at, m.updated_at
  from learning.materials m
  join programmes.cohorts c on c.id = m.cohort_id
  left join programmes.modules mo on mo.id = m.module_id
  where submissions.can_set_work(auth.uid(), m.cohort_id)
  order by m.state = 'archived', m.updated_at desc
$$;

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
  select m.id, m.cohort_id, c.name, c.programme_id, m.module_id, m.title, m.description, m.kind, m.link_url,
    sf.id, sf.original_filename, sf.bytes, sf.media_type, m.state, m.release_at,
    (select count(distinct ev.learner_id)::integer from learning.material_access_events ev where ev.material_id = m.id)
  from learning.materials m
  join programmes.cohorts c on c.id = m.cohort_id
  left join submissions.stored_files sf on sf.id = m.stored_file_id
  where m.id = p_material_id and learning.can_edit_material(auth.uid(), m.id)
$$;

-- The modules a material in this cohort can be tagged to: its programme's.
create function api.list_cohort_modules(p_cohort_id uuid)
returns table (id uuid, code text, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select mo.id, mo.code, mo.title
  from programmes.modules mo
  join programmes.cohorts c on c.programme_id = mo.programme_id
  where c.id = p_cohort_id and submissions.can_set_work(auth.uid(), c.id)
  order by mo.code
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads and the access log (learners)
-- ---------------------------------------------------------------------------------------------------------------

-- Released material for the learner's cohorts, by module, optionally matching words in the title or description.
create function api.list_my_materials(p_search text default null)
returns table (
  id uuid,
  title text,
  description text,
  cohort_name text,
  module_code text,
  module_title text,
  kind text,
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
  select m.id, m.title, m.description, c.name, mo.code, mo.title, m.kind,
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

-- One released material, with what the server needs to sign the file's link. Nothing if it is not released to them.
create function api.get_my_material(p_material_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  module_title text,
  kind text,
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
  select m.id, m.title, m.description, mo.title, m.kind, m.link_url, sf.bucket, sf.object_key, sf.original_filename,
    sf.bytes, sf.media_type, m.release_at
  from learning.materials m
  left join programmes.modules mo on mo.id = m.module_id
  left join submissions.stored_files sf on sf.id = m.stored_file_id
  where m.id = p_material_id and learning.is_released_to(auth.uid(), m.id)
$$;

-- Records that the learner opened a material: at most once per learner, material and 30 minutes (FR-301).
create function api.log_material_access(p_material_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  if not learning.is_released_to(v_actor, p_material_id) then return query select 'not_found'::text; return; end if;
  if exists (
    select 1 from learning.material_access_events ev
    where ev.material_id = p_material_id and ev.learner_id = v_actor and ev.opened_at > now() - interval '30 minutes'
  ) then
    return query select 'coalesced'::text; return;
  end if;
  insert into learning.material_access_events (material_id, learner_id) values (p_material_id, v_actor);
  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.create_material(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function api.update_material(uuid, text, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function api.attach_material_file(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function api.publish_material(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function api.archive_material(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_materials() from public, anon, authenticated, service_role;
revoke all on function api.get_material(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_cohort_modules(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_materials(text) from public, anon, authenticated, service_role;
revoke all on function api.get_my_material(uuid) from public, anon, authenticated, service_role;
revoke all on function api.log_material_access(uuid) from public, anon, authenticated, service_role;

grant execute on function api.create_material(uuid, text, text, uuid) to authenticated;
grant execute on function api.update_material(uuid, text, text, uuid, text) to authenticated;
grant execute on function api.attach_material_file(uuid, uuid) to authenticated;
grant execute on function api.publish_material(uuid, timestamptz) to authenticated;
grant execute on function api.archive_material(uuid) to authenticated;
grant execute on function api.list_materials() to authenticated;
grant execute on function api.get_material(uuid) to authenticated;
grant execute on function api.list_cohort_modules(uuid) to authenticated;
grant execute on function api.list_my_materials(text) to authenticated;
grant execute on function api.get_my_material(uuid) to authenticated;
grant execute on function api.log_material_access(uuid) to authenticated;
