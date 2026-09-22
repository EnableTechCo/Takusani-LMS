-- Audit log, completed for S1-14 (FR-107, NFR-02; LMS-security-and-operations.md "Audit strategy").
--
-- 1. audit.events gains the acting role and scope, and safe before and after values. Additive: existing rows keep
--    nulls in the new columns (they were all written by account creation, which the details column describes).
-- 2. audit.append takes the new values. The old four-argument version is replaced, not overloaded, because an
--    overload with defaults would make every existing four-argument call ambiguous.
-- 3. Identity functions record the acting role and the change: account creation records the new profile as
--    "after"; a role assignment records the role and scope.
-- 4. api.list_audit_events: the audit log screen (X-09), administrators only, newest first, keyset paged.
--
-- Before and after hold references and field values only, never files, answers, tokens, notes or deliberation.

alter table audit.events
  add column acting_role text,
  add column scope_type text,
  add column scope_key uuid,
  add column before jsonb,
  add column after jsonb;

comment on column audit.events.acting_role is 'The role the actor used for this action (for example administrator); null for provisioning.';
comment on column audit.events.before is 'Safe values before the change (fields and references only); null when something was created.';
comment on column audit.events.after is 'Safe values after the change (fields and references only); null when something was removed.';

create index events_action_idx on audit.events (action, occurred_at);

drop function audit.append(text, text, text, jsonb);

create function audit.append(
  p_action text,
  p_object_type text,
  p_object_id text,
  p_details jsonb default '{}'::jsonb,
  p_acting_role text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_scope_type text default null,
  p_scope_key uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into audit.events (
    actor_id, acting_role, scope_type, scope_key, action, object_type, object_id, before, after, details, request_id
  )
  values (
    auth.uid(),
    p_acting_role,
    p_scope_type,
    p_scope_key,
    p_action,
    p_object_type,
    p_object_id,
    p_before,
    p_after,
    coalesce(p_details, '{}'::jsonb),
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id'
  )
$$;

comment on function audit.append(text, text, text, jsonb, text, jsonb, jsonb, text, uuid) is
  'Called by other definer functions in the same transaction as the change it records. Not granted to any API role.';
revoke all on function audit.append(text, text, text, jsonb, text, jsonb, jsonb, text, uuid)
  from public, anon, authenticated, service_role;

-- Same checks and writes as before; only the audit calls change.
create or replace function identity.create_profile(
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
  v_acting_role text := case when p_via = 'administrator' then 'administrator' end;
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

  perform audit.append(
    'identity.account_created', 'profile', p_user_id::text,
    jsonb_build_object('via', p_via), v_acting_role, null,
    jsonb_build_object('full_name', btrim(p_full_name), 'learner_number', v_learner_number, 'status', 'active'),
    'global', null
  );
  perform audit.append(
    'identity.role_assigned', 'profile', p_user_id::text,
    jsonb_build_object('via', p_via), v_acting_role, null,
    jsonb_build_object('role', p_role, 'scope_type', 'global'),
    'global', null
  );

  return 'ok';
end
$$;

create or replace function api.provision_role(p_user_id uuid, p_role text)
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
  perform audit.append(
    'identity.role_assigned', 'profile', p_user_id::text,
    jsonb_build_object('via', 'provisioning'), null, null,
    jsonb_build_object('role', p_role, 'scope_type', 'global'),
    'global', null
  );
  return 'ok';
end
$$;

-- X-09 audit log. Filters are optional; p_before_id pages backwards (pass the smallest id of the previous page).
create function api.list_audit_events(
  p_action text default null,
  p_actor_email text default null,
  p_object_id text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 50
)
returns table (
  id bigint,
  occurred_at timestamptz,
  actor_id uuid,
  actor_name text,
  actor_email text,
  acting_role text,
  scope_type text,
  scope_key uuid,
  action text,
  object_type text,
  object_id text,
  object_label text,
  before jsonb,
  after jsonb,
  details jsonb,
  request_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.occurred_at,
    e.actor_id,
    actor.full_name,
    actor_user.email::text,
    e.acting_role,
    e.scope_type,
    e.scope_key,
    e.action,
    e.object_type,
    e.object_id,
    case when e.object_type = 'profile' then subject.full_name end,
    e.before,
    e.after,
    e.details,
    e.request_id
  from audit.events e
  left join identity.profiles actor on actor.id = e.actor_id
  left join auth.users actor_user on actor_user.id = e.actor_id
  left join identity.profiles subject on e.object_type = 'profile' and subject.id::text = e.object_id
  where identity.has_role(auth.uid(), 'administrator')
    and (p_action is null or e.action = p_action)
    and (p_actor_email is null or lower(actor_user.email) = lower(btrim(p_actor_email)))
    and (p_object_id is null or e.object_id = p_object_id)
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to is null or e.occurred_at < p_to)
    and (p_before_id is null or e.id < p_before_id)
  order by e.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

comment on function api.list_audit_events(text, text, text, timestamptz, timestamptz, bigint, integer) is
  'X-09 audit log. Administrators only; returns no rows for anyone else. Newest first, at most 200 per page.';

revoke all on function api.list_audit_events(text, text, text, timestamptz, timestamptz, bigint, integer)
  from public, anon, authenticated, service_role;
grant execute on function api.list_audit_events(text, text, text, timestamptz, timestamptz, bigint, integer)
  to authenticated;
