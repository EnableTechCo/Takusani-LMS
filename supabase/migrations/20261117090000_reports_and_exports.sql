-- Programme reports and exports (S6-04; FR-708; C-13; R-20; security and operations "Reports/search").
--
-- Eight reports, each a read-only projection over the other modules, scoped by programme, optionally one cohort, and
-- optionally a date range of South African calendar days:
--   submission_progress   per assignment: learners it is for, handed in, on time, late, not handed in (by due date)
--   assessment_turnaround per assessment: decisions, median and longest days from hand-in to decision, waiting now
--   competency_rates      per assessment: released results, Competent, Not yet competent, rate (by release date)
--   credit_accumulation   per unit: learners, learners holding the award, awards, reversals, net credits (by entry date)
--   moderation_findings   per cycle: population, sampled, agreed, disagreed, returned, re-marked, released (by planning)
--   appeals               per appeal type: lodged, inadmissible, open, concluded, upheld, amended up or down (by lodging)
--   attendance            per session: register confirmed, present, absent, rate, self check-ins (by start)
--   logistics             per in-person session: venue, catering, equipment, headcount against present (by start)
-- A coordinator sees only cohorts they coordinate (programmes.can_coordinate), so a programme-wide report of someone
-- scoped to one cohort covers that cohort alone. Rows are aggregates: no learner is named in any report. Personal
-- notes and formative quizzes are not read (system design, principle 7).
--
-- The page previews a report synchronously, bounded to 200 rows and 15 seconds. An export is asynchronous (R-20): the
-- request is recorded and returns at once; a scheduled job builds the CSV in the database, one export at a time and
-- under its own statement timeout, so a large report never runs on a request path. The requester is told in the LMS
-- when it is ready and downloads it within 7 days; after that the content is removed. At most 3 exports per person
-- may be waiting at once, and 20 an hour. Requests and downloads are audited.

-- ---------------------------------------------------------------------------------------------------------------
-- The catalogue
-- ---------------------------------------------------------------------------------------------------------------

-- Each report: its title, what the date range applies to, and its columns in order (key, label, numeric).
create function reporting.report_type(p_type text)
returns table (report_type text, title text, description text, date_basis text, columns jsonb)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    ('submission_progress', 'Submission progress',
     'For each assignment: the learners it is for, how many handed it in on time or late, and how many have not.',
     'Assignments due in the range',
     '[["cohort","Cohort",false],["assignment","Assignment",false],["due","Due (SAST)",false],["learners","Learners",true],["handed_in","Handed in",true],["on_time","On time",true],["late","Late",true],["not_handed_in","Not handed in",true]]'::jsonb),
    ('assessment_turnaround', 'Assessment turnaround',
     'For each assessment: decisions made, how long from hand-in to decision, and what is waiting to be marked now.',
     'Decisions made in the range',
     '[["cohort","Cohort",false],["assessment","Assessment",false],["decisions","Decisions",true],["median_days","Median days to decision",true],["longest_days","Longest days to decision",true],["waiting_now","Waiting to be marked now",true],["oldest_waiting_days","Oldest waiting (days)",true]]'::jsonb),
    ('competency_rates', 'Competency rates',
     'For each assessment: released results, how many are Competent and Not yet competent, and the Competent rate.',
     'Results released in the range',
     '[["cohort","Cohort",false],["assessment","Assessment",false],["released","Released",true],["competent","Competent",true],["not_yet_competent","Not yet competent",true],["competent_percent","Competent (%)",true]]'::jsonb),
    ('credit_accumulation', 'Credit accumulation',
     'For each unit: learners enrolled, how many hold its credits now, and the awards and reversals in the range.',
     'Ledger entries in the range',
     '[["cohort","Cohort",false],["unit","Unit",false],["unit_credits","Unit credits",true],["learners","Learners",true],["holding_award","Holding the award now",true],["awards","Awards",true],["reversals","Reversals",true],["net_credits","Net credits",true]]'::jsonb),
    ('moderation_findings', 'Moderation findings',
     'For each moderation cycle: the population, the sample, the moderators'' findings, returns for re-marking and the release.',
     'Cycles planned in the range',
     '[["cohort","Cohort",false],["cycle","Cycle",false],["state","State",false],["population","Population",true],["sampled","Sampled",true],["agreed","Agreed",true],["disagreed","Disagreed",true],["returned","Returned for re-marking",true],["remarked","Re-marked",true],["signed_off","Signed off (SAST)",false],["released","Released",true]]'::jsonb),
    ('appeals', 'Appeal volumes and outcomes',
     'For each kind of appeal: how many were lodged, found inadmissible, are open or concluded, and how they concluded.',
     'Appeals lodged in the range',
     '[["cohort","Cohort",false],["appeal_type","Appeal",false],["lodged","Lodged",true],["inadmissible","Inadmissible",true],["open","Open",true],["concluded","Concluded",true],["upheld","Upheld",true],["amended_up","Amended up",true],["amended_down","Amended down",true],["median_days","Median days to conclude",true]]'::jsonb),
    ('attendance', 'Attendance',
     'For each session: whether the register is confirmed, who was present and absent, and how many checked themselves in.',
     'Sessions starting in the range',
     '[["cohort","Cohort",false],["session","Session",false],["starts","Starts (SAST)",false],["mode","Mode",false],["register","Register",false],["present","Present",true],["absent","Absent",true],["rate_percent","Attendance (%)",true],["checked_in","Checked themselves in",true]]'::jsonb),
    ('logistics', 'Logistics',
     'For each in-person session: whether the venue, catering and equipment were arranged, and the headcount against who came.',
     'Sessions starting in the range',
     '[["cohort","Cohort",false],["session","Session",false],["starts","Starts (SAST)",false],["venue","Venue",false],["venue_arranged","Venue arranged",false],["catering","Catering",false],["equipment","Equipment",false],["headcount","Headcount",true],["present","Present",true],["difference","Present less headcount",true],["reconciled","Reconciled",false]]'::jsonb)
  ) catalogue (report_type, title, description, date_basis, columns)
  where p_type is null or catalogue.report_type = p_type
