-- Private learner notes (S3-14; FR-306, FR-307; risk R-09; screen L-09).
--
-- A learner writes notes for themselves: a title and text, an optional folder to organise them, and optionally a link
-- to a material released to them or one of their cohort's sessions. They can search, edit and delete them.
--
-- Only the owner ever sees a note (FR-307, R-09). The notes live in their own table, learner_notes, which no role may
-- read or write directly; the only way in is the functions below, each of which acts on the caller's own notes. No
-- view, report, moderation or assessment function, and nothing the Department API will read, touches the table: test
-- 0037 is the schema contract that fails if any other function or view ever mentions it. Row security with an
-- owner-only policy is on as well, so a grant added by mistake would still show a person nothing but their own.
--
-- Notes are not audited: an audit event never copies note text (security and operations, "Logging"), and recording
-- when someone writes in their private notebook would itself be tracking them. Deleting a note deletes it.

create table learning.learner_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references identity.profiles (id),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null default '' check (char_length(body) <= 20000),
  folder text check (char_length(btrim(folder)) between 1 and 60),
  material_id uuid references learning.materials (id),
  session_id uuid references learning.sessions (id),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_link_at_most check (material_id is null or session_id is null)
);

create index learner_notes_owner_idx on learning.learner_notes (owner_id, updated_at desc);

revoke all on table learning.learner_notes from public, anon, authenticated, service_role;

