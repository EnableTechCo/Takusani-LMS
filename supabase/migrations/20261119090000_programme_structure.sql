-- Programme structure: qualifications and units, by screen and by import (FR-701, FR-108, FR-801; SRS AS-03; the
-- credit-structure decisions of 13 Oct 2026: every unit of a qualification is compulsory, the building blocks are
-- called units, and there is no credit for prior learning).
--
-- Credits are earned per unit (S6-01), but nothing could enter a unit except a database script: the create functions
-- from S1-16 had no screens, and only coordinators could call them. This adds what the Administration workspace needs:
--   * who: an administrator, as well as a coordinator whose scope covers the programme (programmes.may_manage_structure);
--   * edit: a qualification's or unit's code and title; a unit's credit value keeps its own versioned path
--     (api.set_unit_credit_value, Configuration), since awards snapshot the value in force;
--   * remove: a unit, or a qualification with no units, only while nothing refers to it (no requirement, award,
--     outcome, module or reconciliation record), so a typo can be undone but history never loses its unit;
--   * import: a unit list (qualification code and title, unit code and title, credits) checked row by row and applied
--     all or nothing. Units already in the programme are left as they are and reported, so loading a file twice
--     creates nothing twice.

-- ---------------------------------------------------------------------------------------------------------------
-- Who may change a programme's structure
-- ---------------------------------------------------------------------------------------------------------------

