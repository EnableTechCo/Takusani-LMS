-- Programme structure (S1-16, FR-701): programmes, qualifications, units, modules, cohorts, the cohort's moderation
-- policy row, and enrolments. LMS-data-model.md "Programme and learning delivery"; ADR-019 (moderation policy).
--
-- Authorization is scoped (LMS-data-model.md, RLS strategy): a coordinator acts on a cohort when their coordinator
-- role covers it, globally, for its programme, or for that cohort. programmes.can_coordinate() is that one rule.
--
-- Not here yet: unit_assessment_requirements links units to assessable items, which arrive with the results
-- aggregate (S2-06); it is created there with its foreign keys. Cohorts start "not_moderated" at go-live; choosing
-- the policy, with its version history, is the cohort setup screen (S4-03).

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create table programmes.programmes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  nqf_level smallint check (nqf_level between 1 and 10),
  created_at timestamptz not null default now(),
  created_by uuid references identity.profiles (id)
);

create table programmes.qualifications (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programmes.programmes (id),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (programme_id, code)
);

create table programmes.units (
  id uuid primary key default gen_random_uuid(),
  qualification_id uuid not null references programmes.qualifications (id),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (qualification_id, code)
);

-- The credit value is versioned configuration (FR-801): a new row supersedes the old one from its effective time,
-- nothing is overwritten, and the value in force at award is snapshotted onto the credit ledger later.
create table programmes.unit_credit_values (
  id bigint generated always as identity primary key,
  unit_id uuid not null references programmes.units (id),
  credits integer not null check (credits between 0 and 1000),
  effective_from timestamptz not null default now(),
  set_by uuid references identity.profiles (id),
  set_at timestamptz not null default now(),
  unique (unit_id, effective_from)
);

create table programmes.modules (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programmes.programmes (id),
  unit_id uuid references programmes.units (id),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (programme_id, code)
);

create table programmes.cohorts (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programmes.programmes (id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid references identity.profiles (id),
  constraint ends_after_start check (ends_on >= starts_on),
  unique (programme_id, name)
);

-- One row per cohort, always present (ADR-019): the lock target for finalise, plan, freeze, sign-off and cancel.
create table programmes.cohort_moderation_state (
  cohort_id uuid primary key references programmes.cohorts (id),
  moderation_policy text not null check (moderation_policy in ('moderated', 'not_moderated')),
  policy_version integer not null default 1 check (policy_version >= 1),
  set_by uuid references identity.profiles (id),
  set_at timestamptz not null default now()
);

create table programmes.enrolments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references programmes.cohorts (id),
  profile_id uuid not null references identity.profiles (id),
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid references identity.profiles (id),
  unique (cohort_id, profile_id)
);

create index cohorts_programme_idx on programmes.cohorts (programme_id);
create index enrolments_profile_idx on programmes.enrolments (profile_id);
create index qualifications_programme_idx on programmes.qualifications (programme_id);
create index units_qualification_idx on programmes.units (qualification_id);
create index modules_programme_idx on programmes.modules (programme_id);

revoke all on table programmes.programmes, programmes.qualifications, programmes.units, programmes.unit_credit_values,
  programmes.modules, programmes.cohorts, programmes.cohort_moderation_state, programmes.enrolments
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Authorization predicates (written once, ADR-024 point 4)
-- ---------------------------------------------------------------------------------------------------------------

-- Does this person hold a current coordinator role covering the programme (global or programme scope)?
create function programmes.can_coordinate_programme(p_profile_id uuid, p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from identity.role_assignments ra
    join identity.profiles p on p.id = ra.profile_id
    where ra.profile_id = p_profile_id
      and ra.role = 'coordinator'
      and ra.effective @> now()
      and p.status = 'active'
      and (ra.scope_type = 'global' or (ra.scope_type = 'programme' and ra.scope_key = p_programme_id))
  )
$$;

-- ... or covering the cohort (global, its programme, or the cohort itself)?
create function programmes.can_coordinate(p_profile_id uuid, p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from programmes.cohorts c
    where c.id = p_cohort_id
      and (
        programmes.can_coordinate_programme(p_profile_id, c.programme_id)
        or exists (
          select 1
          from identity.role_assignments ra
          join identity.profiles p on p.id = ra.profile_id
          where ra.profile_id = p_profile_id
            and ra.role = 'coordinator'
            and ra.effective @> now()
            and p.status = 'active'
            and ra.scope_type = 'cohort'
            and ra.scope_key = c.id
        )
      )
  )
