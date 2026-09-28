-- Lodging an appeal online (S3-01; FR-601 to FR-604, FR-613; BR-05; screen L-16). Until now a learner was told to
-- contact their coordinator; from here the appeal is a record.
--
-- The rules, all checked in the lodge command under a lock on the result:
--   * Two kinds (FR-602): see my work with the marks ('view_script'), or ask for it to be marked again ('remark').
--     Grounds are required: at least 50 characters, at most 2000 (UX spec P0-08).
--   * In time (FR-601, FR-603): before the result's exclusive appeal deadline, which release set once from the
--     release time (P-11: the start of the eighth South African day). The deadline is compared after the result is
--     locked, and copied onto the appeal, so a later reading never has to recompute it (transaction test 8).
--   * One remark per result, ever (P-08, working decision; FR-613, CR-15): a remark that was admitted blocks every
--     later remark on that result, even inside the window. A full unique index holds the line. A remark that was not
--     accepted does not count. Asking to see the work does not use the remark and does not extend the window.
--   * One open appeal of each kind per result (a partial unique index), so a double click or a second tab cannot
--     lodge twice. A replay with the same client_appeal_id returns the appeal already lodged.
--   * An appeal decision is final (FR-613): a result whose current decision came from an appeal cannot be appealed.
--   * At most 10 appeals a day per learner (API design, "POST /api/appeals").
--
-- Lodging tells the learner (a receipt with the reference and the expected turnaround, FR-604) and every coordinator
-- of the cohort, in the same transaction (S2-10). Checking admissibility and allocating a reviewer are S3-02.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create sequence appeals.reference_seq;

create table appeals.appeals (
  id uuid primary key default gen_random_uuid(),
  -- "APL-2026-0031": the year it was lodged (SAST) and a number that is never reused.
  reference text not null unique,
  result_id uuid not null references assessment.results (id),
  learner_id uuid not null references identity.profiles (id),
  -- The decision being appealed: the result's current decision when the appeal was lodged.
  decision_id uuid not null references assessment.decisions (id),
  type text not null check (type in ('view_script', 'remark')),
  grounds text not null check (char_length(btrim(grounds)) between 50 and 2000),
  lodged_at timestamptz not null default now(),
  -- Copied from results.appeal_deadline_at at lodging.
  deadline_at timestamptz not null,
  state text not null default 'lodged'
    check (state in ('lodged', 'admitted', 'inadmissible', 'allocated', 'under_review', 'concluded')),
  -- Set once by the coordinator's check (S3-02). An admitted remark is the one remark this result will ever have.
  admissibility text check (admissibility in ('admitted', 'inadmissible')),
  admissibility_reason text,
  admissibility_decided_at timestamptz,
  admissibility_decided_by uuid references identity.profiles (id),
  client_appeal_id uuid not null,
  created_at timestamptz not null default now(),
  unique (learner_id, client_appeal_id),
  constraint lodged_in_time check (lodged_at < deadline_at),
  constraint admissibility_is_recorded check (
    (admissibility is null) = (admissibility_decided_at is null)
    and (admissibility is null) = (admissibility_decided_by is null)
  )
);

-- One open appeal of each kind per result.
create unique index appeals_one_open_per_type on appeals.appeals (result_id, type)
  where state not in ('inadmissible', 'concluded');

-- One admitted remark per result, ever (P-08, FR-613).
create unique index appeals_one_admitted_remark on appeals.appeals (result_id)
  where type = 'remark' and admissibility = 'admitted';

create index appeals_learner_idx on appeals.appeals (learner_id, lodged_at desc);
create index appeals_queue_idx on appeals.appeals (state, lodged_at);

-- Every step of an appeal, in order (FR-612), including logged script views later (FR-606). Append-only.
create table appeals.appeal_events (
  id bigint generated always as identity primary key,
  appeal_id uuid not null references appeals.appeals (id),
  event text not null check (event in ('lodged')),
  actor_id uuid references identity.profiles (id),
  at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create index appeal_events_appeal_idx on appeals.appeal_events (appeal_id, id);

revoke all on table appeals.appeals, appeals.appeal_events from public, anon, authenticated, service_role;
revoke all on sequence appeals.reference_seq from public, anon, authenticated, service_role;

create trigger appeal_events_append_only
  before update or delete on appeals.appeal_events
  for each row execute function audit.forbid_mutation();

create trigger appeal_events_append_only_truncate
  before truncate on appeals.appeal_events
  for each statement execute function audit.forbid_mutation();

-- ---------------------------------------------------------------------------------------------------------------
-- Notifications: the learner's receipt, and the coordinators' "new appeal"
-- ---------------------------------------------------------------------------------------------------------------

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice', 'appeal_received', 'appeal_lodged')
);

