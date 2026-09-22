-- Identity slice (Sprint 1: sign-in, profiles and roles, audit). LMS-data-model.md "Identity", ADR-024, U-01.
--
-- 1. audit.events: the append-only audit log. Every identity change appends to it in the same transaction.
--    The audit ticket (S1-14) extends it to other modules; the shape here is the one the data model describes.
-- 2. identity.profiles: one per sign-in account (auth.users). Accounts are deactivated, never deleted.
-- 3. identity.roles and identity.role_assignments: capability scope only. Allocation to work lives with the work.
-- 4. Functions in `api` (the only exposed schema), each SECURITY DEFINER with an empty search_path:
--      api.my_access()          the signed-in person's profile and current roles; drives navigation.
--      api.list_accounts()      administrators only.
--      api.create_account(...)  administrators only; the auth user is created first by the server (Auth admin API).
--      api.provision_account()  service_role only, for scripted test accounts and later bulk import (X-05).
--      api.provision_role()     service_role only, an extra role for a provisioned account.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------------------------------------------

create table audit.events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (action ~ '^[a-z]+(\.[a-z_]+)+$'),
  object_type text not null,
  object_id text not null,
  details jsonb not null default '{}'::jsonb,
  request_id text
);

comment on table audit.events is
  'Append-only. actor_id is auth.uid() of the person who acted; null only for provisioning by service_role, which records how in details.';
comment on column audit.events.request_id is 'The x-request-id header of the API request, when present, to join logs to audit.';

create index events_object_idx on audit.events (object_type, object_id, occurred_at);
create index events_actor_idx on audit.events (actor_id, occurred_at);

revoke all on table audit.events from public, anon, authenticated, service_role;
revoke all on sequence audit.events_id_seq from public, anon, authenticated, service_role;

create trigger events_forbid_update_delete
  before update or delete on audit.events
  for each row execute function audit.forbid_mutation();
create trigger events_forbid_truncate
  before truncate on audit.events
  for each statement execute function audit.forbid_mutation();

create function audit.append(p_action text, p_object_type text, p_object_id text, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into audit.events (actor_id, action, object_type, object_id, details, request_id)
  values (
    auth.uid(),
    p_action,
    p_object_type,
    p_object_id,
    coalesce(p_details, '{}'::jsonb),
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id'
  )
$$;

comment on function audit.append(text, text, text, jsonb) is
  'Called by other definer functions in the same transaction as the change it records. Not granted to any API role.';
revoke all on function audit.append(text, text, text, jsonb) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------------------------------------------

create table identity.roles (
  code text primary key check (code ~ '^[a-z]+$'),
  label text not null,
  sort_order smallint not null unique
);

insert into identity.roles (code, label, sort_order) values
  ('learner', 'Learner', 1),
  ('facilitator', 'Facilitator', 2),
  ('assessor', 'Assessor', 3),
  ('moderator', 'Moderator', 4),
  ('coordinator', 'Coordinator', 5),
  ('administrator', 'Administrator', 6);

create type identity.scope_type as enum ('global', 'programme', 'cohort', 'unit');

create table identity.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 200),
  learner_number text unique check (learner_number is null or char_length(btrim(learner_number)) between 1 and 50),
  status text not null default 'active' check (status in ('active', 'deactivated')),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references identity.profiles (id),
  constraint deactivation_is_timestamped check ((status = 'deactivated') = (deactivated_at is not null))
);

comment on table identity.profiles is
  'One per sign-in account. on delete restrict: accounts are deactivated, never deleted (FR-103, FR-107).';

create table identity.role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references identity.profiles (id),
  role text not null references identity.roles (code),
  scope_type identity.scope_type not null default 'global',
  -- programme, cohort or unit id. No foreign key yet: those tables arrive with the programmes slice.
  scope_key uuid,
  effective tstzrange not null default tstzrange(now(), null),
  assigned_by uuid references identity.profiles (id),
  created_at timestamptz not null default now(),
  constraint scope_key_matches_type check ((scope_type = 'global') = (scope_key is null)),
  constraint effective_has_start check (not isempty(effective) and lower(effective) is not null),
  constraint no_overlapping_assignment exclude using gist (
    profile_id with =,
    role with =,
    scope_type with =,
    (coalesce(scope_key, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    effective with &&
  )
);

comment on table identity.role_assignments is
  'Capability scope: what a person may be allocated to. Ending a role closes its effective range; rows are kept for history.';

create index role_assignments_profile_idx on identity.role_assignments (profile_id);

revoke all on table identity.roles, identity.profiles, identity.role_assignments from public, anon, authenticated, service_role;

-- Shared predicate (ADR-024 point 4): does this person currently hold this role, in any scope?
create function identity.has_role(p_profile_id uuid, p_role text)
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
      and ra.role = p_role
      and ra.effective @> now()
      and p.status = 'active'
  )
$$;

revoke all on function identity.has_role(uuid, text) from public, anon, authenticated, service_role;

