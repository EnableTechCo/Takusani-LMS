-- Sample item review and allocation (S4-07; FR-504, FR-507, FR-508; BR-01; ADR-019). A moderator opens a sampled
-- item and sees the submission, the evidence, the rubric with the assessor's marks, and the decision with its
-- justification, on one route; records a finding, agreement or disagreement with reasons, which is never edited; and
-- adds cohort-level observations to the cycle. Nobody moderates a result they took an assessment decision on: the
-- read refuses with the conflict named and shows no evidence, and reallocation refuses the same way. A coordinator
-- reallocates items, and moderators are told about their allocations. Return for re-marking follows in S4-08.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

-- A finding on a sampled item: agree or disagree, with reasons. Append-only: a later finding is added, never edited.
create table moderation.findings (
  id uuid primary key default gen_random_uuid(),
  sample_item_id uuid not null references moderation.sample_items (id),
  cycle_id uuid not null references moderation.cycles (id),
  moderator_id uuid not null references identity.profiles (id),
  -- The decision the finding is about, so a finding on a re-marked decision reads apart from the first (S4-08).
  decision_id uuid not null references assessment.decisions (id),
  finding text not null check (finding in ('agree', 'disagree')),
  reasons text not null check (char_length(btrim(reasons)) between 1 and 4000),
  -- The clock, not the transaction start: findings are a history, and two in one transaction must still order.
  created_at timestamptz not null default clock_timestamp()
);

create index findings_item_idx on moderation.findings (sample_item_id, created_at);

create trigger findings_append_only
  before update or delete on moderation.findings
  for each row execute function audit.forbid_mutation();
create trigger findings_append_only_truncate
  before truncate on moderation.findings
  for each statement execute function audit.forbid_mutation();

-- Cohort-level observations from a moderator to the coordinator, per cycle (FR-508). Append-only.
create table moderation.observations (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references moderation.cycles (id),
  moderator_id uuid not null references identity.profiles (id),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default clock_timestamp()
);

create index observations_cycle_idx on moderation.observations (cycle_id, created_at);

create trigger observations_append_only
  before update or delete on moderation.observations
  for each row execute function audit.forbid_mutation();
create trigger observations_append_only_truncate
  before truncate on moderation.observations
  for each statement execute function audit.forbid_mutation();

revoke all on table moderation.findings, moderation.observations from public, anon, authenticated, service_role;

-- Review states join the allocation states of S4-06; returned and re-marked arrive with S4-08.
alter table moderation.sample_items drop constraint sample_items_state_check;
alter table moderation.sample_items
  add constraint sample_items_state_check check (state in ('unallocated', 'allocated', 'agreed', 'disagreed'));

-- ---------------------------------------------------------------------------------------------------------------
-- Notifications: a moderator's allocations
-- ---------------------------------------------------------------------------------------------------------------

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'session_series_scheduled', 'session_series_changed',
                 'session_series_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked', 'role_assigned', 'role_ended', 'password_reset_sent',
                 'account_deactivated', 'account_reactivated', 'readiness_item_assigned', 'query_assigned',
                 'moderation_items_allocated', 'moderation_item_reallocated')
);