$$;

-- A coordinator with the global role; only they create programmes.
create function programmes.is_global_coordinator(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from identity.role_assignments ra
    join identity.profiles p on p.id = ra.profile_id
    where ra.profile_id = p_profile_id
      and ra.role = 'coordinator'
      and ra.scope_type = 'global'
      and ra.effective @> now()
      and p.status = 'active'
  )
$$;

revoke all on function programmes.can_coordinate_programme(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function programmes.can_coordinate(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function programmes.is_global_coordinator(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands (exposed through api; the actor is auth.uid(); typed refusals; audit in the same transaction)
-- ---------------------------------------------------------------------------------------------------------------

create function api.create_programme(p_code text, p_title text, p_nqf_level smallint default null)
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
  if not programmes.is_global_coordinator(v_actor) then return query select 'forbidden'::text, null::uuid; return; end if;
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

  perform audit.append('programmes.programme_created', 'programme', v_id::text, '{}'::jsonb, 'coordinator', null,
    jsonb_build_object('code', v_code, 'title', btrim(p_title), 'nqf_level', p_nqf_level), 'global', null);
  return query select 'ok'::text, v_id;
end
$$;

create function api.create_qualification(p_programme_id uuid, p_code text, p_title text)
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
  if not programmes.can_coordinate_programme(v_actor, p_programme_id) then
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
    jsonb_build_object('programme_id', p_programme_id), 'coordinator', null,
    jsonb_build_object('code', v_code, 'title', btrim(p_title)), 'programme', p_programme_id);
  return query select 'ok'::text, v_id;
end
$$;

create function api.create_unit(p_qualification_id uuid, p_code text, p_title text, p_credits integer)
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
  if not programmes.can_coordinate_programme(v_actor, v_programme_id) then
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
    jsonb_build_object('qualification_id', p_qualification_id), 'coordinator', null,
    jsonb_build_object('code', v_code, 'title', btrim(p_title), 'credits', p_credits), 'programme', v_programme_id);
  return query select 'ok'::text, v_id;
end
$$;

create function api.create_module(p_programme_id uuid, p_code text, p_title text, p_unit_id uuid default null)
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
  if not programmes.can_coordinate_programme(v_actor, p_programme_id) then
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
    jsonb_build_object('programme_id', p_programme_id), 'coordinator', null,
    jsonb_build_object('code', v_code, 'title', btrim(p_title), 'unit_id', p_unit_id), 'programme', p_programme_id);
  return query select 'ok'::text, v_id;
end
$$;

create function api.create_cohort(p_programme_id uuid, p_name text, p_starts_on date, p_ends_on date)
returns table (status text, cohort_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not exists (select 1 from programmes.programmes where id = p_programme_id) then
    return query select 'programme_not_found'::text, null::uuid; return;
  end if;
  if not programmes.can_coordinate_programme(v_actor, p_programme_id) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120 then
    return query select 'invalid_name'::text, null::uuid; return;
  end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then
    return query select 'invalid_dates'::text, null::uuid; return;
  end if;
  if exists (select 1 from programmes.cohorts where programme_id = p_programme_id and name = btrim(p_name)) then
    return query select 'name_taken'::text, null::uuid; return;
  end if;

  insert into programmes.cohorts (programme_id, name, starts_on, ends_on, created_by)
  values (p_programme_id, btrim(p_name), p_starts_on, p_ends_on, v_actor)
  returning id into v_id;
  -- Not moderated at go-live; the policy choice arrives with cohort setup (S4-03, P-01).
  insert into programmes.cohort_moderation_state (cohort_id, moderation_policy, set_by)
  values (v_id, 'not_moderated', v_actor);

  perform audit.append('programmes.cohort_created', 'cohort', v_id::text,
    jsonb_build_object('programme_id', p_programme_id), 'coordinator', null,
    jsonb_build_object('name', btrim(p_name), 'starts_on', p_starts_on, 'ends_on', p_ends_on,
      'moderation_policy', 'not_moderated'),
    'programme', p_programme_id);
  return query select 'ok'::text, v_id;
end
$$;

-- Enrols an existing learner, found by email (accounts are created first, by an administrator or bulk import).
create function api.enrol_learner(p_cohort_id uuid, p_email text)
returns table (status text, enrolment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile_id uuid;
  v_existing record;
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not exists (select 1 from programmes.cohorts where id = p_cohort_id) then
    return query select 'cohort_not_found'::text, null::uuid; return;
  end if;
  if not programmes.can_coordinate(v_actor, p_cohort_id) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  if exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status = 'archived') then
    return query select 'cohort_archived'::text, null::uuid; return;
  end if;

  select p.id into v_profile_id
  from auth.users u join identity.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(coalesce(p_email, '')));
  if v_profile_id is null then return query select 'account_not_found'::text, null::uuid; return; end if;
  if not identity.has_role(v_profile_id, 'learner') then
    return query select 'not_a_learner'::text, null::uuid; return;
  end if;

  -- Lock order: identity functions lock only the profile; enrolment changes lock the learner's profile row too,
  -- so two coordinators enrolling the same learner cannot race past the unique check with different outcomes.
  perform 1 from identity.profiles where id = v_profile_id for update;
  select e.id, e.status into v_existing
  from programmes.enrolments e where e.cohort_id = p_cohort_id and e.profile_id = v_profile_id;
  if v_existing.id is not null and v_existing.status = 'active' then
    return query select 'already_enrolled'::text, v_existing.id; return;
  end if;

  if v_existing.id is not null then
    update programmes.enrolments set status = 'active', enrolled_at = now(), enrolled_by = v_actor
    where id = v_existing.id returning id into v_id;
  else
    insert into programmes.enrolments (cohort_id, profile_id, enrolled_by)
    values (p_cohort_id, v_profile_id, v_actor)
    returning id into v_id;
  end if;

  perform audit.append('programmes.learner_enrolled', 'profile', v_profile_id::text,
    jsonb_build_object('enrolment_id', v_id), 'coordinator',
    case when v_existing.id is not null then jsonb_build_object('status', 'withdrawn') end,
    jsonb_build_object('cohort_id', p_cohort_id, 'status', 'active'), 'cohort', p_cohort_id);
  return query select 'ok'::text, v_id;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Queries (coordinators see what their scope covers; everyone else sees nothing)
