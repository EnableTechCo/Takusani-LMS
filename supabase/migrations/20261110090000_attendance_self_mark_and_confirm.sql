-- Self-marked attendance, confirmed by the facilitator (FR-209, CR-03; screens L-01, L-07, L-20, F-01, F-06, F-07,
-- F-12, C-02, C-15).
--
-- Before this, the facilitator marked every learner present or absent from nothing. Now a learner marks themselves
-- present ("I'm here") from ten minutes before a session starts until thirty minutes after it ends, or until the
-- facilitator confirms the register, whichever comes first. A check-in is never edited or removed. The facilitator
-- then confirms the register: the check-ins fill it in (checked in: present; not checked in: absent), the
-- facilitator changes any mark that is wrong, and the first save confirms the whole roster as before. The confirmed
-- register is the record; a check-in on its own is not attendance. Every change after confirmation is still an
-- amendment with a reason, and the log now says which confirmed marks came from the learner's own check-in.
--
-- Attendance is also made visible: a learner sees each session's mark and their rate on their home and on an
-- attendance page; a facilitator sees check-ins as they happen, which registers still need confirming, and a
-- cohort's attendance by learner; a coordinator sees the same by cohort. Teams attendance is still never read.

-- ---------------------------------------------------------------------------------------------------------------
-- Check-ins
-- ---------------------------------------------------------------------------------------------------------------

-- A learner's own mark that they are at a session. One per learner per session, never changed.
create table learning.attendance_checkins (
  session_id uuid not null references learning.sessions (id),
  learner_id uuid not null references identity.profiles (id),
  checked_in_at timestamptz not null default now(),
  primary key (session_id, learner_id)
);

create index attendance_checkins_learner_idx on learning.attendance_checkins (learner_id);

revoke all on table learning.attendance_checkins from public, anon, authenticated, service_role;

create trigger attendance_checkins_append_only
  before update or delete on learning.attendance_checkins
  for each row execute function audit.forbid_mutation();
create trigger attendance_checkins_append_only_truncate
  before truncate on learning.attendance_checkins
  for each statement execute function audit.forbid_mutation();

-- Which confirmed marks came from the learner's own check-in.
alter table learning.attendance_changes add column self_marked boolean not null default false;

-- Where a session is in its check-in window. 'confirmed' once the register is, whatever the time.
create function learning.checkin_state(p_session learning.sessions)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_session.state = 'cancelled' then 'cancelled'
    when p_session.register_version > 0 then 'confirmed'
    when now() < p_session.starts_at - interval '10 minutes' then 'not_open'
    when now() >= p_session.starts_at + make_interval(mins => p_session.duration_minutes) + interval '30 minutes' then 'closed'
    else 'open'
  end
$$;

revoke all on function learning.checkin_state(learning.sessions) from public, anon, authenticated, service_role;

