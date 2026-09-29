-- Moderation cycles (S4-05; FR-501, FR-506; ADR-019; P-02 confirmed 29 Sep 2026). A coordinator plans a cycle for a
-- moderated cohort with an explicit scope: named assessable items, or whole units (every item in the unit, including
-- ones added later), optionally limited to results decided in a period. At most one non-terminal cycle may cover an
-- item, so no result can be sampled or released twice. A cycle may be cancelled only while planned: the results it
-- would have claimed stay in the pending pool. Freeze and sampling (S4-06), review (S4-07, S4-08) and sign-off
-- (S4-09) build on these tables. Lock order everywhere: cohort moderation state, then the cycle, then results.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create table moderation.cycles (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references programmes.cohorts (id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  state text not null default 'planned' check (state in ('planned', 'frozen', 'signed_off', 'cancelled')),
  -- Whole units in scope: every assessable item of the unit, including ones added after planning.
  unit_ids uuid[] not null default '{}',
  -- Only results decided in this period are claimed at the freeze (both bounds optional, South African dates).
  period_from date,
  period_to date,
  -- Null: frozen when the coordinator chooses. Set: frozen automatically at that moment (FR-501, S4-06).
  scheduled_start_at timestamptz,
  planned_by uuid not null references identity.profiles (id),
  planned_at timestamptz not null default now(),
  frozen_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references identity.profiles (id),
  cancel_reason text check (cancel_reason is null or char_length(btrim(cancel_reason)) between 1 and 500),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  constraint period_is_ordered check (period_from is null or period_to is null or period_from <= period_to),
  constraint cancellation_is_recorded check (
    (state = 'cancelled') = (cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)
  ),
  constraint frozen_states_have_a_freeze check ((state in ('frozen', 'signed_off')) = (frozen_at is not null))
);

create index cycles_cohort_idx on moderation.cycles (cohort_id, planned_at desc);
create index cycles_scheduled_idx on moderation.cycles (scheduled_start_at) where state = 'planned' and scheduled_start_at is not null;

-- The assessable items a cycle covers. `open` mirrors the cycle being non-terminal, so the database itself holds
-- the rule that an item is in at most one open cycle (the exclusion rule of ADR-019).
create table moderation.cycle_scope (
  cycle_id uuid not null references moderation.cycles (id),
  assessable_item_id uuid not null references assessment.assessable_items (id),
  -- Set when the item came in through a whole unit rather than by name.
  via_unit_id uuid references programmes.units (id),
  open boolean not null default true,
  primary key (cycle_id, assessable_item_id)
);

create unique index cycle_scope_one_open_per_item on moderation.cycle_scope (assessable_item_id) where open;

-- A held result belongs to a cycle from its freeze (S4-06).
alter table assessment.results
  add constraint results_hold_cycle_fkey foreign key (hold_cycle_id) references moderation.cycles (id);

revoke all on table moderation.cycles, moderation.cycle_scope from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------

-- The unit an assessable item belongs to, through its assignment's module. Null for an item with no module.
create function moderation.item_unit(p_item_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select m.unit_id
  from assessment.assessable_items ai
  join submissions.tasks t on t.id = ai.task_id
  join programmes.modules m on m.id = t.module_id
  where ai.id = p_item_id
$$;

-- The pending pool: results waiting for a cycle, that is held with no cycle, or released with a later decision
-- held behind them (S4-04). Never counts results already claimed by a cycle.
create function moderation.is_waiting(p_result assessment.results)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_result.hold_cycle_id is null and (p_result.state = 'held' or p_result.pending_decision_id is not null)
$$;

-- The decision a waiting result is waiting on: the one held behind a release, else the current one.
create function moderation.waiting_decision(p_result assessment.results)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_result.pending_decision_id, p_result.current_decision_id)
$$;

-- The open cycle (planned or frozen) that already covers an item, by name or through its unit. Null when none.
create function moderation.open_cycle_for(p_item_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select c.id
  from moderation.cycles c
  where c.state in ('planned', 'frozen')
    and (exists (select 1 from moderation.cycle_scope s where s.cycle_id = c.id and s.assessable_item_id = p_item_id and s.open)
         or moderation.item_unit(p_item_id) = any (c.unit_ids))
  order by c.planned_at
  limit 1
$$;

revoke all on function moderation.item_unit(uuid), moderation.is_waiting(assessment.results),
  moderation.waiting_decision(assessment.results), moderation.open_cycle_for(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Plan a cycle
-- ---------------------------------------------------------------------------------------------------------------

-- Scope is p_item_ids, plus every item of the cohort in p_unit_ids. Refused in words when the cohort is not
-- moderated, the scope is empty or outside the cohort, the period is backwards, the start is in the past, or an item
-- is already in another open cycle (which the reply names, so the page can say what to take out).
create function api.plan_moderation_cycle(
  p_cohort_id uuid,
  p_name text,
  p_item_ids uuid[] default '{}',
  p_unit_ids uuid[] default '{}',
  p_period_from date default null,
  p_period_to date default null,
  p_scheduled_start_at timestamptz default null
)
returns table (
  status text,
  cycle_id uuid,
  conflict_item_id uuid,
  conflict_item_title text,
  conflict_cycle_id uuid,
  conflict_cycle_name text,
  conflict_cycle_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_policy text;
  v_items uuid[];
  v_item uuid;
  v_other uuid;
  v_cycle moderation.cycles;
  v_unit_ids uuid[] := coalesce(p_unit_ids, '{}');
  v_item_ids uuid[] := coalesce(p_item_ids, '{}');
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return; end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status in ('setup', 'active')) then
    return query select 'cohort_not_found'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;
  if not programmes.can_coordinate(v_actor, p_cohort_id) then
    return query select 'forbidden'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;

  -- Lock order: the cohort's moderation state first, which also serialises planning within the cohort.
  select ms.moderation_policy into v_policy
  from programmes.cohort_moderation_state ms where ms.cohort_id = p_cohort_id for update;
  if v_policy is distinct from 'moderated' then
    return query select 'not_moderated'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120 then
    return query select 'invalid_name'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;
  if exists (select 1 from unnest(v_unit_ids) u(id)
             where not exists (select 1 from programmes.units un
                               join programmes.qualifications q on q.id = un.qualification_id
                               join programmes.cohorts c on c.programme_id = q.programme_id
                               where un.id = u.id and c.id = p_cohort_id)) then
    return query select 'unknown_unit'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;
  if exists (select 1 from unnest(v_item_ids) i(id)
             where not exists (select 1 from assessment.assessable_items ai where ai.id = i.id and ai.cohort_id = p_cohort_id)) then
    return query select 'unknown_item'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;
  if p_period_from is not null and p_period_to is not null and p_period_from > p_period_to then
    return query select 'invalid_period'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;
  if p_scheduled_start_at is not null and p_scheduled_start_at <= now() then
    return query select 'start_in_past'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;

  -- The scope as it stands now: named items, plus the items of the whole units.
  select coalesce(array_agg(distinct id), '{}') into v_items
  from (
    select i.id from unnest(v_item_ids) i(id)
    union
    select ai.id from assessment.assessable_items ai
    where ai.cohort_id = p_cohort_id and moderation.item_unit(ai.id) = any (v_unit_ids)
  ) scope;
  if cardinality(v_items) = 0 and cardinality(v_unit_ids) = 0 then
    return query select 'empty_scope'::text, null::uuid, null::uuid, null::text, null::uuid, null::text, null::text; return;
  end if;

  -- One open cycle per item: by name, or through a unit either side.
  foreach v_item in array v_items loop
    v_other := moderation.open_cycle_for(v_item);
    if v_other is not null then
      return query
        select 'scope_overlap'::text, null::uuid, v_item, ai.title, c.id, c.name, c.state
        from assessment.assessable_items ai, moderation.cycles c
        where ai.id = v_item and c.id = v_other;
      return;
    end if;
  end loop;
  if cardinality(v_unit_ids) > 0 then
    v_item := null; v_other := null;
    select s.assessable_item_id, s.cycle_id into v_item, v_other
    from moderation.cycle_scope s
    join assessment.assessable_items ai on ai.id = s.assessable_item_id
    where s.open and ai.cohort_id = p_cohort_id and moderation.item_unit(s.assessable_item_id) = any (v_unit_ids)
    order by s.cycle_id limit 1;
    if v_item is not null then
      return query
        select 'scope_overlap'::text, null::uuid, v_item, ai.title, c.id, c.name, c.state
        from assessment.assessable_items ai, moderation.cycles c
        where ai.id = v_item and c.id = v_other;
      return;
    end if;
  end if;

  insert into moderation.cycles (cohort_id, name, unit_ids, period_from, period_to, scheduled_start_at, planned_by)
  values (p_cohort_id, btrim(p_name), v_unit_ids, p_period_from, p_period_to, p_scheduled_start_at, v_actor)
  returning * into v_cycle;

  insert into moderation.cycle_scope (cycle_id, assessable_item_id, via_unit_id)
  select v_cycle.id, i.id,
         case when moderation.item_unit(i.id) = any (v_unit_ids) and not (i.id = any (v_item_ids))
              then moderation.item_unit(i.id) end
  from unnest(v_items) i(id);

  perform audit.append('moderation.cycle_planned', 'moderation_cycle', v_cycle.id::text,
    jsonb_build_object('item_ids', v_items, 'unit_ids', v_unit_ids), 'coordinator', null,
    jsonb_build_object('name', v_cycle.name, 'state', v_cycle.state, 'period_from', v_cycle.period_from,
                       'period_to', v_cycle.period_to, 'scheduled_start_at', v_cycle.scheduled_start_at),
    'cohort', p_cohort_id);

  return query select 'ok'::text, v_cycle.id, null::uuid, null::text, null::uuid, null::text, null::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Cancel a cycle, only while planned
-- ---------------------------------------------------------------------------------------------------------------

create function api.cancel_moderation_cycle(p_cycle_id uuid, p_expected_version integer, p_reason text)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cycle moderation.cycles;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id;
  if not found or not programmes.can_coordinate(v_actor, v_cycle.cohort_id) then
    return query select 'not_found'::text; return;
  end if;
  -- Lock order: moderation state, then the cycle.
  perform 1 from programmes.cohort_moderation_state ms where ms.cohort_id = v_cycle.cohort_id for update;
  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id for update;
  if v_cycle.state <> 'planned' then return query select 'not_planned'::text; return; end if;
  if v_cycle.version <> p_expected_version then return query select 'stale_version'::text; return; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    return query select 'reason_required'::text; return;
  end if;

  update moderation.cycles c
  set state = 'cancelled', cancelled_at = now(), cancelled_by = v_actor, cancel_reason = btrim(p_reason),
      version = c.version + 1, updated_at = now()
  where c.id = p_cycle_id;
  update moderation.cycle_scope s set open = false where s.cycle_id = p_cycle_id;

  perform audit.append('moderation.cycle_cancelled', 'moderation_cycle', p_cycle_id::text, '{}'::jsonb, 'coordinator',
    jsonb_build_object('state', 'planned'), jsonb_build_object('state', 'cancelled', 'reason', btrim(p_reason)),
    'cohort', v_cycle.cohort_id);

  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads for the planning page
-- ---------------------------------------------------------------------------------------------------------------

-- The cohort's cycles, newest first, each with its items and how many results it would claim now (planned) or holds.
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
  held integer
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
    (select count(*)::integer from assessment.results r where r.hold_cycle_id = c.id)
  from moderation.cycles c
  join identity.profiles pb on pb.id = c.planned_by
  left join identity.profiles cb on cb.id = c.cancelled_by
  where c.cohort_id = p_cohort_id and programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by c.planned_at desc
$$;

-- The pending pool by assessable item, with every item of the cohort so the plan form can list them: results waiting
-- for a cycle (and which assessors decided them), the oldest decision waiting, results held in a cycle, results
-- released, and the open cycle that already covers the item.
create function api.get_moderation_pool(p_cohort_id uuid)
returns table (
  item_id uuid,
  title text,
  kind text,
  unit_id uuid,
  unit_code text,
  unit_title text,
  waiting integer,
  oldest_decided_at timestamptz,
  assessors jsonb,
  held integer,
  released integer,
  open_cycle_id uuid,
  open_cycle_name text,
  open_cycle_state text,
  open_cycle_scheduled_start_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with items as (
    select ai.id, ai.title, ai.kind, moderation.item_unit(ai.id) as unit_id
    from assessment.assessable_items ai
    where ai.cohort_id = p_cohort_id and programmes.can_coordinate(auth.uid(), p_cohort_id)
  ),
  waiting as (
    select r.assessable_item_id, d.created_at, p.full_name
    from assessment.results r
    join assessment.decisions d on d.id = moderation.waiting_decision(r)
    join identity.profiles p on p.id = d.actor_id
    where moderation.is_waiting(r) and r.assessable_item_id in (select id from items)
  )
  select i.id, i.title, i.kind, i.unit_id, u.code, u.title,
    (select count(*)::integer from waiting w where w.assessable_item_id = i.id),
    (select min(w.created_at) from waiting w where w.assessable_item_id = i.id),
    coalesce((select jsonb_agg(jsonb_build_object('name', a.full_name, 'count', a.n) order by a.n desc, a.full_name)
              from (select w.full_name, count(*) as n from waiting w where w.assessable_item_id = i.id group by w.full_name) a),
             '[]'::jsonb),
    (select count(*)::integer from assessment.results r where r.assessable_item_id = i.id and r.hold_cycle_id is not null and r.state = 'held'),
    (select count(*)::integer from assessment.results r where r.assessable_item_id = i.id and r.state = 'released' and r.pending_decision_id is null),
    c.id, c.name, c.state, c.scheduled_start_at
  from items i
  left join programmes.units u on u.id = i.unit_id
  left join moderation.cycles c on c.id = moderation.open_cycle_for(i.id)
  order by i.title
$$;

-- The figures at the top of the page, and the settings in force.
create function api.get_moderation_summary(p_cohort_id uuid)
returns table (
  moderation_policy text,
  max_hold_days integer,
  sampling_percentage integer,
  sampling_rule text,
  sampling_rule_version integer,
  waiting integer,
  oldest_waiting_at timestamptz,
  held integer,
  oldest_held_at timestamptz,
  planned_cycles integer,
  frozen_cycles integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select ms.moderation_policy,
    audit.config_int('moderation.hold.max_days'),
    audit.config_int('moderation.sampling.percentage'),
    (audit.config_version('moderation.sampling.rule')).value #>> '{}',
    (audit.config_version('moderation.sampling.rule')).version,
    (select count(*)::integer from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
     where ai.cohort_id = p_cohort_id and moderation.is_waiting(r)),
    (select min(d.created_at) from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
     join assessment.decisions d on d.id = moderation.waiting_decision(r)
     where ai.cohort_id = p_cohort_id and moderation.is_waiting(r)),
    (select count(*)::integer from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
     where ai.cohort_id = p_cohort_id and r.hold_cycle_id is not null and r.state = 'held'),
    (select min(d.created_at) from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
     join assessment.decisions d on d.id = moderation.waiting_decision(r)
     where ai.cohort_id = p_cohort_id and r.hold_cycle_id is not null and r.state = 'held'),
    (select count(*)::integer from moderation.cycles c where c.cohort_id = p_cohort_id and c.state = 'planned'),
    (select count(*)::integer from moderation.cycles c where c.cohort_id = p_cohort_id and c.state = 'frozen')
  from programmes.cohort_moderation_state ms
  where ms.cohort_id = p_cohort_id and programmes.can_coordinate(auth.uid(), p_cohort_id)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.plan_moderation_cycle(uuid, text, uuid[], uuid[], date, date, timestamptz),
  api.cancel_moderation_cycle(uuid, integer, text), api.list_moderation_cycles(uuid),
  api.get_moderation_pool(uuid), api.get_moderation_summary(uuid)
  from public, anon, authenticated, service_role;
grant execute on function api.plan_moderation_cycle(uuid, text, uuid[], uuid[], date, date, timestamptz),
  api.cancel_moderation_cycle(uuid, integer, text), api.list_moderation_cycles(uuid),
  api.get_moderation_pool(uuid), api.get_moderation_summary(uuid)
  to authenticated;