$$;

-- The cohorts of a programme (or the one cohort) that the person coordinates.
create function reporting.scope_cohorts(p_actor uuid, p_programme_id uuid, p_cohort_id uuid)
returns table (cohort_id uuid, cohort_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name from programmes.cohorts c
  where c.programme_id = p_programme_id and (p_cohort_id is null or c.id = p_cohort_id)
    and programmes.can_coordinate(p_actor, c.id)
$$;

-- An instant as a South African date and time, for a report cell.
create function reporting.sast(p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_at at time zone 'Africa/Johannesburg', 'YYYY-MM-DD HH24:MI')
$$;

create function reporting.days(p_interval interval)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round((extract(epoch from p_interval) / 86400)::numeric, 1)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The reports. Each takes the actor, the scope and the half-open range [from, to), and returns one jsonb per row.
-- ---------------------------------------------------------------------------------------------------------------

create function reporting.submission_progress(p_actor uuid, p_programme_id uuid, p_cohort_id uuid, p_from timestamptz, p_to timestamptz)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('cohort', s.cohort_name, 'assignment', t.title, 'due', reporting.sast(t.due_at),
    'learners', a.learners, 'handed_in', h.handed_in, 'on_time', h.on_time, 'late', h.late,
    'not_handed_in', greatest(a.learners - h.handed_in, 0))
  from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id) s
  join submissions.tasks t on t.cohort_id = s.cohort_id and t.state <> 'draft'
  cross join lateral (select submissions.audience_size(t.id) as learners) a
  cross join lateral (
    select count(*)::integer as handed_in,
      count(*) filter (where not v.is_late)::integer as on_time,
      count(*) filter (where v.is_late)::integer as late
    from submissions.submissions sm
    join submissions.submission_versions v on v.submission_id = sm.id and v.version_number = 1
    where sm.task_id = t.id
  ) h
  where (p_from is null or t.due_at >= p_from) and (p_to is null or t.due_at < p_to)
  order by s.cohort_name, t.due_at, t.title
$$;

