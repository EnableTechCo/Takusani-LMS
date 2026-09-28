-- Role assignment with the separation-of-duties advisory (S3-07; FR-104, FR-105, FR-107; U-01, CR-20; screen X-04).
--
-- A role says what a person may be given, never a particular piece of work. So, as the product owner decided on
-- 21 September 2026 (U-01): advise at role assignment, block at allocation.
--   * Assigning a role always succeeds when it is valid. When the person has already taken assessment decisions in
--     the role's scope, and the role is one that would let them moderate or review (assessor, moderator), the reply
--     carries an advisory naming the results they will be kept away from (separation_of_duties_exclusions). The
--     allocation commands refuse those results by name (BR-01, BR-02; transaction test 31).
--   * Ending a role is refused while open work depends on it (FR-105): marking the person has taken in a cohort that
--     no other role of theirs covers. The refusal names the work, and is recorded.
--   * Every change locks the person's profile row first, so two administrators cannot race, and is audited with the
--     previous value (FR-107). The account's change history reads from the audit log.
--
-- Administrators manage any role. A coordinator may assign and end facilitator, assessor and moderator roles within
-- the programmes and cohorts they coordinate (FR-701); cohort setup (S4-03) builds on that.

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked', 'role_assigned', 'role_ended')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------------------------

