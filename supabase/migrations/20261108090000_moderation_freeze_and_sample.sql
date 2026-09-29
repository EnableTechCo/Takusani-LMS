-- Freeze and sample (S4-06; FR-501 to FR-506; NFR-06; ADR-019). Freezing a planned cycle claims every result
-- waiting in its scope as an immutable population with a digest, and draws the sample in the same transaction:
-- every Not yet competent decision and every decision by a first-time assessor (no decision of theirs in any
-- signed-off cycle yet) is included; the rest is stratified by assessor, outcome and unit, and drawn at random
-- within each stratum to the configured percentage. The seed, the rule version, the algorithm version and the
-- selection basis are stored, so the same population and seed always give the same sample; a sample is never
-- redrawn. Sampled items go to the cohort's moderators in turn, never to one who assessed the result (FR-504).
-- A scheduled cycle freezes by itself at its start through the scheduled-jobs framework (FR-501); the manual
-- command and the scheduled run are idempotent against each other, and a retry returns the same sample.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

-- The population: the results a cycle claimed at its freeze, and the facts the sample was drawn from. Append-only.
create table moderation.populations (
  cycle_id uuid primary key references moderation.cycles (id),
  frozen_at timestamptz not null default now(),
  -- Null when the scheduler froze the cycle at its start time.
  frozen_by uuid references identity.profiles (id),
  size integer not null check (size >= 1),
  -- sha256 over the result ids in order: any later change to the population shows.
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  -- Per result: the decision, the assessor, the outcome, the unit, and whether the assessor was first-time then.
  basis jsonb not null
);

create trigger populations_append_only
  before update or delete on moderation.populations
  for each row execute function audit.forbid_mutation();
create trigger populations_append_only_truncate
  before truncate on moderation.populations
  for each statement execute function audit.forbid_mutation();

create table moderation.samples (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null unique references moderation.cycles (id),
  generated_at timestamptz not null default now(),
  seed text not null,
  algorithm_version text not null,
  rule_version integer not null,
  percentage integer not null check (percentage between 0 and 100),
  population_digest text not null,
  -- One row per stratum: its label, how many results it holds, how many were sampled, and why.
  strata jsonb not null,
  mandatory_nyc integer not null check (mandatory_nyc >= 0),
  mandatory_first_time integer not null check (mandatory_first_time >= 0),
  random_draw integer not null check (random_draw >= 0)
);

create table moderation.sample_items (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references moderation.samples (id),
  cycle_id uuid not null references moderation.cycles (id),
  result_id uuid not null references assessment.results (id),
  stratum text not null,
  inclusion_reason text not null check (inclusion_reason in ('nyc', 'first_time_assessor', 'random')),
  -- The moderator reviewing it; null while nobody eligible could be found (FR-504). Review states come with S4-07.
  moderator_id uuid references identity.profiles (id),
  state text not null default 'unallocated' check (state in ('unallocated', 'allocated')),
  allocated_at timestamptz,
  unique (cycle_id, result_id),
  constraint allocation_is_recorded check ((moderator_id is not null) = (state <> 'unallocated'))
);

create index sample_items_moderator_idx on moderation.sample_items (moderator_id) where moderator_id is not null;
create index sample_items_result_idx on moderation.sample_items (result_id);

revoke all on table moderation.populations, moderation.samples, moderation.sample_items
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------

-- The moderators who may take items in a cohort: an active moderator role covering it, by name.
create function moderation.eligible_moderators(p_cohort_id uuid)
returns table (profile_id uuid, full_name text)
language sql
stable
set search_path = ''
as $$
  select distinct p.id, p.full_name
  from programmes.cohorts c
  join identity.role_assignments ra on ra.role = 'moderator' and ra.effective @> now()
  join identity.profiles p on p.id = ra.profile_id and p.status = 'active'
  where c.id = p_cohort_id
    and (ra.scope_type = 'global'
         or (ra.scope_type = 'programme' and ra.scope_key = c.programme_id)
         or (ra.scope_type = 'cohort' and ra.scope_key = c.id))
  order by p.full_name, p.id
