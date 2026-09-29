-- Session series (F-06; FR-206, FR-207): a session can repeat every day, week, two weeks or month as a numbered
-- series. Each occurrence is a session of its own, so registers, logistics and notes work as before; the learners
-- are told once about the whole series, and the rest of a series can be changed or cancelled together.

-- ---------------------------------------------------------------------------------------------------------------
-- Sessions know their series
-- ---------------------------------------------------------------------------------------------------------------

alter table learning.sessions
  add column series_id uuid,
  add column series_repeat text,
  add column series_seq integer,
  add column series_count integer,
  add constraint series_is_whole check (
    (series_id is null and series_repeat is null and series_seq is null and series_count is null)
    or (series_id is not null and series_repeat in ('daily', 'weekly', 'fortnightly', 'monthly')
        and series_count between 2 and 26 and series_seq between 1 and series_count)
  );

create index sessions_series_idx on learning.sessions (series_id, series_seq) where series_id is not null;

-- How far apart the sessions of a series are.
create function learning.series_interval(p_repeat text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_repeat
    when 'daily' then interval '1 day'
    when 'weekly' then interval '7 days'
    when 'fortnightly' then interval '14 days'
    when 'monthly' then interval '1 month'
  end
$$;

-- When the p_seq-th session of a series starts: counted in South African time from the first, so a monthly series
-- keeps its day of the month (the 31st falls back to a shorter month's last day, from the first date, not the last).
create function learning.series_start(p_first timestamptz, p_repeat text, p_seq integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((p_first at time zone 'Africa/Johannesburg') + (p_seq - 1) * learning.series_interval(p_repeat))
         at time zone 'Africa/Johannesburg'
$$;

revoke all on function learning.series_interval(text) from public, anon, authenticated, service_role;
revoke all on function learning.series_start(timestamptz, text, integer) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Notifications: one message about the series, not one per session
-- ---------------------------------------------------------------------------------------------------------------

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'session_series_scheduled', 'session_series_changed',
                 'session_series_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked', 'role_assigned', 'role_ended', 'password_reset_sent',
                 'account_deactivated', 'account_reactivated', 'readiness_item_assigned', 'query_assigned')
);

-- Tells every active learner in the cohort about a series, from its first (or first affected) session. The event
-- key names the series and the session's version, so a replay is harmless and a later change is a new message.
create function learning.notify_series(p_session learning.sessions, p_event text, p_details jsonb)
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
           'session_id', p_session.id, 'series_id', p_session.series_id, 'repeat', p_session.series_repeat,
           'title', p_session.title, 'cohort_name', c.name, 'starts_at', p_session.starts_at,
           'duration_minutes', p_session.duration_minutes, 'mode', p_session.mode, 'venue', p_session.venue) || p_details
  into v_payload
  from programmes.cohorts c where c.id = p_session.cohort_id;

  for v_learner in
    select e.profile_id from programmes.enrolments e
    where e.cohort_id = p_session.cohort_id and e.status = 'active'
  loop
    if notifications.enqueue(p_event, p_event || ':' || p_session.series_id::text || ':' || p_session.version,
                             v_learner, v_payload, '/learn/calendar') is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end
$$;

revoke all on function learning.notify_series(learning.sessions, text, jsonb) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Schedule a series
-- ---------------------------------------------------------------------------------------------------------------

-- The same checks as one session, then p_count sessions at the same time of day, spaced by p_repeat. Returns the
-- first session and how many were made.
create function api.create_session_series(
  p_cohort_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_mode text,
  p_repeat text,
  p_count integer,
  p_teams_url text default null,
  p_venue text default null
)
returns table (status text, session_id uuid, sessions integer, notified integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_problem text;
  v_series uuid := gen_random_uuid();
  v_first learning.sessions;
  v_session learning.sessions;
  v_last timestamptz;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::integer, null::integer; return; end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status in ('setup', 'active')) then
    return query select 'cohort_not_found'::text, null::uuid, null::integer, null::integer; return;
  end if;
  if not submissions.can_set_work(v_actor, p_cohort_id) then
    return query select 'forbidden'::text, null::uuid, null::integer, null::integer; return;
  end if;
  v_problem := learning.session_problem(p_title, p_starts_at, p_duration_minutes, p_mode, p_teams_url, p_venue);
  if v_problem is not null then return query select v_problem, null::uuid, null::integer, null::integer; return; end if;
  if p_repeat is null or p_repeat not in ('daily', 'weekly', 'fortnightly', 'monthly') then
    return query select 'invalid_repeat'::text, null::uuid, null::integer, null::integer; return;
  end if;
  if p_count is null or p_count not between 2 and 26 then
    return query select 'invalid_count'::text, null::uuid, null::integer, null::integer; return;
  end if;

  for v_seq in 1..p_count loop
    insert into learning.sessions (
      cohort_id, title, starts_at, duration_minutes, mode, teams_url, venue, created_by,
      series_id, series_repeat, series_seq, series_count
    )
    values (
      p_cohort_id, btrim(p_title), learning.series_start(p_starts_at, p_repeat, v_seq), p_duration_minutes,
      p_mode, case when p_mode = 'online' then btrim(p_teams_url) end,
      case when p_mode = 'in_person' then btrim(p_venue) end, v_actor, v_series, p_repeat, v_seq, p_count
    )
    returning * into v_session;
    if v_seq = 1 then v_first := v_session; end if;
    v_last := v_session.starts_at;
  end loop;

  perform audit.append('learning.session_series_scheduled', 'session_series', v_series::text, '{}'::jsonb,
    'facilitator', null,
    jsonb_build_object('title', v_first.title, 'starts_at', v_first.starts_at, 'last_starts_at', v_last,
                       'repeat', p_repeat, 'count', p_count, 'duration_minutes', p_duration_minutes, 'mode', p_mode),
    'cohort', p_cohort_id);

  return query select 'ok'::text, v_first.id, p_count,
    learning.notify_series(v_first, 'session_series_scheduled',
      jsonb_build_object('count', p_count, 'last_starts_at', v_last));