-- Does a role's scope cover a cohort? The same reading as assessment.can_assess: everything, its programme, or it.
create function identity.scope_covers_cohort(p_scope_type identity.scope_type, p_scope_key uuid, p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_scope_type = 'global'
    or (p_scope_type = 'cohort' and p_scope_key = p_cohort_id)
    or (p_scope_type = 'programme' and exists (
          select 1 from programmes.cohorts c where c.id = p_cohort_id and c.programme_id = p_scope_key))
$$;

-- "All programmes", a programme's title, a cohort's name.
create function identity.scope_label(p_scope_type identity.scope_type, p_scope_key uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case p_scope_type
    when 'global' then 'All programmes'
    when 'programme' then coalesce((select pr.title from programmes.programmes pr where pr.id = p_scope_key), 'A programme')
    when 'cohort' then coalesce((select c.name from programmes.cohorts c where c.id = p_scope_key), 'A cohort')
    else coalesce((select u.title from programmes.units u where u.id = p_scope_key), 'A unit')
  end
$$;

-- May the actor assign or end this role in this scope?
create function identity.can_manage_role(
  p_actor uuid, p_role text, p_scope_type identity.scope_type, p_scope_key uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select identity.has_role(p_actor, 'administrator')
    or (p_role in ('facilitator', 'assessor', 'moderator') and (
          (p_scope_type = 'cohort' and programmes.can_coordinate(p_actor, p_scope_key))
          or (p_scope_type = 'programme' and programmes.can_coordinate_programme(p_actor, p_scope_key))))
$$;

-- U-01: the results in this scope the person took an assessment decision on, by item. Only for the roles that could
-- otherwise put them in front of their own work (moderating, or reviewing an appeal).
create function identity.sod_advisories(
  p_profile_id uuid, p_role text, p_scope_type identity.scope_type, p_scope_key uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'type', 'separation_of_duties_exclusions', 'item_title', x.item_title, 'cohort_name', x.cohort_name,
           'results', x.results, 'first_decided_at', x.first_at, 'last_decided_at', x.last_at)
         order by x.cohort_name, x.item_title), '[]'::jsonb)
  from (
    select ai.title as item_title, c.name as cohort_name, count(distinct d.result_id)::integer as results,
      min(d.created_at) as first_at, max(d.created_at) as last_at
    from assessment.decisions d
    join assessment.results r on r.id = d.result_id
    join assessment.assessable_items ai on ai.id = r.assessable_item_id
    join programmes.cohorts c on c.id = ai.cohort_id
    where p_role in ('assessor', 'moderator')
      and d.type = 'assessment' and d.actor_id = p_profile_id
      and identity.scope_covers_cohort(p_scope_type, p_scope_key, c.id)
    group by ai.id, ai.title, c.name
  ) x
$$;

-- The work with this person now, and the role it depends on (FR-105). Marking they have taken depends on an assessor
-- role covering its cohort. An appeal review is given for one appeal at a time and depends on no role.
create function identity.open_allocations(p_profile_id uuid)
returns table (kind text, cohort_id uuid, cohort_name text, items integer, oldest_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select 'marking'::text, c.id, c.name, count(*)::integer, min(v.submitted_at)
  from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  left join submissions.submission_versions v on v.id = i.submission_version_id
  where i.assessor_id = p_profile_id and i.state = 'marking'
  group by c.id, c.name
  union all
  select 'appeal_review', null, null, count(*)::integer, min(a.allocated_at)
  from appeals.appeals a
  where a.reviewer_id = p_profile_id and a.state in ('allocated', 'under_review')
  having count(*) > 0
$$;

revoke all on function identity.scope_covers_cohort(identity.scope_type, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function identity.scope_label(identity.scope_type, uuid) from public, anon, authenticated, service_role;
revoke all on function identity.can_manage_role(uuid, text, identity.scope_type, uuid) from public, anon, authenticated, service_role;
revoke all on function identity.sod_advisories(uuid, text, identity.scope_type, uuid) from public, anon, authenticated, service_role;
revoke all on function identity.open_allocations(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------------------------

-- In force from now, until p_until when given. Refusals: unauthenticated, not_found, account_inactive, invalid_role,
-- invalid_scope, forbidden, invalid_until, already_assigned. On success, advisories lists what the person will be kept
-- away from (U-01); an empty list means nothing.
create function api.assign_role(
  p_profile_id uuid,
  p_role text,
  p_scope_type text,
  p_scope_key uuid default null,
  p_until timestamptz default null
)
returns table (status text, assignment_id uuid, advisories jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile identity.profiles;
  v_scope identity.scope_type;
  v_id uuid;
  v_advisories jsonb;
  v_label text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::jsonb; return; end if;
  -- Lock the person first (API design): assignments for one person are changed one at a time.
  select * into v_profile from identity.profiles p where p.id = p_profile_id for update;
  if not found then return query select 'not_found'::text, null::uuid, null::jsonb; return; end if;
  if v_profile.status <> 'active' then return query select 'account_inactive'::text, null::uuid, null::jsonb; return; end if;
  if not exists (select 1 from identity.roles r where r.code = p_role) then
    return query select 'invalid_role'::text, null::uuid, null::jsonb; return;
  end if;
  if p_scope_type not in ('global', 'programme', 'cohort')
     or (p_scope_type = 'global') <> (p_scope_key is null)
     or (p_scope_type = 'programme' and not exists (select 1 from programmes.programmes pr where pr.id = p_scope_key))
     or (p_scope_type = 'cohort' and not exists (select 1 from programmes.cohorts c where c.id = p_scope_key))
     or (p_role = 'learner') then
    return query select 'invalid_scope'::text, null::uuid, null::jsonb; return;
  end if;
  v_scope := p_scope_type::identity.scope_type;
  if not identity.can_manage_role(v_actor, p_role, v_scope, p_scope_key) then
    return query select 'forbidden'::text, null::uuid, null::jsonb; return;
  end if;
  if p_until is not null and p_until <= now() then
    return query select 'invalid_until'::text, null::uuid, null::jsonb; return;
  end if;
  if exists (
    select 1 from identity.role_assignments ra
    where ra.profile_id = p_profile_id and ra.role = p_role and ra.scope_type = v_scope
      and ra.scope_key is not distinct from p_scope_key
      and ra.effective && tstzrange(now(), p_until)
  ) then
    return query select 'already_assigned'::text, null::uuid, null::jsonb; return;
  end if;

  insert into identity.role_assignments (profile_id, role, scope_type, scope_key, effective, assigned_by)
  values (p_profile_id, p_role, v_scope, p_scope_key, tstzrange(now(), p_until), v_actor)
  returning id into v_id;

  v_advisories := identity.sod_advisories(p_profile_id, p_role, v_scope, p_scope_key);
  v_label := identity.scope_label(v_scope, p_scope_key);

  perform audit.append('identity.role_assigned', 'profile', p_profile_id::text,
    jsonb_build_object('assignment_id', v_id, 'advisory_results',
      (select coalesce(sum((e ->> 'results')::integer), 0) from jsonb_array_elements(v_advisories) e)),
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end,
    null,
    jsonb_build_object('role', p_role, 'scope_type', v_scope, 'scope_key', p_scope_key, 'scope_label', v_label,
                       'from', now(), 'until', p_until),
    v_scope::text, p_scope_key);

  perform notifications.enqueue('role_assigned', 'role_assigned:' || v_id::text, p_profile_id,
    jsonb_build_object('role', p_role, 'scope_label', v_label, 'until', p_until), '/home');

  return query select 'ok'::text, v_id, v_advisories;
end
$$;

-- Ends an assignment now. Refusals: unauthenticated, not_found, forbidden, already_ended, not_started, open_allocations
-- (allocations lists the work, by cohort, that would be left without anyone able to finish it).
create function api.end_role(p_assignment_id uuid)
returns table (status text, allocations jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_assignment identity.role_assignments;
  v_blocking jsonb;
  v_label text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::jsonb; return; end if;
  select * into v_assignment from identity.role_assignments ra where ra.id = p_assignment_id;
  if not found then return query select 'not_found'::text, null::jsonb; return; end if;
  perform 1 from identity.profiles p where p.id = v_assignment.profile_id for update;
  select * into v_assignment from identity.role_assignments ra where ra.id = p_assignment_id for update;
  if not identity.can_manage_role(v_actor, v_assignment.role, v_assignment.scope_type, v_assignment.scope_key) then
    return query select 'forbidden'::text, null::jsonb; return;
  end if;
  if not (upper_inf(v_assignment.effective) or upper(v_assignment.effective) > now()) then
    return query select 'already_ended'::text, null::jsonb; return;
  end if;
  -- Assigned in this same instant: ending it now would leave an empty period, which the table does not allow.
  if lower(v_assignment.effective) >= now() then
    return query select 'not_started'::text, null::jsonb; return;
  end if;
  v_label := identity.scope_label(v_assignment.scope_type, v_assignment.scope_key);

  -- FR-105: marking the person holds in a cohort that, without this assignment, no assessor role of theirs covers.
  if v_assignment.role = 'assessor' then
    select jsonb_agg(jsonb_build_object('kind', o.kind, 'cohort_name', o.cohort_name, 'items', o.items,
                                        'oldest_at', o.oldest_at) order by o.cohort_name)
    into v_blocking
    from identity.open_allocations(v_assignment.profile_id) o
    where o.kind = 'marking'
      and identity.scope_covers_cohort(v_assignment.scope_type, v_assignment.scope_key, o.cohort_id)
      and not exists (
        select 1 from identity.role_assignments other
        where other.profile_id = v_assignment.profile_id and other.id <> v_assignment.id
          and other.role = 'assessor' and other.effective @> now()
          and identity.scope_covers_cohort(other.scope_type, other.scope_key, o.cohort_id)
      );
  end if;
  if v_blocking is not null then
    perform audit.append('identity.role_end_refused', 'profile', v_assignment.profile_id::text,
      jsonb_build_object('assignment_id', v_assignment.id, 'reason', 'open_allocations', 'allocations', v_blocking),
      case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end,
      jsonb_build_object('role', v_assignment.role, 'scope_label', v_label, 'until', upper(v_assignment.effective)),
      null, v_assignment.scope_type::text, v_assignment.scope_key);
    return query select 'open_allocations'::text, v_blocking;
    return;
  end if;

  update identity.role_assignments ra set effective = tstzrange(lower(ra.effective), now())
  where ra.id = v_assignment.id;

  perform audit.append('identity.role_ended', 'profile', v_assignment.profile_id::text,
    jsonb_build_object('assignment_id', v_assignment.id),
    case when identity.has_role(v_actor, 'administrator') then 'administrator' else 'coordinator' end,
    jsonb_build_object('role', v_assignment.role, 'scope_label', v_label, 'until', upper(v_assignment.effective)),
    jsonb_build_object('role', v_assignment.role, 'scope_label', v_label, 'until', now()),
    v_assignment.scope_type::text, v_assignment.scope_key);

  perform notifications.enqueue('role_ended', 'role_ended:' || v_assignment.id::text, v_assignment.profile_id,
    jsonb_build_object('role', v_assignment.role, 'scope_label', v_label, 'ended_at', now()), '/home');

  return query select 'ok'::text, null::jsonb;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads (administrators): X-04
-- ---------------------------------------------------------------------------------------------------------------

create function api.get_account(p_profile_id uuid)
returns table (
  profile_id uuid,
  full_name text,
  email text,
  status text,
  learner_number text,
  locked_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, u.email::text, p.status, p.learner_number,
    (select f.locked_until from identity.sign_in_failures f where f.profile_id = p.id and f.locked_until > now())
  from identity.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_profile_id and identity.has_role(auth.uid(), 'administrator')
$$;

-- Every assignment, current first, with how many open allocations depend on it.
create function api.list_account_role_assignments(p_profile_id uuid)
returns table (
  id uuid,
  role text,
  scope_type text,
  scope_label text,
  effective_from timestamptz,
  effective_until timestamptz,
  in_force boolean,
  assigned_by_name text,
  dependent_items integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select ra.id, ra.role, ra.scope_type::text, identity.scope_label(ra.scope_type, ra.scope_key),
    lower(ra.effective), upper(ra.effective), ra.effective @> now(), ab.full_name,
    case when ra.role = 'assessor' and ra.effective @> now() then
      (select coalesce(sum(o.items), 0)::integer from identity.open_allocations(ra.profile_id) o
       where o.kind = 'marking' and identity.scope_covers_cohort(ra.scope_type, ra.scope_key, o.cohort_id))
    else 0 end
  from identity.role_assignments ra
  left join identity.profiles ab on ab.id = ra.assigned_by
  join identity.roles r on r.code = ra.role
  where ra.profile_id = p_profile_id and identity.has_role(auth.uid(), 'administrator')
  order by ra.effective @> now() desc, r.sort_order, lower(ra.effective) desc
$$;

create function api.list_account_open_allocations(p_profile_id uuid)
returns table (kind text, cohort_name text, items integer, oldest_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.kind, o.cohort_name, o.items, o.oldest_at
  from identity.open_allocations(p_profile_id) o
  where identity.has_role(auth.uid(), 'administrator')
  order by o.kind, o.cohort_name
$$;

-- FR-107: the account's change history, newest first: who, what, the previous value and the new one.
create function api.list_account_history(p_profile_id uuid)
returns table (
  id bigint,
  occurred_at timestamptz,
  actor_name text,
  action text,
  before jsonb,
  after jsonb,
  details jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.occurred_at, ap.full_name, e.action, e.before, e.after, e.details
  from audit.events e
  left join identity.profiles ap on ap.id = e.actor_id
  where e.object_type = 'profile' and e.object_id = p_profile_id::text
    and identity.has_role(auth.uid(), 'administrator')
  order by e.id desc
  limit 100
$$;

-- The scopes an administrator can pick for a new role: everything, each programme, each cohort.
create function api.list_role_scopes()
returns table (scope_type text, scope_key uuid, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.scope_type, s.scope_key, s.label from (
    select 'global'::text as scope_type, null::uuid as scope_key, 'All programmes'::text as label, 0 as o
    union all
    select 'programme', pr.id, 'Programme: ' || pr.title, 1 from programmes.programmes pr
    union all
    select 'cohort', c.id, 'Cohort: ' || c.name || ' (' || pr.title || ')', 2
    from programmes.cohorts c join programmes.programmes pr on pr.id = c.programme_id
    where c.status <> 'archived'
  ) s
  where identity.has_role(auth.uid(), 'administrator')
  order by s.o, s.label
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.assign_role(uuid, text, text, uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function api.end_role(uuid) from public, anon, authenticated, service_role;
revoke all on function api.get_account(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_account_role_assignments(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_account_open_allocations(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_account_history(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_role_scopes() from public, anon, authenticated, service_role;

grant execute on function api.assign_role(uuid, text, text, uuid, timestamptz) to authenticated;
grant execute on function api.end_role(uuid) to authenticated;
grant execute on function api.get_account(uuid) to authenticated;
grant execute on function api.list_account_role_assignments(uuid) to authenticated;
grant execute on function api.list_account_open_allocations(uuid) to authenticated;
grant execute on function api.list_account_history(uuid) to authenticated;
grant execute on function api.list_role_scopes() to authenticated;