alter table learning.learner_notes enable row level security;
create policy "only the owner" on learning.learner_notes
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- What a note may link to: a material released to the owner, or a session of a cohort they are actively in.
create function learning.note_link_problem(p_owner uuid, p_material_id uuid, p_session_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_material_id is not null and p_session_id is not null then 'one_link_only'
    when p_material_id is not null and not learning.is_released_to(p_owner, p_material_id) then 'link_not_found'
    when p_session_id is not null and not exists (
      select 1 from learning.sessions s
      join programmes.enrolments e on e.cohort_id = s.cohort_id and e.profile_id = p_owner and e.status = 'active'
      where s.id = p_session_id
    ) then 'link_not_found'
  end
$$;

-- The shape checks shared by create and update.
create function learning.note_problem(p_title text, p_body text, p_folder text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then 'invalid_title'
    when char_length(coalesce(p_body, '')) > 20000 then 'body_too_long'
    when p_folder is not null and btrim(p_folder) <> '' and char_length(btrim(p_folder)) > 60 then 'invalid_folder'
  end
$$;

revoke all on function learning.note_link_problem(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function learning.note_problem(text, text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands: each acts on the caller's own notes
-- ---------------------------------------------------------------------------------------------------------------

create function api.create_note(
  p_title text,
  p_body text default '',
  p_folder text default null,
  p_material_id uuid default null,
  p_session_id uuid default null
)
returns table (status text, note_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_problem text;
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not identity.has_role(v_actor, 'learner') then return query select 'forbidden'::text, null::uuid; return; end if;
  v_problem := coalesce(learning.note_problem(p_title, p_body, p_folder),
                        learning.note_link_problem(v_actor, p_material_id, p_session_id));
  if v_problem is not null then return query select v_problem, null::uuid; return; end if;

  insert into learning.learner_notes (owner_id, title, body, folder, material_id, session_id)
  values (v_actor, btrim(p_title), coalesce(p_body, ''), nullif(btrim(coalesce(p_folder, '')), ''), p_material_id, p_session_id)
  returning id into v_id;
  return query select 'ok'::text, v_id;
end
$$;

-- Replaces the note's title, text, folder and link. p_expected_version is the version the learner opened, so an
-- edit in another tab is not silently overwritten.
create function api.update_note(
  p_note_id uuid,
  p_expected_version integer,
  p_title text,
  p_body text,
  p_folder text default null,
  p_material_id uuid default null,
  p_session_id uuid default null
)
returns table (status text, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_note learning.learner_notes;
  v_problem text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_note from learning.learner_notes n where n.id = p_note_id and n.owner_id = v_actor for update;
  if not found then return query select 'not_found'::text, null::integer; return; end if;
  if p_expected_version is distinct from v_note.version then
    return query select 'stale'::text, v_note.version; return;
  end if;
  v_problem := learning.note_problem(p_title, p_body, p_folder);
  -- A link the note already has may stay even if its material is no longer released; a new link must be valid.
  if v_problem is null and (p_material_id is distinct from v_note.material_id or p_session_id is distinct from v_note.session_id) then
    v_problem := learning.note_link_problem(v_actor, p_material_id, p_session_id);
  end if;
  if v_problem is not null then return query select v_problem, v_note.version; return; end if;

  update learning.learner_notes n
  set title = btrim(p_title), body = coalesce(p_body, ''), folder = nullif(btrim(coalesce(p_folder, '')), ''),
      material_id = p_material_id, session_id = p_session_id, version = n.version + 1, updated_at = now()
  where n.id = p_note_id;
  return query select 'ok'::text, v_note.version + 1;
end
$$;

create function api.delete_note(p_note_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return query select 'unauthenticated'::text; return; end if;
  delete from learning.learner_notes n where n.id = p_note_id and n.owner_id = auth.uid();
  if not found then return query select 'not_found'::text; return; end if;
  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads: the caller's own notes only
-- ---------------------------------------------------------------------------------------------------------------

-- The learner's notes, newest first, optionally in one folder and matching words in the title or text.
create function api.list_my_notes(p_search text default null, p_folder text default null)
returns table (
  id uuid,
  title text,
  excerpt text,
  folder text,
  link_kind text,
  link_id uuid,
  link_title text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.title, left(regexp_replace(n.body, '\s+', ' ', 'g'), 160), n.folder,
    case when n.material_id is not null then 'material' when n.session_id is not null then 'session' end,
    coalesce(n.material_id, n.session_id), coalesce(m.title, s.title), n.updated_at
  from learning.learner_notes n
  left join learning.materials m on m.id = n.material_id
  left join learning.sessions s on s.id = n.session_id
  where n.owner_id = auth.uid()
    and (nullif(btrim(coalesce(p_folder, '')), '') is null or n.folder = btrim(p_folder))
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or (n.title || ' ' || n.body || ' ' || coalesce(n.folder, ''))
         ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by n.updated_at desc, n.title
$$;

-- The learner's folders, with how many notes each holds.
create function api.list_my_note_folders()
returns table (folder text, notes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.folder, count(*)::integer
  from learning.learner_notes n
  where n.owner_id = auth.uid() and n.folder is not null
  group by n.folder
  order by n.folder
$$;

-- One of the learner's notes. Nothing if it is not theirs.
create function api.get_my_note(p_note_id uuid)
returns table (
  id uuid,
  title text,
  body text,
  folder text,
  material_id uuid,
  session_id uuid,
  link_title text,
  link_available boolean,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.title, n.body, n.folder, n.material_id, n.session_id, coalesce(m.title, s.title),
    case
      when n.material_id is not null then learning.is_released_to(auth.uid(), n.material_id)
      when n.session_id is not null then true
    end,
    n.version, n.created_at, n.updated_at
  from learning.learner_notes n
  left join learning.materials m on m.id = n.material_id
  left join learning.sessions s on s.id = n.session_id
  where n.id = p_note_id and n.owner_id = auth.uid()
$$;

-- What a note can link to: materials released to the learner and their cohorts' sessions, newest first.
create function api.list_note_link_targets()
returns table (kind text, id uuid, title text, at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select 'material'::text, m.id, m.title, m.release_at
  from learning.materials m
  where learning.is_released_to(auth.uid(), m.id)
  union all
  select 'session', s.id, s.title, s.starts_at
  from learning.sessions s
  join programmes.enrolments e on e.cohort_id = s.cohort_id and e.profile_id = auth.uid() and e.status = 'active'
  order by 1, 4 desc
$$;

revoke all on function api.create_note(text, text, text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function api.update_note(uuid, integer, text, text, text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function api.delete_note(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_notes(text, text) from public, anon, authenticated, service_role;
revoke all on function api.list_my_note_folders() from public, anon, authenticated, service_role;
revoke all on function api.get_my_note(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_note_link_targets() from public, anon, authenticated, service_role;

grant execute on function api.create_note(text, text, text, uuid, uuid) to authenticated;
grant execute on function api.update_note(uuid, integer, text, text, text, uuid, uuid) to authenticated;
grant execute on function api.delete_note(uuid) to authenticated;
grant execute on function api.list_my_notes(text, text) to authenticated;
grant execute on function api.list_my_note_folders() to authenticated;
grant execute on function api.get_my_note(uuid) to authenticated;
grant execute on function api.list_note_link_targets() to authenticated;
