-- Appeals administration (S3-02; FR-605, FR-608; BR-02; AS-02; screen C-12). The coordinator checks each lodged appeal
-- and, for a re-mark, chooses a reviewer who took no assessment decision on the work.
--
-- Admissibility (FR-605): a coordinator of the cohort admits the appeal or records it as inadmissible with a reason the
-- learner reads word for word. Either way the learner is told, and the decision is made once. For a request to see
-- the marked work, admitting it grants the view (FR-606; the view itself is S3-03). Admitting a re-mark uses the one
-- re-mark this result will ever have (P-08).
--
-- Reviewer candidates (FR-608, AS-02, P-10 working decision), in this order:
--   1. independent qualified internal reviewers: people holding the assessor role for this cohort (globally, or for
--      its programme, the cohort itself, or the unit the task counts towards);
--   2. the cohort moderator: people holding the moderator role for this cohort;
--   3. qualified assessors from other cohorts: the assessor role elsewhere. They are allocated to this appeal only;
--      the allocation, not a role, is what lets them open it.
-- Everyone who took an assessment decision on the result is excluded at every tier (BR-02, CR-16), computed from the
-- decisions, never from a pointer; they are listed with the decisions that exclude them, so the coordinator sees why.
-- Choosing from a later tier while an earlier one has someone available needs a reason (UX flow F, D2).
--
-- Allocating locks the result, then the appeal, and checks the conflict again inside the transaction. A conflicting
-- request is refused with `separation_of_duties_conflict` and the decisions that cause it; the refusal is recorded
-- on the appeal's record. The same command reallocates.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

alter table appeals.appeals
  add column reviewer_id uuid references identity.profiles (id),
  add column reviewer_tier smallint check (reviewer_tier between 1 and 3),
  add column allocated_at timestamptz,
  add column allocated_by uuid references identity.profiles (id),
  add constraint reviewer_is_recorded check (
    (reviewer_id is null) = (reviewer_tier is null)
    and (reviewer_id is null) = (allocated_at is null)
    and (reviewer_id is null) = (allocated_by is null)
  ),
  add constraint reviewer_only_for_remark check (reviewer_id is null or type = 'remark'),
  add constraint allocated_has_reviewer check (state not in ('allocated', 'under_review') or reviewer_id is not null),
  add constraint inadmissible_has_reason check (
    admissibility is distinct from 'inadmissible' or char_length(btrim(coalesce(admissibility_reason, ''))) between 1 and 1000
  );

create index appeals_reviewer_idx on appeals.appeals (reviewer_id) where reviewer_id is not null;

alter table appeals.appeal_events drop constraint appeal_events_event_check;
alter table appeals.appeal_events add constraint appeal_events_event_check check (
  event in ('lodged', 'admitted', 'inadmissible', 'allocated', 'reallocated', 'allocation_refused')
);

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------------------------