-- Tells each moderator holding items in a cycle how many, once per cycle (the freeze calls it).
create function moderation.notify_allocations(p_cycle_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle moderation.cycles;
  v_cohort text;
  v_row record;
  v_told integer := 0;
begin
  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id;
  select c.name into v_cohort from programmes.cohorts c where c.id = v_cycle.cohort_id;
  for v_row in
    select si.moderator_id, count(*) as n from moderation.sample_items si
    where si.cycle_id = p_cycle_id and si.moderator_id is not null group by si.moderator_id
  loop
    if notifications.enqueue('moderation_items_allocated', 'moderation_items_allocated:' || p_cycle_id::text,
         v_row.moderator_id,
         jsonb_build_object('cycle_id', p_cycle_id, 'cycle_name', v_cycle.name, 'cohort_name', v_cohort, 'count', v_row.n),
         '/moderate/cycles/' || p_cycle_id::text) is not null then
      v_told := v_told + 1;
    end if;
  end loop;
  return v_told;
end
$$;

revoke all on function moderation.notify_allocations(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- The freeze now tells the moderators (S4-06's function, with one call added before the cycle turns frozen)
-- ---------------------------------------------------------------------------------------------------------------

create or replace function moderation.freeze(p_cycle_id uuid, p_actor uuid, p_seed text)
returns table (status text, population integer, sample integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle moderation.cycles;
  v_seed text := coalesce(nullif(btrim(coalesce(p_seed, '')), ''), replace(gen_random_uuid()::text, '-', ''));
  v_percentage integer := coalesce(audit.config_int('moderation.sampling.percentage'), 0);
  v_rule_version integer := coalesce((audit.config_version('moderation.sampling.rule')).version, 1);
  v_algorithm constant text := '1';
  v_ids uuid[];
  v_digest text;
  v_basis jsonb;
  v_sample uuid;
  v_strata jsonb;
  v_nyc integer;
  v_first integer;
  v_random integer;
  v_moderators uuid[];
  v_item record;
  v_turn integer := 0;
  v_pick uuid;
  v_n integer;
begin
  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id;
  if not found then return query select 'not_found'::text, null::integer, null::integer; return; end if;
  perform 1 from programmes.cohort_moderation_state ms where ms.cohort_id = v_cycle.cohort_id for update;
  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id for update;

  if v_cycle.state in ('frozen', 'signed_off') then
    -- A retry, or the scheduler and a coordinator racing: the sample already drawn is the answer.
    return query select 'ok'::text, pp.size, (select count(*)::integer from moderation.sample_items si where si.cycle_id = p_cycle_id)
      from moderation.populations pp where pp.cycle_id = p_cycle_id;
    return;
  end if;
  if v_cycle.state <> 'planned' then return query select 'not_planned'::text, null::integer, null::integer; return; end if;

  -- Whole units bring in every assignment they have now, including ones published after the plan.
  insert into moderation.cycle_scope (cycle_id, assessable_item_id, via_unit_id)
  select p_cycle_id, ai.id, moderation.item_unit(ai.id)
  from assessment.assessable_items ai
  where ai.cohort_id = v_cycle.cohort_id
    and moderation.item_unit(ai.id) = any (v_cycle.unit_ids)
    and not exists (select 1 from moderation.cycle_scope s where s.cycle_id = p_cycle_id and s.assessable_item_id = ai.id)
    and moderation.open_cycle_for(ai.id) is null;

  -- The population: every result waiting in scope, decided within the period, locked in id order.
  select coalesce(array_agg(r.id order by r.id), '{}') into v_ids
  from (
    select r.id
    from assessment.results r
    join moderation.cycle_scope s on s.cycle_id = p_cycle_id and s.assessable_item_id = r.assessable_item_id
    join assessment.decisions d on d.id = moderation.waiting_decision(r)
    where moderation.is_waiting(r)
      and (v_cycle.period_from is null or (d.created_at at time zone 'Africa/Johannesburg')::date >= v_cycle.period_from)
      and (v_cycle.period_to is null or (d.created_at at time zone 'Africa/Johannesburg')::date <= v_cycle.period_to)
    order by r.id
    for update of r
  ) r;
  if cardinality(v_ids) = 0 then return query select 'nothing_to_freeze'::text, null::integer, null::integer; return; end if;

  update assessment.results r set hold_cycle_id = p_cycle_id, updated_at = now() where r.id = any (v_ids);
  v_digest := encode(extensions.digest(array_to_string(v_ids, ','), 'sha256'), 'hex');

  -- The selection basis, with each assessor's first-time standing as it is at this moment (FR-503, FR-505).
  select jsonb_agg(jsonb_build_object(
           'result_id', b.result_id, 'decision_id', b.decision_id, 'assessor_id', b.assessor_id,
           'assessor_name', b.assessor_name, 'outcome', b.outcome, 'unit_id', b.unit_id, 'unit_code', b.unit_code,
           'first_time', b.first_time) order by b.result_id)
  into v_basis
  from (
    select r.id as result_id, d.id as decision_id, d.actor_id as assessor_id, p.full_name as assessor_name,
      d.outcome, u.id as unit_id, u.code as unit_code,
      not exists (
        select 1 from moderation.populations pp
        join moderation.cycles c on c.id = pp.cycle_id and c.state = 'signed_off'
        cross join lateral jsonb_array_elements(pp.basis) e
        where (e ->> 'assessor_id')::uuid = d.actor_id
      ) as first_time
    from assessment.results r
    join assessment.decisions d on d.id = moderation.waiting_decision(r)
    join identity.profiles p on p.id = d.actor_id
    left join programmes.units u on u.id = moderation.item_unit(r.assessable_item_id)
    where r.id = any (v_ids)
  ) b;

  insert into moderation.populations (cycle_id, frozen_by, size, digest, basis)
  values (p_cycle_id, p_actor, cardinality(v_ids), v_digest, v_basis);

  insert into moderation.samples (cycle_id, seed, algorithm_version, rule_version, percentage, population_digest,
                                  strata, mandatory_nyc, mandatory_first_time, random_draw)
  values (p_cycle_id, v_seed, v_algorithm, v_rule_version, v_percentage, v_digest, '[]'::jsonb, 0, 0, 0)
  returning id into v_sample;

  -- The draw: mandatory inclusions, then within each stratum of the rest the first ceil(n × percentage) results by
  -- the lot md5(seed, result id), so the same seed always draws the same items.
  with pop as (
    select (e ->> 'result_id')::uuid as result_id, (e ->> 'assessor_id')::uuid as assessor_id,
      e ->> 'assessor_name' as assessor_name, e ->> 'outcome' as outcome, e ->> 'unit_code' as unit_code,
      (e ->> 'first_time')::boolean as first_time
    from jsonb_array_elements(v_basis) e
  ),
  classed as (
    select pop.*,
      case when outcome = 'not_yet_competent' then 'nyc' when first_time then 'first_time_assessor' else 'random' end as reason,
      case when outcome = 'not_yet_competent' then 'Not yet competent'
           when first_time then 'First-time assessor: ' || assessor_name
           else assessor_name || ' · Competent · ' || coalesce('Unit ' || unit_code, 'No unit') end as stratum,
      md5(v_seed || result_id::text) as lot
    from pop
  ),
  drawn as (
    select c.*, row_number() over (partition by c.stratum order by c.lot, c.result_id) as rn,
      count(*) over (partition by c.stratum) as n
    from classed c where c.reason = 'random'
  )
  insert into moderation.sample_items (sample_id, cycle_id, result_id, stratum, inclusion_reason)
  select v_sample, p_cycle_id, c.result_id, c.stratum, c.reason from classed c where c.reason <> 'random'
  union all
  select v_sample, p_cycle_id, d.result_id, d.stratum, d.reason from drawn d
  where d.rn <= ceil(d.n * v_percentage / 100.0);

  -- The strata record: every stratum of the population, sampled or not.
  with pop as (
    select (e ->> 'result_id')::uuid as result_id, e ->> 'assessor_name' as assessor_name, e ->> 'outcome' as outcome,
      e ->> 'unit_code' as unit_code, (e ->> 'first_time')::boolean as first_time
    from jsonb_array_elements(v_basis) e
  ),
  classed as (
    select case when outcome = 'not_yet_competent' then 'Not yet competent'
                when first_time then 'First-time assessor: ' || assessor_name
                else assessor_name || ' · Competent · ' || coalesce('Unit ' || unit_code, 'No unit') end as stratum,
      case when outcome = 'not_yet_competent' then 'Mandatory: every Not yet competent decision'
           when first_time then 'Mandatory: no decision of theirs is in a signed-off cycle yet'
           else v_percentage || '% draw' end as why,
      case when outcome = 'not_yet_competent' then 0 when first_time then 1 else 2 end as rank_key,
      result_id
    from pop
  )
  select jsonb_agg(jsonb_build_object('stratum', g.stratum, 'population', g.population, 'sampled', g.sampled, 'why', g.why)
                   order by g.rank_key, g.stratum)
  into v_strata
  from (
    select c.stratum, c.why, c.rank_key, count(*)::integer as population,
      count(*) filter (where exists (select 1 from moderation.sample_items si where si.cycle_id = p_cycle_id and si.result_id = c.result_id))::integer as sampled
    from classed c group by c.stratum, c.why, c.rank_key
  ) g;

  select count(*) filter (where inclusion_reason = 'nyc'), count(*) filter (where inclusion_reason = 'first_time_assessor'),
         count(*) filter (where inclusion_reason = 'random')
  into v_nyc, v_first, v_random
  from moderation.sample_items where cycle_id = p_cycle_id;
  update moderation.samples s
  set strata = v_strata, mandatory_nyc = v_nyc, mandatory_first_time = v_first, random_draw = v_random
  where s.id = v_sample;

  -- Allocation in turn among the cohort's moderators, skipping anyone who assessed the result (FR-504).
  select coalesce(array_agg(m.profile_id), '{}') into v_moderators from moderation.eligible_moderators(v_cycle.cohort_id) m;
  v_n := cardinality(v_moderators);
  for v_item in
    select si.id, si.result_id from moderation.sample_items si where si.cycle_id = p_cycle_id order by si.stratum, si.result_id
  loop
    v_pick := null;
    for v_i in 0..greatest(v_n - 1, 0) loop
      exit when v_n = 0;
      if not moderation.assessed_result(v_moderators[((v_turn + v_i) % v_n) + 1], v_item.result_id) then
        v_pick := v_moderators[((v_turn + v_i) % v_n) + 1];
        v_turn := (v_turn + v_i + 1) % v_n;
        exit;
      end if;
    end loop;
    if v_pick is null then
      update moderation.sample_items set state = 'unallocated' where id = v_item.id;
    else
      update moderation.sample_items set moderator_id = v_pick, state = 'allocated', allocated_at = now() where id = v_item.id;
    end if;
  end loop;

  update moderation.cycles c
  set state = 'frozen', frozen_at = now(), version = c.version + 1, updated_at = now()
  where c.id = p_cycle_id;

  -- Each moderator is told once how many items of this cycle are theirs (S4-07).
  perform moderation.notify_allocations(p_cycle_id);

  perform audit.append('moderation.cycle_frozen', 'moderation_cycle', p_cycle_id::text,
    jsonb_build_object('population', cardinality(v_ids), 'sample', v_nyc + v_first + v_random, 'seed', v_seed,
                       'rule_version', v_rule_version, 'percentage', v_percentage, 'algorithm_version', v_algorithm,
                       'digest', v_digest, 'scheduled', p_actor is null),
    case when p_actor is null then 'system' else 'coordinator' end,
    jsonb_build_object('state', 'planned'), jsonb_build_object('state', 'frozen'),
    'cohort', v_cycle.cohort_id);

  return query select 'ok'::text, cardinality(v_ids), v_nyc + v_first + v_random;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Evidence: a moderator reads the files of the work they hold
-- ---------------------------------------------------------------------------------------------------------------

create function moderation.may_read_sample_evidence(p_profile_id uuid, p_bucket text, p_object_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from moderation.sample_items si
    join assessment.results r on r.id = si.result_id
    join assessment.decisions d on d.id = coalesce(r.pending_decision_id, r.current_decision_id)
    join assessment.assessment_instances i on i.id = d.instance_id
    join submissions.submission_files vf on vf.version_id = i.submission_version_id
    join submissions.stored_files sf on sf.id = vf.stored_file_id
    where si.moderator_id = p_profile_id
      and not moderation.assessed_result(p_profile_id, si.result_id)
      and sf.bucket = p_bucket
      and sf.object_key = p_object_key
  )
$$;

revoke all on function moderation.may_read_sample_evidence(uuid, text, text) from public, anon, authenticated, service_role;
-- The policy runs as the signed-in role, which therefore needs EXECUTE (as with may_read_review_evidence).
grant execute on function moderation.may_read_sample_evidence(uuid, text, text) to authenticated;

create policy "moderators read the work they hold"
  on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and moderation.may_read_sample_evidence(auth.uid(), bucket_id, name));

-- ---------------------------------------------------------------------------------------------------------------
-- The moderator's reads
-- ---------------------------------------------------------------------------------------------------------------

-- M-01: the cycles in which the moderator holds items, with their progress. Open cycles first, then signed off.
create function api.list_my_moderation_cycles()
returns table (
  cycle_id uuid,
  name text,
  state text,
  cohort_id uuid,
  cohort_name text,
  frozen_at timestamptz,
  my_items integer,
  my_concluded integer,
  my_disagreed integer,
  total_items integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.state, c.cohort_id, co.name, c.frozen_at,
    count(*) filter (where si.moderator_id = auth.uid())::integer,
    count(*) filter (where si.moderator_id = auth.uid() and si.state = 'agreed')::integer,
    count(*) filter (where si.moderator_id = auth.uid() and si.state = 'disagreed')::integer,
    count(*)::integer
  from moderation.cycles c
  join programmes.cohorts co on co.id = c.cohort_id
  join moderation.sample_items si on si.cycle_id = c.id
  where exists (select 1 from moderation.sample_items x where x.cycle_id = c.id and x.moderator_id = auth.uid())
  group by c.id, co.name
  order by c.state = 'signed_off', c.frozen_at desc
$$;

-- The moderator's own items, in one cycle or across all: numbered within the cycle by stratum then result, the same
-- order the review pages step through.
create function api.list_my_sample_items(p_cycle_id uuid default null)
returns table (
  item_id uuid,
  cycle_id uuid,
  cycle_name text,
  cohort_name text,
  seq integer,
  total integer,
  learner_name text,
  learner_number text,
  item_title text,
  inclusion_reason text,
  stratum text,
  state text,
  outcome text,
  last_finding_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select si.*, row_number() over (partition by si.cycle_id order by si.stratum, si.result_id)::integer as seq,
      count(*) over (partition by si.cycle_id)::integer as total
    from moderation.sample_items si
    where si.moderator_id = auth.uid()
  )
  select m.id, c.id, c.name, co.name, m.seq, m.total, lp.full_name, lp.learner_number, ai.title,
    m.inclusion_reason, m.stratum, m.state, d.outcome,
    (select max(f.created_at) from moderation.findings f where f.sample_item_id = m.id)
  from mine m
  join moderation.cycles c on c.id = m.cycle_id
  join programmes.cohorts co on co.id = c.cohort_id
  join assessment.results r on r.id = m.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join identity.profiles lp on lp.id = r.learner_id
  join assessment.decisions d on d.id = coalesce(r.pending_decision_id, r.current_decision_id)
  where p_cycle_id is null or c.id = p_cycle_id
  order by c.state = 'signed_off', c.frozen_at desc, m.seq
$$;

-- M-03 (FR-507): everything about one sampled item on one route. Refuses with the conflict named, and no evidence,
-- when the moderator assessed the result (BR-01); an item allocated to someone else reads as not found.
create function api.open_sample_item(p_item_id uuid)
returns table (
  status text,
  item_id uuid,
  cycle_id uuid,
  cycle_name text,
  cycle_state text,
  cohort_name text,
  seq integer,
  total integer,
  next_item_id uuid,
  previous_item_id uuid,
  learner_name text,
  learner_number text,
  item_title text,
  inclusion_reason text,
  stratum text,
  state text,
  assessor_name text,
  outcome text,
  justification text,
  feedback text,
  remediation text,
  resubmission_days integer,
  decided_at timestamptz,
  marks jsonb,
  assessed_version jsonb,
  files jsonb,
  decisions jsonb,
  findings jsonb,
  my_concluded integer,
  my_items integer,
  -- When status is separation_of_duties_conflict: the decision the moderator took.
  conflict jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select si.*, row_number() over (partition by si.cycle_id order by si.stratum, si.result_id)::integer as seq,
      count(*) over (partition by si.cycle_id)::integer as total,
      lead(si.id) over (partition by si.cycle_id order by si.stratum, si.result_id) as next_id,
      lag(si.id) over (partition by si.cycle_id order by si.stratum, si.result_id) as previous_id
    from moderation.sample_items si
    where si.moderator_id = auth.uid()
  ),
  item as (
    select m.*, r.learner_id, r.assessable_item_id, coalesce(r.pending_decision_id, r.current_decision_id) as decision_id,
      moderation.assessed_result(auth.uid(), m.result_id) as conflict
    from mine m join assessment.results r on r.id = m.result_id
    where m.id = p_item_id
  )
  select
    case when i.conflict then 'separation_of_duties_conflict' else 'ok' end,
    i.id, c.id, c.name, c.state, co.name, i.seq, i.total, i.next_id, i.previous_id,
    lp.full_name, lp.learner_number, ai.title, i.inclusion_reason, i.stratum, i.state,
    case when i.conflict then null else ap.full_name end,
    case when i.conflict then null else d.outcome end,
    case when i.conflict then null else d.justification end,
    case when i.conflict then null else nullif(btrim(d.feedback), '') end,
    case when i.conflict then null else d.remediation end,
    case when i.conflict then null else d.resubmission_days end,
    case when i.conflict then null else d.created_at end,
    case when i.conflict then null else coalesce((
      select jsonb_agg(jsonb_build_object(
               'ordinal', tc.ordinal, 'title', tc.title, 'descriptor', tc.descriptor, 'max_points', tc.points,
               'points', (sc.score ->> 'points')::integer,
               'comment', nullif(btrim(sc.score ->> 'comment'), '')) order by tc.ordinal)
      from submissions.task_criteria tc
      left join lateral (
        select e as score from jsonb_array_elements(coalesce(d.scores, '[]'::jsonb)) e
        where (e ->> 'ordinal')::integer = tc.ordinal
        limit 1
      ) sc on true
      where tc.task_id = ai.task_id
    ), '[]'::jsonb) end,
    case when i.conflict then null else (
      select jsonb_build_object('version_number', v.version_number, 'submitted_at', v.submitted_at,
                                'is_late', v.is_late, 'receipt_reference', v.receipt_reference)
      from assessment.assessment_instances ins
      join submissions.submission_versions v on v.id = ins.submission_version_id
      where ins.id = d.instance_id) end,
    case when i.conflict then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'filename', sf.original_filename, 'bytes', sf.bytes, 'media_type', sf.media_type,
               'bucket', sf.bucket, 'object_key', sf.object_key, 'requirement', q.title)
             order by q.ordinal nulls last, sf.original_filename)
      from assessment.assessment_instances ins
      join submissions.submission_files vf on vf.version_id = ins.submission_version_id
      join submissions.stored_files sf on sf.id = vf.stored_file_id
      left join submissions.task_evidence_requirements q on q.id = vf.requirement_id
      where ins.id = d.instance_id
    ), '[]'::jsonb) end,
    case when i.conflict then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'decision_id', x.id, 'type', x.type, 'outcome', x.outcome, 'decided_at', x.created_at,
               'actor_name', xp.full_name, 'version_number', v.version_number, 'justification', x.justification,
               'current', x.id = i.decision_id) order by x.created_at desc)
      from assessment.decisions x
      left join identity.profiles xp on xp.id = x.actor_id
      left join assessment.assessment_instances ins on ins.id = x.instance_id
      left join submissions.submission_versions v on v.id = ins.submission_version_id
      where x.result_id = i.result_id), '[]'::jsonb) end,
    coalesce((select jsonb_agg(jsonb_build_object(
                'finding_id', f.id, 'finding', f.finding, 'reasons', f.reasons, 'recorded_at', f.created_at,
                'moderator_name', fp.full_name, 'decision_id', f.decision_id,
                'on_current', f.decision_id = i.decision_id) order by f.created_at desc)
              from moderation.findings f join identity.profiles fp on fp.id = f.moderator_id
              where f.sample_item_id = i.id), '[]'::jsonb),
    (select count(*)::integer from moderation.sample_items x where x.cycle_id = c.id and x.moderator_id = auth.uid() and x.state = 'agreed'),
    (select count(*)::integer from moderation.sample_items x where x.cycle_id = c.id and x.moderator_id = auth.uid()),
    case when i.conflict then (
      select jsonb_agg(jsonb_build_object('decision_id', x.id, 'outcome', x.outcome, 'decided_at', x.created_at) order by x.created_at)
      from assessment.decisions x where x.result_id = i.result_id and x.actor_id = auth.uid() and x.type = 'assessment') end
  from item i
  join moderation.cycles c on c.id = i.cycle_id
  join programmes.cohorts co on co.id = c.cohort_id
  join assessment.assessable_items ai on ai.id = i.assessable_item_id
  join identity.profiles lp on lp.id = i.learner_id
  join assessment.decisions d on d.id = i.decision_id
  left join identity.profiles ap on ap.id = d.actor_id
