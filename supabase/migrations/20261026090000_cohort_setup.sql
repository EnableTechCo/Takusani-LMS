-- Cohort setup: moderation policy, readiness and activation (S4-03; FR-701, FR-702; ADR-019; P-01; screens C-03,
-- C-04, C-05; prototype coordinate-cohort-setup.html).
--
-- A new cohort starts in setup. It is hidden from learners until the coordinator activates it: a learner enrolled in
-- a cohort in setup has a pending enrolment, which every learner-facing read already ignores (they all look for an
-- active one), and activation turns the pending enrolments active. Staff can prepare the cohort meanwhile: import
-- learners, write and publish tasks, add material and schedule sessions.
--
-- Moderation policy (P-01, ADR-019). There is no default: a cohort in setup has no policy until the coordinator
-- chooses Moderated or Not moderated, and it cannot be activated without one. Every choice and change is a new
-- version in moderation_policy_versions (append-only), with who, when and why, and is audited. Changing a cohort to
-- Not moderated is refused while any of its results is waiting for moderation or held in a cycle, because the change
-- would release them unmoderated; the refusal says how many and is audited. Changing to Moderated is always allowed:
-- it holds results decided from then on. The change locks cohort_moderation_state first (ADR-019 lock order).
-- Cohorts created before this migration keep the Not moderated policy they started with, as version 1.
--
-- Readiness (FR-702). A checklist computed from the cohort itself: details, the policy, learners, a facilitator, an
-- assessor, a moderator when moderated (these gate activation), then published material, a published task, a
-- scheduled session and logistics (confirmed by hand until session logistics is built). An open item can be assigned
-- to a person on the cohort's staff, with a due date and a note; they are told in the LMS.
--
-- People (FR-701). The cohort's staff are the facilitator, assessor, moderator and coordinator roles that cover it
-- (global, its programme, or it). Coordinators assign cohort-scoped teaching roles from the cohort's People page,
-- through the same assign_role command and separation-of-duties advisory as an administrator (S3-07).

-- ---------------------------------------------------------------------------------------------------------------
-- Cohort lifecycle
-- ---------------------------------------------------------------------------------------------------------------

alter table programmes.cohorts drop constraint cohorts_status_check;
alter table programmes.cohorts
  add constraint cohorts_status_check check (status in ('setup', 'active', 'archived')),
  add column activated_at timestamptz,
  add column activated_by uuid references identity.profiles (id);

-- Cohorts already running were active from their creation.
update programmes.cohorts set activated_at = created_at where status <> 'setup' and activated_at is null;
alter table programmes.cohorts
  add constraint activation_is_recorded check ((status = 'setup') = (activated_at is null));

alter table programmes.enrolments drop constraint enrolments_status_check;
alter table programmes.enrolments
  add constraint enrolments_status_check check (status in ('pending', 'active', 'withdrawn'));

-- An enrolment in a cohort still in setup waits: it becomes active when the cohort is activated.
create function programmes.enrolment_waits_for_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and exists (
    select 1 from programmes.cohorts c where c.id = new.cohort_id and c.status = 'setup'
  ) then
    new.status := 'pending';
  end if;
  return new;
end
$$;

revoke all on function programmes.enrolment_waits_for_activation() from public, anon, authenticated, service_role;

create trigger enrolments_wait_for_activation
  before insert or update of status on programmes.enrolments
  for each row execute function programmes.enrolment_waits_for_activation();

-- ---------------------------------------------------------------------------------------------------------------
-- Moderation policy, versioned
-- ---------------------------------------------------------------------------------------------------------------

alter table programmes.cohort_moderation_state alter column moderation_policy drop not null;
alter table programmes.cohort_moderation_state drop constraint cohort_moderation_state_policy_version_check;
alter table programmes.cohort_moderation_state
  add constraint policy_version_counts_choices check (policy_version >= 0),
  add constraint policy_chosen_has_a_version check ((moderation_policy is null) = (policy_version = 0));

create table programmes.moderation_policy_versions (
  cohort_id uuid not null references programmes.cohorts (id),
  version integer not null check (version >= 1),
  policy text not null check (policy in ('moderated', 'not_moderated')),
  previous_policy text check (previous_policy in ('moderated', 'not_moderated')),
  reason text check (char_length(btrim(reason)) between 1 and 1000),
  set_by uuid references identity.profiles (id),
  set_at timestamptz not null default now(),
  primary key (cohort_id, version),
  constraint a_change_says_why check (previous_policy is null or reason is not null)
);

