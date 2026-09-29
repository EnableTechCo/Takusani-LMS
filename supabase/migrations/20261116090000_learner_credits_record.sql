-- The learner's credits record (S6-02; L-19, P0-09; FR-318, FR-801 to FR-804; P-07).
--
-- Two reads for the signed-in learner, both from the credits module built in S6-01:
--   * api.get_my_credits(): every unit of each programme the learner is enrolled in (their latest active or archived
--     cohort of it), with the credits earned from the ledger, whether and when the unit was awarded, and the
--     assessments that count: for an earned unit, those of the version it was awarded under; otherwise those of the
--     cohort's version in force.
--   * api.list_my_credit_history(): every ledger entry, newest first, with the running total. Entries are never
--     changed, so a reversal after an appeal is a new line, not a rewritten total (FR-803).
--
-- FR-804: a result the learner cannot see yet contributes nothing and hints at nothing. An assessment whose result is
-- held, whose resubmission is waiting to be marked, or whose later decision is waiting for moderation reads as
-- "being_assessed", with no outcome; only a released current decision is shown as Competent or Not yet competent.

create function api.get_my_credits()
returns table (
  programme_id uuid,
  programme_title text,
  nqf_level smallint,
  cohort_id uuid,
  cohort_name text,
  cohort_status text,
  unit_id uuid,
  unit_code text,
  unit_title text,
  -- The credits the unit is worth: the value awarded when earned, otherwise the value in force (null if none).
  credits integer,
  -- What the ledger holds for the unit now: the award less any reversal.
  earned integer,
  awarded boolean,
  awarded_at timestamptz,
  -- Whether the cohort has frozen which assessments each unit needs.
  requirements_set boolean,
  -- The assessments that count: [{title, state, result_id, deadline_at, due_at}], state one of competent,
  -- not_yet_competent, being_assessed, not_started.
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select distinct on (c.programme_id) c.id as cohort_id, c.name as cohort_name, c.status as cohort_status,
      c.programme_id
    from programmes.enrolments e
    join programmes.cohorts c on c.id = e.cohort_id
    where e.profile_id = auth.uid() and e.status = 'active' and c.status in ('active', 'archived')
    order by c.programme_id, c.starts_on desc, c.id
  ),
  units as (
    select m.*, p.title as programme_title, p.nqf_level, u.id as unit_id, u.code as unit_code, u.title as unit_title,
      q.title as qualification_title,
      o.awarded, o.awarded_at, o.credits as awarded_credits,
      coalesce(case when o.awarded then o.requirement_set_id end, credits.current_set(m.cohort_id)) as set_id
    from mine m
    join programmes.programmes p on p.id = m.programme_id
    join programmes.qualifications q on q.programme_id = p.id
    join programmes.units u on u.qualification_id = q.id
    left join credits.learner_unit_outcomes o on o.learner_id = auth.uid() and o.unit_id = u.id
  )
  select un.programme_id, un.programme_title, un.nqf_level, un.cohort_id, un.cohort_name, un.cohort_status,
    un.unit_id, un.unit_code, un.unit_title,
    case when coalesce(un.awarded, false) then un.awarded_credits else credits.credit_value(un.unit_id) end,
    coalesce((select sum(l.credits)::integer from credits.ledger_entries l
              where l.learner_id = auth.uid() and l.unit_id = un.unit_id), 0),
    coalesce(un.awarded, false),
    case when coalesce(un.awarded, false) then un.awarded_at end,
    credits.current_set(un.cohort_id) is not null,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', ai.title,
        'state', case
          when r.id is null then 'not_started'
          when r.state = 'held' or r.pending_decision_id is not null
            or exists (select 1 from assessment.assessment_instances i
                       where i.result_id = r.id and i.state in ('to_mark', 'marking')) then 'being_assessed'
          else d.outcome end,
        'result_id', case when r.state = 'released' then r.id end,
        'deadline_at', case when r.state = 'released' and d.outcome = 'not_yet_competent'
                                 and r.pending_decision_id is null
                            then r.remediation_deadline_at end,
        'due_at', case when r.id is null then t.due_at end)
        order by ai.title)
      from credits.unit_assessment_requirements uar
      join assessment.assessable_items ai on ai.id = uar.assessable_item_id
      left join submissions.tasks t on t.id = ai.task_id
      left join assessment.results r on r.assessable_item_id = ai.id and r.learner_id = auth.uid()
      left join assessment.decisions d on d.id = r.current_decision_id
      where uar.requirement_set_id = un.set_id and uar.unit_id = un.unit_id
    ), '[]'::jsonb)
  from units un
  order by un.programme_title, un.qualification_title, un.unit_code
$$;

-- The learner's ledger, newest first, with the total after each entry.
create function api.list_my_credit_history()
returns table (
  entry_id bigint,
  created_at timestamptz,
  unit_code text,
  unit_title text,
  credits integer,
  entry_type text,
  cause text,
  total integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.created_at, h.code, h.title, h.credits, h.entry_type, h.cause, h.total
  from (
    select l.id, l.created_at, u.code, u.title, l.credits, l.entry_type, l.cause,
      (sum(l.credits) over (order by l.created_at, l.id))::integer as total
    from credits.ledger_entries l
    join programmes.units u on u.id = l.unit_id
    where l.learner_id = auth.uid()
  ) h
  order by h.created_at desc, h.id desc
$$;

revoke all on function api.get_my_credits(), api.list_my_credit_history() from public, anon, authenticated, service_role;
grant execute on function api.get_my_credits(), api.list_my_credit_history() to authenticated;