-- Creates the profile and its first role for an existing auth user, and audits both. Shared by
-- api.create_account (an administrator) and api.provision_account (service_role).
create function identity.create_profile(
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_learner_number text,
  p_via text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_learner_number text := nullif(btrim(coalesce(p_learner_number, '')), '');
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    return 'user_not_found';
  end if;
  if not exists (select 1 from identity.roles where code = p_role) then
    return 'invalid_role';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 1 and 200 then
    return 'invalid_name';
  end if;
  if exists (select 1 from identity.profiles where id = p_user_id) then
    return 'already_exists';
  end if;
  if v_learner_number is not null and exists (select 1 from identity.profiles where learner_number = v_learner_number) then
    return 'learner_number_taken';
  end if;

  insert into identity.profiles (id, full_name, learner_number, created_by)
  values (p_user_id, btrim(p_full_name), v_learner_number, v_actor);

  insert into identity.role_assignments (profile_id, role, assigned_by)
  values (p_user_id, p_role, v_actor);

  perform audit.append('identity.account_created', 'profile', p_user_id::text,
    jsonb_build_object('role', p_role, 'via', p_via));
  perform audit.append('identity.role_assigned', 'profile', p_user_id::text,
    jsonb_build_object('role', p_role, 'scope_type', 'global', 'via', p_via));

  return 'ok';
end
$$;

revoke all on function identity.create_profile(uuid, text, text, text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- API (exposed)
-- ---------------------------------------------------------------------------------------------------------------

create function api.my_access()
returns table (
  profile_id uuid,
  full_name text,
  email text,
  status text,
  roles text[],
  has_review_allocation boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.full_name,
    u.email::text,
    p.status,
    coalesce(
      array(
        select ra.role
        from identity.role_assignments ra
        join identity.roles r on r.code = ra.role
        where ra.profile_id = p.id and ra.effective @> now() and p.status = 'active'
        group by ra.role, r.sort_order
        order by r.sort_order
      ),
      '{}'::text[]
    ),
    -- Appeal-review allocations arrive with the appeals slice (BR-02, AS-02).
    false
  from identity.profiles p
  join auth.users u on u.id = p.id
  where p.id = auth.uid()
$$;

comment on function api.my_access() is
  'The signed-in person''s profile and current roles. No row when there is no session or no profile.';

create function api.list_accounts()
returns table (
  profile_id uuid,
  full_name text,
  email text,
  status text,
  roles text[],
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.full_name,
    u.email::text,
    p.status,
    coalesce(
      array(
        select ra.role
        from identity.role_assignments ra
        join identity.roles r on r.code = ra.role
        where ra.profile_id = p.id and ra.effective @> now()
        group by ra.role, r.sort_order
        order by r.sort_order
      ),
      '{}'::text[]
    ),
    u.last_sign_in_at,
    p.created_at
  from identity.profiles p
  join auth.users u on u.id = p.id
  where identity.has_role(auth.uid(), 'administrator')
  order by p.full_name, u.email
$$;

comment on function api.list_accounts() is 'Administrators only; returns no rows for anyone else.';

create function api.create_account(
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_learner_number text default null
)
returns table (status text, profile_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    return query select 'unauthenticated'::text, null::uuid;
    return;
  end if;
  if not identity.has_role(auth.uid(), 'administrator') then
    return query select 'forbidden'::text, null::uuid;
    return;
  end if;

  v_status := identity.create_profile(p_user_id, p_full_name, p_role, p_learner_number, 'administrator');
  return query select v_status, case when v_status = 'ok' then p_user_id end;
end
$$;

comment on function api.create_account(uuid, text, text, text) is
  'Administrator command. The server creates the auth user with the Auth admin API first, then calls this with the administrator''s session; on a refusal it deletes that auth user again.';

create function api.provision_account(
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_learner_number text default null
)
returns table (status text, profile_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  v_status := identity.create_profile(p_user_id, p_full_name, p_role, p_learner_number, 'provisioning');
  return query select v_status, case when v_status = 'ok' then p_user_id end;
end
$$;

comment on function api.provision_account(uuid, text, text, text) is
  'service_role only: scripted accounts (staging test accounts) and, later, bulk import. Audited with no actor and via = provisioning.';

create function api.provision_role(p_user_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from identity.profiles where id = p_user_id) then
    return 'profile_not_found';
  end if;
  if not exists (select 1 from identity.roles where code = p_role) then
    return 'invalid_role';
  end if;
  if identity.has_role(p_user_id, p_role) then
    return 'already_held';
  end if;

  -- Lock order (LMS-data-model.md): identity functions lock only the profile whose assignments change.
  perform 1 from identity.profiles where id = p_user_id for update;
  insert into identity.role_assignments (profile_id, role) values (p_user_id, p_role);
  perform audit.append('identity.role_assigned', 'profile', p_user_id::text,
    jsonb_build_object('role', p_role, 'scope_type', 'global', 'via', 'provisioning'));
  return 'ok';
end
$$;

comment on function api.provision_role(uuid, text) is
  'service_role only: adds a global role to a provisioned account (staging test accounts). Administrators get X-04.';

revoke all on function api.my_access() from public, anon, authenticated, service_role;
revoke all on function api.list_accounts() from public, anon, authenticated, service_role;
revoke all on function api.create_account(uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function api.provision_account(uuid, text, text, text) from public, anon, authenticated, service_role;

grant execute on function api.my_access() to authenticated;
grant execute on function api.list_accounts() to authenticated;
grant execute on function api.create_account(uuid, text, text, text) to authenticated;
revoke all on function api.provision_role(uuid, text) from public, anon, authenticated, service_role;
grant execute on function api.provision_account(uuid, text, text, text) to service_role;
grant execute on function api.provision_role(uuid, text) to service_role;