-- "I'm here": the learner marks themselves present at a session of a cohort they are enrolled in.
create function api.mark_my_attendance(p_session_id uuid)
returns table (status text, checked_in_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session learning.sessions;
  v_state text;
  v_at timestamptz;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::timestamptz; return; end if;
  -- Shared with the facilitator's confirmation, which locks the session: a check-in never lands between the register
  -- being read and being confirmed.
  select * into v_session from learning.sessions s where s.id = p_session_id for share;
  if not found or not exists (
    select 1 from programmes.enrolments e
    where e.cohort_id = v_session.cohort_id and e.profile_id = v_actor and e.status = 'active'
  ) then
    return query select 'not_found'::text, null::timestamptz; return;
  end if;
  select ci.checked_in_at into v_at from learning.attendance_checkins ci
  where ci.session_id = p_session_id and ci.learner_id = v_actor;
  if found then return query select 'already_marked'::text, v_at; return; end if;

  v_state := learning.checkin_state(v_session);
  if v_state = 'cancelled' then return query select 'session_cancelled'::text, null::timestamptz; return; end if;
  if v_state = 'confirmed' then return query select 'already_confirmed'::text, null::timestamptz; return; end if;
  if v_state = 'not_open' then return query select 'not_open'::text, null::timestamptz; return; end if;
  if v_state = 'closed' then return query select 'closed'::text, null::timestamptz; return; end if;

  insert into learning.attendance_checkins (session_id, learner_id)
  values (p_session_id, v_actor)
  returning attendance_checkins.checked_in_at into v_at;

  perform audit.append('learning.attendance_self_marked', 'session', p_session_id::text,
    jsonb_build_object('learner_id', v_actor, 'checked_in_at', v_at), 'learner',
    null, jsonb_build_object('checked_in', true), 'cohort', v_session.cohort_id);
  return query select 'ok'::text, v_at;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The register: confirmed from the check-ins
-- ---------------------------------------------------------------------------------------------------------------

-- Confirm or amend the register. p_marks: [{"learner_id": ..., "status": "present" | "absent"}]. The first save
-- must mark everyone on the roster and confirms the register; later saves change only the marks given, and need a
-- reason. p_expected_version is the register version the facilitator saw (0 before it is confirmed). A confirmed
-- 'present' that matches the learner's own check-in is logged as self-marked.
create or replace function api.save_register(
  p_session_id uuid,
  p_marks jsonb,
  p_expected_version integer,
  p_reason text default null
)
returns table (status text, register_version integer, changed integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session learning.sessions;
  v_version integer;
  v_kind text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_mark record;
  v_changed integer := 0;
  v_self integer := 0;
  v_present integer;
  v_absent integer;
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer; return; end if;
  select * into v_session from learning.sessions s where s.id = p_session_id for update;
  if not found or not submissions.can_set_work(v_actor, v_session.cohort_id) then
    return query select 'not_found'::text, null::integer, null::integer; return;
  end if;
  if v_session.state = 'cancelled' then
    return query select 'session_cancelled'::text, v_session.register_version, null::integer; return;
  end if;
  if v_session.starts_at > now() then
    return query select 'not_started'::text, v_session.register_version, null::integer; return;
  end if;
  if p_expected_version is distinct from v_session.register_version then
    return query select 'stale'::text, v_session.register_version, null::integer; return;
  end if;

  -- The marks: well formed, each learner once, each on the roster.
  if jsonb_typeof(coalesce(p_marks, 'null'::jsonb)) <> 'array' or exists (
    select 1 from jsonb_array_elements(p_marks) m
    where jsonb_typeof(m) <> 'object'
       or coalesce(m ->> 'status', '') not in ('present', 'absent')
       or coalesce(m ->> 'learner_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) or (select count(*) from jsonb_array_elements(p_marks)) <> (
    select count(distinct m ->> 'learner_id') from jsonb_array_elements(p_marks) m
  ) then
    return query select 'invalid_marks'::text, v_session.register_version, null::integer; return;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_marks) m
    where not exists (select 1 from learning.session_roster(p_session_id) r where r.learner_id = (m ->> 'learner_id')::uuid)
  ) then
    return query select 'not_on_roster'::text, v_session.register_version, null::integer; return;
  end if;

  v_version := v_session.register_version + 1;

  if v_session.register_version = 0 then
    -- Confirmation: everyone on the roster, at once.
    if exists (
      select 1 from learning.session_roster(p_session_id) r
      where not exists (select 1 from jsonb_array_elements(p_marks) m where (m ->> 'learner_id')::uuid = r.learner_id)
    ) or jsonb_array_length(p_marks) = 0 then
      return query select 'incomplete'::text, v_session.register_version, null::integer; return;
    end if;
    v_kind := 'captured';
  else
    v_kind := 'amended';
    -- Checked before anything is written: an amendment that changes a mark needs its reason.
    if exists (
      select 1 from jsonb_array_elements(p_marks) m
      left join learning.attendance a on a.session_id = p_session_id and a.learner_id = (m ->> 'learner_id')::uuid
      where a.status is distinct from m ->> 'status'
    ) then
      if v_reason is null then
        return query select 'reason_required'::text, v_session.register_version, null::integer; return;
      end if;
      if char_length(v_reason) > 500 then
        return query select 'reason_too_long'::text, v_session.register_version, null::integer; return;
      end if;
    end if;
  end if;

  for v_mark in
    select (m ->> 'learner_id')::uuid as learner_id, m ->> 'status' as status, a.status as previous,
      ci.checked_in_at is not null as checked_in
    from jsonb_array_elements(p_marks) m
    left join learning.attendance a on a.session_id = p_session_id and a.learner_id = (m ->> 'learner_id')::uuid
    left join learning.attendance_checkins ci on ci.session_id = p_session_id and ci.learner_id = (m ->> 'learner_id')::uuid
  loop
    continue when v_mark.previous is not distinct from v_mark.status;

    insert into learning.attendance (session_id, learner_id, status, marked_by, marked_at)
    values (p_session_id, v_mark.learner_id, v_mark.status, v_actor, now())
    on conflict (session_id, learner_id)
    do update set status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at;

    insert into learning.attendance_changes (
      session_id, learner_id, kind, previous_status, status, reason, register_version, changed_by, self_marked
    )
    values (
      p_session_id, v_mark.learner_id, case when v_mark.previous is null and v_kind = 'captured' then 'captured' else 'amended' end,
      v_mark.previous, v_mark.status, case when v_kind = 'amended' then v_reason end, v_version, v_actor,
      v_kind = 'captured' and v_mark.status = 'present' and v_mark.checked_in
    );
    v_before := v_before || jsonb_build_object('learner_id', v_mark.learner_id, 'status', v_mark.previous);
    v_after := v_after || jsonb_build_object('learner_id', v_mark.learner_id, 'status', v_mark.status);
    v_changed := v_changed + 1;
    if v_kind = 'captured' and v_mark.status = 'present' and v_mark.checked_in then v_self := v_self + 1; end if;
  end loop;

  if v_changed = 0 then
    return query select 'unchanged'::text, v_session.register_version, 0; return;
  end if;

  update learning.sessions s
  set register_version = v_version,
      register_captured_at = coalesce(s.register_captured_at, now()),
      register_captured_by = coalesce(s.register_captured_by, v_actor)
  where s.id = p_session_id;

  select count(*) filter (where a.status = 'present'), count(*) filter (where a.status = 'absent')
  into v_present, v_absent
  from learning.attendance a where a.session_id = p_session_id;

  perform audit.append(
    case when v_kind = 'captured' then 'learning.register_captured' else 'learning.register_amended' end,
    'session', p_session_id::text,
    jsonb_build_object('register_version', v_version, 'present', v_present, 'absent', v_absent, 'reason', v_reason,
      'self_marked', case when v_kind = 'captured' then v_self end),
    'facilitator',
    case when v_kind = 'amended' then v_before end, v_after, 'cohort', v_session.cohort_id);
  return query select 'ok'::text, v_version, v_changed;
end
$$;

-- F-07: the session, its roster with each learner's mark and check-in, and every amendment, newest first.
create or replace function api.get_register(p_session_id uuid)
returns table (
  session_id uuid,
  title text,
  cohort_name text,
  starts_at timestamptz,
  duration_minutes integer,
  state text,
  register_version integer,
  captured_at timestamptz,
  captured_by_name text,
  roster jsonb,
  amendments jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, c.name, s.starts_at, s.duration_minutes, s.state, s.register_version,
    s.register_captured_at, cap.full_name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'learner_id', r.learner_id, 'full_name', r.full_name, 'learner_number', r.learner_number,
        'enrolled', r.enrolled, 'status', a.status, 'checked_in_at', ci.checked_in_at) order by r.full_name)
      from learning.session_roster(s.id) r
      left join learning.attendance a on a.session_id = s.id and a.learner_id = r.learner_id
      left join learning.attendance_checkins ci on ci.session_id = s.id and ci.learner_id = r.learner_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'learner_name', l.full_name, 'previous_status', ch.previous_status, 'status', ch.status,
        'reason', ch.reason, 'changed_by_name', by_p.full_name, 'changed_at', ch.changed_at,
        'register_version', ch.register_version) order by ch.changed_at desc, ch.id desc)
      from learning.attendance_changes ch
      join identity.profiles l on l.id = ch.learner_id
      join identity.profiles by_p on by_p.id = ch.changed_by
      where ch.session_id = s.id and ch.kind = 'amended'
    ), '[]'::jsonb)
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  left join identity.profiles cap on cap.id = s.register_captured_by
  where s.id = p_session_id and submissions.can_set_work(auth.uid(), s.cohort_id)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Session lists carry attendance