end
$$;

revoke all on function api.create_session_series(uuid, text, timestamptz, integer, text, text, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function api.create_session_series(uuid, text, timestamptz, integer, text, text, integer, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Change one session, or it and the rest of its series
-- ---------------------------------------------------------------------------------------------------------------

drop function api.update_session(uuid, integer, text, timestamptz, integer, text, text, text);

-- With p_rest_of_series, the later scheduled sessions of the same series take the same title, length and place,
-- and their start times move by the same amount as this one (a Tuesday series moved to Wednesday 10:00 stays a
-- series of Wednesdays at 10:00). The learners are told once about all of them when the time or place changed.
-- Returns how many learners were told and how many sessions changed.
create function api.update_session(
  p_session_id uuid,
  p_expected_version integer,
  p_title text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_mode text,
  p_teams_url text default null,
  p_venue text default null,
  p_rest_of_series boolean default false
)
returns table (status text, notified integer, changed integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before learning.sessions;
  v_after learning.sessions;
  v_later learning.sessions;
  v_moved_later learning.sessions;
  v_problem text;
  v_moved boolean;
  v_shift interval;
  v_changed integer := 1;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer; return; end if;
  select * into v_before from learning.sessions s where s.id = p_session_id for update;
  if not found then return query select 'not_found'::text, null::integer, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_before.cohort_id) then
    return query select 'forbidden'::text, null::integer, null::integer; return;
  end if;
  if v_before.state = 'cancelled' then return query select 'cancelled'::text, null::integer, null::integer; return; end if;
  if v_before.starts_at + make_interval(mins => v_before.duration_minutes) <= now() then
    return query select 'already_held'::text, null::integer, null::integer; return;
  end if;
  if v_before.version <> p_expected_version then
    return query select 'stale_version'::text, null::integer, null::integer; return;
  end if;
  v_problem := learning.session_problem(p_title, p_starts_at, p_duration_minutes, p_mode, p_teams_url, p_venue);
  if v_problem is not null then return query select v_problem, null::integer, null::integer; return; end if;

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
  v_shift := v_after.starts_at - v_before.starts_at;

  perform audit.append('learning.session_changed', 'session', p_session_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('title', v_before.title, 'starts_at', v_before.starts_at,
                       'duration_minutes', v_before.duration_minutes, 'mode', v_before.mode,
                       'teams_url', v_before.teams_url, 'venue', v_before.venue),
    jsonb_build_object('title', v_after.title, 'starts_at', v_after.starts_at,
                       'duration_minutes', v_after.duration_minutes, 'mode', v_after.mode,
                       'teams_url', v_after.teams_url, 'venue', v_after.venue),
    'cohort', v_after.cohort_id);

  if coalesce(p_rest_of_series, false) and v_before.series_id is not null then
    for v_later in
      select * from learning.sessions s
      where s.series_id = v_before.series_id and s.series_seq > v_before.series_seq
        and s.state = 'scheduled' and s.starts_at > now()
      order by s.series_seq
      for update
    loop
      update learning.sessions s
      set title = v_after.title, starts_at = s.starts_at + v_shift, duration_minutes = v_after.duration_minutes,
          mode = v_after.mode, teams_url = v_after.teams_url, venue = v_after.venue,
          version = s.version + 1, updated_at = now()
      where s.id = v_later.id
      returning * into v_moved_later;
      perform audit.append('learning.session_changed', 'session', v_later.id::text,
        jsonb_build_object('with_series', p_session_id), 'facilitator',
        jsonb_build_object('title', v_later.title, 'starts_at', v_later.starts_at,
                           'duration_minutes', v_later.duration_minutes, 'mode', v_later.mode,
                           'teams_url', v_later.teams_url, 'venue', v_later.venue),
        jsonb_build_object('title', v_moved_later.title, 'starts_at', v_moved_later.starts_at,
                           'duration_minutes', v_moved_later.duration_minutes, 'mode', v_moved_later.mode,
                           'teams_url', v_moved_later.teams_url, 'venue', v_moved_later.venue),
        'cohort', v_later.cohort_id);
      v_changed := v_changed + 1;
    end loop;
  end if;

  if not v_moved then return query select 'ok'::text, 0, v_changed; return; end if;
  if v_changed > 1 then
    return query select 'ok'::text,
      learning.notify_series(v_after, 'session_series_changed', jsonb_build_object('count', v_changed)), v_changed;
  else
    return query select 'ok'::text,
      learning.notify_session(v_after, 'session_changed', 'session_changed:' || p_session_id::text || ':' || v_after.version),
      v_changed;
  end if;
end
$$;

revoke all on function api.update_session(uuid, integer, text, timestamptz, integer, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function api.update_session(uuid, integer, text, timestamptz, integer, text, text, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Cancel one session, or it and the rest of its series
-- ---------------------------------------------------------------------------------------------------------------

drop function api.cancel_session(uuid, text);

-- With p_rest_of_series, the later scheduled sessions of the same series are cancelled with the same reason, and
-- the learners are told once about all of them. Returns how many learners were told and how many sessions cancelled.
create function api.cancel_session(p_session_id uuid, p_reason text, p_rest_of_series boolean default false)
returns table (status text, notified integer, cancelled integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session learning.sessions;
  v_later learning.sessions;
  v_cancelled integer := 1;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer; return; end if;
  select * into v_session from learning.sessions s where s.id = p_session_id for update;
  if not found then return query select 'not_found'::text, null::integer, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_session.cohort_id) then
    return query select 'forbidden'::text, null::integer, null::integer; return;
  end if;
  if v_session.state = 'cancelled' then return query select 'already_cancelled'::text, 0, 0; return; end if;
  if v_session.starts_at + make_interval(mins => v_session.duration_minutes) <= now() then
    return query select 'already_held'::text, null::integer, null::integer; return;
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    return query select 'reason_required'::text, null::integer, null::integer; return;
  end if;

  update learning.sessions s
  set state = 'cancelled', cancel_reason = btrim(p_reason), version = s.version + 1, updated_at = now()
  where s.id = p_session_id
  returning * into v_session;

  perform audit.append('learning.session_cancelled', 'session', p_session_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('state', 'scheduled'), jsonb_build_object('state', 'cancelled', 'reason', v_session.cancel_reason),
    'cohort', v_session.cohort_id);

  if coalesce(p_rest_of_series, false) and v_session.series_id is not null then
    for v_later in
      select * from learning.sessions s
      where s.series_id = v_session.series_id and s.series_seq > v_session.series_seq
        and s.state = 'scheduled' and s.starts_at > now()
      order by s.series_seq
      for update
    loop
      update learning.sessions s
      set state = 'cancelled', cancel_reason = v_session.cancel_reason, version = s.version + 1, updated_at = now()
      where s.id = v_later.id;
      perform audit.append('learning.session_cancelled', 'session', v_later.id::text,
        jsonb_build_object('with_series', v_session.id), 'facilitator',
        jsonb_build_object('state', 'scheduled'), jsonb_build_object('state', 'cancelled', 'reason', v_session.cancel_reason),
        'cohort', v_later.cohort_id);
      v_cancelled := v_cancelled + 1;
    end loop;
  end if;

  if v_cancelled > 1 then
    return query select 'ok'::text,
      learning.notify_series(v_session, 'session_series_cancelled',
        jsonb_build_object('count', v_cancelled, 'cancel_reason', v_session.cancel_reason)),
      v_cancelled;
  else
    return query select 'ok'::text,
      learning.notify_session(v_session, 'session_cancelled', 'session_cancelled:' || p_session_id::text),
      v_cancelled;
  end if;
end
$$;

revoke all on function api.cancel_session(uuid, text, boolean) from public, anon, authenticated, service_role;
grant execute on function api.cancel_session(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The facilitator's list says which sessions belong to a series
-- ---------------------------------------------------------------------------------------------------------------

drop function api.list_sessions();

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
  audience integer,
  series_id uuid,
  series_repeat text,
  series_seq integer,
  series_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.cohort_id, c.name, s.title, s.starts_at, s.duration_minutes, s.mode, s.teams_url, s.venue, s.state,
    s.cancel_reason, s.version,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = s.cohort_id and e.status = 'active'),
    s.series_id, s.series_repeat, s.series_seq, s.series_count
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  where submissions.can_set_work(auth.uid(), s.cohort_id)
  order by s.starts_at
$$;

revoke all on function api.list_sessions() from public, anon, authenticated, service_role;
grant execute on function api.list_sessions() to authenticated;
