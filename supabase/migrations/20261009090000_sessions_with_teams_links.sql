-- Sessions with Teams links (S2-15; FR-206, FR-207, FR-305; screens F-06, L-07).
--
-- A facilitator schedules a session for a cohort they set work in: a start time, a duration, and either a Microsoft
-- Teams join link (checked on entry against the forms Teams gives out) or a venue. It is on the cohort's calendar at
-- once. Every active learner in the cohort is told in the LMS when it is scheduled, when its time or place changes,
-- and when it is cancelled (FR-207), through the notification outbox (S2-10); email follows when it is switched on.
-- A cancelled session stays on the calendar marked as cancelled, so nobody turns up for it.
--
-- Not here: the attendance register (FR-209, F-07), recordings (FR-208), the iCalendar feed (FR-304, S3-13), and
-- sessions for part of a cohort.

-- ---------------------------------------------------------------------------------------------------------------
-- A Teams join link
-- ---------------------------------------------------------------------------------------------------------------

-- The links Teams gives out for a meeting: work and school accounts (teams.microsoft.com, as a meetup-join or a meet
-- link) and personal accounts (teams.live.com/meet). The same pattern is checked in the form before it gets here.
create function learning.is_teams_link(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_url, '') ~ '^https://teams\.(microsoft\.com/(l/meetup-join|meet)/|live\.com/meet/)[^\s<>"]+$'
    and char_length(p_url) <= 2000
$$;

revoke all on function learning.is_teams_link(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------------------------------------------

create table learning.sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references programmes.cohorts (id),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 600),
  mode text not null check (mode in ('online', 'in_person')),
  teams_url text check (teams_url is null or learning.is_teams_link(teams_url)),
  venue text check (venue is null or char_length(btrim(venue)) between 1 and 200),
  state text not null default 'scheduled' check (state in ('scheduled', 'cancelled')),
  cancel_reason text check (char_length(cancel_reason) <= 500),
  version integer not null default 1 check (version >= 1),
  created_by uuid not null references identity.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_matches_mode check (
    (mode = 'online' and teams_url is not null and venue is null)
    or (mode = 'in_person' and venue is not null and teams_url is null)
  ),
  constraint cancelled_has_reason check ((state = 'cancelled') = (cancel_reason is not null))
);

create index sessions_cohort_idx on learning.sessions (cohort_id, starts_at);

revoke all on table learning.sessions from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Telling the audience (FR-207)
-- ---------------------------------------------------------------------------------------------------------------

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'session_scheduled', 'session_changed', 'session_cancelled')
);