create or replace function notifications.category(p_event_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_event_type = 'result_released' then 'results'
    when p_event_type in ('task_published', 'task_reminder') then 'deadlines'
    when p_event_type like 'session\_%' then 'sessions'
    when p_event_type like 'appeal\_%' then 'appeals'
    else 'notices'
  end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------------------------

-- The reply learners are promised on their receipt (FR-604): a working-day promise, so it is labelled as one. A
-- template value until configuration is versioned (S3-09).
create function appeals.turnaround_working_days()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 5
$$;

-- The people who coordinate a cohort today: they check its appeals.
create function appeals.cohort_coordinators(p_cohort_id uuid)
returns table (profile_id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id, p.full_name
  from identity.role_assignments ra
  join identity.profiles p on p.id = ra.profile_id
  where ra.role = 'coordinator' and ra.effective @> now() and p.status = 'active'
    and programmes.can_coordinate(p.id, p_cohort_id)
$$;

-- Where a result's remark stands for one learner: 'open' (lodged and not yet closed), 'used' (a remark was admitted),
-- or 'available'. With the appeal that decides it.
create function appeals.remark_standing(p_result_id uuid)
returns table (standing text, appeal_id uuid, reference text, lodged_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  -- An admitted remark still under review is both; "open" wins, so the learner is pointed at the live appeal.
  select s.standing, s.appeal_id, s.reference, s.lodged_at from (
    select 1 as rank, 'open'::text as standing, a.id as appeal_id, a.reference, a.lodged_at from appeals.appeals a
    where a.result_id = p_result_id and a.type = 'remark' and a.state not in ('inadmissible', 'concluded')
    union all
    select 2, 'used', a.id, a.reference, a.lodged_at from appeals.appeals a
    where a.result_id = p_result_id and a.type = 'remark' and a.admissibility = 'admitted'
  ) s
  order by s.rank
  limit 1
$$;

revoke all on function appeals.turnaround_working_days() from public, anon, authenticated, service_role;
revoke all on function appeals.cohort_coordinators(uuid) from public, anon, authenticated, service_role;
revoke all on function appeals.remark_standing(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Command: lodge
-- ---------------------------------------------------------------------------------------------------------------

-- Refusals: unauthenticated, not_found (not this learner's result), not_released, window_closed, decision_final,
-- invalid_type, grounds_required, grounds_too_short, grounds_too_long, already_open (appeal_id and reference name
-- the open one), remark_used (the admitted remark), rate_limited.
create function api.lodge_appeal(p_result_id uuid, p_type text, p_grounds text, p_client_appeal_id uuid)
returns table (status text, appeal_id uuid, reference text, lodged_at timestamptz, deadline_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result assessment.results;
  v_decision_type text;
  v_grounds text := btrim(coalesce(p_grounds, ''));
  v_existing appeals.appeals;
  v_appeal appeals.appeals;
  v_item text;
  v_cohort_id uuid;
  v_cohort_name text;
  v_learner_name text;
  v_coordinator uuid;
begin
  if v_actor is null then
    return query select 'unauthenticated'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  -- A replay (a retry after a lost response) returns the appeal already lodged, whatever the clock says now.
  select * into v_existing from appeals.appeals a where a.learner_id = v_actor and a.client_appeal_id = p_client_appeal_id;
  if found then
    return query select 'ok'::text, v_existing.id, v_existing.reference, v_existing.lodged_at, v_existing.deadline_at;
    return;
  end if;

  if p_type is null or p_type not in ('view_script', 'remark') then
    return query select 'invalid_type'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  -- Lock the result, then compare the clock with its deadline (API design, "POST /api/appeals").
  select * into v_result from assessment.results r where r.id = p_result_id and r.learner_id = v_actor for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  if v_result.state <> 'released' then
    return query select 'not_released'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  if now() >= v_result.appeal_deadline_at then
    return query select 'window_closed'::text, null::uuid, null::text, null::timestamptz, v_result.appeal_deadline_at;
    return;
  end if;

  select d.type into v_decision_type from assessment.decisions d where d.id = v_result.current_decision_id;
  if v_decision_type = 'appeal' then
    return query select 'decision_final'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  if v_grounds = '' then
    return query select 'grounds_required'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  if char_length(v_grounds) < 50 then
    return query select 'grounds_too_short'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  if char_length(v_grounds) > 2000 then
    return query select 'grounds_too_long'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  select * into v_existing from appeals.appeals a
  where a.result_id = v_result.id and a.type = p_type and a.state not in ('inadmissible', 'concluded');
  if found then
    return query select 'already_open'::text, v_existing.id, v_existing.reference, v_existing.lodged_at,
      v_existing.deadline_at;
    return;
  end if;
  if p_type = 'remark' then
    select * into v_existing from appeals.appeals a
    where a.result_id = v_result.id and a.type = 'remark' and a.admissibility = 'admitted';
    if found then
      return query select 'remark_used'::text, v_existing.id, v_existing.reference, v_existing.lodged_at,
        v_existing.deadline_at;
      return;
    end if;
  end if;

  if (select count(*) from appeals.appeals a where a.learner_id = v_actor and a.lodged_at > now() - interval '1 day') >= 10 then
    return query select 'rate_limited'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  insert into appeals.appeals (reference, result_id, learner_id, decision_id, type, grounds, deadline_at, client_appeal_id)
  values (
    format('APL-%s-%s', to_char(now() at time zone 'Africa/Johannesburg', 'YYYY'),
           lpad(nextval('appeals.reference_seq')::text, 4, '0')),
    v_result.id, v_actor, v_result.current_decision_id, p_type, v_grounds, v_result.appeal_deadline_at,
    p_client_appeal_id)
  returning * into v_appeal;

  insert into appeals.appeal_events (appeal_id, event, actor_id, details)
  values (v_appeal.id, 'lodged', v_actor, jsonb_build_object('type', p_type));

  select ai.title, ai.cohort_id, c.name into v_item, v_cohort_id, v_cohort_name
  from assessment.assessable_items ai join programmes.cohorts c on c.id = ai.cohort_id
  where ai.id = v_result.assessable_item_id;
  select p.full_name into v_learner_name from identity.profiles p where p.id = v_actor;

  perform audit.append('appeals.appeal_lodged', 'appeal', v_appeal.id::text, '{}'::jsonb, 'learner', null,
    jsonb_build_object('reference', v_appeal.reference, 'result_id', v_result.id, 'type', p_type,
                       'decision_id', v_appeal.decision_id, 'deadline_at', v_appeal.deadline_at),
    'cohort', v_cohort_id);

  -- The learner's receipt (FR-604), and every coordinator of the cohort.
  perform notifications.enqueue('appeal_received', 'appeal_received:' || v_appeal.id::text, v_actor,
    jsonb_build_object('appeal_id', v_appeal.id, 'reference', v_appeal.reference, 'item_title', v_item,
                       'type', p_type, 'lodged_at', v_appeal.lodged_at, 'deadline_at', v_appeal.deadline_at,
                       'turnaround_working_days', appeals.turnaround_working_days()),
    '/learn/appeals/' || v_appeal.id::text);
  for v_coordinator in
    select cc.profile_id from appeals.cohort_coordinators(v_cohort_id) cc where cc.profile_id <> v_actor
  loop
    perform notifications.enqueue('appeal_lodged', 'appeal_lodged:' || v_appeal.id::text, v_coordinator,
      jsonb_build_object('appeal_id', v_appeal.id, 'reference', v_appeal.reference, 'item_title', v_item,
                         'cohort_name', v_cohort_name, 'type', p_type, 'learner_name', v_learner_name,
                         'lodged_at', v_appeal.lodged_at),
      '/coordinate/appeals/' || v_appeal.id::text);
  end loop;

  return query select 'ok'::text, v_appeal.id, v_appeal.reference, v_appeal.lodged_at, v_appeal.deadline_at;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads (learner)
-- ---------------------------------------------------------------------------------------------------------------

-- Everything the lodge page needs about one of the learner's released results: the result in one line, the window,
-- and which kinds of appeal are still open to them. No row for a held result or anyone else's.
create function api.get_appeal_options(p_result_id uuid)
returns table (
  result_id uuid,
  item_title text,
  cohort_name text,
  outcome text,
  -- Null when the rubric carries no points.
  points_scored integer,
  points_possible integer,
  released_at timestamptz,
  appeal_deadline_at timestamptz,
  remediation_deadline_at timestamptz,
  assessed_version_number integer,
  -- The current decision came from an appeal: it is final (FR-613).
  decision_final boolean,
  remark_standing text,
  remark_appeal_id uuid,
  remark_reference text,
  remark_lodged_at timestamptz,
  open_script_appeal_id uuid,
  open_script_reference text,
  learner_name text,
  learner_number text,
  coordinator_names text[],
  turnaround_working_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, ai.title, c.name, d.outcome,
    pts.scored, pts.possible,
    r.released_at, r.appeal_deadline_at,
    case when d.outcome = 'not_yet_competent' then r.remediation_deadline_at end,
    (select v.version_number from assessment.assessment_instances i
     join submissions.submission_versions v on v.id = i.submission_version_id where i.id = d.instance_id),
    d.type = 'appeal',
    coalesce(rs.standing, 'available'), rs.appeal_id, rs.reference, rs.lodged_at,
    sa.id, sa.reference,
    lp.full_name, lp.learner_number,
    coalesce((select array_agg(cc.full_name order by cc.full_name) from appeals.cohort_coordinators(c.id) cc
              where cc.profile_id <> r.learner_id), '{}'),
    appeals.turnaround_working_days()
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join assessment.decisions d on d.id = r.current_decision_id
  join identity.profiles lp on lp.id = r.learner_id
  left join lateral (
    select sum(coalesce((sc.score ->> 'points')::integer, 0))::integer as scored, sum(tc.points)::integer as possible
    from submissions.task_criteria tc
    left join lateral (
      select e as score from jsonb_array_elements(coalesce(d.scores, '[]'::jsonb)) e
      where (e ->> 'ordinal')::integer = tc.ordinal
      limit 1
    ) sc on true
    where tc.task_id = ai.task_id and tc.points is not null
    having count(*) > 0
  ) pts on true
  left join lateral (select * from appeals.remark_standing(r.id)) rs on true
  left join lateral (
    select a.id, a.reference from appeals.appeals a
    where a.result_id = r.id and a.type = 'view_script' and a.state not in ('inadmissible', 'concluded')
  ) sa on true
  where r.id = p_result_id and r.learner_id = auth.uid() and r.state = 'released'
$$;

-- The learner's appeals, newest first (L-17).
create function api.list_my_appeals()
returns table (
  id uuid,
  reference text,
  result_id uuid,
  item_title text,
  type text,
  state text,
  lodged_at timestamptz,
  deadline_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.reference, a.result_id, ai.title, a.type, a.state, a.lodged_at, a.deadline_at
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where a.learner_id = auth.uid()
  order by a.lodged_at desc
$$;

-- One of the learner's appeals: the receipt (FR-604) and its steps so far (FR-612).
create function api.get_my_appeal(p_appeal_id uuid)
returns table (
  id uuid,
  reference text,
  result_id uuid,
  item_title text,
  cohort_name text,
  type text,
  grounds text,
  state text,
  lodged_at timestamptz,
  deadline_at timestamptz,
  -- The outcome being appealed, and the result's resubmission deadline, which an appeal does not move.
  appealed_outcome text,
  points_scored integer,
  points_possible integer,
  remediation_deadline_at timestamptz,
  learner_name text,
  learner_number text,
  coordinator_names text[],
  turnaround_working_days integer,
  events jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.reference, a.result_id, ai.title, c.name, a.type, a.grounds, a.state, a.lodged_at, a.deadline_at,
    d.outcome, pts.scored, pts.possible,
    case when cd.outcome = 'not_yet_competent' then r.remediation_deadline_at end,
    lp.full_name, lp.learner_number,
    coalesce((select array_agg(cc.full_name order by cc.full_name) from appeals.cohort_coordinators(c.id) cc
              where cc.profile_id <> a.learner_id), '{}'),
    appeals.turnaround_working_days(),
    coalesce((select jsonb_agg(jsonb_build_object('event', e.event, 'at', e.at) order by e.id)
              from appeals.appeal_events e where e.appeal_id = a.id), '[]'::jsonb)
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join assessment.decisions d on d.id = a.decision_id
  join assessment.decisions cd on cd.id = r.current_decision_id
  join identity.profiles lp on lp.id = a.learner_id
  left join lateral (
    select sum(coalesce((sc.score ->> 'points')::integer, 0))::integer as scored, sum(tc.points)::integer as possible
    from submissions.task_criteria tc
    left join lateral (
      select e as score from jsonb_array_elements(coalesce(d.scores, '[]'::jsonb)) e
      where (e ->> 'ordinal')::integer = tc.ordinal
      limit 1
    ) sc on true
    where tc.task_id = ai.task_id and tc.points is not null
    having count(*) > 0
  ) pts on true
  where a.id = p_appeal_id and a.learner_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads (coordinators): appeals in the cohorts they coordinate (C-12)
-- ---------------------------------------------------------------------------------------------------------------

create function api.list_appeals_to_coordinate()
returns table (
  id uuid,
  reference text,
  learner_name text,
  learner_number text,
  item_title text,
  cohort_name text,
  type text,
  state text,
  lodged_at timestamptz,
  deadline_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.reference, lp.full_name, lp.learner_number, ai.title, c.name, a.type, a.state, a.lodged_at,
    a.deadline_at
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join identity.profiles lp on lp.id = a.learner_id
  where programmes.can_coordinate(auth.uid(), c.id)
  order by a.state in ('inadmissible', 'concluded'), a.lodged_at
$$;

create function api.get_appeal_to_coordinate(p_appeal_id uuid)
returns table (
  id uuid,
  reference text,
  result_id uuid,
  learner_name text,
  learner_number text,
  item_title text,
  cohort_name text,
  type text,
  grounds text,
  state text,
  lodged_at timestamptz,
  deadline_at timestamptz,
  appealed_outcome text,
  points_scored integer,
  points_possible integer,
  assessor_name text,
  released_at timestamptz,
  turnaround_working_days integer,
  events jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.reference, a.result_id, lp.full_name, lp.learner_number, ai.title, c.name, a.type, a.grounds,
    a.state, a.lodged_at, a.deadline_at, d.outcome, pts.scored, pts.possible, ap.full_name, r.released_at,
    appeals.turnaround_working_days(),
    coalesce((select jsonb_agg(jsonb_build_object('event', e.event, 'at', e.at, 'actor_name', ep.full_name)
                               order by e.id)
              from appeals.appeal_events e left join identity.profiles ep on ep.id = e.actor_id
              where e.appeal_id = a.id), '[]'::jsonb)
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join assessment.decisions d on d.id = a.decision_id
  join identity.profiles lp on lp.id = a.learner_id
  left join identity.profiles ap on ap.id = d.actor_id
  left join lateral (
    select sum(coalesce((sc.score ->> 'points')::integer, 0))::integer as scored, sum(tc.points)::integer as possible
    from submissions.task_criteria tc
    left join lateral (
      select e as score from jsonb_array_elements(coalesce(d.scores, '[]'::jsonb)) e
      where (e ->> 'ordinal')::integer = tc.ordinal
      limit 1
    ) sc on true
    where tc.task_id = ai.task_id and tc.points is not null
    having count(*) > 0
  ) pts on true
  where a.id = p_appeal_id and programmes.can_coordinate(auth.uid(), c.id)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.lodge_appeal(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function api.get_appeal_options(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_appeals() from public, anon, authenticated, service_role;
revoke all on function api.get_my_appeal(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_appeals_to_coordinate() from public, anon, authenticated, service_role;
revoke all on function api.get_appeal_to_coordinate(uuid) from public, anon, authenticated, service_role;

grant execute on function api.lodge_appeal(uuid, text, text, uuid) to authenticated;
grant execute on function api.get_appeal_options(uuid) to authenticated;
grant execute on function api.list_my_appeals() to authenticated;
grant execute on function api.get_my_appeal(uuid) to authenticated;
grant execute on function api.list_appeals_to_coordinate() to authenticated;
grant execute on function api.get_appeal_to_coordinate(uuid) to authenticated;