-- ---------------------------------------------------------------------------------------------------------------

-- The facilitator's sessions, now with the register's state and counts.
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
  series_count integer,
  register_version integer,
  checkin_state text,
  checked_in integer,
  present integer,
  absent integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.cohort_id, c.name, s.title, s.starts_at, s.duration_minutes, s.mode, s.teams_url, s.venue, s.state,
    s.cancel_reason, s.version,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = s.cohort_id and e.status = 'active'),
    s.series_id, s.series_repeat, s.series_seq, s.series_count,
    s.register_version, learning.checkin_state(s),
    (select count(*)::integer from learning.attendance_checkins ci where ci.session_id = s.id),
    (select count(*)::integer from learning.attendance a where a.session_id = s.id and a.status = 'present'),
    (select count(*)::integer from learning.attendance a where a.session_id = s.id and a.status = 'absent')
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  where submissions.can_set_work(auth.uid(), s.cohort_id)
  order by s.starts_at
$$;

-- The learner's sessions, now with their check-in and, once confirmed, their mark.
drop function api.list_my_sessions(timestamptz);
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
  facilitator_name text,
  checkin_state text,
  checked_in_at timestamptz,
  attendance text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, c.name, s.title, s.starts_at, s.duration_minutes, s.mode,
    case when s.state = 'scheduled' then s.teams_url end, s.venue, s.state, s.cancel_reason, p.full_name,
    learning.checkin_state(s), ci.checked_in_at, a.status
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  join programmes.enrolments e on e.cohort_id = s.cohort_id and e.profile_id = auth.uid() and e.status = 'active'
  join identity.profiles p on p.id = s.created_by
  left join learning.attendance_checkins ci on ci.session_id = s.id and ci.learner_id = auth.uid()
  left join learning.attendance a on a.session_id = s.id and a.learner_id = auth.uid()
  where s.starts_at + make_interval(mins => s.duration_minutes) > coalesce(p_from, now())
  order by s.starts_at, s.title