create function reporting.assessment_turnaround(p_actor uuid, p_programme_id uuid, p_cohort_id uuid, p_from timestamptz, p_to timestamptz)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('cohort', s.cohort_name, 'assessment', ai.title, 'decisions', d.decisions,
    'median_days', d.median_days, 'longest_days', d.longest_days, 'waiting_now', w.waiting,
    'oldest_waiting_days', w.oldest_days)
  from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id) s
  join assessment.assessable_items ai on ai.cohort_id = s.cohort_id
  cross join lateral (
    select count(*)::integer as decisions,
      reporting.days(percentile_cont(0.5) within group (order by dec.created_at - v.submitted_at)) as median_days,
      reporting.days(max(dec.created_at - v.submitted_at)) as longest_days
    from assessment.results r
    join assessment.decisions dec on dec.result_id = r.id and dec.type = 'assessment'
    join assessment.assessment_instances i on i.id = dec.instance_id
    join submissions.submission_versions v on v.id = i.submission_version_id
    where r.assessable_item_id = ai.id
      and (p_from is null or dec.created_at >= p_from) and (p_to is null or dec.created_at < p_to)
  ) d
  cross join lateral (
    select count(*)::integer as waiting, reporting.days(now() - min(v.submitted_at)) as oldest_days
    from assessment.results r
    join assessment.assessment_instances i on i.result_id = r.id and i.state in ('to_mark', 'marking')
    join submissions.submission_versions v on v.id = i.submission_version_id
    where r.assessable_item_id = ai.id
  ) w
  where d.decisions > 0 or w.waiting > 0
  order by s.cohort_name, ai.title
$$;

create function reporting.competency_rates(p_actor uuid, p_programme_id uuid, p_cohort_id uuid, p_from timestamptz, p_to timestamptz)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('cohort', s.cohort_name, 'assessment', ai.title, 'released', x.released,
    'competent', x.competent, 'not_yet_competent', x.released - x.competent,
    'competent_percent', round(100.0 * x.competent / x.released, 1))
  from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id) s
  join assessment.assessable_items ai on ai.cohort_id = s.cohort_id
  cross join lateral (
    select count(*)::integer as released, count(*) filter (where d.outcome = 'competent')::integer as competent
    from assessment.results r
    join assessment.decisions d on d.id = r.current_decision_id
    where r.assessable_item_id = ai.id and r.state = 'released'
      and (p_from is null or r.released_at >= p_from) and (p_to is null or r.released_at < p_to)
  ) x
  where x.released > 0
  order by s.cohort_name, ai.title
$$;

create function reporting.credit_accumulation(p_actor uuid, p_programme_id uuid, p_cohort_id uuid, p_from timestamptz, p_to timestamptz)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('cohort', s.cohort_name, 'unit', u.code || ': ' || u.title,
    'unit_credits', credits.credit_value(u.id),
    'learners', (select count(*)::integer from programmes.enrolments e where e.cohort_id = s.cohort_id and e.status = 'active'),
    'holding_award', (select count(*)::integer from credits.learner_unit_outcomes o
                      join credits.requirement_sets rs on rs.id = o.requirement_set_id
                      where o.unit_id = u.id and o.awarded and rs.cohort_id = s.cohort_id),
    'awards', l.awards, 'reversals', l.reversals, 'net_credits', l.net)
  from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id) s
  join programmes.cohorts c on c.id = s.cohort_id
  join programmes.qualifications q on q.programme_id = c.programme_id
  join programmes.units u on u.qualification_id = q.id
  cross join lateral (
    select count(*) filter (where le.entry_type = 'award')::integer as awards,
      count(*) filter (where le.entry_type = 'reversal')::integer as reversals,
      coalesce(sum(le.credits), 0)::integer as net
    from credits.ledger_entries le
    join credits.requirement_sets rs on rs.id = le.requirement_set_id
    where le.unit_id = u.id and rs.cohort_id = s.cohort_id
      and (p_from is null or le.created_at >= p_from) and (p_to is null or le.created_at < p_to)
  ) l
  order by s.cohort_name, u.code
$$;