revoke all on table programmes.moderation_policy_versions from public, anon, authenticated, service_role;

create trigger moderation_policy_versions_append_only
  before update or delete on programmes.moderation_policy_versions
  for each row execute function audit.forbid_mutation();
create trigger moderation_policy_versions_append_only_truncate
  before truncate on programmes.moderation_policy_versions
  for each statement execute function audit.forbid_mutation();

-- The policy each existing cohort started with is its version 1.
insert into programmes.moderation_policy_versions (cohort_id, version, policy, previous_policy, set_by, set_at)
select m.cohort_id, m.policy_version, m.moderation_policy, null, m.set_by, m.set_at
from programmes.cohort_moderation_state m
where m.moderation_policy is not null;

-- Results of the cohort still to be released: waiting for a cycle (the pending pool), or held in one.
create function programmes.unreleased_results(p_cohort_id uuid)
returns table (waiting integer, held integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where r.hold_cycle_id is null)::integer,
         count(*) filter (where r.hold_cycle_id is not null)::integer
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where ai.cohort_id = p_cohort_id and r.state = 'held'
$$;

revoke all on function programmes.unreleased_results(uuid) from public, anon, authenticated, service_role;

-- Choose or change the policy. p_expected_version is the version the coordinator saw (0 before any choice). A change
-- to a policy already chosen needs its reason.
create function api.set_moderation_policy(
  p_cohort_id uuid,
  p_policy text,
  p_expected_version integer,
  p_reason text default null
)
returns table (status text, policy_version integer, waiting integer, held integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_state programmes.cohort_moderation_state;
  v_cohort programmes.cohorts;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_waiting integer;
  v_held integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer, null::integer; return; end if;
  select * into v_cohort from programmes.cohorts c where c.id = p_cohort_id;
  if not found or not programmes.can_coordinate(v_actor, p_cohort_id) then
    return query select 'not_found'::text, null::integer, null::integer, null::integer; return;
  end if;
  -- ADR-019: the moderation state is always locked first.
  select * into v_state from programmes.cohort_moderation_state m where m.cohort_id = p_cohort_id for update;
  if v_cohort.status = 'archived' then
    return query select 'archived'::text, v_state.policy_version, null::integer, null::integer; return;
  end if;
  if p_policy is null or p_policy not in ('moderated', 'not_moderated') then
    return query select 'invalid_policy'::text, v_state.policy_version, null::integer, null::integer; return;
  end if;
  if p_expected_version is distinct from v_state.policy_version then
    return query select 'stale'::text, v_state.policy_version, null::integer, null::integer; return;
  end if;
  if v_state.moderation_policy = p_policy then
    return query select 'unchanged'::text, v_state.policy_version, null::integer, null::integer; return;
  end if;
  if v_state.moderation_policy is not null and v_reason is null then
    return query select 'reason_required'::text, v_state.policy_version, null::integer, null::integer; return;
  end if;
  if char_length(v_reason) > 1000 then
    return query select 'reason_too_long'::text, v_state.policy_version, null::integer, null::integer; return;
  end if;

  -- BR-04: dropping moderation would release waiting and held results unmoderated.
  if v_state.moderation_policy = 'moderated' and p_policy = 'not_moderated' then
    select u.waiting, u.held into v_waiting, v_held from programmes.unreleased_results(p_cohort_id) u;
    if v_waiting + v_held > 0 then
      perform audit.append('programmes.moderation_policy_change_refused', 'cohort', p_cohort_id::text,
        jsonb_build_object('reason_code', 'results_pending_or_held', 'requested', p_policy, 'waiting', v_waiting,
                           'held', v_held, 'policy_version', v_state.policy_version),
        'coordinator', null, null, 'cohort', p_cohort_id);
      return query select 'results_pending_or_held'::text, v_state.policy_version, v_waiting, v_held; return;
    end if;
  end if;

  insert into programmes.moderation_policy_versions (cohort_id, version, policy, previous_policy, reason, set_by)
  values (p_cohort_id, v_state.policy_version + 1, p_policy, v_state.moderation_policy, v_reason, v_actor);
  update programmes.cohort_moderation_state m
  set moderation_policy = p_policy, policy_version = v_state.policy_version + 1, set_by = v_actor, set_at = now()
  where m.cohort_id = p_cohort_id;

  perform audit.append('programmes.moderation_policy_set', 'cohort', p_cohort_id::text,
    jsonb_build_object('policy_version', v_state.policy_version + 1, 'reason', v_reason), 'coordinator',
    jsonb_build_object('moderation_policy', v_state.moderation_policy),
    jsonb_build_object('moderation_policy', p_policy), 'cohort', p_cohort_id);
  return query select 'ok'::text, v_state.policy_version + 1, null::integer, null::integer;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Staff and readiness
-- ---------------------------------------------------------------------------------------------------------------

-- The staff roles that cover a cohort now or from a later date: global, its programme, or the cohort itself.
create function programmes.cohort_staff(p_cohort_id uuid)
returns table (assignment_id uuid, profile_id uuid, role text, scope_type text, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ra.id, ra.profile_id, ra.role, ra.scope_type::text, lower(ra.effective), upper(ra.effective)
  from identity.role_assignments ra
  join identity.profiles p on p.id = ra.profile_id and p.status = 'active'
  where ra.role in ('facilitator', 'assessor', 'moderator', 'coordinator')
    and ra.effective && tstzrange(now(), null)
    and identity.scope_covers_cohort(ra.scope_type, ra.scope_key, p_cohort_id)
$$;

-- Who an open item is assigned to, when it is due, and (for logistics) that it was confirmed by hand.
create table programmes.readiness_assignments (
  cohort_id uuid not null references programmes.cohorts (id),
  item_key text not null check (item_key in ('details', 'moderation_policy', 'learners', 'facilitator', 'assessor',
    'moderator', 'materials', 'published_tasks', 'sessions', 'logistics')),
  assignee_id uuid references identity.profiles (id),
  due_on date,
  note text check (char_length(note) <= 500),
  assigned_by uuid references identity.profiles (id),
  assigned_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references identity.profiles (id),
  primary key (cohort_id, item_key),
  constraint only_logistics_is_confirmed_by_hand check (confirmed_at is null or item_key = 'logistics'),
  constraint confirmation_is_recorded check ((confirmed_at is null) = (confirmed_by is null))
);

revoke all on table programmes.readiness_assignments from public, anon, authenticated, service_role;

-- The readiness checklist, computed from the cohort. `gate` items must be done before activation.
create function programmes.readiness(p_cohort_id uuid)
returns table (item_key text, sort integer, gate boolean, done boolean, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select c.*, m.moderation_policy,
      (select count(*) from programmes.enrolments e where e.cohort_id = c.id and e.status in ('pending', 'active')) as learners,
      (select count(distinct s.profile_id) from programmes.cohort_staff(c.id) s where s.role = 'facilitator') as facilitators,
      (select count(distinct s.profile_id) from programmes.cohort_staff(c.id) s where s.role = 'assessor') as assessors,
      (select count(distinct s.profile_id) from programmes.cohort_staff(c.id) s where s.role = 'moderator') as moderators,
      (select count(*) from learning.materials mt where mt.cohort_id = c.id and mt.state = 'published') as materials,
      (select count(*) from submissions.tasks t where t.cohort_id = c.id and t.state = 'published') as tasks,
      (select count(*) from learning.sessions s where s.cohort_id = c.id and s.state = 'scheduled') as sessions,
      (select r.confirmed_at from programmes.readiness_assignments r
       where r.cohort_id = c.id and r.item_key = 'logistics') as logistics_confirmed_at
    from programmes.cohorts c
    join programmes.cohort_moderation_state m on m.cohort_id = c.id
    where c.id = p_cohort_id
  )
  select * from (
    select 'details', 1, true, true, null::text from c
    union all
    select 'moderation_policy', 2, true, c.moderation_policy is not null, c.moderation_policy from c
    union all
    select 'learners', 3, true, c.learners > 0, c.learners::text from c
    union all
    select 'facilitator', 4, true, c.facilitators > 0, c.facilitators::text from c
    union all
    select 'assessor', 5, true, c.assessors > 0, c.assessors::text from c
    union all
    -- Needed only for a moderated cohort; until a policy is chosen it counts as needed.
    select 'moderator', 6, c.moderation_policy is distinct from 'not_moderated',
      c.moderators > 0 or c.moderation_policy = 'not_moderated', c.moderators::text from c
    union all
    select 'materials', 7, false, c.materials > 0, c.materials::text from c
    union all
    select 'published_tasks', 8, false, c.tasks > 0, c.tasks::text from c
    union all
    select 'sessions', 9, false, c.sessions > 0, c.sessions::text from c
    union all
    select 'logistics', 10, false, c.logistics_confirmed_at is not null, null from c
  ) items (item_key, sort, gate, done, detail)
$$;


revoke all on function programmes.cohort_staff(uuid) from public, anon, authenticated, service_role;
revoke all on function programmes.readiness(uuid) from public, anon, authenticated, service_role;

-- C-05: the checklist, with each item's assignee, due date and note.
create function api.get_cohort_readiness(p_cohort_id uuid)
returns table (
  item_key text,
  gate boolean,
  done boolean,
  detail text,
  assignee_id uuid,
  assignee_name text,
  due_on date,
  note text,
  confirmed_by_name text,
  confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.item_key, r.gate, r.done, r.detail, a.assignee_id, p.full_name, a.due_on, a.note, cp.full_name, a.confirmed_at
  from programmes.readiness(p_cohort_id) r
  left join programmes.readiness_assignments a on a.cohort_id = p_cohort_id and a.item_key = r.item_key
  left join identity.profiles p on p.id = a.assignee_id
  left join identity.profiles cp on cp.id = a.confirmed_by
  where programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by r.sort
$$;

-- Assign an open item to someone on the cohort's staff (or clear it with a null assignee). They are told in the LMS.
create function api.assign_readiness_item(
  p_cohort_id uuid,
  p_item_key text,
  p_assignee_id uuid,
  p_due_on date default null,
  p_note text default null
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item record;
  v_cohort programmes.cohorts;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_cohort from programmes.cohorts c where c.id = p_cohort_id;
  if not found or not programmes.can_coordinate(v_actor, p_cohort_id) then return query select 'not_found'::text; return; end if;
  if v_cohort.status = 'archived' then return query select 'archived'::text; return; end if;
  select * into v_item from programmes.readiness(p_cohort_id) r where r.item_key = p_item_key;
  if not found then return query select 'invalid_item'::text; return; end if;
  if v_item.done and p_assignee_id is not null then return query select 'already_done'::text; return; end if;
  if p_assignee_id is not null and not exists (
    select 1 from programmes.cohort_staff(p_cohort_id) s where s.profile_id = p_assignee_id
  ) then
    return query select 'not_staff'::text; return;
  end if;
  if char_length(v_note) > 500 then return query select 'note_too_long'::text; return; end if;
  if p_due_on is not null and p_due_on < (now() at time zone 'Africa/Johannesburg')::date then
    return query select 'due_in_past'::text; return;
  end if;

  insert into programmes.readiness_assignments as ra (cohort_id, item_key, assignee_id, due_on, note, assigned_by, assigned_at)
  values (p_cohort_id, p_item_key, p_assignee_id, p_due_on, v_note, v_actor, now())
  on conflict (cohort_id, item_key) do update
  set assignee_id = excluded.assignee_id, due_on = excluded.due_on, note = excluded.note,
      assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at;

  perform audit.append('programmes.readiness_item_assigned', 'cohort', p_cohort_id::text,
    jsonb_build_object('item_key', p_item_key), 'coordinator', null,
    jsonb_build_object('assignee_id', p_assignee_id, 'due_on', p_due_on), 'cohort', p_cohort_id);

  if p_assignee_id is not null and p_assignee_id <> v_actor then
    perform notifications.enqueue('readiness_item_assigned',
      'readiness:' || p_cohort_id::text || ':' || p_item_key || ':' || p_assignee_id::text || ':' || now()::text,
      p_assignee_id,
      jsonb_build_object('cohort_name', v_cohort.name, 'item_key', p_item_key, 'due_on', p_due_on, 'note', v_note,
        'assigned_by_name', (select full_name from identity.profiles where id = v_actor)),
      case p_item_key
        when 'materials' then '/teach/materials'
        when 'published_tasks' then '/teach/tasks'
        when 'sessions' then '/teach/sessions'
        else '/coordinate/cohorts/' || p_cohort_id::text || '/readiness'
      end);
  end if;
  return query select 'ok'::text;
end
$$;

-- Logistics is confirmed by hand until session logistics (C-11) is built.
create function api.confirm_cohort_logistics(p_cohort_id uuid, p_confirmed boolean)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status <> 'archived')
     or not programmes.can_coordinate(v_actor, p_cohort_id) then
    return query select 'not_found'::text; return;
  end if;
  insert into programmes.readiness_assignments as ra (cohort_id, item_key, confirmed_at, confirmed_by)
  values (p_cohort_id, 'logistics', case when p_confirmed then now() end, case when p_confirmed then v_actor end)
  on conflict (cohort_id, item_key) do update
  set confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by;
  perform audit.append('programmes.logistics_confirmed', 'cohort', p_cohort_id::text, '{}'::jsonb, 'coordinator',
    null, jsonb_build_object('confirmed', coalesce(p_confirmed, false)), 'cohort', p_cohort_id);
  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Activation
-- ---------------------------------------------------------------------------------------------------------------

-- Activates a cohort in setup once every gating item is done: the pending enrolments become active, so learners see
-- the cohort from now. Refused with the items still open.
create function api.activate_cohort(p_cohort_id uuid)
returns table (status text, missing text[], learners integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cohort programmes.cohorts;
  v_missing text[];
  v_count integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::text[], null::integer; return; end if;
  select * into v_cohort from programmes.cohorts c where c.id = p_cohort_id;
  if not found or not programmes.can_coordinate(v_actor, p_cohort_id) then
    return query select 'not_found'::text, null::text[], null::integer; return;
  end if;
  perform 1 from programmes.cohort_moderation_state m where m.cohort_id = p_cohort_id for update;
  select * into v_cohort from programmes.cohorts c where c.id = p_cohort_id for update;
  if v_cohort.status <> 'setup' then
    return query select 'not_in_setup'::text, null::text[], null::integer; return;
  end if;
  select array_agg(r.item_key order by r.sort) into v_missing
  from programmes.readiness(p_cohort_id) r where r.gate and not r.done;
  if v_missing is not null then
    return query select 'not_ready'::text, v_missing, null::integer; return;
  end if;

  update programmes.cohorts c set status = 'active', activated_at = now(), activated_by = v_actor where c.id = p_cohort_id;
  update programmes.enrolments e set status = 'active' where e.cohort_id = p_cohort_id and e.status = 'pending';
  get diagnostics v_count = row_count;

  perform audit.append('programmes.cohort_activated', 'cohort', p_cohort_id::text,
    jsonb_build_object('learners', v_count), 'coordinator',
    jsonb_build_object('status', 'setup'), jsonb_build_object('status', 'active'), 'cohort', p_cohort_id);
  return query select 'ok'::text, null::text[], v_count;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads for the setup and people pages
-- ---------------------------------------------------------------------------------------------------------------

-- C-03: the cohort's state, policy and activation, for the setup page.
create function api.get_cohort_setup(p_cohort_id uuid)
returns table (
  cohort_id uuid,
  name text,
  programme_title text,
  starts_on date,
  ends_on date,
  status text,
  activated_at timestamptz,
  activated_by_name text,
  moderation_policy text,
  policy_version integer,
  learners integer,
  waiting integer,
  held integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, p.title, c.starts_on, c.ends_on, c.status, c.activated_at, ap.full_name,
    m.moderation_policy, m.policy_version,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = c.id and e.status in ('pending', 'active')),
    u.waiting, u.held
  from programmes.cohorts c
  join programmes.programmes p on p.id = c.programme_id
  join programmes.cohort_moderation_state m on m.cohort_id = c.id
  left join identity.profiles ap on ap.id = c.activated_by
  cross join lateral programmes.unreleased_results(c.id) u
  where c.id = p_cohort_id and programmes.can_coordinate(auth.uid(), c.id)
$$;

-- The policy's history, newest first: every version, and every change that was refused.
create function api.list_moderation_policy_history(p_cohort_id uuid)
returns table (
  kind text,
  version integer,
  policy text,
  previous_policy text,
  reason text,
  by_name text,
  at timestamptz,
  waiting integer,
  held integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select 'version'::text, v.version, v.policy, v.previous_policy, v.reason, p.full_name, v.set_at, null::integer, null::integer
    from programmes.moderation_policy_versions v
    left join identity.profiles p on p.id = v.set_by
    where v.cohort_id = p_cohort_id
    union all
    select 'refused', (e.details ->> 'policy_version')::integer, e.details ->> 'requested', null, null, p.full_name,
      e.occurred_at, (e.details ->> 'waiting')::integer, (e.details ->> 'held')::integer
    from audit.events e
    left join identity.profiles p on p.id = e.actor_id
    where e.action = 'programmes.moderation_policy_change_refused' and e.object_type = 'cohort'
      and e.object_id = p_cohort_id::text
  ) h
  where programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by 7 desc
$$;

-- C-04: the staff roles that cover the cohort. Only a cohort-scoped one can be ended from the cohort's page.
create function api.list_cohort_staff(p_cohort_id uuid)
returns table (
  assignment_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  role text,
  scope_type text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.assignment_id, s.profile_id, p.full_name, u.email::text, s.role, s.scope_type, s.starts_at, s.ends_at
  from programmes.cohort_staff(p_cohort_id) s
  join identity.profiles p on p.id = s.profile_id
  join auth.users u on u.id = p.id
  where programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by case s.role when 'coordinator' then 1 when 'facilitator' then 2 when 'assessor' then 3 else 4 end, p.full_name
$$;

-- Assign a facilitator, assessor or moderator to the cohort by email: the same command, rules and separation-of-
-- duties advisory as assigning a role on the person's account (S3-07).
create function api.assign_cohort_role(p_cohort_id uuid, p_email text, p_role text, p_until timestamptz default null)
returns table (status text, assignment_id uuid, advisories jsonb, profile_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_row record;
begin
  if auth.uid() is null then return query select 'unauthenticated'::text, null::uuid, null::jsonb, null::uuid; return; end if;
  if not programmes.can_coordinate(auth.uid(), p_cohort_id) then
    return query select 'not_found'::text, null::uuid, null::jsonb, null::uuid; return;
  end if;
  if p_role not in ('facilitator', 'assessor', 'moderator') then
    return query select 'invalid_role'::text, null::uuid, null::jsonb, null::uuid; return;
  end if;
  select p.id into v_profile
  from auth.users u join identity.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(coalesce(p_email, '')));
  if v_profile is null then return query select 'account_not_found'::text, null::uuid, null::jsonb, null::uuid; return; end if;

  select * into v_row from api.assign_role(v_profile, p_role, 'cohort', p_cohort_id, p_until);
  return query select v_row.status, v_row.assignment_id, v_row.advisories, v_profile;
end
$$;

revoke all on function api.set_moderation_policy(uuid, text, integer, text) from public, anon, authenticated, service_role;
revoke all on function api.get_cohort_readiness(uuid) from public, anon, authenticated, service_role;
revoke all on function api.assign_readiness_item(uuid, text, uuid, date, text) from public, anon, authenticated, service_role;
revoke all on function api.confirm_cohort_logistics(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function api.activate_cohort(uuid) from public, anon, authenticated, service_role;
revoke all on function api.get_cohort_setup(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_moderation_policy_history(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_cohort_staff(uuid) from public, anon, authenticated, service_role;
revoke all on function api.assign_cohort_role(uuid, text, text, timestamptz) from public, anon, authenticated, service_role;

grant execute on function api.set_moderation_policy(uuid, text, integer, text) to authenticated;
grant execute on function api.get_cohort_readiness(uuid) to authenticated;
grant execute on function api.assign_readiness_item(uuid, text, uuid, date, text) to authenticated;
grant execute on function api.confirm_cohort_logistics(uuid, boolean) to authenticated;
grant execute on function api.activate_cohort(uuid) to authenticated;
grant execute on function api.get_cohort_setup(uuid) to authenticated;
grant execute on function api.list_moderation_policy_history(uuid) to authenticated;
grant execute on function api.list_cohort_staff(uuid) to authenticated;
grant execute on function api.assign_cohort_role(uuid, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Notifications: a readiness item assigned to you
-- ---------------------------------------------------------------------------------------------------------------

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked', 'role_assigned', 'role_ended', 'password_reset_sent',
                 'account_deactivated', 'account_reactivated', 'readiness_item_assigned')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Existing functions, regenerated: new cohorts start in setup with no policy; setup cohorts can be prepared
-- ---------------------------------------------------------------------------------------------------------------


alter table programmes.cohorts alter column status set default 'setup';

-- The cohort creation from 20260923120000: a new cohort starts in setup, with no moderation policy chosen.
create or replace function api.create_cohort(p_programme_id uuid, p_name text, p_starts_on date, p_ends_on date)
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
  -- No policy yet: the coordinator chooses one before activating the cohort (P-01). The row exists from the start,
  -- as the lock target (ADR-019).
  insert into programmes.cohort_moderation_state (cohort_id, moderation_policy, policy_version, set_by)
  values (v_id, null, 0, v_actor);

  perform audit.append('programmes.cohort_created', 'cohort', v_id::text,
    jsonb_build_object('programme_id', p_programme_id), 'coordinator', null,
    jsonb_build_object('name', btrim(p_name), 'starts_on', p_starts_on, 'ends_on', p_ends_on,
      'status', 'setup'),
    'programme', p_programme_id);
  return query select 'ok'::text, v_id;
end
$$;

-- The enrolment from 20260923120000: a pending enrolment (cohort in setup) is already enrolled.
create or replace function api.enrol_learner(p_cohort_id uuid, p_email text)
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
  if v_existing.id is not null and v_existing.status in ('active', 'pending') then
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

-- The coordinator's cohort list from 20260923120000: learners waiting for activation count as enrolled.
create or replace function api.list_cohorts()
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
    (select count(*)::int from programmes.enrolments e where e.cohort_id = c.id and e.status in ('pending', 'active'))
  from programmes.cohorts c
  join programmes.programmes p on p.id = c.programme_id
  join programmes.cohort_moderation_state m on m.cohort_id = c.id
  where programmes.can_coordinate(auth.uid(), c.id)
  order by c.starts_on desc, c.name
$$;

-- The import from 20261007090000: learners can be imported into a cohort in setup.
create or replace function api.create_import_batch(p_cohort_id uuid, p_file_name text, p_file_digest text, p_rows jsonb)
returns table (status text, batch_id uuid, detail jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_existing record;
  v_batch uuid;
  v_count integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::jsonb; return; end if;
  if not identity.has_role(v_actor, 'administrator') then
    return query select 'forbidden'::text, null::uuid, null::jsonb; return;
  end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status in ('setup', 'active')) then
    return query select 'cohort_not_found'::text, null::uuid, null::jsonb; return;
  end if;
  if coalesce(p_file_digest, '') !~ '^[0-9a-f]{64}$' or char_length(coalesce(p_file_name, '')) not between 1 and 255 then
    return query select 'invalid_file'::text, null::uuid, null::jsonb; return;
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return query select 'no_rows'::text, null::uuid, null::jsonb; return;
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count > 5000 then
    return query select 'too_many_rows'::text, null::uuid, jsonb_build_object('rows', v_count); return;
  end if;

  -- The same file for the same cohort: say which batch has it, and create nothing (flow G, E2).
  select b.id, b.reference, b.created_at, p.full_name into v_existing
  from identity.import_batches b join identity.profiles p on p.id = b.uploaded_by
  where b.cohort_id = p_cohort_id and b.file_digest = p_file_digest and b.state <> 'cancelled';
  if v_existing.id is not null then
    return query select 'duplicate_file'::text, v_existing.id,
      jsonb_build_object('reference', v_existing.reference, 'created_at', v_existing.created_at,
                         'uploaded_by', v_existing.full_name);
    return;
  end if;

  insert into identity.import_batches (cohort_id, file_name, file_digest, uploaded_by)
  values (p_cohort_id, btrim(p_file_name), p_file_digest, v_actor)
  returning id into v_batch;

  with raw as (
    select (r ->> 'row')::integer as row_number,
      nullif(btrim(r ->> 'full_name'), '') as full_name,
      nullif(btrim(r ->> 'email'), '') as email,
      nullif(btrim(r ->> 'learner_number'), '') as learner_number
    from jsonb_array_elements(p_rows) r
  ),
  keyed as (
    select raw.*, lower(raw.email) as identity_key,
      min(raw.row_number) over (partition by lower(raw.email)) as first_email_row,
      min(raw.row_number) over (partition by raw.learner_number) as first_number_row
    from raw
  )
  insert into identity.import_rows (batch_id, row_number, full_name, email, learner_number, identity_key, outcome, problem)
  select v_batch, k.row_number, k.full_name, k.email, k.learner_number, k.identity_key,
    case when x.problem is not null then 'problem' when x.exists_already then 'exists' else 'ready' end,
    x.problem
  from keyed k
  cross join lateral (
    select
      case
        when k.full_name is null then 'Name is missing.'
        when char_length(k.full_name) > 200 then 'Name is longer than 200 characters.'
        when k.email is null then 'Email is missing.'
        when k.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(k.email) > 254 then 'This is not an email address.'
        when k.first_email_row < k.row_number then 'This email appears twice in the file (also row ' || k.first_email_row || ').'
        when k.learner_number is not null and char_length(k.learner_number) > 50 then 'Learner number is longer than 50 characters.'
        when k.learner_number is not null and k.first_number_row < k.row_number
          then 'This learner number appears twice in the file (also row ' || k.first_number_row || ').'
        when k.learner_number is not null and exists (
          select 1 from identity.profiles p
          join auth.users u on u.id = p.id
          where p.learner_number = k.learner_number and lower(u.email) <> k.identity_key
        ) then 'Another account already has this learner number.'
      end as problem,
      exists (select 1 from auth.users u join identity.profiles p on p.id = u.id where lower(u.email) = k.identity_key)
        as exists_already
  ) x;

  perform audit.append('identity.import_checked', 'import_batch', v_batch::text,
    jsonb_build_object('file_name', btrim(p_file_name), 'rows', v_count), 'administrator', null,
    (select jsonb_build_object('reference', b.reference, 'ready', count(*) filter (where r.outcome = 'ready'),
                               'problems', count(*) filter (where r.outcome = 'problem'),
                               'exists', count(*) filter (where r.outcome = 'exists'))
     from identity.import_batches b join identity.import_rows r on r.batch_id = b.id
     where b.id = v_batch group by b.reference),
    'cohort', p_cohort_id);

  return query select 'ok'::text, v_batch, null::jsonb;
end
$$;

-- The import's cohort list from 20261007090000, with cohorts in setup.
create or replace function api.list_import_cohorts()
returns table (id uuid, name text, programme_title text, enrolled integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, p.title,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = c.id and e.status in ('pending', 'active'))
  from programmes.cohorts c
  join programmes.programmes p on p.id = c.programme_id
  where c.status in ('setup', 'active') and identity.has_role(auth.uid(), 'administrator')
  order by p.title, c.starts_on desc, c.name
$$;

-- Material from 20261008090000: it can be prepared in a cohort in setup.
create or replace function api.create_material(p_cohort_id uuid, p_title text, p_description text default '', p_module_id uuid default null)
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
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status in ('setup', 'active')) then
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

-- Recordings from 20261023090000: likewise.
create or replace function api.create_recording(
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
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status in ('setup', 'active')) then
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

-- Sessions from 20261009090000: they can be scheduled in a cohort in setup; nobody is told until it is active.
create or replace function api.create_session(
  p_cohort_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_mode text,
  p_teams_url text default null,
  p_venue text default null
)
returns table (status text, session_id uuid, notified integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_problem text;
  v_session learning.sessions;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::integer; return; end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status in ('setup', 'active')) then
    return query select 'cohort_not_found'::text, null::uuid, null::integer; return;
  end if;
  if not submissions.can_set_work(v_actor, p_cohort_id) then
    return query select 'forbidden'::text, null::uuid, null::integer; return;
  end if;
  v_problem := learning.session_problem(p_title, p_starts_at, p_duration_minutes, p_mode, p_teams_url, p_venue);
  if v_problem is not null then return query select v_problem, null::uuid, null::integer; return; end if;

  insert into learning.sessions (cohort_id, title, starts_at, duration_minutes, mode, teams_url, venue, created_by)
  values (p_cohort_id, btrim(p_title), p_starts_at, p_duration_minutes, p_mode,
          case when p_mode = 'online' then btrim(p_teams_url) end,
          case when p_mode = 'in_person' then btrim(p_venue) end, v_actor)
  returning * into v_session;

  perform audit.append('learning.session_scheduled', 'session', v_session.id::text, '{}'::jsonb, 'facilitator', null,
    jsonb_build_object('title', v_session.title, 'starts_at', v_session.starts_at,
                       'duration_minutes', v_session.duration_minutes, 'mode', v_session.mode),
    'cohort', p_cohort_id);

  return query select 'ok'::text, v_session.id,
    learning.notify_session(v_session, 'session_scheduled', 'session_scheduled:' || v_session.id::text);
end
$$;

-- The cohorts a facilitator sets work in, from 20260925090000, with cohorts in setup.
create or replace function api.list_work_cohorts()
returns table (id uuid, name text, programme_title text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, p.title, c.status
  from programmes.cohorts c
  join programmes.programmes p on p.id = c.programme_id
  where c.status in ('setup', 'active')
    and submissions.can_set_work(auth.uid(), c.id)
  order by c.starts_on desc, c.name
$$;