$$;

-- L-20: every session of the learner's cohorts that has started, latest first, with their check-in and mark. A
-- cancelled session has no register and is left out.
create function api.list_my_attendance()
returns table (
  session_id uuid,
  cohort_name text,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  mode text,
  venue text,
  checkin_state text,
  checked_in_at timestamptz,
  attendance text,
  confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, c.name, s.title, s.starts_at, s.duration_minutes, s.mode, s.venue,
    learning.checkin_state(s), ci.checked_in_at, a.status, s.register_captured_at
  from learning.sessions s
  join programmes.cohorts c on c.id = s.cohort_id
  join programmes.enrolments e on e.cohort_id = s.cohort_id and e.profile_id = auth.uid() and e.status = 'active'
  left join learning.attendance_checkins ci on ci.session_id = s.id and ci.learner_id = auth.uid()
  left join learning.attendance a on a.session_id = s.id and a.learner_id = auth.uid()
  where s.state <> 'cancelled' and s.starts_at <= now()
  order by s.starts_at desc, s.title
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- A cohort's attendance, for whoever sets work in it or coordinates it
-- ---------------------------------------------------------------------------------------------------------------

create function learning.may_read_cohort_attendance(p_profile_id uuid, p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select submissions.can_set_work(p_profile_id, p_cohort_id) or programmes.can_coordinate(p_profile_id, p_cohort_id)
$$;

revoke all on function learning.may_read_cohort_attendance(uuid, uuid) from public, anon, authenticated, service_role;

-- F-12, C-15: each learner's confirmed marks across the cohort's sessions, lowest attendance first. A learner who
-- has left the cohort stays while they have a mark.
create function api.get_cohort_attendance(p_cohort_id uuid)
returns table (
  learner_id uuid,
  full_name text,
  learner_number text,
  enrolled boolean,
  sessions integer,
  present integer,
  absent integer,
  last_absent_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with marks as (
    select a.learner_id, a.status, s.starts_at
    from learning.attendance a
    join learning.sessions s on s.id = a.session_id
    where s.cohort_id = p_cohort_id and s.state <> 'cancelled'
  )
  select p.id, p.full_name, p.learner_number, e.profile_id is not null,
    (select count(*)::integer from marks m where m.learner_id = p.id),
    (select count(*)::integer from marks m where m.learner_id = p.id and m.status = 'present'),
    (select count(*)::integer from marks m where m.learner_id = p.id and m.status = 'absent'),
    (select max(m.starts_at) from marks m where m.learner_id = p.id and m.status = 'absent')
  from identity.profiles p
  left join programmes.enrolments e on e.cohort_id = p_cohort_id and e.profile_id = p.id and e.status = 'active'
  where learning.may_read_cohort_attendance(auth.uid(), p_cohort_id)
    and (e.profile_id is not null or exists (select 1 from marks m where m.learner_id = p.id))
  order by
    case when (select count(*) from marks m where m.learner_id = p.id) = 0 then 2 else 1 end,
    (select (count(*) filter (where m.status = 'present'))::numeric / nullif(count(*), 0) from marks m where m.learner_id = p.id),
    p.full_name
$$;

-- F-12, C-15: the cohort's sessions that have started, latest first, each with its register's state and counts. A
-- cancelled session has no register and is left out.
create function api.list_cohort_registers(p_cohort_id uuid)
returns table (
  session_id uuid,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  mode text,
  venue text,
  state text,
  register_version integer,
  checkin_state text,
  confirmed_at timestamptz,
  confirmed_by_name text,
  audience integer,
  checked_in integer,
  present integer,
  absent integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.starts_at, s.duration_minutes, s.mode, s.venue, s.state, s.register_version,
    learning.checkin_state(s), s.register_captured_at, cap.full_name,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = s.cohort_id and e.status = 'active'),
    (select count(*)::integer from learning.attendance_checkins ci where ci.session_id = s.id),
    (select count(*)::integer from learning.attendance a where a.session_id = s.id and a.status = 'present'),
    (select count(*)::integer from learning.attendance a where a.session_id = s.id and a.status = 'absent')
  from learning.sessions s
  left join identity.profiles cap on cap.id = s.register_captured_by
  where s.cohort_id = p_cohort_id and s.state <> 'cancelled' and s.starts_at <= now()
    and learning.may_read_cohort_attendance(auth.uid(), s.cohort_id)
  order by s.starts_at desc, s.title
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.mark_my_attendance(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_sessions() from public, anon, authenticated, service_role;
revoke all on function api.list_my_sessions(timestamptz) from public, anon, authenticated, service_role;
revoke all on function api.list_my_attendance() from public, anon, authenticated, service_role;
revoke all on function api.get_cohort_attendance(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_cohort_registers(uuid) from public, anon, authenticated, service_role;

grant execute on function api.mark_my_attendance(uuid) to authenticated;
grant execute on function api.list_sessions() to authenticated;
grant execute on function api.list_my_sessions(timestamptz) to authenticated;
grant execute on function api.list_my_attendance() to authenticated;
grant execute on function api.get_cohort_attendance(uuid) to authenticated;
grant execute on function api.list_cohort_registers(uuid) to authenticated;