create function reporting.moderation_findings(p_actor uuid, p_programme_id uuid, p_cohort_id uuid, p_from timestamptz, p_to timestamptz)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('cohort', s.cohort_name, 'cycle', cy.name,
    'state', case cy.state when 'planned' then 'Planned' when 'frozen' then 'Frozen, being moderated'
                           when 'signed_off' then 'Signed off' else 'Cancelled' end,
    'population', p.size,
    'sampled', (select count(*)::integer from moderation.sample_items si where si.cycle_id = cy.id),
    'agreed', (select count(*)::integer from moderation.findings f where f.cycle_id = cy.id and f.finding = 'agree'),
    'disagreed', (select count(*)::integer from moderation.findings f where f.cycle_id = cy.id and f.finding = 'disagree'),
    'returned', (select count(*)::integer from moderation.returns rt where rt.cycle_id = cy.id),
    'remarked', (select count(*)::integer from moderation.returns rt where rt.cycle_id = cy.id and rt.remarked_at is not null),
    'signed_off', reporting.sast(cy.signed_off_at), 'released', cy.released_count)
  from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id) s
  join moderation.cycles cy on cy.cohort_id = s.cohort_id
  left join moderation.populations p on p.cycle_id = cy.id
  where (p_from is null or cy.planned_at >= p_from) and (p_to is null or cy.planned_at < p_to)
  order by s.cohort_name, cy.planned_at, cy.name
$$;

create function reporting.appeals(p_actor uuid, p_programme_id uuid, p_cohort_id uuid, p_from timestamptz, p_to timestamptz)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('cohort', s.cohort_name,
    'appeal_type', case x.type when 'remark' then 'Remark' else 'View marked script' end,
    'lodged', x.lodged, 'inadmissible', x.inadmissible, 'open', x.open, 'concluded', x.concluded,
    'upheld', x.upheld, 'amended_up', x.amended_up, 'amended_down', x.amended_down, 'median_days', x.median_days)
  from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id) s
  cross join lateral (
    select a.type, count(*)::integer as lodged,
      count(*) filter (where a.state = 'inadmissible')::integer as inadmissible,
      count(*) filter (where a.state not in ('inadmissible', 'concluded'))::integer as open,
      count(*) filter (where a.state = 'concluded')::integer as concluded,
      count(*) filter (where a.outcome_category = 'upheld')::integer as upheld,
      count(*) filter (where a.outcome_category = 'amended_up')::integer as amended_up,
      count(*) filter (where a.outcome_category = 'amended_down')::integer as amended_down,
      reporting.days(percentile_cont(0.5) within group (order by a.concluded_at - a.lodged_at)
        filter (where a.concluded_at is not null)) as median_days
    from appeals.appeals a
    join assessment.results r on r.id = a.result_id
    join assessment.assessable_items ai on ai.id = r.assessable_item_id
    where ai.cohort_id = s.cohort_id
      and (p_from is null or a.lodged_at >= p_from) and (p_to is null or a.lodged_at < p_to)
    group by a.type
  ) x
  order by s.cohort_name, x.type
$$;

create function reporting.attendance(p_actor uuid, p_programme_id uuid, p_cohort_id uuid, p_from timestamptz, p_to timestamptz)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('cohort', s.cohort_name, 'session', se.title, 'starts', reporting.sast(se.starts_at),
    'mode', case se.mode when 'online' then 'Online' else 'In person' end,
    'register', case when se.register_captured_at is null then 'Not confirmed' else 'Confirmed' end,
    'present', x.present, 'absent', x.absent,
    'rate_percent', case when x.present + x.absent > 0 then round(100.0 * x.present / (x.present + x.absent), 1) end,
    'checked_in', (select count(*)::integer from learning.attendance_checkins ch where ch.session_id = se.id))
  from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id) s
  join learning.sessions se on se.cohort_id = s.cohort_id and se.state = 'scheduled'
  cross join lateral (
    select count(*) filter (where at.status = 'present')::integer as present,
      count(*) filter (where at.status = 'absent')::integer as absent
    from learning.attendance at
    where at.session_id = se.id and se.register_captured_at is not null
  ) x
  where (p_from is null or se.starts_at >= p_from) and (p_to is null or se.starts_at < p_to)
  order by s.cohort_name, se.starts_at, se.title
$$;