-- The notification centre's filter chips: sessions get their own.
create or replace function notifications.category(p_event_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_event_type = 'result_released' then 'results'
    when p_event_type = 'task_published' then 'deadlines'
    when p_event_type like 'session\_%' then 'sessions'
    else 'notices'
  end
$$;

-- One notification per active learner in the session's cohort. The event key makes each change its own event, so a
-- second change tells people again while a replay of the same change does not.
create function learning.notify_session(p_session learning.sessions, p_event text, p_event_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_learner uuid;
  v_count integer := 0;
  v_payload jsonb;
begin
  select jsonb_build_object(
           'session_id', p_session.id, 'title', p_session.title, 'cohort_name', c.name,
           'starts_at', p_session.starts_at, 'duration_minutes', p_session.duration_minutes, 'mode', p_session.mode,
           'venue', p_session.venue, 'cancel_reason', p_session.cancel_reason)
  into v_payload
  from programmes.cohorts c where c.id = p_session.cohort_id;

  for v_learner in
    select e.profile_id from programmes.enrolments e
    where e.cohort_id = p_session.cohort_id and e.status = 'active'
  loop
    if notifications.enqueue(p_event, p_event_key, v_learner, v_payload, '/learn/calendar') is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end
$$;

revoke all on function learning.notify_session(learning.sessions, text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands (facilitators)
-- ---------------------------------------------------------------------------------------------------------------

-- Checks shared by scheduling and changing a session. Null when everything is in order, or the refusal.
create function learning.session_problem(
  p_title text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_mode text,
  p_teams_url text,
  p_venue text
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then 'invalid_title'
    when p_starts_at is null or p_starts_at <= now() then 'start_in_past'
    when p_duration_minutes is null or p_duration_minutes not between 15 and 600 then 'invalid_duration'
    when p_mode not in ('online', 'in_person') then 'invalid_mode'
    when p_mode = 'online' and not learning.is_teams_link(btrim(coalesce(p_teams_url, ''))) then 'invalid_teams_link'
    when p_mode = 'in_person' and char_length(btrim(coalesce(p_venue, ''))) not between 1 and 200 then 'invalid_venue'
  end
$$;

revoke all on function learning.session_problem(text, timestamptz, integer, text, text, text)
  from public, anon, authenticated, service_role;

create function api.create_session(
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
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status = 'active') then
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

-- Changing a session. A change of time, length or place tells the audience again (FR-207); a new title alone does
-- not. p_expected_version guards against two facilitators editing at once.
create function api.update_session(
  p_session_id uuid,
  p_expected_version integer,
  p_title text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_mode text,
  p_teams_url text default null,
  p_venue text default null
)
returns table (status text, notified integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before learning.sessions;
  v_after learning.sessions;
  v_problem text;
  v_moved boolean;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_before from learning.sessions s where s.id = p_session_id for update;
  if not found then return query select 'not_found'::text, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_before.cohort_id) then return query select 'forbidden'::text, null::integer; return; end if;
  if v_before.state = 'cancelled' then return query select 'cancelled'::text, null::integer; return; end if;
  if v_before.starts_at + make_interval(mins => v_before.duration_minutes) <= now() then
    return query select 'already_held'::text, null::integer; return;
  end if;
  if v_before.version <> p_expected_version then return query select 'stale_version'::text, null::integer; return; end if;
  v_problem := learning.session_problem(p_title, p_starts_at, p_duration_minutes, p_mode, p_teams_url, p_venue);
  if v_problem is not null then return query select v_problem, null::integer; return; end if;

  update learning.sessions s
  set title = btrim(p_title), starts_at = p_starts_at, duration_minutes = p_duration_minutes, mode = p_mode,
      teams_url = case when p_mode = 'online' then btrim(p_teams_url) end,
      venue = case when p_mode = 'in_person' then btrim(p_venue) end,
      version = s.version + 1, updated_at = now()
  where s.id = p_session_id
  returning * into v_after;

  v_moved := v_after.starts_at is distinct from v_before.starts_at
    or v_after.duration_minutes is distinct from v_before.duration_minutes
    or v_after.mode is distinct from v_before.mode
    or v_after.teams_url is distinct from v_before.teams_url
    or v_after.venue is distinct from v_before.venue;

  perform audit.append('learning.session_changed', 'session', p_session_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('title', v_before.title, 'starts_at', v_before.starts_at,
                       'duration_minutes', v_before.duration_minutes, 'mode', v_before.mode,
                       'teams_url', v_before.teams_url, 'venue', v_before.venue),
    jsonb_build_object('title', v_after.title, 'starts_at', v_after.starts_at,
                       'duration_minutes', v_after.duration_minutes, 'mode', v_after.mode,
                       'teams_url', v_after.teams_url, 'venue', v_after.venue),
    'cohort', v_after.cohort_id);

  return query select 'ok'::text,
    case when v_moved
      then learning.notify_session(v_after, 'session_changed', 'session_changed:' || p_session_id::text || ':' || v_after.version)
      else 0 end;
end
$$;

-- Cancelling: the session stays on the calendar, marked cancelled, and the audience is told why.
create function api.cancel_session(p_session_id uuid, p_reason text)
returns table (status text, notified integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session learning.sessions;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_session from learning.sessions s where s.id = p_session_id for update;
  if not found then return query select 'not_found'::text, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_session.cohort_id) then return query select 'forbidden'::text, null::integer; return; end if;
  if v_session.state = 'cancelled' then return query select 'already_cancelled'::text, 0; return; end if;
  if v_session.starts_at + make_interval(mins => v_session.duration_minutes) <= now() then
    return query select 'already_held'::text, null::integer; return;
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    return query select 'reason_required'::text, null::integer; return;
  end if;

  update learning.sessions s
  set state = 'cancelled', cancel_reason = btrim(p_reason), version = s.version + 1, updated_at = now()
  where s.id = p_session_id
  returning * into v_session;

  perform audit.append('learning.session_cancelled', 'session', p_session_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('state', 'scheduled'), jsonb_build_object('state', 'cancelled', 'reason', v_session.cancel_reason),
    'cohort', v_session.cohort_id);

  return query select 'ok'::text,
    learning.notify_session(v_session, 'session_cancelled', 'session_cancelled:' || p_session_id::text);
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------------------------

-- Facilitators: the sessions of cohorts they set work in, with how many learners each one reaches.
create function api.list_sessions()
returns table (
  id uuid,
  cohort_id uuid,
  cohort_name text,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  mode text,
  teams_url text,
  venue text,
  state text,
  cancel_reason text,
  version integer,
  audience integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.cohort_id, c.name, s.title, s.starts_at, s.duration_minutes, s.mode, s.teams_url, s.venue, s.state,
    s.cancel_reason, s.version,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = s.cohort_id and e.status = 'active')
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  where submissions.can_set_work(auth.uid(), s.cohort_id)
  order by s.starts_at
$$;

-- How many learners a new session in this cohort would tell, for the form ("24 learners will be told").
create function api.cohort_audience_size(p_cohort_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when submissions.can_set_work(auth.uid(), p_cohort_id) then
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = p_cohort_id and e.status = 'active')
  end
$$;

-- Learners: sessions of their cohorts that end after p_from, cancelled ones included (marked), soonest first.
create function api.list_my_sessions(p_from timestamptz default now())
returns table (
  id uuid,
  cohort_name text,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  mode text,
  teams_url text,
  venue text,
  state text,
  cancel_reason text,
  facilitator_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, c.name, s.title, s.starts_at, s.duration_minutes, s.mode,
    case when s.state = 'scheduled' then s.teams_url end, s.venue, s.state, s.cancel_reason, p.full_name
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  join programmes.enrolments e on e.cohort_id = s.cohort_id and e.profile_id = auth.uid() and e.status = 'active'
  join identity.profiles p on p.id = s.created_by
  where s.starts_at + make_interval(mins => s.duration_minutes) > coalesce(p_from, now())
  order by s.starts_at, s.title
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.create_session(uuid, text, timestamptz, integer, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function api.update_session(uuid, integer, text, timestamptz, integer, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function api.cancel_session(uuid, text) from public, anon, authenticated, service_role;
revoke all on function api.list_sessions() from public, anon, authenticated, service_role;
revoke all on function api.cohort_audience_size(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_sessions(timestamptz) from public, anon, authenticated, service_role;

grant execute on function api.create_session(uuid, text, timestamptz, integer, text, text, text) to authenticated;
grant execute on function api.update_session(uuid, integer, text, timestamptz, integer, text, text, text) to authenticated;
grant execute on function api.cancel_session(uuid, text) to authenticated;
grant execute on function api.list_sessions() to authenticated;
grant execute on function api.cohort_audience_size(uuid) to authenticated;
grant execute on function api.list_my_sessions(timestamptz) to authenticated;