$$;

-- M-02: the observations recorded on a cycle, oldest first; moderators and coordinators of the cohort read them.
create function api.list_moderation_observations(p_cycle_id uuid)
returns table (id uuid, moderator_name text, body text, created_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, p.full_name, o.body, o.created_at, o.moderator_id = auth.uid()
  from moderation.observations o
  join moderation.cycles c on c.id = o.cycle_id
  join identity.profiles p on p.id = o.moderator_id
  where o.cycle_id = p_cycle_id
    and (programmes.can_coordinate(auth.uid(), c.cohort_id)
         or exists (select 1 from moderation.sample_items si where si.cycle_id = c.id and si.moderator_id = auth.uid()))
  order by o.created_at
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The moderator's commands
-- ---------------------------------------------------------------------------------------------------------------

-- Records a finding (FR-508). Statuses: ok, not_found, separation_of_duties_conflict, not_open (the cycle is signed
-- off), invalid_finding, reasons_required.
create function api.record_moderation_finding(p_item_id uuid, p_finding text, p_reasons text)
returns table (status text, finding_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item moderation.sample_items;
  v_cycle moderation.cycles;
  v_decision uuid;
  v_finding uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  select * into v_item from moderation.sample_items si where si.id = p_item_id and si.moderator_id = v_actor for update;
  if not found then return query select 'not_found'::text, null::uuid; return; end if;
  if moderation.assessed_result(v_actor, v_item.result_id) then
    return query select 'separation_of_duties_conflict'::text, null::uuid; return;
  end if;
  select * into v_cycle from moderation.cycles c where c.id = v_item.cycle_id;
  if v_cycle.state <> 'frozen' then return query select 'not_open'::text, null::uuid; return; end if;
  if p_finding is null or p_finding not in ('agree', 'disagree') then
    return query select 'invalid_finding'::text, null::uuid; return;
  end if;
  if char_length(btrim(coalesce(p_reasons, ''))) not between 1 and 4000 then
    return query select 'reasons_required'::text, null::uuid; return;
  end if;

  select coalesce(r.pending_decision_id, r.current_decision_id) into v_decision
  from assessment.results r where r.id = v_item.result_id;

  insert into moderation.findings (sample_item_id, cycle_id, moderator_id, decision_id, finding, reasons)
  values (v_item.id, v_item.cycle_id, v_actor, v_decision, p_finding, btrim(p_reasons))
  returning id into v_finding;

  update moderation.sample_items si
  set state = case when p_finding = 'agree' then 'agreed' else 'disagreed' end
  where si.id = v_item.id;

  perform audit.append('moderation.finding_recorded', 'moderation_sample_item', v_item.id::text,
    jsonb_build_object('finding_id', v_finding, 'decision_id', v_decision, 'finding', p_finding), 'moderator',
    jsonb_build_object('state', v_item.state),
    jsonb_build_object('state', case when p_finding = 'agree' then 'agreed' else 'disagreed' end),
    'cohort', v_cycle.cohort_id);

  return query select 'ok'::text, v_finding;
end
$$;

-- Records a cohort-level observation on a cycle the moderator holds items in (FR-508).
create function api.record_moderation_observation(p_cycle_id uuid, p_body text)
returns table (status text, observation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cycle moderation.cycles;
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id;
  if not found or not exists (select 1 from moderation.sample_items si where si.cycle_id = p_cycle_id and si.moderator_id = v_actor) then
    return query select 'not_found'::text, null::uuid; return;
  end if;
  if v_cycle.state <> 'frozen' then return query select 'not_open'::text, null::uuid; return; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    return query select 'body_required'::text, null::uuid; return;
  end if;

  insert into moderation.observations (cycle_id, moderator_id, body) values (p_cycle_id, v_actor, btrim(p_body))
  returning id into v_id;
  perform audit.append('moderation.observation_recorded', 'moderation_cycle', p_cycle_id::text,
    jsonb_build_object('observation_id', v_id), 'moderator', null, null, 'cohort', v_cycle.cohort_id);
  return query select 'ok'::text, v_id;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The coordinator's reads and reallocation (C-07)
-- ---------------------------------------------------------------------------------------------------------------

-- Every sampled item of a cycle, with who holds it and where it stands.
create function api.list_cycle_sample_items(p_cycle_id uuid)
returns table (
  item_id uuid,
  seq integer,
  learner_name text,
  learner_number text,
  item_title text,
  inclusion_reason text,
  stratum text,
  state text,
  outcome text,
  assessor_name text,
  moderator_id uuid,
  moderator_name text,
  allocated_at timestamptz,
  last_finding text,
  last_finding_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select si.id, row_number() over (order by si.stratum, si.result_id)::integer, lp.full_name, lp.learner_number, ai.title,
    si.inclusion_reason, si.stratum, si.state, d.outcome, ap.full_name, si.moderator_id, mp.full_name, si.allocated_at,
    (select f.finding from moderation.findings f where f.sample_item_id = si.id order by f.created_at desc limit 1),
    (select max(f.created_at) from moderation.findings f where f.sample_item_id = si.id)
  from moderation.sample_items si
  join moderation.cycles c on c.id = si.cycle_id
  join assessment.results r on r.id = si.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join identity.profiles lp on lp.id = r.learner_id
  join assessment.decisions d on d.id = coalesce(r.pending_decision_id, r.current_decision_id)
  left join identity.profiles ap on ap.id = d.actor_id
  left join identity.profiles mp on mp.id = si.moderator_id
  where si.cycle_id = p_cycle_id and programmes.can_coordinate(auth.uid(), c.cohort_id)
  order by si.stratum, si.result_id
$$;

-- The moderators an item could go to, each saying whether they assessed the result (and so cannot take it).
create function api.list_sample_moderator_candidates(p_item_id uuid)
returns table (profile_id uuid, full_name text, conflict boolean, holds_now boolean, items_in_cycle integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.profile_id, m.full_name, moderation.assessed_result(m.profile_id, si.result_id),
    si.moderator_id = m.profile_id,
    (select count(*)::integer from moderation.sample_items x where x.cycle_id = si.cycle_id and x.moderator_id = m.profile_id)
  from moderation.sample_items si
  join moderation.cycles c on c.id = si.cycle_id
  cross join lateral moderation.eligible_moderators(c.cohort_id) m
  where si.id = p_item_id and programmes.can_coordinate(auth.uid(), c.cohort_id)
  order by m.full_name
$$;

-- Reallocates an item (FR-504). Refused with the conflict named when the person assessed the result, and once the
-- item is concluded. The new moderator is told.
create function api.reallocate_sample_item(p_item_id uuid, p_moderator_id uuid)
returns table (status text, conflict jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item moderation.sample_items;
  v_cycle moderation.cycles;
  v_cohort text;
  v_title text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::jsonb; return; end if;
  select * into v_item from moderation.sample_items si where si.id = p_item_id;
  if not found then return query select 'not_found'::text, null::jsonb; return; end if;
  select * into v_cycle from moderation.cycles c where c.id = v_item.cycle_id;
  if not programmes.can_coordinate(v_actor, v_cycle.cohort_id) then return query select 'not_found'::text, null::jsonb; return; end if;
  if v_cycle.state <> 'frozen' then return query select 'not_open'::text, null::jsonb; return; end if;
  if v_item.state = 'agreed' then return query select 'concluded'::text, null::jsonb; return; end if;
  if p_moderator_id is null or not exists (select 1 from moderation.eligible_moderators(v_cycle.cohort_id) m where m.profile_id = p_moderator_id) then
    return query select 'not_a_moderator'::text, null::jsonb; return;
  end if;
  if v_item.moderator_id = p_moderator_id then return query select 'unchanged'::text, null::jsonb; return; end if;
  if moderation.assessed_result(p_moderator_id, v_item.result_id) then
    return query select 'separation_of_duties_conflict'::text,
      (select jsonb_agg(jsonb_build_object('decision_id', x.id, 'outcome', x.outcome, 'decided_at', x.created_at,
                                            'actor_name', p.full_name) order by x.created_at)
       from assessment.decisions x join identity.profiles p on p.id = x.actor_id
       where x.result_id = v_item.result_id and x.actor_id = p_moderator_id and x.type = 'assessment');
    return;
  end if;

  update moderation.sample_items si
  set moderator_id = p_moderator_id, state = case when si.state = 'unallocated' then 'allocated' else si.state end,
      allocated_at = now()
  where si.id = p_item_id;

  perform audit.append('moderation.sample_item_reallocated', 'moderation_sample_item', p_item_id::text, '{}'::jsonb,
    'coordinator', jsonb_build_object('moderator_id', v_item.moderator_id),
    jsonb_build_object('moderator_id', p_moderator_id), 'cohort', v_cycle.cohort_id);

  select co.name into v_cohort from programmes.cohorts co where co.id = v_cycle.cohort_id;
  select ai.title into v_title from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where r.id = v_item.result_id;
  perform notifications.enqueue('moderation_item_reallocated',
    'moderation_item_reallocated:' || p_item_id::text || ':' || p_moderator_id::text, p_moderator_id,
    jsonb_build_object('cycle_id', v_cycle.id, 'cycle_name', v_cycle.name, 'cohort_name', v_cohort, 'item_title', v_title),
    '/moderate/cycles/' || v_cycle.id::text || '/items/' || p_item_id::text);

  return query select 'ok'::text, null::jsonb;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.list_my_moderation_cycles(), api.list_my_sample_items(uuid), api.open_sample_item(uuid),
  api.list_moderation_observations(uuid), api.record_moderation_finding(uuid, text, text),
  api.record_moderation_observation(uuid, text), api.list_cycle_sample_items(uuid),
  api.list_sample_moderator_candidates(uuid), api.reallocate_sample_item(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function api.list_my_moderation_cycles(), api.list_my_sample_items(uuid), api.open_sample_item(uuid),
  api.list_moderation_observations(uuid), api.record_moderation_finding(uuid, text, text),
  api.record_moderation_observation(uuid, text), api.list_cycle_sample_items(uuid),
  api.list_sample_moderator_candidates(uuid), api.reallocate_sample_item(uuid, uuid)
  to authenticated;