create function reporting.logistics(p_actor uuid, p_programme_id uuid, p_cohort_id uuid, p_from timestamptz, p_to timestamptz)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('cohort', s.cohort_name, 'session', se.title, 'starts', reporting.sast(se.starts_at),
    'venue', se.venue,
    'venue_arranged', case when l.venue_arranged_at is not null then 'Yes' else 'No' end,
    'catering', case when l.session_id is null or not l.catering_needed then 'Not needed'
                     when l.catering_arranged_at is not null then 'Arranged' else 'Not arranged' end,
    'equipment', case when l.session_id is null or l.equipment is null then 'None asked for'
                      when l.equipment_arranged_at is not null then 'Arranged' else 'Not arranged' end,
    'headcount', l.headcount, 'present', x.present,
    'difference', case when l.headcount is not null and se.register_captured_at is not null then x.present - l.headcount end,
    'reconciled', case when l.reconciled_at is not null then 'Yes' else 'No' end)
  from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id) s
  join learning.sessions se on se.cohort_id = s.cohort_id and se.state = 'scheduled' and se.mode = 'in_person'
  left join learning.session_logistics l on l.session_id = se.id
  cross join lateral (
    select count(*)::integer as present from learning.attendance at
    where at.session_id = se.id and at.status = 'present' and se.register_captured_at is not null
  ) x
  where (p_from is null or se.starts_at >= p_from) and (p_to is null or se.starts_at < p_to)
  order by s.cohort_name, se.starts_at, se.title
$$;

-- One report's rows. An unknown type raises: callers check the catalogue first.
create function reporting.report_rows(p_type text, p_actor uuid, p_programme_id uuid, p_cohort_id uuid,
  p_from timestamptz, p_to timestamptz)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  case p_type
    when 'submission_progress' then return query select * from reporting.submission_progress(p_actor, p_programme_id, p_cohort_id, p_from, p_to);
    when 'assessment_turnaround' then return query select * from reporting.assessment_turnaround(p_actor, p_programme_id, p_cohort_id, p_from, p_to);
    when 'competency_rates' then return query select * from reporting.competency_rates(p_actor, p_programme_id, p_cohort_id, p_from, p_to);
    when 'credit_accumulation' then return query select * from reporting.credit_accumulation(p_actor, p_programme_id, p_cohort_id, p_from, p_to);
    when 'moderation_findings' then return query select * from reporting.moderation_findings(p_actor, p_programme_id, p_cohort_id, p_from, p_to);
    when 'appeals' then return query select * from reporting.appeals(p_actor, p_programme_id, p_cohort_id, p_from, p_to);
    when 'attendance' then return query select * from reporting.attendance(p_actor, p_programme_id, p_cohort_id, p_from, p_to);
    when 'logistics' then return query select * from reporting.logistics(p_actor, p_programme_id, p_cohort_id, p_from, p_to);
    else raise exception 'no report named %', p_type;
  end case;
end
$$;