-- The appeal with what the rules need: its cohort, programme, and the unit its task counts towards.
create function appeals.appeal_context(p_appeal_id uuid)
returns table (appeal_id uuid, result_id uuid, learner_id uuid, cohort_id uuid, programme_id uuid, unit_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select ap.id, ap.result_id, ap.learner_id, ai.cohort_id, c.programme_id, m.unit_id
  from appeals.appeals ap
  join assessment.results r on r.id = ap.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  left join submissions.tasks t on t.id = ai.task_id
  left join programmes.modules m on m.id = t.module_id
  where ap.id = p_appeal_id
$$;

-- Every assessment-type decision on a result, by person (CR-16): who may never review an appeal against it.
create function appeals.assessment_actors(p_result_id uuid)
returns table (profile_id uuid, decisions jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select d.actor_id,
    jsonb_agg(jsonb_build_object('decision_id', d.id, 'decided_at', d.created_at, 'outcome', d.outcome,
                                 'version_number', v.version_number, 'role', 'assessor')
              order by d.created_at)
  from assessment.decisions d
  left join assessment.assessment_instances i on i.id = d.instance_id
  left join submissions.submission_versions v on v.id = i.submission_version_id
  where d.result_id = p_result_id and d.type = 'assessment'
  group by d.actor_id
$$;

-- The reviewer list for one appeal (AS-02): each person's tier, or, for someone excluded, the decisions that exclude
-- them (tier null). Active accounts only; never the learner.
create function appeals.reviewer_candidates(p_appeal_id uuid)
returns table (
  profile_id uuid,
  full_name text,
  tier smallint,
  role_label text,
  open_reviews integer,
  excluded_by jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with ctx as (select * from appeals.appeal_context(p_appeal_id)),
  held as (
    select ra.profile_id, ra.role, ra.scope_type, ra.scope_key,
      ra.scope_type = 'global'
        or (ra.scope_type = 'programme' and ra.scope_key = ctx.programme_id)
        or (ra.scope_type = 'cohort' and ra.scope_key = ctx.cohort_id)
        or (ra.scope_type = 'unit' and ra.scope_key = ctx.unit_id) as covers
    from ctx
    join identity.role_assignments ra on ra.role in ('assessor', 'moderator') and ra.effective @> now()
    join identity.profiles p on p.id = ra.profile_id and p.status = 'active'
    where ra.profile_id <> ctx.learner_id
  ),
  ranked as (
    select h.profile_id,
      min(case when h.role = 'assessor' and h.covers then 1
               when h.role = 'moderator' and h.covers then 2
               when h.role = 'assessor' then 3 end)::smallint as tier,
      string_agg(distinct initcap(h.role) || ', ' || case h.scope_type
          when 'global' then 'all programmes'
          when 'programme' then coalesce((select pr.title from programmes.programmes pr where pr.id = h.scope_key), 'a programme')
          when 'cohort' then coalesce((select c.name from programmes.cohorts c where c.id = h.scope_key), 'a cohort')
          else coalesce((select u.title from programmes.units u where u.id = h.scope_key), 'a unit')
        end, '; ') as role_label
    from held h
    group by h.profile_id
  ),
  excluded as (select x.* from ctx cross join lateral appeals.assessment_actors(ctx.result_id) x)
  select p.id, p.full_name,
    case when e.profile_id is null then rk.tier end,
    rk.role_label,
    (select count(*)::integer from appeals.appeals x where x.reviewer_id = p.id and x.state in ('allocated', 'under_review')),
    e.decisions
  from (select r.profile_id from ranked r where r.tier is not null union select e2.profile_id from excluded e2) people
  join identity.profiles p on p.id = people.profile_id
  left join ranked rk on rk.profile_id = p.id
  left join excluded e on e.profile_id = p.id
$$;

revoke all on function appeals.appeal_context(uuid) from public, anon, authenticated, service_role;
revoke all on function appeals.assessment_actors(uuid) from public, anon, authenticated, service_role;
revoke all on function appeals.reviewer_candidates(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------------------------

-- Refusals: unauthenticated, not_found (not an appeal this coordinator runs), already_decided, reason_required,
-- reason_too_long, remark_used.
create function api.decide_appeal_admissibility(p_appeal_id uuid, p_admit boolean, p_reason text default null)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ctx record;
  v_appeal appeals.appeals;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_item text;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_ctx from appeals.appeal_context(p_appeal_id);
  if not found or not programmes.can_coordinate(v_actor, v_ctx.cohort_id) then
    return query select 'not_found'::text; return;
  end if;
  select * into v_appeal from appeals.appeals a where a.id = p_appeal_id for update;
  if v_appeal.state <> 'lodged' then return query select 'already_decided'::text; return; end if;

  if p_admit is not true then
    if v_reason is null then return query select 'reason_required'::text; return; end if;
    if char_length(v_reason) > 1000 then return query select 'reason_too_long'::text; return; end if;
  elsif v_appeal.type = 'remark' and exists (
    select 1 from appeals.appeals a
    where a.result_id = v_appeal.result_id and a.type = 'remark' and a.admissibility = 'admitted'
  ) then
    return query select 'remark_used'::text; return;
  end if;

  update appeals.appeals a
  set admissibility = case when p_admit then 'admitted' else 'inadmissible' end,
      admissibility_reason = case when p_admit then null else v_reason end,
      admissibility_decided_at = now(),
      admissibility_decided_by = v_actor,
      state = case when p_admit then 'admitted' else 'inadmissible' end
  where a.id = p_appeal_id
  returning * into v_appeal;

  insert into appeals.appeal_events (appeal_id, event, actor_id, details)
  values (v_appeal.id, v_appeal.admissibility, v_actor,
          case when p_admit then '{}'::jsonb else jsonb_build_object('reason', v_reason) end);

  perform audit.append('appeals.admissibility_decided', 'appeal', v_appeal.id::text, '{}'::jsonb, 'coordinator',
    jsonb_build_object('state', 'lodged'),
    jsonb_build_object('state', v_appeal.state, 'admissibility', v_appeal.admissibility),
    'cohort', v_ctx.cohort_id);

  select ai.title into v_item from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id where r.id = v_appeal.result_id;
  perform notifications.enqueue(
    case when p_admit then 'appeal_admitted' else 'appeal_inadmissible' end,
    'appeal_admissibility:' || v_appeal.id::text,
    v_appeal.learner_id,
    jsonb_build_object('appeal_id', v_appeal.id, 'reference', v_appeal.reference, 'item_title', v_item,
                       'type', v_appeal.type, 'reason', v_reason,
                       'turnaround_working_days', appeals.turnaround_working_days()),
    '/learn/appeals/' || v_appeal.id::text);

  return query select 'ok'::text;
end
$$;

-- Refusals: unauthenticated, not_found, not_a_remark, not_admitted, closed, separation_of_duties_conflict (conflicts
-- names each decision), not_eligible (holds no qualifying role), already_allocated, skip_reason_required.
create function api.allocate_appeal_reviewer(p_appeal_id uuid, p_reviewer_id uuid, p_skip_reason text default null)
returns table (status text, conflicts jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ctx record;
  v_appeal appeals.appeals;
  v_conflicts jsonb;
  v_tier smallint;
  v_best smallint;
  v_skip text := nullif(btrim(coalesce(p_skip_reason, '')), '');
  v_previous uuid;
  v_event bigint;
  v_item text;
  v_cohort_name text;
  v_learner_name text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::jsonb; return; end if;
  select * into v_ctx from appeals.appeal_context(p_appeal_id);
  if not found or not programmes.can_coordinate(v_actor, v_ctx.cohort_id) then
    return query select 'not_found'::text, null::jsonb; return;
  end if;

  -- Lock order: the result, then the appeal (API design, allocation commands).
  perform 1 from assessment.results r where r.id = v_ctx.result_id for update;
  select * into v_appeal from appeals.appeals a where a.id = p_appeal_id for update;
  if v_appeal.type <> 'remark' then return query select 'not_a_remark'::text, null::jsonb; return; end if;
  if v_appeal.state = 'lodged' then return query select 'not_admitted'::text, null::jsonb; return; end if;
  if v_appeal.state in ('inadmissible', 'concluded') then return query select 'closed'::text, null::jsonb; return; end if;

  -- BR-02, checked now, under the lock: anyone who took an assessment decision on the result.
  select x.decisions into v_conflicts from appeals.assessment_actors(v_ctx.result_id) x where x.profile_id = p_reviewer_id;
  if v_conflicts is not null then
    insert into appeals.appeal_events (appeal_id, event, actor_id, details)
    values (v_appeal.id, 'allocation_refused', v_actor,
            jsonb_build_object('reviewer_id', p_reviewer_id, 'conflicts', v_conflicts));
    perform audit.append('appeals.reviewer_allocation_refused', 'appeal', v_appeal.id::text,
      jsonb_build_object('reason', 'separation_of_duties_conflict'), 'coordinator', null,
      jsonb_build_object('reviewer_id', p_reviewer_id, 'conflicts', v_conflicts), 'cohort', v_ctx.cohort_id);
    return query select 'separation_of_duties_conflict'::text, v_conflicts;
    return;
  end if;

  select c.tier into v_tier from appeals.reviewer_candidates(p_appeal_id) c where c.profile_id = p_reviewer_id;
  if v_tier is null then return query select 'not_eligible'::text, null::jsonb; return; end if;
  if v_appeal.reviewer_id = p_reviewer_id then return query select 'already_allocated'::text, null::jsonb; return; end if;

  select min(c.tier) into v_best from appeals.reviewer_candidates(p_appeal_id) c
  where c.tier is not null and c.profile_id is distinct from v_appeal.reviewer_id;
  if v_tier > v_best and v_skip is null then
    return query select 'skip_reason_required'::text, null::jsonb; return;
  end if;

  v_previous := v_appeal.reviewer_id;
  update appeals.appeals a
  set reviewer_id = p_reviewer_id, reviewer_tier = v_tier, allocated_at = now(), allocated_by = v_actor,
      state = 'allocated'
  where a.id = p_appeal_id
  returning * into v_appeal;

  insert into appeals.appeal_events (appeal_id, event, actor_id, details)
  values (v_appeal.id, case when v_previous is null then 'allocated' else 'reallocated' end, v_actor,
          jsonb_strip_nulls(jsonb_build_object('reviewer_id', p_reviewer_id, 'tier', v_tier,
                                               'previous_reviewer_id', v_previous, 'skip_reason', v_skip)))
  returning id into v_event;

  perform audit.append('appeals.reviewer_allocated', 'appeal', v_appeal.id::text, '{}'::jsonb, 'coordinator',
    jsonb_build_object('reviewer_id', v_previous),
    jsonb_strip_nulls(jsonb_build_object('reviewer_id', p_reviewer_id, 'tier', v_tier, 'skip_reason', v_skip)),
    'cohort', v_ctx.cohort_id);

  select ai.title, c.name into v_item, v_cohort_name from assessment.assessable_items ai
  join assessment.results r on r.assessable_item_id = ai.id join programmes.cohorts c on c.id = ai.cohort_id
  where r.id = v_appeal.result_id;
  select p.full_name into v_learner_name from identity.profiles p where p.id = v_appeal.learner_id;
  perform notifications.enqueue('appeal_review_allocated', 'appeal_review_allocated:' || v_event::text,
    p_reviewer_id,
    jsonb_build_object('appeal_id', v_appeal.id, 'reference', v_appeal.reference, 'item_title', v_item,
                       'cohort_name', v_cohort_name, 'learner_name', v_learner_name),
    '/review/appeals/' || v_appeal.id::text);

  return query select 'ok'::text, null::jsonb;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------------------------

-- The reviewer list for a coordinator of the appeal's cohort, in AS-02 order; the excluded come last.
create function api.list_appeal_reviewer_candidates(p_appeal_id uuid)
returns table (
  profile_id uuid,
  full_name text,
  tier smallint,
  role_label text,
  open_reviews integer,
  excluded_by jsonb,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.profile_id, c.full_name, c.tier, c.role_label, c.open_reviews, c.excluded_by,
    c.profile_id = (select a.reviewer_id from appeals.appeals a where a.id = p_appeal_id)
  from appeals.reviewer_candidates(p_appeal_id) c
  where programmes.can_coordinate(auth.uid(), (select x.cohort_id from appeals.appeal_context(p_appeal_id) x))
  order by c.tier nulls last, c.open_reviews, c.full_name
$$;

drop function api.list_appeals_to_coordinate();
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
  deadline_at timestamptz,
  reviewer_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.reference, lp.full_name, lp.learner_number, ai.title, c.name, a.type, a.state, a.lodged_at,
    a.deadline_at, rp.full_name
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join identity.profiles lp on lp.id = a.learner_id
  left join identity.profiles rp on rp.id = a.reviewer_id
  where programmes.can_coordinate(auth.uid(), c.id)
  order by a.state in ('inadmissible', 'concluded'), a.lodged_at
$$;

drop function api.get_appeal_to_coordinate(uuid);
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
  admissibility text,
  admissibility_reason text,
  admissibility_decided_at timestamptz,
  admissibility_decided_by_name text,
  reviewer_id uuid,
  reviewer_name text,
  reviewer_tier smallint,
  allocated_at timestamptz,
  -- Every decision on the result, oldest first, so the coordinator sees who assessed it (BR-02).
  decisions jsonb,
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
    a.admissibility, a.admissibility_reason, a.admissibility_decided_at, dp.full_name,
    a.reviewer_id, rp.full_name, a.reviewer_tier, a.allocated_at,
    coalesce((select jsonb_agg(jsonb_build_object(
                'decision_id', x.id, 'type', x.type, 'outcome', x.outcome, 'decided_at', x.created_at,
                'actor_name', xp.full_name, 'version_number', v.version_number,
                'current', x.id = r.current_decision_id, 'appealed', x.id = a.decision_id) order by x.created_at)
              from assessment.decisions x
              left join identity.profiles xp on xp.id = x.actor_id
              left join assessment.assessment_instances i on i.id = x.instance_id
              left join submissions.submission_versions v on v.id = i.submission_version_id
              where x.result_id = r.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
                'event', e.event, 'at', e.at, 'actor_name', ep.full_name, 'reason', e.details ->> 'reason',
                'reviewer_name', (select p.full_name from identity.profiles p where p.id = (e.details ->> 'reviewer_id')::uuid),
                'tier', e.details -> 'tier', 'skip_reason', e.details ->> 'skip_reason',
                'conflicts', e.details -> 'conflicts') order by e.id)
              from appeals.appeal_events e left join identity.profiles ep on ep.id = e.actor_id
              where e.appeal_id = a.id), '[]'::jsonb)
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join assessment.decisions d on d.id = a.decision_id
  join identity.profiles lp on lp.id = a.learner_id
  left join identity.profiles ap on ap.id = d.actor_id
  left join identity.profiles dp on dp.id = a.admissibility_decided_by
  left join identity.profiles rp on rp.id = a.reviewer_id
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

-- The learner reads why an appeal was not accepted, word for word (FR-605), and when each step happened. The
-- reviewer is never named to the learner (UX Q7).
drop function api.get_my_appeal(uuid);
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
  appealed_outcome text,
  points_scored integer,
  points_possible integer,
  remediation_deadline_at timestamptz,
  learner_name text,
  learner_number text,
  coordinator_names text[],
  turnaround_working_days integer,
  admissibility_reason text,
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
    case when a.admissibility = 'inadmissible' then a.admissibility_reason end,
    -- Only the steps a learner follows; a refused allocation is staff business.
    coalesce((select jsonb_agg(jsonb_build_object('event', e.event, 'at', e.at) order by e.id)
              from appeals.appeal_events e
              where e.appeal_id = a.id and e.event in ('lodged', 'admitted', 'inadmissible', 'allocated', 'reallocated')),
             '[]'::jsonb)
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

-- Navigation: the Appeal reviews workspace appears for anyone with a current or past reviewer allocation (BR-02,
-- AS-02: allocation-based, not a role).
create or replace function api.my_access()
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
    p.status = 'active' and exists (select 1 from appeals.appeals a where a.reviewer_id = p.id)
  from identity.profiles p
  join auth.users u on u.id = p.id
  where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.decide_appeal_admissibility(uuid, boolean, text) from public, anon, authenticated, service_role;
revoke all on function api.allocate_appeal_reviewer(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function api.list_appeal_reviewer_candidates(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_appeals_to_coordinate() from public, anon, authenticated, service_role;
revoke all on function api.get_appeal_to_coordinate(uuid) from public, anon, authenticated, service_role;
revoke all on function api.get_my_appeal(uuid) from public, anon, authenticated, service_role;

grant execute on function api.decide_appeal_admissibility(uuid, boolean, text) to authenticated;
grant execute on function api.allocate_appeal_reviewer(uuid, uuid, text) to authenticated;
grant execute on function api.list_appeal_reviewer_candidates(uuid) to authenticated;
grant execute on function api.list_appeals_to_coordinate() to authenticated;
grant execute on function api.get_appeal_to_coordinate(uuid) to authenticated;
grant execute on function api.get_my_appeal(uuid) to authenticated;