create function programmes.may_manage_structure(p_profile_id uuid, p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select identity.has_role(p_profile_id, 'administrator')
    or programmes.can_coordinate_programme(p_profile_id, p_programme_id)
$$;

revoke all on function programmes.may_manage_structure(uuid, uuid) from public, anon, authenticated, service_role;

-- The S1-16 commands, unchanged except that an administrator may now call them too.
create or replace function api.create_programme(p_code text, p_title text, p_nqf_level smallint default null)
returns table (status text, programme_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not (programmes.is_global_coordinator(v_actor) or identity.has_role(v_actor, 'administrator')) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' then return query select 'invalid_code'::text, null::uuid; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    return query select 'invalid_title'::text, null::uuid; return;
  end if;
  if p_nqf_level is not null and p_nqf_level not between 1 and 10 then
    return query select 'invalid_nqf_level'::text, null::uuid; return;
  end if;
  if exists (select 1 from programmes.programmes where code = v_code) then
    return query select 'code_taken'::text, null::uuid; return;
  end if;

  insert into programmes.programmes (code, title, nqf_level, created_by)
  values (v_code, btrim(p_title), p_nqf_level, v_actor)
  returning id into v_id;

  perform audit.append('programmes.programme_created', 'programme', v_id::text, '{}'::jsonb,
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end, null,
    jsonb_build_object('code', v_code, 'title', btrim(p_title), 'nqf_level', p_nqf_level), 'global', null);
  return query select 'ok'::text, v_id;
end
$$;

create or replace function api.create_qualification(p_programme_id uuid, p_code text, p_title text)
returns table (status text, qualification_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not exists (select 1 from programmes.programmes where id = p_programme_id) then
    return query select 'programme_not_found'::text, null::uuid; return;
  end if;
  if not programmes.may_manage_structure(v_actor, p_programme_id) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' then return query select 'invalid_code'::text, null::uuid; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    return query select 'invalid_title'::text, null::uuid; return;
  end if;
  if exists (select 1 from programmes.qualifications where programme_id = p_programme_id and code = v_code) then
    return query select 'code_taken'::text, null::uuid; return;
  end if;

  insert into programmes.qualifications (programme_id, code, title)
  values (p_programme_id, v_code, btrim(p_title))
  returning id into v_id;

  perform audit.append('programmes.qualification_created', 'qualification', v_id::text,
    jsonb_build_object('programme_id', p_programme_id),
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end, null,
    jsonb_build_object('code', v_code, 'title', btrim(p_title)), 'programme', p_programme_id);
  return query select 'ok'::text, v_id;
end
$$;

create or replace function api.create_unit(p_qualification_id uuid, p_code text, p_title text, p_credits integer)
returns table (status text, unit_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_programme_id uuid;
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  select programme_id into v_programme_id from programmes.qualifications where id = p_qualification_id;
  if v_programme_id is null then return query select 'qualification_not_found'::text, null::uuid; return; end if;
  if not programmes.may_manage_structure(v_actor, v_programme_id) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' then return query select 'invalid_code'::text, null::uuid; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    return query select 'invalid_title'::text, null::uuid; return;
  end if;
  if p_credits is null or p_credits not between 0 and 1000 then
    return query select 'invalid_credits'::text, null::uuid; return;
  end if;
  if exists (select 1 from programmes.units where qualification_id = p_qualification_id and code = v_code) then
    return query select 'code_taken'::text, null::uuid; return;
  end if;

  insert into programmes.units (qualification_id, code, title)
  values (p_qualification_id, v_code, btrim(p_title))
  returning id into v_id;
  insert into programmes.unit_credit_values (unit_id, credits, set_by) values (v_id, p_credits, v_actor);

  perform audit.append('programmes.unit_created', 'unit', v_id::text,
    jsonb_build_object('qualification_id', p_qualification_id),
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end, null,
    jsonb_build_object('code', v_code, 'title', btrim(p_title), 'credits', p_credits), 'programme', v_programme_id);
  return query select 'ok'::text, v_id;
end
$$;

create or replace function api.create_module(p_programme_id uuid, p_code text, p_title text, p_unit_id uuid default null)
returns table (status text, module_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not exists (select 1 from programmes.programmes where id = p_programme_id) then
    return query select 'programme_not_found'::text, null::uuid; return;
  end if;
  if not programmes.may_manage_structure(v_actor, p_programme_id) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  if p_unit_id is not null and not exists (
    select 1 from programmes.units u join programmes.qualifications q on q.id = u.qualification_id
    where u.id = p_unit_id and q.programme_id = p_programme_id
  ) then
    return query select 'unit_not_in_programme'::text, null::uuid; return;
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' then return query select 'invalid_code'::text, null::uuid; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    return query select 'invalid_title'::text, null::uuid; return;
  end if;
  if exists (select 1 from programmes.modules where programme_id = p_programme_id and code = v_code) then
    return query select 'code_taken'::text, null::uuid; return;
  end if;

  insert into programmes.modules (programme_id, unit_id, code, title)
  values (p_programme_id, p_unit_id, v_code, btrim(p_title))
  returning id into v_id;

  perform audit.append('programmes.module_created', 'module', v_id::text,
    jsonb_build_object('programme_id', p_programme_id),
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end, null,
    jsonb_build_object('code', v_code, 'title', btrim(p_title), 'unit_id', p_unit_id), 'programme', p_programme_id);
  return query select 'ok'::text, v_id;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Editing and removing
-- ---------------------------------------------------------------------------------------------------------------

-- Whether anything refers to a unit: a requirement, an award or outcome, a module, or a reconciliation record.
create function programmes.unit_in_use(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from credits.unit_assessment_requirements r where r.unit_id = p_unit_id)
    or exists (select 1 from credits.ledger_entries l where l.unit_id = p_unit_id)
    or exists (select 1 from credits.learner_unit_outcomes o where o.unit_id = p_unit_id)
    or exists (select 1 from credits.reconciliation_differences d where d.unit_id = p_unit_id)
    or exists (select 1 from programmes.modules m where m.unit_id = p_unit_id)
$$;

revoke all on function programmes.unit_in_use(uuid) from public, anon, authenticated, service_role;

-- A qualification's code and title. Refusals: unauthenticated, not_found, forbidden, invalid_code, invalid_title,
-- code_taken, unchanged.
create function api.update_qualification(p_qualification_id uuid, p_code text, p_title text)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_row programmes.qualifications;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_row from programmes.qualifications q where q.id = p_qualification_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if not programmes.may_manage_structure(v_actor, v_row.programme_id) then return query select 'forbidden'::text; return; end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' then return query select 'invalid_code'::text; return; end if;
  if char_length(v_title) not between 1 and 200 then return query select 'invalid_title'::text; return; end if;
  if v_code = v_row.code and v_title = v_row.title then return query select 'unchanged'::text; return; end if;
  if exists (select 1 from programmes.qualifications q
             where q.programme_id = v_row.programme_id and q.code = v_code and q.id <> v_row.id) then
    return query select 'code_taken'::text; return;
  end if;
  update programmes.qualifications q set code = v_code, title = v_title where q.id = v_row.id;
  perform audit.append('programmes.qualification_changed', 'qualification', v_row.id::text, '{}'::jsonb,
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end,
    jsonb_build_object('code', v_row.code, 'title', v_row.title), jsonb_build_object('code', v_code, 'title', v_title),
    'programme', v_row.programme_id);
  return query select 'ok'::text;
end
$$;

-- A unit's code and title; its credit value changes through api.set_unit_credit_value. Refusals as above.
create function api.update_unit(p_unit_id uuid, p_code text, p_title text)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_row programmes.units;
  v_programme_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_row from programmes.units u where u.id = p_unit_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  select q.programme_id into v_programme_id from programmes.qualifications q where q.id = v_row.qualification_id;
  if not programmes.may_manage_structure(v_actor, v_programme_id) then return query select 'forbidden'::text; return; end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' then return query select 'invalid_code'::text; return; end if;
  if char_length(v_title) not between 1 and 200 then return query select 'invalid_title'::text; return; end if;
  if v_code = v_row.code and v_title = v_row.title then return query select 'unchanged'::text; return; end if;
  if exists (select 1 from programmes.units u
             where u.qualification_id = v_row.qualification_id and u.code = v_code and u.id <> v_row.id) then
    return query select 'code_taken'::text; return;
  end if;
  update programmes.units u set code = v_code, title = v_title where u.id = v_row.id;
  perform audit.append('programmes.unit_changed', 'unit', v_row.id::text, '{}'::jsonb,
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end,
    jsonb_build_object('code', v_row.code, 'title', v_row.title), jsonb_build_object('code', v_code, 'title', v_title),
    'programme', v_programme_id);
  return query select 'ok'::text;
end
$$;

-- Removes a unit nothing refers to yet. Refusals: unauthenticated, not_found, forbidden, in_use.
create function api.remove_unit(p_unit_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row programmes.units;
  v_programme_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_row from programmes.units u where u.id = p_unit_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  select q.programme_id into v_programme_id from programmes.qualifications q where q.id = v_row.qualification_id;
  if not programmes.may_manage_structure(v_actor, v_programme_id) then return query select 'forbidden'::text; return; end if;
  if programmes.unit_in_use(v_row.id) then return query select 'in_use'::text; return; end if;
  delete from programmes.unit_credit_values cv where cv.unit_id = v_row.id;
  delete from programmes.units u where u.id = v_row.id;
  perform audit.append('programmes.unit_removed', 'unit', v_row.id::text, '{}'::jsonb,
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end,
    jsonb_build_object('code', v_row.code, 'title', v_row.title, 'qualification_id', v_row.qualification_id), null,
    'programme', v_programme_id);
  return query select 'ok'::text;
end
$$;

-- Removes a qualification with no units. Refusals: unauthenticated, not_found, forbidden, has_units.
create function api.remove_qualification(p_qualification_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row programmes.qualifications;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_row from programmes.qualifications q where q.id = p_qualification_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if not programmes.may_manage_structure(v_actor, v_row.programme_id) then return query select 'forbidden'::text; return; end if;
  if exists (select 1 from programmes.units u where u.qualification_id = v_row.id) then
    return query select 'has_units'::text; return;
  end if;
  delete from programmes.qualifications q where q.id = v_row.id;
  perform audit.append('programmes.qualification_removed', 'qualification', v_row.id::text, '{}'::jsonb,
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end,
    jsonb_build_object('code', v_row.code, 'title', v_row.title), null, 'programme', v_row.programme_id);
  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------------------------

-- Every programme the person may manage: all of them for an administrator, those their coordinator scope covers.
create function api.list_programme_structures()
returns table (
  programme_id uuid,
  code text,
  title text,
  nqf_level smallint,
  qualifications integer,
  units integer,
  total_credits integer,
  cohorts integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.code, p.title, p.nqf_level,
    (select count(*)::integer from programmes.qualifications q where q.programme_id = p.id),
    (select count(*)::integer from programmes.units u join programmes.qualifications q on q.id = u.qualification_id
     where q.programme_id = p.id),
    (select coalesce(sum(credits.credit_value(u.id)), 0)::integer from programmes.units u
     join programmes.qualifications q on q.id = u.qualification_id where q.programme_id = p.id),
    (select count(*)::integer from programmes.cohorts c where c.programme_id = p.id)
  from programmes.programmes p
  where programmes.may_manage_structure(auth.uid(), p.id)
  order by p.title
$$;

-- One programme's qualifications and their units, with each unit's credit value in force, any change scheduled,
-- and whether anything refers to it (so it can no longer be removed). Empty for anyone who may not manage it.
create function api.get_programme_structure(p_programme_id uuid)
returns table (
  programme_id uuid,
  code text,
  title text,
  nqf_level smallint,
  cohorts integer,
  qualifications jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.code, p.title, p.nqf_level,
    (select count(*)::integer from programmes.cohorts c where c.programme_id = p.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'qualification_id', q.id, 'code', q.code, 'title', q.title,
        'units', coalesce((
          select jsonb_agg(jsonb_build_object(
            'unit_id', u.id, 'code', u.code, 'title', u.title,
            'credits', credits.credit_value(u.id),
            'scheduled', (select jsonb_build_object('credits', cv.credits, 'effective_from', cv.effective_from)
                          from programmes.unit_credit_values cv
                          where cv.unit_id = u.id and cv.effective_from > now() order by cv.effective_from limit 1),
            'in_use', programmes.unit_in_use(u.id))
            order by u.code)
          from programmes.units u where u.qualification_id = q.id), '[]'::jsonb))
        order by q.code)
      from programmes.qualifications q where q.programme_id = p.id), '[]'::jsonb)
  from programmes.programmes p
  where p.id = p_programme_id and programmes.may_manage_structure(auth.uid(), p.id)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Importing a unit list
-- ---------------------------------------------------------------------------------------------------------------

-- Checks a unit list for a programme and, when p_apply and nothing is wrong, adds it all in one transaction.
-- p_rows: [{row, qualification_code, qualification_title, unit_code, unit_title, credits}], row being the line in the
-- file. Units already in the programme are skipped and reported (with whether their title or credits differ); a new
-- qualification needs its title. Returns status ok, problems (nothing added), or a refusal: unauthenticated,
-- not_found, invalid_rows, too_many_rows (over 1,000).
create function api.import_units(p_programme_id uuid, p_rows jsonb, p_apply boolean)
returns table (
  status text,
  new_qualifications integer,
  new_units integer,
  skipped jsonb,
  problems jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item record;
  v_row integer;
  v_qcode text;
  v_qtitle text;
  v_ucode text;
  v_utitle text;
  v_credits_text text;
  v_credits integer;
  v_problems jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_existing record;
  v_new_quals jsonb := '{}'::jsonb;   -- code -> title, for qualifications this file adds
  v_seen jsonb := '{}'::jsonb;        -- "qualification:unit" -> row, for duplicates within the file
  v_plan jsonb := '[]'::jsonb;        -- the units to add
  v_qid uuid;
  v_uid uuid;
  v_unit jsonb;
  v_qualifications integer := 0;
  v_units integer := 0;
  v_role text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer, null::jsonb, null::jsonb; return; end if;
  if not exists (select 1 from programmes.programmes p where p.id = p_programme_id)
     or not programmes.may_manage_structure(v_actor, p_programme_id) then
    return query select 'not_found'::text, null::integer, null::integer, null::jsonb, null::jsonb; return;
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return query select 'invalid_rows'::text, null::integer, null::integer, null::jsonb, null::jsonb; return;
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    return query select 'too_many_rows'::text, null::integer, null::integer, null::jsonb, null::jsonb; return;
  end if;

  -- One import per programme at a time, so two people loading the same list cannot both add a unit.
  perform pg_advisory_xact_lock(hashtextextended('programmes.import_units:' || p_programme_id::text, 0));

  for v_item in select e.value, e.ordinality from jsonb_array_elements(p_rows) with ordinality e loop
    if jsonb_typeof(v_item.value) <> 'object' then
      v_problems := v_problems || jsonb_build_object('row', v_item.ordinality + 1, 'problem', 'unreadable');
      continue;
    end if;
    v_row := coalesce(nullif(v_item.value ->> 'row', '')::integer, v_item.ordinality + 1);
    v_qcode := upper(btrim(coalesce(v_item.value ->> 'qualification_code', '')));
    v_qtitle := btrim(coalesce(v_item.value ->> 'qualification_title', ''));
    v_ucode := upper(btrim(coalesce(v_item.value ->> 'unit_code', '')));
    v_utitle := btrim(coalesce(v_item.value ->> 'unit_title', ''));
    v_credits_text := btrim(coalesce(v_item.value ->> 'credits', ''));

    if v_qcode !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' then
      v_problems := v_problems || jsonb_build_object('row', v_row, 'problem', 'invalid_qualification_code'); continue;
    end if;
    if v_ucode !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' then
      v_problems := v_problems || jsonb_build_object('row', v_row, 'problem', 'invalid_unit_code'); continue;
    end if;
    if char_length(v_utitle) not between 1 and 200 then
      v_problems := v_problems || jsonb_build_object('row', v_row, 'problem', 'invalid_unit_title'); continue;
    end if;
    if v_credits_text !~ '^[0-9]{1,4}$' or v_credits_text::integer > 1000 then
      v_problems := v_problems || jsonb_build_object('row', v_row, 'problem', 'invalid_credits'); continue;
    end if;
    v_credits := v_credits_text::integer;
    if v_seen ? (v_qcode || ':' || v_ucode) then
      v_problems := v_problems || jsonb_build_object('row', v_row, 'problem', 'duplicate_unit',
        'first_row', (v_seen ->> (v_qcode || ':' || v_ucode))::integer);
      continue;
    end if;
    v_seen := v_seen || jsonb_build_object(v_qcode || ':' || v_ucode, v_row);

    select q.id into v_qid from programmes.qualifications q where q.programme_id = p_programme_id and q.code = v_qcode;
    if v_qid is null then
      if v_new_quals ? v_qcode then
        if v_qtitle <> '' and v_qtitle <> v_new_quals ->> v_qcode then
          v_problems := v_problems || jsonb_build_object('row', v_row, 'problem', 'qualification_title_differs'); continue;
        end if;
      elsif char_length(v_qtitle) not between 1 and 200 then
        v_problems := v_problems || jsonb_build_object('row', v_row, 'problem', 'qualification_title_required'); continue;
      else
        v_new_quals := v_new_quals || jsonb_build_object(v_qcode, v_qtitle);
      end if;
    else
      select u.title, credits.credit_value(u.id) as credits into v_existing
      from programmes.units u where u.qualification_id = v_qid and u.code = v_ucode;
      if found then
        v_skipped := v_skipped || jsonb_build_object('row', v_row, 'unit_code', v_ucode,
          'differs', v_existing.title <> v_utitle or v_existing.credits is distinct from v_credits);
        continue;
      end if;
    end if;
    v_plan := v_plan || jsonb_build_object('qualification_code', v_qcode, 'unit_code', v_ucode, 'unit_title', v_utitle,
      'credits', v_credits);
  end loop;

  if jsonb_array_length(v_problems) > 0 then
    return query select 'problems'::text, (select count(*)::integer from jsonb_object_keys(v_new_quals)),
      jsonb_array_length(v_plan), v_skipped, v_problems;
    return;
  end if;
  if not p_apply then
    return query select 'ok'::text, (select count(*)::integer from jsonb_object_keys(v_new_quals)),
      jsonb_array_length(v_plan), v_skipped, '[]'::jsonb;
    return;
  end if;

  v_role := case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end;
  for v_qcode, v_qtitle in select key, value from jsonb_each_text(v_new_quals) loop
    insert into programmes.qualifications (programme_id, code, title) values (p_programme_id, v_qcode, v_qtitle);
    v_qualifications := v_qualifications + 1;
  end loop;
  for v_unit in select value from jsonb_array_elements(v_plan) loop
    select q.id into v_qid from programmes.qualifications q
    where q.programme_id = p_programme_id and q.code = v_unit ->> 'qualification_code';
    insert into programmes.units (qualification_id, code, title)
    values (v_qid, v_unit ->> 'unit_code', v_unit ->> 'unit_title')
    returning id into v_uid;
    insert into programmes.unit_credit_values (unit_id, credits, set_by) values (v_uid, (v_unit ->> 'credits')::integer, v_actor);
    v_units := v_units + 1;
  end loop;

  perform audit.append('programmes.units_imported', 'programme', p_programme_id::text,
    jsonb_build_object('qualifications_added', v_qualifications, 'units_added', v_units,
      'skipped', jsonb_array_length(v_skipped), 'units', v_plan),
    v_role, null, null, 'programme', p_programme_id);
  return query select 'ok'::text, v_qualifications, v_units, v_skipped, '[]'::jsonb;
end
$$;

revoke all on function api.update_qualification(uuid, text, text), api.update_unit(uuid, text, text),
  api.remove_unit(uuid), api.remove_qualification(uuid), api.list_programme_structures(),
  api.get_programme_structure(uuid), api.import_units(uuid, jsonb, boolean)
  from public, anon, authenticated, service_role;
grant execute on function api.update_qualification(uuid, text, text), api.update_unit(uuid, text, text),
  api.remove_unit(uuid), api.remove_qualification(uuid), api.list_programme_structures(),
  api.get_programme_structure(uuid), api.import_units(uuid, jsonb, boolean)
  to authenticated;