-- The start of a South African day, and the start of the day after the last one: the half-open range.
create function reporting.range_from(p_from date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case when p_from is null then null else (p_from::timestamp at time zone 'Africa/Johannesburg') end
$$;

create function reporting.range_to(p_to date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case when p_to is null then null else ((p_to + 1)::timestamp at time zone 'Africa/Johannesburg') end
$$;

-- Why a report cannot run for this person and scope, or null. Refusals: unauthenticated, invalid_type,
-- not_found (no cohort of the programme, or the chosen cohort, is theirs), invalid_range, range_too_long (over 3 years).
create function reporting.refusal(p_actor uuid, p_type text, p_programme_id uuid, p_cohort_id uuid, p_from date, p_to date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_actor is null then 'unauthenticated'
    when not exists (select 1 from reporting.report_type(p_type)) or p_type is null then 'invalid_type'
    when not exists (select 1 from reporting.scope_cohorts(p_actor, p_programme_id, p_cohort_id)) then 'not_found'
    when p_from is not null and p_to is not null and p_from > p_to then 'invalid_range'
    when p_from is not null and p_to is not null and p_to - p_from > 1096 then 'range_too_long'
  end
$$;

revoke all on function reporting.report_type(text), reporting.scope_cohorts(uuid, uuid, uuid), reporting.sast(timestamptz),
  reporting.days(interval), reporting.range_from(date), reporting.range_to(date),
  reporting.refusal(uuid, text, uuid, uuid, date, date),
  reporting.submission_progress(uuid, uuid, uuid, timestamptz, timestamptz),
  reporting.assessment_turnaround(uuid, uuid, uuid, timestamptz, timestamptz),
  reporting.competency_rates(uuid, uuid, uuid, timestamptz, timestamptz),
  reporting.credit_accumulation(uuid, uuid, uuid, timestamptz, timestamptz),
  reporting.moderation_findings(uuid, uuid, uuid, timestamptz, timestamptz),
  reporting.appeals(uuid, uuid, uuid, timestamptz, timestamptz),
  reporting.attendance(uuid, uuid, uuid, timestamptz, timestamptz),
  reporting.logistics(uuid, uuid, uuid, timestamptz, timestamptz),
  reporting.report_rows(text, uuid, uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads for the pages
-- ---------------------------------------------------------------------------------------------------------------

-- The catalogue, for anyone signed in who coordinates a cohort.
create function api.list_report_types()
returns table (report_type text, title text, description text, date_basis text, columns jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select * from reporting.report_type(null)
  where exists (
    select 1 from programmes.cohorts c where programmes.can_coordinate(auth.uid(), c.id)
  )
$$;

-- A preview: at most 200 rows, and whether there were more. The export has them all.
create function api.run_report(p_type text, p_programme_id uuid, p_cohort_id uuid default null, p_from date default null,
  p_to date default null)
returns table (status text, rows jsonb, total integer, truncated boolean)
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_actor uuid := auth.uid();
  v_refusal text := reporting.refusal(v_actor, p_type, p_programme_id, p_cohort_id, p_from, p_to);
  v_rows jsonb;
  v_total integer;
begin
  if v_refusal is not null then return query select v_refusal, null::jsonb, null::integer, null::boolean; return; end if;
  select coalesce(jsonb_agg(r.row_data order by r.ord) filter (where r.ord <= 200), '[]'::jsonb), count(*)::integer
  into v_rows, v_total
  from reporting.report_rows(p_type, v_actor, p_programme_id, p_cohort_id,
    reporting.range_from(p_from), reporting.range_to(p_to)) with ordinality as r(row_data, ord);
  return query select 'ok'::text, v_rows, v_total, v_total > 200;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Exports
-- ---------------------------------------------------------------------------------------------------------------

create table reporting.report_exports (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references identity.profiles (id),
  report_type text not null,
  programme_id uuid not null references programmes.programmes (id),
  cohort_id uuid references programmes.cohorts (id),
  from_on date,
  to_on date,
  state text not null default 'queued' check (state in ('queued', 'running', 'ready', 'failed', 'expired')),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  row_count integer,
  content text,
  content_bytes integer,
  error_code text,
  expires_at timestamptz,
  constraint ready_has_content check ((state = 'ready') = (content is not null)),
  constraint finished_is_recorded check ((state in ('ready', 'failed', 'expired')) = (finished_at is not null))
);

create index report_exports_requester_idx on reporting.report_exports (requested_by, requested_at desc);
create index report_exports_queued_idx on reporting.report_exports (requested_at) where state = 'queued';
create index report_exports_expiring_idx on reporting.report_exports (expires_at) where state = 'ready';

revoke all on table reporting.report_exports from public, anon, authenticated, service_role;

-- A CSV cell: quoted, with quotes doubled; a text cell that a spreadsheet would read as a formula is prefixed with an
-- apostrophe (CSV injection). Numbers and nulls are written as they are.
create function reporting.csv_cell(p_value jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) = 'null' then ''
    when jsonb_typeof(p_value) = 'number' then p_value #>> '{}'
    else '"' || replace(
      case when (p_value #>> '{}') ~ '^[=+\-@\t\r]' then '''' || (p_value #>> '{}') else (p_value #>> '{}') end,
      '"', '""') || '"'
  end
$$;

-- Asks for an export of a report; it is built in the background. Refusals as for a preview, and too_many_exports
-- (3 waiting), rate_limited (20 in the last hour).
create function api.request_report_export(p_type text, p_programme_id uuid, p_cohort_id uuid default null,
  p_from date default null, p_to date default null)
returns table (status text, export_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_refusal text := reporting.refusal(v_actor, p_type, p_programme_id, p_cohort_id, p_from, p_to);
  v_id uuid;
begin
  if v_refusal is not null then return query select v_refusal, null::uuid; return; end if;
  -- One person's requests are counted under their own lock, so two at once cannot both pass the cap.
  perform pg_advisory_xact_lock(hashtextextended('reporting.request_export:' || v_actor::text, 0));
  if (select count(*) from reporting.report_exports e
      where e.requested_by = v_actor and e.state in ('queued', 'running')) >= 3 then
    return query select 'too_many_exports'::text, null::uuid; return;
  end if;
  if (select count(*) from reporting.report_exports e
      where e.requested_by = v_actor and e.requested_at > now() - interval '1 hour') >= 20 then
    return query select 'rate_limited'::text, null::uuid; return;
  end if;
  insert into reporting.report_exports (requested_by, report_type, programme_id, cohort_id, from_on, to_on)
  values (v_actor, p_type, p_programme_id, p_cohort_id, p_from, p_to)
  returning id into v_id;
  perform audit.append('reporting.export_requested', 'report_export', v_id::text,
    jsonb_build_object('report_type', p_type, 'programme_id', p_programme_id, 'cohort_id', p_cohort_id,
      'from', p_from, 'to', p_to), 'coordinator', null, null,
    case when p_cohort_id is null then 'programme' else 'cohort' end, coalesce(p_cohort_id, p_programme_id));
  return query select 'ok'::text, v_id;
end
$$;

-- Builds one export: the rows under the requester's scope as it is now, as CSV with a header row.
create function reporting.build_export(p_export_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  v_export reporting.report_exports;
  v_columns jsonb;
  v_title text;
  v_csv text;
  v_rows integer;
begin
  select * into v_export from reporting.report_exports e where e.id = p_export_id for update skip locked;
  if not found or v_export.state <> 'queued' then return null; end if;
  update reporting.report_exports set state = 'running', started_at = now() where id = p_export_id;

  select t.columns, t.title into v_columns, v_title from reporting.report_type(v_export.report_type) t;
  if v_columns is null
     or not exists (select 1 from reporting.scope_cohorts(v_export.requested_by, v_export.programme_id, v_export.cohort_id)) then
    update reporting.report_exports
    set state = 'failed', finished_at = now(), error_code = 'no_longer_in_scope' where id = p_export_id;
    return 0;
  end if;

  with body as (
    select string_agg(
      (select string_agg(reporting.csv_cell(x.row_data -> (c.col ->> 0)), ',' order by c.ord)
       from jsonb_array_elements(v_columns) with ordinality c(col, ord)),
      E'\r\n' order by x.ord) as lines, count(*)::integer as n
    from reporting.report_rows(v_export.report_type, v_export.requested_by, v_export.programme_id,
      v_export.cohort_id, reporting.range_from(v_export.from_on), reporting.range_to(v_export.to_on))
      with ordinality as x(row_data, ord)
  )
  select (select string_agg(reporting.csv_cell(to_jsonb(c.col ->> 1)), ',' order by c.ord)
          from jsonb_array_elements(v_columns) with ordinality c(col, ord))
         || E'\r\n' || coalesce(b.lines || E'\r\n', ''), b.n
  into v_csv, v_rows
  from body b;

  update reporting.report_exports
  set state = 'ready', finished_at = now(), row_count = v_rows, content = v_csv,
    content_bytes = octet_length(v_csv), expires_at = now() + interval '7 days'
  where id = p_export_id;

  perform notifications.enqueue('report_export_ready', 'report_export_ready:' || p_export_id::text,
    v_export.requested_by,
    jsonb_build_object('export_id', p_export_id, 'report_title', v_title, 'rows', v_rows,
      'expires_at', now() + interval '7 days'),
    '/coordinate/reports#exports');
  return 1;
end
$$;

-- The job: builds queued exports oldest first, each on its own, so one failure holds back no other; and removes the
-- content of exports past their 7 days.
create function reporting.build_due_exports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_built integer := 0;
  v_state text;
begin
  update reporting.report_exports e
  set state = 'expired', content = null
  where e.state = 'ready' and e.expires_at <= now();

  for v_id in
    select e.id from reporting.report_exports e where e.state = 'queued' order by e.requested_at limit 5
  loop
    begin
      if reporting.build_export(v_id) = 1 then v_built := v_built + 1; end if;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      update reporting.report_exports
      set state = 'failed', finished_at = now(), error_code = v_state, content = null
      where id = v_id;
    end;
  end loop;
  return v_built;
end
$$;

revoke all on function reporting.csv_cell(jsonb), reporting.build_export(uuid), reporting.build_due_exports()
  from public, anon, authenticated, service_role;

insert into audit.scheduled_jobs (name, kind, description, handler, schedule, heartbeat_within) values
('build-report-exports', 'recurring',
 'Builds requested report exports in the background, and removes the content of exports older than 7 days.',
 'reporting.build_due_exports', '* * * * *', interval '5 minutes');

select cron.schedule('build-report-exports', '* * * * *', format('select audit.run_job(%L)', 'build-report-exports'));

-- The signed-in person's exports, newest first, with their scope in words.
create function api.list_my_report_exports()
returns table (
  export_id uuid,
  report_type text,
  report_title text,
  programme_title text,
  cohort_name text,
  from_on date,
  to_on date,
  state text,
  requested_at timestamptz,
  finished_at timestamptz,
  row_count integer,
  content_bytes integer,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.report_type, t.title, p.title, c.name, e.from_on, e.to_on, e.state, e.requested_at, e.finished_at,
    e.row_count, e.content_bytes, e.expires_at
  from reporting.report_exports e
  join programmes.programmes p on p.id = e.programme_id
  left join programmes.cohorts c on c.id = e.cohort_id
  left join lateral reporting.report_type(e.report_type) t on true
  where e.requested_by = auth.uid()
  order by e.requested_at desc
  limit 50
$$;

-- The CSV of one of the person's own ready exports, with a file name; the download is audited. Refusals:
-- unauthenticated, not_found, not_ready, expired.
create function api.download_report_export(p_export_id uuid)
returns table (status text, filename text, content text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_export reporting.report_exports;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::text, null::text; return; end if;
  select * into v_export from reporting.report_exports e where e.id = p_export_id and e.requested_by = v_actor;
  if not found then return query select 'not_found'::text, null::text, null::text; return; end if;
  if v_export.state = 'expired' or (v_export.state = 'ready' and v_export.expires_at <= now()) then
    return query select 'expired'::text, null::text, null::text; return;
  end if;
  if v_export.state <> 'ready' then return query select 'not_ready'::text, null::text, null::text; return; end if;
  perform audit.append('reporting.export_downloaded', 'report_export', p_export_id::text,
    jsonb_build_object('report_type', v_export.report_type, 'rows', v_export.row_count), 'coordinator', null, null,
    case when v_export.cohort_id is null then 'programme' else 'cohort' end,
    coalesce(v_export.cohort_id, v_export.programme_id));
  return query select 'ok'::text,
    replace(v_export.report_type, '_', '-') || '-' || to_char(v_export.finished_at at time zone 'Africa/Johannesburg', 'YYYY-MM-DD-HH24MI') || '.csv',
    v_export.content;
end
$$;

revoke all on function api.list_report_types(), api.run_report(text, uuid, uuid, date, date),
  api.request_report_export(text, uuid, uuid, date, date), api.list_my_report_exports(),
  api.download_report_export(uuid)
  from public, anon, authenticated, service_role;
grant execute on function api.list_report_types(), api.run_report(text, uuid, uuid, date, date),
  api.request_report_export(text, uuid, uuid, date, date), api.list_my_report_exports(),
  api.download_report_export(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Notifications: an export is ready
-- ---------------------------------------------------------------------------------------------------------------

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'session_series_scheduled', 'session_series_changed',
                 'session_series_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked', 'role_assigned', 'role_ended', 'password_reset_sent',
                 'account_deactivated', 'account_reactivated', 'readiness_item_assigned', 'query_assigned',
                 'moderation_items_allocated', 'moderation_item_reallocated',
                 'moderation_item_returned', 'moderation_return_logged', 'moderation_item_remarked',
                 'moderation_cycle_signed_off',
                 'correction_proposed', 'correction_concluded', 'result_corrected',
                 'credit_reconciliation_differences', 'report_export_ready')
);