$$;

-- Whether a person took any assessment decision on a result: such a person never moderates it (FR-504, BR-01).
create function moderation.assessed_result(p_profile_id uuid, p_result_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from assessment.decisions d
    where d.result_id = p_result_id and d.actor_id = p_profile_id and d.type = 'assessment'
  )
$$;

revoke all on function moderation.eligible_moderators(uuid), moderation.assessed_result(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Freeze and sample, in one transaction
-- ---------------------------------------------------------------------------------------------------------------

-- The command behind both the coordinator's button and the scheduler. Statuses: ok (frozen now, or already frozen:
-- a retry returns the same sample), not_found, not_planned (cancelled), nothing_to_freeze. Lock order: the cohort's
-- moderation state, the cycle, then the results in id order.
create function moderation.freeze(p_cycle_id uuid, p_actor uuid, p_seed text)
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

revoke all on function moderation.freeze(uuid, uuid, text) from public, anon, authenticated, service_role;

-- The coordinator's command. A frozen cycle answers ok with the sample it has (a retry changes nothing).
create function api.freeze_moderation_cycle(p_cycle_id uuid, p_expected_version integer, p_seed text default null)
returns table (status text, population integer, sample integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cycle moderation.cycles;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer; return; end if;
  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id;
  if not found or not programmes.can_coordinate(v_actor, v_cycle.cohort_id) then
    return query select 'not_found'::text, null::integer, null::integer; return;
  end if;
  if v_cycle.state = 'planned' and v_cycle.version <> p_expected_version then
    return query select 'stale_version'::text, null::integer, null::integer; return;
  end if;
  return query select * from moderation.freeze(p_cycle_id, v_actor, p_seed);
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Scheduled cycles freeze by themselves (FR-501)
-- ---------------------------------------------------------------------------------------------------------------

-- One cycle, as a one-shot run: the population size, or null when there was nothing to do.
create function moderation.freeze_due_cycle(p_cycle_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_population integer;
begin
  select f.status, f.population into v_status, v_population
  from moderation.freeze(p_cycle_id::uuid, null, null) f;
  if v_status = 'ok' then return v_population; end if;
  return null;
end
$$;

-- Every planned cycle whose start has come and that has something to freeze, each on its own.
create function moderation.freeze_due_cycles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_frozen integer := 0;
begin
  for v_id in
    select c.id from moderation.cycles c
    where c.state = 'planned' and c.scheduled_start_at is not null and c.scheduled_start_at <= now()
      and exists (
        select 1 from assessment.results r
        join moderation.cycle_scope s on s.cycle_id = c.id and s.assessable_item_id = r.assessable_item_id
        where moderation.is_waiting(r))
    order by c.scheduled_start_at
  loop
    if audit.run_once('freeze-moderation-cycle', v_id::text) = 'done' then v_frozen := v_frozen + 1; end if;
  end loop;
  return v_frozen;
end
$$;

revoke all on function moderation.freeze_due_cycle(text), moderation.freeze_due_cycles()
  from public, anon, authenticated, service_role;

insert into audit.scheduled_jobs (name, kind, description, handler, schedule, heartbeat_within) values
('freeze-due-moderation-cycles', 'recurring', 'Freezes and samples each scheduled moderation cycle whose start has come.',
 'moderation.freeze_due_cycles', '* * * * *', interval '5 minutes'),
('freeze-moderation-cycle', 'one_shot', 'Freezes and samples one scheduled moderation cycle, once.',
 'moderation.freeze_due_cycle', null, null);

select cron.schedule('freeze-due-moderation-cycles', '* * * * *', $$select audit.run_job('freeze-due-moderation-cycles')$$);

-- ---------------------------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------------------------

-- The sample record of a frozen cycle (C-06, C-07): the population, the draw, the strata, the seed and rule, the
-- digest, and who holds the items.
create function api.get_moderation_sample(p_cycle_id uuid)
returns table (
  cycle_id uuid,
  frozen_at timestamptz,
  frozen_by_name text,
  population integer,
  digest text,
  sample_size integer,
  mandatory_nyc integer,
  mandatory_first_time integer,
  random_draw integer,
  percentage integer,
  rule_version integer,
  algorithm_version text,
  seed text,
  strata jsonb,
  allocations jsonb,
  unallocated integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, pp.frozen_at, fb.full_name, pp.size, pp.digest,
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id),
    s.mandatory_nyc, s.mandatory_first_time, s.random_draw, s.percentage, s.rule_version, s.algorithm_version, s.seed,
    s.strata,
    coalesce((select jsonb_agg(jsonb_build_object('moderator_name', a.full_name, 'count', a.n) order by a.n desc, a.full_name)
              from (select p.full_name, count(*) as n from moderation.sample_items si
                    join identity.profiles p on p.id = si.moderator_id
                    where si.cycle_id = c.id group by p.full_name) a), '[]'::jsonb),
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id and si.moderator_id is null)
  from moderation.cycles c
  join moderation.populations pp on pp.cycle_id = c.id
  join moderation.samples s on s.cycle_id = c.id
  left join identity.profiles fb on fb.id = pp.frozen_by
  where c.id = p_cycle_id and programmes.can_coordinate(auth.uid(), c.cohort_id)
$$;

-- The cycles list now says how many items each frozen cycle sampled.
drop function api.list_moderation_cycles(uuid);

create function api.list_moderation_cycles(p_cohort_id uuid)
returns table (
  id uuid,
  name text,
  state text,
  unit_ids uuid[],
  period_from date,
  period_to date,
  scheduled_start_at timestamptz,
  planned_by_name text,
  planned_at timestamptz,
  frozen_at timestamptz,
  cancelled_by_name text,
  cancelled_at timestamptz,
  cancel_reason text,
  version integer,
  items jsonb,
  waiting integer,
  held integer,
  sampled integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.state, c.unit_ids, c.period_from, c.period_to, c.scheduled_start_at,
    pb.full_name, c.planned_at, c.frozen_at, cb.full_name, c.cancelled_at, c.cancel_reason, c.version,
    coalesce((select jsonb_agg(jsonb_build_object('id', ai.id, 'title', ai.title, 'via_unit_id', s.via_unit_id)
                               order by ai.title)
              from moderation.cycle_scope s join assessment.assessable_items ai on ai.id = s.assessable_item_id
              where s.cycle_id = c.id), '[]'::jsonb),
    (select count(*)::integer from assessment.results r
     join moderation.cycle_scope s on s.cycle_id = c.id and s.assessable_item_id = r.assessable_item_id
     join assessment.decisions d on d.id = moderation.waiting_decision(r)
     where c.state = 'planned' and moderation.is_waiting(r)
       and (c.period_from is null or (d.created_at at time zone 'Africa/Johannesburg')::date >= c.period_from)
       and (c.period_to is null or (d.created_at at time zone 'Africa/Johannesburg')::date <= c.period_to)),
    (select count(*)::integer from assessment.results r where r.hold_cycle_id = c.id),
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id)
  from moderation.cycles c
  join identity.profiles pb on pb.id = c.planned_by
  left join identity.profiles cb on cb.id = c.cancelled_by
  where c.cohort_id = p_cohort_id and programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by c.planned_at desc
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.freeze_moderation_cycle(uuid, integer, text), api.get_moderation_sample(uuid),
  api.list_moderation_cycles(uuid)
  from public, anon, authenticated, service_role;
grant execute on function api.freeze_moderation_cycle(uuid, integer, text), api.get_moderation_sample(uuid),
  api.list_moderation_cycles(uuid)
  to authenticated;
