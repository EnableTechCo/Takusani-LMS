-- Learner appeal tracking (S3-05; FR-612, FR-613; screen L-17). The learner follows each step of their appeal, with
-- its date, and once it is concluded reads how it was decided, the new outcome and total, and the reviewer's reasons
-- word for word. The reviewer is described, never named: "a reviewer who did not mark your work" (UX Q7). There is no
-- way to appeal the outcome (FR-613). For a "not yet competent" outcome the learner also reads what to do and until
-- when (P-09, confirmed 28 September 2026).

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
  events jsonb,
  -- Once concluded (FR-612): how, the new outcome and total, the reviewer's reasons, and for "not yet competent" what
  -- to do and until when. The reviewer is never named (UX Q7).
  outcome_category text,
  concluded_at timestamptz,
  decided_outcome text,
  decided_points integer,
  reasons text,
  decided_remediation text,
  decided_remediation_deadline_at timestamptz
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
              where e.appeal_id = a.id
                and e.event in ('lodged', 'admitted', 'inadmissible', 'allocated', 'reallocated', 'review_opened',
                                'concluded')),
             '[]'::jsonb),
    a.outcome_category, a.concluded_at, n.outcome, appeals.decision_total(ai.task_id, n.scores), n.justification,
    case when n.outcome = 'not_yet_competent' then n.remediation end,
    case when n.outcome = 'not_yet_competent' and r.current_decision_id = n.id then r.remediation_deadline_at end
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join assessment.decisions d on d.id = a.decision_id
  join assessment.decisions cd on cd.id = r.current_decision_id
  join identity.profiles lp on lp.id = a.learner_id
  left join assessment.decisions n on n.id = a.conclusion_decision_id
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

revoke all on function api.get_my_appeal(uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_my_appeal(uuid) to authenticated;

drop function api.list_my_appeals();
create function api.list_my_appeals()
returns table (
  id uuid,
  reference text,
  result_id uuid,
  item_title text,
  type text,
  state text,
  lodged_at timestamptz,
  deadline_at timestamptz,
  outcome_category text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.reference, a.result_id, ai.title, a.type, a.state, a.lodged_at, a.deadline_at, a.outcome_category
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where a.learner_id = auth.uid()
  order by a.lodged_at desc
$$;

revoke all on function api.list_my_appeals() from public, anon, authenticated, service_role;
grant execute on function api.list_my_appeals() to authenticated;