-- ---------------------------------------------------------------------------------------------------------------

create function api.list_programmes()
returns table (id uuid, code text, title text, nqf_level smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.code, p.title, p.nqf_level
  from programmes.programmes p
  where programmes.can_coordinate_programme(auth.uid(), p.id)
  order by p.title
$$;

create function api.list_cohorts()
returns table (
  id uuid,
  programme_id uuid,
  programme_title text,
  name text,
  starts_on date,
  ends_on date,
  status text,
  moderation_policy text,
  enrolment_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.programme_id, p.title, c.name, c.starts_on, c.ends_on, c.status, m.moderation_policy,
    (select count(*)::int from programmes.enrolments e where e.cohort_id = c.id and e.status = 'active')
  from programmes.cohorts c
  join programmes.programmes p on p.id = c.programme_id
  join programmes.cohort_moderation_state m on m.cohort_id = c.id
  where programmes.can_coordinate(auth.uid(), c.id)
  order by c.starts_on desc, c.name
$$;

create function api.list_enrolments(p_cohort_id uuid)
returns table (
  enrolment_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  learner_number text,
  status text,
  enrolled_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, p.id, p.full_name, u.email::text, p.learner_number, e.status, e.enrolled_at
  from programmes.enrolments e
  join identity.profiles p on p.id = e.profile_id
  join auth.users u on u.id = p.id
  where e.cohort_id = p_cohort_id
    and programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by p.full_name, u.email
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.create_programme(text, text, smallint) from public, anon, authenticated, service_role;
revoke all on function api.create_qualification(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function api.create_unit(uuid, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function api.create_module(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function api.create_cohort(uuid, text, date, date) from public, anon, authenticated, service_role;
revoke all on function api.enrol_learner(uuid, text) from public, anon, authenticated, service_role;
revoke all on function api.list_programmes() from public, anon, authenticated, service_role;
revoke all on function api.list_cohorts() from public, anon, authenticated, service_role;
revoke all on function api.list_enrolments(uuid) from public, anon, authenticated, service_role;

grant execute on function api.create_programme(text, text, smallint) to authenticated;
grant execute on function api.create_qualification(uuid, text, text) to authenticated;
grant execute on function api.create_unit(uuid, text, text, integer) to authenticated;
grant execute on function api.create_module(uuid, text, text, uuid) to authenticated;
grant execute on function api.create_cohort(uuid, text, date, date) to authenticated;
grant execute on function api.enrol_learner(uuid, text) to authenticated;
grant execute on function api.list_programmes() to authenticated;
grant execute on function api.list_cohorts() to authenticated;
grant execute on function api.list_enrolments(uuid) to authenticated;
