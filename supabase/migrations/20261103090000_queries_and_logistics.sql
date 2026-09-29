-- Stakeholder queries and session logistics (S6-03; FR-704 to FR-707; screens C-10, C-11).
--
-- Queries (FR-704). A coordinator logs a query from outside the teaching team (an employer, a funder, a learner, the
-- Department) against a programme, and optionally one of its cohorts. It is routed to a coordinator who covers it,
-- who is told, and tracked to closure: open, in progress, closed with a resolution, and reopened with a reason if it
-- comes back. Every step is an append-only event, so the history is the record. A query is seen by the coordinators
-- whose scope covers it: the programme's (global or programme scope), or the cohort's when it names one.
--
-- Logistics (FR-705 to FR-707). For an in-person session: the venue booking, catering (headcount and dietary needs)
-- and equipment, each marked arranged by whom and when. The default headcount comes from attendance so far (the
-- average present over the cohort's last three captured registers) or, before any register, from enrolment, and the
-- page says which. Once the session's register is captured, a difference between the learners present and the
-- confirmed headcount beyond the configured percentage is flagged until a coordinator reconciles it with a note. The
-- readiness checklist's logistics item now follows from this (every upcoming in-person session arranged) instead of
-- being confirmed by hand, and the hand confirmation is removed.

-- ---------------------------------------------------------------------------------------------------------------
-- Stakeholder queries
-- ---------------------------------------------------------------------------------------------------------------

create sequence programmes.query_reference_seq;

create table programmes.stakeholder_queries (
  id uuid primary key default gen_random_uuid(),
  -- "QRY-2026-0007": the year it was logged (SAST) and a number that is never reused.
  reference text not null unique,
  programme_id uuid not null references programmes.programmes (id),
  cohort_id uuid references programmes.cohorts (id),
  source_type text not null check (source_type in ('learner', 'employer', 'funder', 'department', 'staff', 'other')),
  source_name text not null check (char_length(btrim(source_name)) between 1 and 200),
  -- How to reply, when the source gave one. Kept short and optional: only what the reply needs.
  contact text check (contact is null or char_length(btrim(contact)) between 1 and 200),
  subject text not null check (char_length(btrim(subject)) between 1 and 200),
  details text not null check (char_length(btrim(details)) between 1 and 5000),
  owner_id uuid references identity.profiles (id),
  due_on date,
  state text not null default 'open' check (state in ('open', 'in_progress', 'closed')),
  resolution text check (resolution is null or char_length(btrim(resolution)) between 1 and 5000),
  logged_by uuid not null references identity.profiles (id),
  logged_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references identity.profiles (id),
  updated_at timestamptz not null default now(),
  constraint closure_is_recorded check (
    (state = 'closed') = (closed_at is not null)
    and (closed_at is null) = (closed_by is null)
    and (closed_at is null) = (resolution is null)
  )
);

create index stakeholder_queries_programme_idx on programmes.stakeholder_queries (programme_id, state);
create index stakeholder_queries_owner_idx on programmes.stakeholder_queries (owner_id) where state <> 'closed';

-- Append-only: what happened to the query, by whom, when.
create table programmes.stakeholder_query_events (
  id bigint generated always as identity primary key,
  query_id uuid not null references programmes.stakeholder_queries (id),
  event text not null check (event in ('logged', 'routed', 'started', 'noted', 'closed', 'reopened')),
  actor_id uuid not null references identity.profiles (id),
  owner_id uuid references identity.profiles (id),
  note text check (note is null or char_length(btrim(note)) between 1 and 5000),
  created_at timestamptz not null default now(),
  constraint routing_names_the_owner check ((event = 'routed') = (owner_id is not null))
);

create index stakeholder_query_events_query_idx on programmes.stakeholder_query_events (query_id, id);

revoke all on table programmes.stakeholder_queries, programmes.stakeholder_query_events
  from public, anon, authenticated, service_role;
revoke all on sequence programmes.query_reference_seq from public, anon, authenticated, service_role;

create trigger stakeholder_query_events_append_only
  before update or delete on programmes.stakeholder_query_events
  for each row execute function audit.forbid_mutation();
create trigger stakeholder_query_events_append_only_truncate
  before truncate on programmes.stakeholder_query_events
  for each statement execute function audit.forbid_mutation();

-- Who may see and work a query: the programme's coordinators, or the cohort's when it names one.
create function programmes.can_handle_query(p_profile_id uuid, p_programme_id uuid, p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select programmes.can_coordinate_programme(p_profile_id, p_programme_id)
      or (p_cohort_id is not null and programmes.can_coordinate(p_profile_id, p_cohort_id))
$$;

-- Who a query can be routed to: every active coordinator who can handle it.
create function programmes.query_owners(p_programme_id uuid, p_cohort_id uuid)
returns table (profile_id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id, p.full_name
  from identity.role_assignments ra
  join identity.profiles p on p.id = ra.profile_id and p.status = 'active'
  where ra.role = 'coordinator' and ra.effective @> now()
    and programmes.can_handle_query(p.id, p_programme_id, p_cohort_id)
  order by p.full_name
$$;

revoke all on function programmes.can_handle_query(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function programmes.query_owners(uuid, uuid) from public, anon, authenticated, service_role;

-- Tells the new owner, unless they routed it to themselves.
create function programmes.notify_query_owner(p_query programmes.stakeholder_queries, p_actor uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_query.owner_id is null or p_query.owner_id = p_actor then return; end if;
  perform notifications.enqueue('query_assigned',
    'query_assigned:' || p_query.id::text || ':' || gen_random_uuid()::text, p_query.owner_id,
    jsonb_build_object(
      'reference', p_query.reference, 'subject', p_query.subject,
      'programme_title', (select pr.title from programmes.programmes pr where pr.id = p_query.programme_id),
      'cohort_name', (select c.name from programmes.cohorts c where c.id = p_query.cohort_id),
      'source_name', p_query.source_name, 'due_on', p_query.due_on, 'note', p_note,
      'assigned_by_name', (select p.full_name from identity.profiles p where p.id = p_actor)),
    '/coordinate/queries/' || p_query.id::text);
end
$$;

revoke all on function programmes.notify_query_owner(programmes.stakeholder_queries, uuid, text)
  from public, anon, authenticated, service_role;

-- Logging a query (C-10). It starts open, with no owner; routing is its own step.
create function api.log_stakeholder_query(
  p_programme_id uuid,
  p_cohort_id uuid,
  p_source_type text,
  p_source_name text,
  p_contact text,
  p_subject text,
  p_details text,
  p_due_on date default null
)
returns table (status text, query_id uuid, reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_contact text := nullif(btrim(coalesce(p_contact, '')), '');
  v_query programmes.stakeholder_queries;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::text; return; end if;
  if not exists (select 1 from programmes.programmes where id = p_programme_id) then
    return query select 'programme_not_found'::text, null::uuid, null::text; return;
  end if;
  if p_cohort_id is not null
     and not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.programme_id = p_programme_id) then
    return query select 'cohort_not_in_programme'::text, null::uuid, null::text; return;
  end if;
  if not programmes.can_handle_query(v_actor, p_programme_id, p_cohort_id) then
    return query select 'forbidden'::text, null::uuid, null::text; return;
  end if;
  if p_source_type is null
     or p_source_type not in ('learner', 'employer', 'funder', 'department', 'staff', 'other') then
    return query select 'invalid_source_type'::text, null::uuid, null::text; return;
  end if;
  if char_length(btrim(coalesce(p_source_name, ''))) not between 1 and 200 then
    return query select 'invalid_source_name'::text, null::uuid, null::text; return;
  end if;
  if char_length(v_contact) > 200 then return query select 'invalid_contact'::text, null::uuid, null::text; return; end if;
  if char_length(btrim(coalesce(p_subject, ''))) not between 1 and 200 then
    return query select 'invalid_subject'::text, null::uuid, null::text; return;
  end if;
  if char_length(btrim(coalesce(p_details, ''))) not between 1 and 5000 then
    return query select 'invalid_details'::text, null::uuid, null::text; return;
  end if;
  if p_due_on is not null and p_due_on < v_today then
    return query select 'due_in_past'::text, null::uuid, null::text; return;
  end if;

  insert into programmes.stakeholder_queries (reference, programme_id, cohort_id, source_type, source_name, contact,
    subject, details, due_on, logged_by)
  values ('QRY-' || to_char(now() at time zone 'Africa/Johannesburg', 'YYYY') || '-'
            || lpad(nextval('programmes.query_reference_seq')::text, 4, '0'),
          p_programme_id, p_cohort_id, p_source_type, btrim(p_source_name), v_contact, btrim(p_subject),
          btrim(p_details), p_due_on, v_actor)
  returning * into v_query;

  insert into programmes.stakeholder_query_events (query_id, event, actor_id) values (v_query.id, 'logged', v_actor);
  perform audit.append('programmes.query_logged', 'stakeholder_query', v_query.id::text,
    jsonb_build_object('reference', v_query.reference), 'coordinator', null,
    jsonb_build_object('programme_id', p_programme_id, 'cohort_id', p_cohort_id, 'source_type', p_source_type),
    case when p_cohort_id is null then 'programme' else 'cohort' end, coalesce(p_cohort_id, p_programme_id));

  return query select 'ok'::text, v_query.id, v_query.reference;
end
$$;

-- Routing (or rerouting) a query to a coordinator who can handle it. They are told.
create function api.route_stakeholder_query(p_query_id uuid, p_owner_id uuid, p_note text default null)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_query programmes.stakeholder_queries;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_query from programmes.stakeholder_queries q where q.id = p_query_id for update;
  if not found or not programmes.can_handle_query(v_actor, v_query.programme_id, v_query.cohort_id) then
    return query select 'not_found'::text; return;
  end if;
  if v_query.state = 'closed' then return query select 'closed'::text; return; end if;
  if char_length(v_note) > 5000 then return query select 'invalid_note'::text; return; end if;
  if p_owner_id is null
     or not exists (select 1 from programmes.query_owners(v_query.programme_id, v_query.cohort_id) o
                    where o.profile_id = p_owner_id) then
    return query select 'owner_not_eligible'::text; return;
  end if;
  if v_query.owner_id = p_owner_id then return query select 'unchanged'::text; return; end if;

  update programmes.stakeholder_queries q set owner_id = p_owner_id, updated_at = now()
  where q.id = p_query_id returning * into v_query;
  insert into programmes.stakeholder_query_events (query_id, event, actor_id, owner_id, note)
  values (p_query_id, 'routed', v_actor, p_owner_id, v_note);
  perform programmes.notify_query_owner(v_query, v_actor, v_note);
  perform audit.append('programmes.query_routed', 'stakeholder_query', p_query_id::text,
    jsonb_build_object('reference', v_query.reference), 'coordinator', null,
    jsonb_build_object('owner_id', p_owner_id),
    case when v_query.cohort_id is null then 'programme' else 'cohort' end,
    coalesce(v_query.cohort_id, v_query.programme_id));
  return query select 'ok'::text;
end
$$;

-- Working a query: start it, add a note, close it with the resolution, or reopen it with the reason.
create function api.act_on_stakeholder_query(p_query_id uuid, p_action text, p_note text default null)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_query programmes.stakeholder_queries;
  v_event text;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_query from programmes.stakeholder_queries q where q.id = p_query_id for update;
  if not found or not programmes.can_handle_query(v_actor, v_query.programme_id, v_query.cohort_id) then
    return query select 'not_found'::text; return;
  end if;
  if p_action is null or p_action not in ('start', 'note', 'close', 'reopen') then
    return query select 'invalid_action'::text; return;
  end if;
  if char_length(v_note) > 5000 then return query select 'invalid_note'::text; return; end if;

  if p_action = 'start' then
    if v_query.state <> 'open' then return query select 'not_open'::text; return; end if;
    update programmes.stakeholder_queries q set state = 'in_progress', updated_at = now() where q.id = p_query_id;
    v_event := 'started';
  elsif p_action = 'note' then
    if v_query.state = 'closed' then return query select 'closed'::text; return; end if;
    if v_note is null then return query select 'note_required'::text; return; end if;
    update programmes.stakeholder_queries q set updated_at = now() where q.id = p_query_id;
    v_event := 'noted';
  elsif p_action = 'close' then
    if v_query.state = 'closed' then return query select 'closed'::text; return; end if;
    if v_note is null then return query select 'resolution_required'::text; return; end if;
    update programmes.stakeholder_queries q
    set state = 'closed', resolution = v_note, closed_at = now(), closed_by = v_actor, updated_at = now()
    where q.id = p_query_id;
    v_event := 'closed';
  else
    if v_query.state <> 'closed' then return query select 'not_closed'::text; return; end if;
    if v_note is null then return query select 'reason_required'::text; return; end if;
    update programmes.stakeholder_queries q
    set state = 'open', resolution = null, closed_at = null, closed_by = null, updated_at = now()
    where q.id = p_query_id;
    v_event := 'reopened';
  end if;

  insert into programmes.stakeholder_query_events (query_id, event, actor_id, note)
  values (p_query_id, v_event, v_actor, v_note);
  perform audit.append('programmes.query_' || v_event, 'stakeholder_query', p_query_id::text,
    jsonb_build_object('reference', v_query.reference), 'coordinator',
    jsonb_build_object('state', v_query.state), null,
    case when v_query.cohort_id is null then 'programme' else 'cohort' end,
    coalesce(v_query.cohort_id, v_query.programme_id));
  return query select 'ok'::text;
end
$$;

-- C-10 list: the queries the caller can handle. p_show: 'open' (not closed, the default), 'closed', 'mine' or 'all'.
create function api.list_stakeholder_queries(p_show text default 'open')
returns table (
  id uuid,
  reference text,
  subject text,
  programme_title text,
  cohort_name text,
  source_type text,
  source_name text,
  owner_id uuid,
  owner_name text,
  state text,
  due_on date,
  logged_at timestamptz,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.reference, q.subject, pr.title, c.name, q.source_type, q.source_name, q.owner_id, op.full_name,
    q.state, q.due_on, q.logged_at, q.updated_at
  from programmes.stakeholder_queries q
  join programmes.programmes pr on pr.id = q.programme_id
  left join programmes.cohorts c on c.id = q.cohort_id
  left join identity.profiles op on op.id = q.owner_id
  where programmes.can_handle_query(auth.uid(), q.programme_id, q.cohort_id)
    and case coalesce(p_show, 'open')
          when 'open' then q.state <> 'closed'
          when 'closed' then q.state = 'closed'
          when 'mine' then q.owner_id = auth.uid() and q.state <> 'closed'
          else true
        end
  order by q.state = 'closed', q.due_on nulls last, q.logged_at desc
$$;

-- C-10 detail: the query, its history, and who it can be routed to. Nothing when the caller cannot handle it.
create function api.get_stakeholder_query(p_query_id uuid)
returns table (
  id uuid,
  reference text,
  programme_id uuid,
  programme_title text,
  cohort_id uuid,
  cohort_name text,
  source_type text,
  source_name text,
  contact text,
  subject text,
  details text,
  owner_id uuid,
  owner_name text,
  due_on date,
  state text,
  resolution text,
  logged_by_name text,
  logged_at timestamptz,
  closed_by_name text,
  closed_at timestamptz,
  events jsonb,
  owners jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.reference, q.programme_id, pr.title, q.cohort_id, c.name, q.source_type, q.source_name, q.contact,
    q.subject, q.details, q.owner_id, op.full_name, q.due_on, q.state, q.resolution, lp.full_name, q.logged_at,
    cp.full_name, q.closed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('event', e.event, 'actor_name', ap.full_name, 'owner_name', ep.full_name,
                                          'note', e.note, 'at', e.created_at) order by e.id)
      from programmes.stakeholder_query_events e
      join identity.profiles ap on ap.id = e.actor_id
      left join identity.profiles ep on ep.id = e.owner_id
      where e.query_id = q.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('profile_id', o.profile_id, 'full_name', o.full_name) order by o.full_name)
      from programmes.query_owners(q.programme_id, q.cohort_id) o
    ), '[]'::jsonb)
  from programmes.stakeholder_queries q
  join programmes.programmes pr on pr.id = q.programme_id
  left join programmes.cohorts c on c.id = q.cohort_id
  left join identity.profiles op on op.id = q.owner_id
  join identity.profiles lp on lp.id = q.logged_by
  left join identity.profiles cp on cp.id = q.closed_by
  where q.id = p_query_id and programmes.can_handle_query(auth.uid(), q.programme_id, q.cohort_id)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Session logistics
-- ---------------------------------------------------------------------------------------------------------------

insert into audit.configuration_keys (key, group_key, group_label, group_order, sort_order, label, description,
  value_type, unit_label, min_value, max_value, choices, affects, does_not_affect, in_use) values
('logistics.variance_percent', 'logistics', 'Session logistics', 7, 1, 'Headcount difference that is flagged',
 'How far the learners present at an in-person session may differ from the confirmed catering headcount before the difference is flagged for a coordinator to reconcile.',
 'integer', '%', 0, 100, null,
 'Every session''s flag, from the moment it takes effect.',
 'A difference already reconciled stays reconciled. Nothing about the session or its register changes.',
 true);

insert into audit.configuration_versions (key, version, value, previous_value, effective_from, reason)
values ('logistics.variance_percent', 1, '10', null, '-infinity',
  'Set when session logistics was introduced (S6-03): more than 10% either way is flagged.');

-- One row per in-person session that has logistics recorded.
create table learning.session_logistics (
  session_id uuid primary key references learning.sessions (id),
  venue_note text check (venue_note is null or char_length(btrim(venue_note)) between 1 and 1000),
  venue_arranged_at timestamptz,
  venue_arranged_by uuid references identity.profiles (id),
  catering_needed boolean not null default false,
  headcount integer check (headcount between 0 and 10000),
  headcount_source text check (headcount_source in ('enrolment', 'expected_attendance', 'manual')),
  dietary text check (dietary is null or char_length(btrim(dietary)) between 1 and 1000),
  catering_arranged_at timestamptz,
  catering_arranged_by uuid references identity.profiles (id),
  equipment text check (equipment is null or char_length(btrim(equipment)) between 1 and 1000),
  equipment_arranged_at timestamptz,
  equipment_arranged_by uuid references identity.profiles (id),
  reconciled_at timestamptz,
  reconciled_by uuid references identity.profiles (id),
  reconciliation_note text check (reconciliation_note is null or char_length(btrim(reconciliation_note)) between 1 and 1000),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references identity.profiles (id),
  constraint catering_has_a_headcount check (
    catering_needed = (headcount is not null) and (headcount is null) = (headcount_source is null)
  ),
  constraint no_catering_nothing_to_arrange check (catering_needed or (dietary is null and catering_arranged_at is null)),
  constraint equipment_arranged_needs_equipment check (equipment is not null or equipment_arranged_at is null),
  constraint arrangements_are_recorded check (
    (venue_arranged_at is null) = (venue_arranged_by is null)
    and (catering_arranged_at is null) = (catering_arranged_by is null)
    and (equipment_arranged_at is null) = (equipment_arranged_by is null)
  ),
  constraint reconciliation_is_recorded check (
    (reconciled_at is null) = (reconciled_by is null) and (reconciled_at is null) = (reconciliation_note is null)
  )
);

revoke all on table learning.session_logistics from public, anon, authenticated, service_role;

-- The default catering headcount (FR-706): the average present over the cohort's last three captured registers of
-- other sessions, or, before any register, the learners enrolled.
create function learning.default_headcount(p_session_id uuid)
returns table (headcount integer, source text, basis integer)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from learning.sessions where id = p_session_id),
  recent as (
    select (select count(*) from learning.attendance a where a.session_id = o.id and a.status = 'present') as present
    from learning.sessions o, s
    where o.cohort_id = s.cohort_id and o.id <> s.id and o.state = 'scheduled' and o.register_version > 0
    order by o.starts_at desc
    limit 3
  )
  select case when (select count(*) from recent) > 0 then (select round(avg(present))::integer from recent)
              else (select count(*)::integer from programmes.enrolments e, s
                    where e.cohort_id = s.cohort_id and e.status in ('pending', 'active')) end,
         case when (select count(*) from recent) > 0 then 'expected_attendance' else 'enrolment' end,
         (select count(*)::integer from recent)
$$;

-- Whether the session's logistics are all arranged: the venue, and catering and equipment where they are needed.
create function learning.logistics_arranged(p_logistics learning.session_logistics)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_logistics.session_id is not null
     and p_logistics.venue_arranged_at is not null
     and (not p_logistics.catering_needed or p_logistics.catering_arranged_at is not null)
     and (p_logistics.equipment is null or p_logistics.equipment_arranged_at is not null)
$$;

-- The learners present, when the register is captured, against the confirmed headcount (FR-707).
create function learning.logistics_variance(p_session_id uuid)
returns table (present integer, difference integer, flagged boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.present, p.present - l.headcount,
    l.catering_needed and l.reconciled_at is null
      and abs(p.present - l.headcount) * 100 > l.headcount * audit.config_int('logistics.variance_percent')
  from learning.sessions s
  join learning.session_logistics l on l.session_id = s.id
  cross join lateral (
    select count(*)::integer as present from learning.attendance a where a.session_id = s.id and a.status = 'present'
  ) p
  where s.id = p_session_id and s.register_version > 0 and l.catering_needed
$$;

revoke all on function learning.default_headcount(uuid) from public, anon, authenticated, service_role;
revoke all on function learning.logistics_arranged(learning.session_logistics) from public, anon, authenticated, service_role;
revoke all on function learning.logistics_variance(uuid) from public, anon, authenticated, service_role;

-- C-11 list: in-person sessions in the caller's cohorts, from 30 days ago on, with where their logistics stand.
create function api.list_session_logistics()
returns table (
  session_id uuid,
  cohort_id uuid,
  cohort_name text,
  title text,
  starts_at timestamptz,
  venue text,
  session_state text,
  needed integer,
  arranged integer,
  catering_needed boolean,
  headcount integer,
  register_captured boolean,
  present integer,
  variance_flagged boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, c.id, c.name, s.title, s.starts_at, s.venue, s.state,
    1 + (coalesce(l.catering_needed, false))::int + (l.equipment is not null)::int,
    (l.venue_arranged_at is not null)::int + (l.catering_arranged_at is not null)::int
      + (l.equipment_arranged_at is not null)::int,
    coalesce(l.catering_needed, false), l.headcount, s.register_version > 0, v.present, coalesce(v.flagged, false)
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  left join learning.session_logistics l on l.session_id = s.id
  left join lateral learning.logistics_variance(s.id) v on true
  where s.mode = 'in_person' and s.starts_at >= now() - interval '30 days'
    and programmes.can_coordinate(auth.uid(), s.cohort_id)
  order by coalesce(v.flagged, false) desc, s.starts_at
$$;

-- C-11 detail: the session, its logistics, the default headcount and its source, and the variance.
create function api.get_session_logistics(p_session_id uuid)
returns table (
  session_id uuid,
  cohort_id uuid,
  cohort_name text,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  mode text,
  venue text,
  session_state text,
  version integer,
  venue_note text,
  venue_arranged_at timestamptz,
  venue_arranged_by_name text,
  catering_needed boolean,
  headcount integer,
  headcount_source text,
  dietary text,
  catering_arranged_at timestamptz,
  catering_arranged_by_name text,
  equipment text,
  equipment_arranged_at timestamptz,
  equipment_arranged_by_name text,
  default_headcount integer,
  default_source text,
  default_basis integer,
  enrolled integer,
  register_captured boolean,
  present integer,
  difference integer,
  variance_flagged boolean,
  variance_percent integer,
  reconciled_at timestamptz,
  reconciled_by_name text,
  reconciliation_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, c.id, c.name, s.title, s.starts_at, s.duration_minutes, s.mode, s.venue, s.state, coalesce(l.version, 0),
    l.venue_note, l.venue_arranged_at, vp.full_name, coalesce(l.catering_needed, false), l.headcount,
    l.headcount_source, l.dietary, l.catering_arranged_at, cp.full_name, l.equipment, l.equipment_arranged_at,
    ep.full_name, d.headcount, d.source, d.basis,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = s.cohort_id and e.status in ('pending', 'active')),
    s.register_version > 0, v.present, v.difference, coalesce(v.flagged, false),
    audit.config_int('logistics.variance_percent'), l.reconciled_at, rp.full_name, l.reconciliation_note
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  left join learning.session_logistics l on l.session_id = s.id
  left join identity.profiles vp on vp.id = l.venue_arranged_by
  left join identity.profiles cp on cp.id = l.catering_arranged_by
  left join identity.profiles ep on ep.id = l.equipment_arranged_by
  left join identity.profiles rp on rp.id = l.reconciled_by
  cross join lateral learning.default_headcount(s.id) d
  left join lateral learning.logistics_variance(s.id) v on true
  where s.id = p_session_id and programmes.can_coordinate(auth.uid(), s.cohort_id)
$$;

-- Saving the session's logistics (FR-705). Marking an item arranged records who and when; unmarking clears it.
-- A changed headcount undoes an earlier reconciliation, which was of the old number.
create function api.save_session_logistics(
  p_session_id uuid,
  p_expected_version integer,
  p_venue_note text,
  p_venue_arranged boolean,
  p_catering_needed boolean,
  p_headcount integer,
  p_dietary text,
  p_catering_arranged boolean,
  p_equipment text,
  p_equipment_arranged boolean
)
returns table (status text, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session learning.sessions;
  v_old learning.session_logistics;
  v_new learning.session_logistics;
  v_default record;
  v_venue_note text := nullif(btrim(coalesce(p_venue_note, '')), '');
  v_dietary text := nullif(btrim(coalesce(p_dietary, '')), '');
  v_equipment text := nullif(btrim(coalesce(p_equipment, '')), '');
  v_catering boolean := coalesce(p_catering_needed, false);
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_session from learning.sessions s where s.id = p_session_id;
  if not found or not programmes.can_coordinate(v_actor, v_session.cohort_id) then
    return query select 'not_found'::text, null::integer; return;
  end if;
  if v_session.mode <> 'in_person' then return query select 'not_in_person'::text, null::integer; return; end if;
  if v_session.state <> 'scheduled' then return query select 'cancelled'::text, null::integer; return; end if;
  if char_length(v_venue_note) > 1000 or char_length(v_dietary) > 1000 or char_length(v_equipment) > 1000 then
    return query select 'too_long'::text, null::integer; return;
  end if;
  if v_catering and (p_headcount is null or p_headcount not between 0 and 10000) then
    return query select 'invalid_headcount'::text, null::integer; return;
  end if;
  if coalesce(p_equipment_arranged, false) and v_equipment is null then
    return query select 'equipment_required'::text, null::integer; return;
  end if;

  select * into v_old from learning.session_logistics l where l.session_id = p_session_id for update;
  if coalesce(v_old.version, 0) <> coalesce(p_expected_version, -1) then
    return query select 'stale_version'::text, coalesce(v_old.version, 0); return;
  end if;
  select * into v_default from learning.default_headcount(p_session_id);

  insert into learning.session_logistics as l (
    session_id, venue_note, venue_arranged_at, venue_arranged_by, catering_needed, headcount, headcount_source,
    dietary, catering_arranged_at, catering_arranged_by, equipment, equipment_arranged_at, equipment_arranged_by,
    reconciled_at, reconciled_by, reconciliation_note, version, updated_at, updated_by
  )
  values (
    p_session_id, v_venue_note,
    case when coalesce(p_venue_arranged, false) then coalesce(v_old.venue_arranged_at, now()) end,
    case when coalesce(p_venue_arranged, false) then coalesce(v_old.venue_arranged_by, v_actor) end,
    v_catering,
    case when v_catering then p_headcount end,
    case when not v_catering then null
         when p_headcount = v_old.headcount then v_old.headcount_source
         when p_headcount = v_default.headcount then v_default.source
         else 'manual' end,
    case when v_catering then v_dietary end,
    case when v_catering and coalesce(p_catering_arranged, false) then coalesce(v_old.catering_arranged_at, now()) end,
    case when v_catering and coalesce(p_catering_arranged, false) then coalesce(v_old.catering_arranged_by, v_actor) end,
    v_equipment,
    case when v_equipment is not null and coalesce(p_equipment_arranged, false) then coalesce(v_old.equipment_arranged_at, now()) end,
    case when v_equipment is not null and coalesce(p_equipment_arranged, false) then coalesce(v_old.equipment_arranged_by, v_actor) end,
    case when v_catering and p_headcount is not distinct from v_old.headcount then v_old.reconciled_at end,
    case when v_catering and p_headcount is not distinct from v_old.headcount then v_old.reconciled_by end,
    case when v_catering and p_headcount is not distinct from v_old.headcount then v_old.reconciliation_note end,
    1, now(), v_actor
  )
  on conflict (session_id) do update set
    venue_note = excluded.venue_note, venue_arranged_at = excluded.venue_arranged_at,
    venue_arranged_by = excluded.venue_arranged_by, catering_needed = excluded.catering_needed,
    headcount = excluded.headcount, headcount_source = excluded.headcount_source, dietary = excluded.dietary,
    catering_arranged_at = excluded.catering_arranged_at, catering_arranged_by = excluded.catering_arranged_by,
    equipment = excluded.equipment, equipment_arranged_at = excluded.equipment_arranged_at,
    equipment_arranged_by = excluded.equipment_arranged_by, reconciled_at = excluded.reconciled_at,
    reconciled_by = excluded.reconciled_by, reconciliation_note = excluded.reconciliation_note,
    version = l.version + 1, updated_at = now(), updated_by = v_actor
  returning * into v_new;

  perform audit.append('learning.logistics_saved', 'session', p_session_id::text, '{}'::jsonb, 'coordinator',
    case when v_old.session_id is null then null else to_jsonb(v_old) - 'updated_at' - 'updated_by' - 'version' end,
    to_jsonb(v_new) - 'updated_at' - 'updated_by' - 'version', 'cohort', v_session.cohort_id);
  return query select 'ok'::text, v_new.version;
end
$$;

-- Reconciling a flagged difference (FR-707): the note says what happened.
create function api.reconcile_logistics_variance(p_session_id uuid, p_note text)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_session learning.sessions;
  v_variance record;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_session from learning.sessions s where s.id = p_session_id;
  if not found or not programmes.can_coordinate(v_actor, v_session.cohort_id) then
    return query select 'not_found'::text; return;
  end if;
  perform 1 from learning.session_logistics l where l.session_id = p_session_id for update;
  select * into v_variance from learning.logistics_variance(p_session_id);
  if not found or not v_variance.flagged then return query select 'nothing_to_reconcile'::text; return; end if;
  if v_note is null or char_length(v_note) > 1000 then return query select 'note_required'::text; return; end if;

  update learning.session_logistics l
  set reconciled_at = now(), reconciled_by = v_actor, reconciliation_note = v_note, version = l.version + 1,
      updated_at = now(), updated_by = v_actor
  where l.session_id = p_session_id;
  perform audit.append('learning.logistics_reconciled', 'session', p_session_id::text,
    jsonb_build_object('present', v_variance.present, 'difference', v_variance.difference), 'coordinator', null,
    jsonb_build_object('note', v_note), 'cohort', v_session.cohort_id);
  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Readiness: logistics follows from the sessions now, not from a hand confirmation
-- ---------------------------------------------------------------------------------------------------------------

-- The checklist from 20261026090000, with logistics computed from the sessions.
create or replace function programmes.readiness(p_cohort_id uuid)
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
      -- Upcoming in-person sessions, and how many of them have every logistics item arranged (S6-03).
      (select count(*) from learning.sessions s
       where s.cohort_id = c.id and s.state = 'scheduled' and s.mode = 'in_person'
         and s.starts_at + make_interval(mins => s.duration_minutes) > now()) as in_person,
      (select count(*) from learning.sessions s
       join learning.session_logistics l on l.session_id = s.id
       where s.cohort_id = c.id and s.state = 'scheduled' and s.mode = 'in_person'
         and s.starts_at + make_interval(mins => s.duration_minutes) > now()
         and learning.logistics_arranged(l)) as in_person_arranged
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
    -- Done when every upcoming in-person session is arranged; with only online sessions there is nothing to arrange,
    -- and with no sessions yet there is nothing to judge. Detail: "arranged/total", or "none_in_person".
    select 'logistics', 10, false, c.sessions > 0 and c.in_person = c.in_person_arranged,
      case when c.sessions = 0 then null when c.in_person = 0 then 'none_in_person'
           else c.in_person_arranged || '/' || c.in_person end from c
  ) items (item_key, sort, gate, done, detail)
$$;

drop function api.confirm_cohort_logistics(uuid, boolean);

-- ---------------------------------------------------------------------------------------------------------------
-- Notifications: a query routed to you
-- ---------------------------------------------------------------------------------------------------------------

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked', 'role_assigned', 'role_ended', 'password_reset_sent',
                 'account_deactivated', 'account_reactivated', 'readiness_item_assigned', 'query_assigned')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.log_stakeholder_query(uuid, uuid, text, text, text, text, text, date) from public, anon, authenticated, service_role;
revoke all on function api.route_stakeholder_query(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function api.act_on_stakeholder_query(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function api.list_stakeholder_queries(text) from public, anon, authenticated, service_role;
revoke all on function api.get_stakeholder_query(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_session_logistics() from public, anon, authenticated, service_role;
revoke all on function api.get_session_logistics(uuid) from public, anon, authenticated, service_role;
revoke all on function api.save_session_logistics(uuid, integer, text, boolean, boolean, integer, text, boolean, text, boolean) from public, anon, authenticated, service_role;
revoke all on function api.reconcile_logistics_variance(uuid, text) from public, anon, authenticated, service_role;
grant execute on function api.log_stakeholder_query(uuid, uuid, text, text, text, text, text, date) to authenticated;
grant execute on function api.route_stakeholder_query(uuid, uuid, text) to authenticated;
grant execute on function api.act_on_stakeholder_query(uuid, text, text) to authenticated;
grant execute on function api.list_stakeholder_queries(text) to authenticated;
grant execute on function api.get_stakeholder_query(uuid) to authenticated;
grant execute on function api.list_session_logistics() to authenticated;
grant execute on function api.get_session_logistics(uuid) to authenticated;
grant execute on function api.save_session_logistics(uuid, integer, text, boolean, boolean, integer, text, boolean, text, boolean) to authenticated;
grant execute on function api.reconcile_logistics_variance(uuid, text) to authenticated;

