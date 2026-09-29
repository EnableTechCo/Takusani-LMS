-- Unit credit roll-up and ledger (S6-01; FR-801 to FR-804; ADR-022; P-07 confirmed by the owner on 29 Sep 2026;
-- transaction tests 10, 17 and 25).
--
-- P-07: a learner earns a unit's credits when every assessable item the unit requires has a released Competent
-- decision; one item may count towards several units; the list of required items is frozen per cohort.
--
-- Requirement sets. A coordinator of the cohort drafts which of the cohort's published assessments each unit of the
-- programme requires, then freezes the draft. A frozen set never changes (a trigger refuses it, whoever tries). A
-- change is a new version: a new draft, frozen with a reason, which is the audited re-evaluation. Freezing any
-- version evaluates every learner with a result on its items, so work released before the freeze counts.
--
-- Evaluation. credits.learner_unit_outcomes holds one mutable row per learner and unit: whether the unit is awarded,
-- the award sequence, and the award in force (the set it was made under, its credits, the decisions it rests on).
-- Whenever a released result's current decision changes (release, moderation, appeal, correction), a trigger on the
-- result locks that row FOR UPDATE for every unit whose frozen set requires the item, re-evaluates, and appends an
-- award or a reversal to the ledger when the award state changes. The lock is the point: two required results
-- releasing at once serialise on it, and the second sees the first, so the learner is never silently left without
-- the award (ADR-022). Lock order stays cohort_moderation_state, cycles, results, learner_unit_outcomes: the trigger
-- runs while its result is locked.
--   * An award stands while the set it was made under is still met. A required result that becomes Not yet competent
--     (appeal, correction, moderation) appends a reversal of the same award sequence; a later Competent appends a new
--     award with the next sequence. So a requirement-set change never alters an award already made (test 25).
--   * Only released results count: a held result has no current decision the learner can see, and a later decision
--     on a released result that is waiting for moderation does not move the current decision (FR-804).
--   * Evaluating again with nothing changed appends nothing, and the ledger is unique on (learner, unit, award
--     sequence, entry type), so a retry can never award twice (test 10).
--
-- The ledger is append-only (UPDATE, DELETE, TRUNCATE revoked and refused by trigger). Each entry carries the signed
-- credits, the credit value in force, the requirement-set version, the contributing decisions and what caused it.
--
-- Reconciliation. A daily job compares the ledger with the outcome rows and with the rule, records any difference and
-- tells the administrators in the LMS. It repairs nothing: a difference means a defect to investigate.
--
-- Not here: the learner's credits record (S6-02) and the Department API's competency by unit (S6-06, S6-07), which
-- read these tables.

-- ---------------------------------------------------------------------------------------------------------------
-- Requirement sets
-- ---------------------------------------------------------------------------------------------------------------

create table credits.requirement_sets (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references programmes.cohorts (id),
  version integer not null check (version >= 1),
  created_by uuid not null references identity.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  frozen_at timestamptz,
  frozen_by uuid references identity.profiles (id),
  -- Why a later version replaces the one in force. Version 1 needs none.
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 1000),
  unique (cohort_id, version),
  constraint freezing_is_recorded check ((frozen_at is null) = (frozen_by is null)),
  constraint later_version_has_reason check (frozen_at is null or version = 1 or reason is not null)
);

-- At most one draft per cohort.
create unique index requirement_sets_one_draft_idx on credits.requirement_sets (cohort_id) where frozen_at is null;

create table credits.unit_assessment_requirements (
  requirement_set_id uuid not null references credits.requirement_sets (id) on delete cascade,
  unit_id uuid not null references programmes.units (id),
  assessable_item_id uuid not null references assessment.assessable_items (id),
  primary key (requirement_set_id, unit_id, assessable_item_id)
);

create index unit_assessment_requirements_item_idx on credits.unit_assessment_requirements (assessable_item_id);
create index unit_assessment_requirements_unit_idx on credits.unit_assessment_requirements (unit_id);

-- A frozen set and its requirements are fixed. A draft may be edited or discarded.
create function credits.forbid_frozen_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set uuid;
begin
  if tg_table_name = 'requirement_sets' then
    if old.frozen_at is not null then
      raise exception 'a frozen requirement set cannot change' using errcode = '42501';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_set := case when tg_op = 'DELETE' then old.requirement_set_id else new.requirement_set_id end;
  if exists (select 1 from credits.requirement_sets s where s.id = v_set and s.frozen_at is not null)
     or (tg_op = 'UPDATE' and exists (
       select 1 from credits.requirement_sets s where s.id = old.requirement_set_id and s.frozen_at is not null)) then
    raise exception 'the requirements of a frozen set cannot change' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger requirement_sets_frozen
  before update or delete on credits.requirement_sets
  for each row execute function credits.forbid_frozen_change();

create trigger unit_assessment_requirements_frozen
  before insert or update or delete on credits.unit_assessment_requirements
  for each row execute function credits.forbid_frozen_change();

-- ---------------------------------------------------------------------------------------------------------------
-- Outcomes and the ledger
-- ---------------------------------------------------------------------------------------------------------------

create table credits.learner_unit_outcomes (
  learner_id uuid not null references identity.profiles (id),
  unit_id uuid not null references programmes.units (id),
  awarded boolean not null default false,
  -- The sequence of the latest award; a reversal carries the sequence of the award it reverses.
  award_seq integer not null default 0 check (award_seq >= 0),
  -- The award in force, when awarded.
  requirement_set_id uuid references credits.requirement_sets (id),
  credits integer,
  contributing_decision_ids uuid[],
  awarded_at timestamptz,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  primary key (learner_id, unit_id),
  constraint award_is_described check (
    awarded = (requirement_set_id is not null)
    and awarded = (credits is not null)
    and awarded = (contributing_decision_ids is not null)
    and awarded = (awarded_at is not null)
    and (not awarded or award_seq >= 1)
  )
);

create index learner_unit_outcomes_unit_idx on credits.learner_unit_outcomes (unit_id);
create index learner_unit_outcomes_set_idx on credits.learner_unit_outcomes (requirement_set_id);

create table credits.ledger_entries (
  id bigint generated always as identity primary key,
  learner_id uuid not null references identity.profiles (id),
  unit_id uuid not null references programmes.units (id),
  award_seq integer not null check (award_seq >= 1),
  entry_type text not null check (entry_type in ('award', 'reversal')),
  -- Signed: an award adds the credit value, its reversal takes the same value away.
  credits integer not null,
  credit_value integer not null check (credit_value between 0 and 1000),
  requirement_set_id uuid not null references credits.requirement_sets (id),
  requirement_set_version integer not null check (requirement_set_version >= 1),
  -- For an award, the Competent decisions it rests on; for a reversal, the current decisions of the required results
  -- at that moment, including the one that is no longer Competent.
  contributing_decision_ids uuid[] not null check (cardinality(contributing_decision_ids) >= 1),
  cause text not null check (cause in ('release', 'moderation', 'appeal', 'correction', 'requirement_set')),
  cause_decision_id uuid references assessment.decisions (id),
  created_at timestamptz not null default now(),
  unique (learner_id, unit_id, award_seq, entry_type),
  constraint amount_follows_type check (
    (entry_type = 'award' and credits = credit_value) or (entry_type = 'reversal' and credits = -credit_value)
  )
);

create index ledger_entries_learner_idx on credits.ledger_entries (learner_id, unit_id, created_at);
create index ledger_entries_set_idx on credits.ledger_entries (requirement_set_id);

revoke all on table credits.requirement_sets, credits.unit_assessment_requirements, credits.learner_unit_outcomes,
  credits.ledger_entries from public, anon, authenticated, service_role;
revoke update, delete, truncate on credits.ledger_entries from public, anon, authenticated, service_role;

create trigger ledger_entries_append_only
  before update or delete on credits.ledger_entries
  for each row execute function audit.forbid_mutation();

create trigger ledger_entries_append_only_truncate
  before truncate on credits.ledger_entries
  for each statement execute function audit.forbid_mutation();

-- ---------------------------------------------------------------------------------------------------------------
-- The rule
-- ---------------------------------------------------------------------------------------------------------------

-- The frozen version in force for a cohort: its latest.
create function credits.current_set(p_cohort_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from credits.requirement_sets s
  where s.cohort_id = p_cohort_id and s.frozen_at is not null
  order by s.version desc limit 1
$$;

-- The Competent decisions that meet a unit's requirements in a set for a learner, in item order; null when any
-- required item has no released Competent result (a held result, no result, or Not yet competent).
create function credits.meeting_decisions(p_set_id uuid, p_unit_id uuid, p_learner_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when count(*) > 0 and bool_and(coalesce(r.state = 'released' and d.outcome = 'competent', false))
    then array_agg(d.id order by uar.assessable_item_id)
  end
  from credits.unit_assessment_requirements uar
  left join assessment.results r on r.assessable_item_id = uar.assessable_item_id and r.learner_id = p_learner_id
  left join assessment.decisions d on d.id = r.current_decision_id
  where uar.requirement_set_id = p_set_id and uar.unit_id = p_unit_id
$$;

-- The current decisions of a unit's released required results in a set, whatever their outcome.
create function credits.current_decisions(p_set_id uuid, p_unit_id uuid, p_learner_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_agg(r.current_decision_id order by uar.assessable_item_id)
  from credits.unit_assessment_requirements uar
  join assessment.results r on r.assessable_item_id = uar.assessable_item_id and r.learner_id = p_learner_id
  where uar.requirement_set_id = p_set_id and uar.unit_id = p_unit_id
    and r.state = 'released' and r.current_decision_id is not null
$$;

-- The set in force under which a learner meets a unit now, earliest frozen first; null when none is met.
create function credits.met_set(p_unit_id uuid, p_learner_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from credits.requirement_sets s
  where s.frozen_at is not null
    and s.id = credits.current_set(s.cohort_id)
    and exists (select 1 from credits.unit_assessment_requirements uar where uar.requirement_set_id = s.id and uar.unit_id = p_unit_id)
    and exists (select 1 from assessment.results r
                join credits.unit_assessment_requirements uar on uar.assessable_item_id = r.assessable_item_id
                where uar.requirement_set_id = s.id and r.learner_id = p_learner_id)
    and credits.meeting_decisions(s.id, p_unit_id, p_learner_id) is not null
  order by s.frozen_at, s.id
  limit 1
$$;

-- A unit's credit value in force now.
create function credits.credit_value(p_unit_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select cv.credits from programmes.unit_credit_values cv
  where cv.unit_id = p_unit_id and cv.effective_from <= now()
  order by cv.effective_from desc limit 1
$$;

-- Evaluates one learner's unit under the lock and appends to the ledger when the award state changes. Returns
-- 'unchanged', 'awarded', 'reversed' or 'reawarded' (an award reversed and a new one made under another set).
create function credits.evaluate_unit(p_learner_id uuid, p_unit_id uuid, p_cause text, p_cause_decision_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_outcome credits.learner_unit_outcomes;
  v_version integer;
  v_set uuid;
  v_decisions uuid[];
  v_value integer;
  v_result text := 'unchanged';
begin
  insert into credits.learner_unit_outcomes (learner_id, unit_id) values (p_learner_id, p_unit_id)
  on conflict (learner_id, unit_id) do nothing;
  -- Every read below is a new statement, so after this lock it sees whatever a concurrent release committed first.
  select * into v_outcome from credits.learner_unit_outcomes o
  where o.learner_id = p_learner_id and o.unit_id = p_unit_id for update;

  if v_outcome.awarded then
    -- An award stands while the set it was made under is still met.
    if credits.meeting_decisions(v_outcome.requirement_set_id, p_unit_id, p_learner_id) is not null then
      return 'unchanged';
    end if;
    select s.version into v_version from credits.requirement_sets s where s.id = v_outcome.requirement_set_id;
    v_decisions := coalesce(credits.current_decisions(v_outcome.requirement_set_id, p_unit_id, p_learner_id),
      v_outcome.contributing_decision_ids);
    insert into credits.ledger_entries (learner_id, unit_id, award_seq, entry_type, credits, credit_value,
      requirement_set_id, requirement_set_version, contributing_decision_ids, cause, cause_decision_id)
    values (p_learner_id, p_unit_id, v_outcome.award_seq, 'reversal', -v_outcome.credits, v_outcome.credits,
      v_outcome.requirement_set_id, v_version, v_decisions, p_cause, p_cause_decision_id);
    update credits.learner_unit_outcomes o
    set awarded = false, requirement_set_id = null, credits = null, contributing_decision_ids = null,
      awarded_at = null, version = o.version + 1, updated_at = now()
    where o.learner_id = p_learner_id and o.unit_id = p_unit_id;
    v_result := 'reversed';
  end if;

  v_set := credits.met_set(p_unit_id, p_learner_id);
  if v_set is null then return v_result; end if;
  v_value := credits.credit_value(p_unit_id);
  -- Freezing refuses a unit without a value in force and values are never removed, so this cannot happen; if it
  -- did, the reconciliation reports the unit as met and not awarded rather than failing the release.
  if v_value is null then return v_result; end if;

  v_decisions := credits.meeting_decisions(v_set, p_unit_id, p_learner_id);
  select s.version into v_version from credits.requirement_sets s where s.id = v_set;
  insert into credits.ledger_entries (learner_id, unit_id, award_seq, entry_type, credits, credit_value,
    requirement_set_id, requirement_set_version, contributing_decision_ids, cause, cause_decision_id)
  values (p_learner_id, p_unit_id, v_outcome.award_seq + 1, 'award', v_value, v_value, v_set, v_version,
    v_decisions, p_cause, p_cause_decision_id);
  update credits.learner_unit_outcomes o
  set awarded = true, award_seq = v_outcome.award_seq + 1, requirement_set_id = v_set, credits = v_value,
    contributing_decision_ids = v_decisions, awarded_at = now(), version = o.version + 1, updated_at = now()
  where o.learner_id = p_learner_id and o.unit_id = p_unit_id;
  return case when v_result = 'reversed' then 'reawarded' else 'awarded' end;
end
$$;

-- Every change to what a released result says: released for the first time, or its current decision superseded by
-- moderation, appeal or correction. Re-evaluates each unit whose frozen requirements include the item, in unit order.
create function credits.on_result_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit uuid;
  v_cause text;
begin
  select case d.type when 'assessment' then 'release' else d.type end into v_cause
  from assessment.decisions d where d.id = new.current_decision_id;
  for v_unit in
    select distinct uar.unit_id
    from credits.unit_assessment_requirements uar
    join credits.requirement_sets s on s.id = uar.requirement_set_id
    where uar.assessable_item_id = new.assessable_item_id and s.frozen_at is not null
    order by uar.unit_id
  loop
    perform credits.evaluate_unit(new.learner_id, v_unit, coalesce(v_cause, 'release'), new.current_decision_id);
  end loop;
  return null;
end
$$;

create trigger results_evaluate_credit
  after update of state, current_decision_id on assessment.results
  for each row
  when (new.state = 'released' and (old.state is distinct from new.state
        or old.current_decision_id is distinct from new.current_decision_id))
  execute function credits.on_result_changed();

revoke all on function credits.forbid_frozen_change(), credits.current_set(uuid),
  credits.meeting_decisions(uuid, uuid, uuid), credits.current_decisions(uuid, uuid, uuid), credits.met_set(uuid, uuid),
  credits.credit_value(uuid), credits.evaluate_unit(uuid, uuid, text, uuid), credits.on_result_changed()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands: drafting and freezing a cohort's requirements
-- ---------------------------------------------------------------------------------------------------------------

-- Replaces the cohort's draft with these pairs, making the draft if there is none. p_requirements is an array of
-- {"unit_id", "assessable_item_id"}. Refusals: unauthenticated, not_found, cohort_archived, invalid_requirements,
-- unit_not_in_programme, item_not_in_cohort.
create function api.save_requirement_draft(p_cohort_id uuid, p_requirements jsonb)
returns table (status text, requirement_set_id uuid, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cohort programmes.cohorts;
  v_draft credits.requirement_sets;
  v_pairs integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::integer; return; end if;
  select * into v_cohort from programmes.cohorts c where c.id = p_cohort_id;
  if not found or not programmes.can_coordinate(v_actor, p_cohort_id) then
    return query select 'not_found'::text, null::uuid, null::integer; return;
  end if;
  if v_cohort.status = 'archived' then return query select 'cohort_archived'::text, null::uuid, null::integer; return; end if;
  if p_requirements is null or jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) > 2000
     or exists (
       select 1 from jsonb_array_elements(p_requirements) e
       where jsonb_typeof(e) <> 'object'
         or coalesce(e ->> 'unit_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or coalesce(e ->> 'assessable_item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     ) then
    return query select 'invalid_requirements'::text, null::uuid, null::integer; return;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_requirements) e
    where not exists (
      select 1 from programmes.units u join programmes.qualifications q on q.id = u.qualification_id
      where u.id = (e ->> 'unit_id')::uuid and q.programme_id = v_cohort.programme_id)
  ) then
    return query select 'unit_not_in_programme'::text, null::uuid, null::integer; return;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_requirements) e
    where not exists (
      select 1 from assessment.assessable_items ai
      where ai.id = (e ->> 'assessable_item_id')::uuid and ai.cohort_id = p_cohort_id)
  ) then
    return query select 'item_not_in_cohort'::text, null::uuid, null::integer; return;
  end if;

  -- The cohort's lock target (ADR-019 lock order) serialises drafting and freezing for the cohort.
  perform 1 from programmes.cohort_moderation_state m where m.cohort_id = p_cohort_id for update;
  select * into v_draft from credits.requirement_sets s where s.cohort_id = p_cohort_id and s.frozen_at is null;
  if not found then
    insert into credits.requirement_sets (cohort_id, version, created_by)
    values (p_cohort_id,
      coalesce((select max(s.version) from credits.requirement_sets s where s.cohort_id = p_cohort_id), 0) + 1, v_actor)
    returning * into v_draft;
  else
    delete from credits.unit_assessment_requirements uar where uar.requirement_set_id = v_draft.id;
    update credits.requirement_sets s set updated_at = now() where s.id = v_draft.id;
  end if;

  insert into credits.unit_assessment_requirements (requirement_set_id, unit_id, assessable_item_id)
  select distinct v_draft.id, (e ->> 'unit_id')::uuid, (e ->> 'assessable_item_id')::uuid
  from jsonb_array_elements(p_requirements) e;
  get diagnostics v_pairs = row_count;

  perform audit.append('credits.requirement_draft_saved', 'cohort', p_cohort_id::text,
    jsonb_build_object('requirement_set_id', v_draft.id, 'version', v_draft.version), 'coordinator',
    null, jsonb_build_object('requirements', v_pairs), 'cohort', p_cohort_id);
  return query select 'ok'::text, v_draft.id, v_draft.version;
end
$$;

-- Discards the cohort's draft. Refusals: unauthenticated, not_found, no_draft.
create function api.discard_requirement_draft(p_cohort_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_draft credits.requirement_sets;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id)
     or not programmes.can_coordinate(v_actor, p_cohort_id) then
    return query select 'not_found'::text; return;
  end if;
  perform 1 from programmes.cohort_moderation_state m where m.cohort_id = p_cohort_id for update;
  select * into v_draft from credits.requirement_sets s where s.cohort_id = p_cohort_id and s.frozen_at is null;
  if not found then return query select 'no_draft'::text; return; end if;
  delete from credits.requirement_sets s where s.id = v_draft.id;
  perform audit.append('credits.requirement_draft_discarded', 'cohort', p_cohort_id::text,
    jsonb_build_object('version', v_draft.version), 'coordinator', null, null, 'cohort', p_cohort_id);
  return query select 'ok'::text;
end
$$;

-- Freezes the cohort's draft, which becomes the set in force, and evaluates every learner with a result on its items
-- for each of its units. A later version is a change to the requirements and needs a reason; awards already made
-- stand. Refusals: unauthenticated, not_found, no_draft, stale_draft (the draft was saved again since the page was
-- read), cohort_archived, no_requirements, credit_value_missing (with the unit codes), reason_required,
-- reason_too_long.
create function api.freeze_requirement_set(p_cohort_id uuid, p_requirement_set_id uuid, p_reason text)
returns table (status text, version integer, awarded integer, missing text[])
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_actor uuid := auth.uid();
  v_cohort programmes.cohorts;
  v_draft credits.requirement_sets;
  v_previous integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_missing text[];
  v_pair record;
  v_awarded integer := 0;
  v_evaluated integer := 0;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer, null::text[]; return; end if;
  select * into v_cohort from programmes.cohorts c where c.id = p_cohort_id;
  if not found or not programmes.can_coordinate(v_actor, p_cohort_id) then
    return query select 'not_found'::text, null::integer, null::integer, null::text[]; return;
  end if;
  if v_cohort.status = 'archived' then
    return query select 'cohort_archived'::text, null::integer, null::integer, null::text[]; return;
  end if;

  perform 1 from programmes.cohort_moderation_state m where m.cohort_id = p_cohort_id for update;
  select * into v_draft from credits.requirement_sets s where s.cohort_id = p_cohort_id and s.frozen_at is null;
  if not found then return query select 'no_draft'::text, null::integer, null::integer, null::text[]; return; end if;
  if v_draft.id is distinct from p_requirement_set_id then
    return query select 'stale_draft'::text, null::integer, null::integer, null::text[]; return;
  end if;
  if not exists (select 1 from credits.unit_assessment_requirements uar where uar.requirement_set_id = v_draft.id) then
    return query select 'no_requirements'::text, null::integer, null::integer, null::text[]; return;
  end if;
  select array_agg(distinct u.code order by u.code) into v_missing
  from credits.unit_assessment_requirements uar join programmes.units u on u.id = uar.unit_id
  where uar.requirement_set_id = v_draft.id and credits.credit_value(uar.unit_id) is null;
  if v_missing is not null then
    return query select 'credit_value_missing'::text, null::integer, null::integer, v_missing; return;
  end if;
  select s.version into v_previous from credits.requirement_sets s
  where s.id = credits.current_set(p_cohort_id);
  if v_previous is not null and v_reason is null then
    return query select 'reason_required'::text, null::integer, null::integer, null::text[]; return;
  end if;
  if char_length(coalesce(v_reason, '')) > 1000 then
    return query select 'reason_too_long'::text, null::integer, null::integer, null::text[]; return;
  end if;

  -- Lock the results on the set's items in ascending order (lock order: results before learner_unit_outcomes), so a
  -- release committing at the same moment either finishes first and is evaluated here, or waits and sees the set.
  perform 1 from assessment.results r
  where r.assessable_item_id in (
    select uar.assessable_item_id from credits.unit_assessment_requirements uar where uar.requirement_set_id = v_draft.id)
  order by r.id for update;

  update credits.requirement_sets s
  set frozen_at = now(), frozen_by = v_actor, reason = v_reason, updated_at = now()
  where s.id = v_draft.id;

  for v_pair in
    select distinct r.learner_id, uar.unit_id
    from credits.unit_assessment_requirements uar
    join assessment.results r on r.assessable_item_id = uar.assessable_item_id
    where uar.requirement_set_id = v_draft.id
    order by r.learner_id, uar.unit_id
  loop
    v_evaluated := v_evaluated + 1;
    if credits.evaluate_unit(v_pair.learner_id, v_pair.unit_id, 'requirement_set', null) in ('awarded', 'reawarded') then
      v_awarded := v_awarded + 1;
    end if;
  end loop;

  perform audit.append('credits.requirement_set_frozen', 'cohort', p_cohort_id::text,
    jsonb_build_object('requirement_set_id', v_draft.id, 'reason', v_reason, 'evaluated', v_evaluated,
      'awarded', v_awarded), 'coordinator',
    case when v_previous is null then null else jsonb_build_object('version', v_previous) end,
    jsonb_build_object('version', v_draft.version,
      'requirements', (select count(*) from credits.unit_assessment_requirements uar where uar.requirement_set_id = v_draft.id)),
    'cohort', p_cohort_id);
  return query select 'ok'::text, v_draft.version, v_awarded, null::text[];
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Read: the cohort's requirements page
-- ---------------------------------------------------------------------------------------------------------------

-- The programme's units with the credit value in force and how many learners hold the award from this cohort; the
-- cohort's assessable items, with the unit their module suggests; and every version of the requirements, the draft
-- last. Empty for anyone who does not coordinate the cohort.
create function api.get_cohort_credit_requirements(p_cohort_id uuid)
returns table (
  cohort_id uuid,
  cohort_name text,
  cohort_status text,
  units jsonb,
  items jsonb,
  sets jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.status,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'unit_id', u.id, 'code', u.code, 'title', u.title, 'qualification_title', q.title,
        'credits', credits.credit_value(u.id),
        'awarded_learners', (
          select count(*) from credits.learner_unit_outcomes o
          join credits.requirement_sets s on s.id = o.requirement_set_id
          where o.unit_id = u.id and o.awarded and s.cohort_id = c.id))
        order by q.title, u.code)
      from programmes.units u join programmes.qualifications q on q.id = u.qualification_id
      where q.programme_id = c.programme_id), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', ai.id, 'title', ai.title, 'kind', ai.kind, 'suggested_unit_id', m.unit_id)
        order by ai.title)
      from assessment.assessable_items ai
      left join submissions.tasks t on t.id = ai.task_id
      left join programmes.modules m on m.id = t.module_id
      where ai.cohort_id = c.id), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'requirement_set_id', s.id, 'version', s.version, 'frozen_at', s.frozen_at, 'frozen_by_name', fp.full_name,
        'created_by_name', cp.full_name, 'updated_at', s.updated_at, 'reason', s.reason,
        'in_force', s.id = credits.current_set(c.id),
        'awards', (select count(*) from credits.ledger_entries l where l.requirement_set_id = s.id and l.entry_type = 'award'),
        'requirements', coalesce((
          select jsonb_agg(jsonb_build_object('unit_id', uar.unit_id, 'assessable_item_id', uar.assessable_item_id)
            order by uar.unit_id, uar.assessable_item_id)
          from credits.unit_assessment_requirements uar where uar.requirement_set_id = s.id), '[]'::jsonb))
        order by s.version)
      from credits.requirement_sets s
      left join identity.profiles fp on fp.id = s.frozen_by
      left join identity.profiles cp on cp.id = s.created_by
      where s.cohort_id = c.id), '[]'::jsonb)
  from programmes.cohorts c
  where c.id = p_cohort_id and programmes.can_coordinate(auth.uid(), c.id)
$$;

revoke all on function api.save_requirement_draft(uuid, jsonb), api.discard_requirement_draft(uuid),
  api.freeze_requirement_set(uuid, uuid, text), api.get_cohort_credit_requirements(uuid)
  from public, anon, authenticated, service_role;
grant execute on function api.save_requirement_draft(uuid, jsonb), api.discard_requirement_draft(uuid),
  api.freeze_requirement_set(uuid, uuid, text), api.get_cohort_credit_requirements(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Readiness: the requirements, not gating
-- ---------------------------------------------------------------------------------------------------------------

-- The checklist from 20261103090000, with the unit requirements as an eleventh item: done when a version is frozen;
-- detail is the version in force. It does not gate activation, because assessments may be published after it.
create or replace function programmes.readiness(p_cohort_id uuid)
returns table (item_key text, sort integer, gate boolean, done boolean, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select c.*, m.moderation_policy,
      (select count(*) from programmes.enrolments e where e.cohort_id = c.id and e.status in ('pending', 'active')) as learners,
      (select count(distinct s.profile_id) from programmes.cohort_staff(c.id) s where s.role = 'facilitator') as facilitators,
      (select count(distinct s.profile_id) from programmes.cohort_staff(c.id) s where s.role = 'assessor') as assessors,
      (select count(distinct s.profile_id) from programmes.cohort_staff(c.id) s where s.role = 'moderator') as moderators,
      (select count(*) from learning.materials mt where mt.cohort_id = c.id and mt.state = 'published') as materials,
      (select count(*) from submissions.tasks t where t.cohort_id = c.id and t.state = 'published') as tasks,
      (select count(*) from learning.sessions s where s.cohort_id = c.id and s.state = 'scheduled') as sessions,
      -- Upcoming in-person sessions, and how many of them have every logistics item arranged (S6-03).
      (select count(*) from learning.sessions s
       where s.cohort_id = c.id and s.state = 'scheduled' and s.mode = 'in_person'
         and s.starts_at + make_interval(mins => s.duration_minutes) > now()) as in_person,
      (select count(*) from learning.sessions s
       join learning.session_logistics l on l.session_id = s.id
       where s.cohort_id = c.id and s.state = 'scheduled' and s.mode = 'in_person'
         and s.starts_at + make_interval(mins => s.duration_minutes) > now()
         and learning.logistics_arranged(l)) as in_person_arranged,
      (select s.version from credits.requirement_sets s where s.id = credits.current_set(c.id)) as requirements_version
    from programmes.cohorts c
    join programmes.cohort_moderation_state m on m.cohort_id = c.id
    where c.id = p_cohort_id
  )
  select * from (
    select 'details', 1, true, true, null::text from c
    union all
    select 'moderation_policy', 2, true, c.moderation_policy is not null, c.moderation_policy from c
    union all
    select 'learners', 3, true, c.learners > 0, c.learners::text from c
    union all
    select 'facilitator', 4, true, c.facilitators > 0, c.facilitators::text from c
    union all
    select 'assessor', 5, true, c.assessors > 0, c.assessors::text from c
    union all
    -- Needed only for a moderated cohort; until a policy is chosen it counts as needed.
    select 'moderator', 6, c.moderation_policy is distinct from 'not_moderated',
      c.moderators > 0 or c.moderation_policy = 'not_moderated', c.moderators::text from c
    union all
    select 'materials', 7, false, c.materials > 0, c.materials::text from c
    union all
    select 'published_tasks', 8, false, c.tasks > 0, c.tasks::text from c
    union all
    select 'sessions', 9, false, c.sessions > 0, c.sessions::text from c
    union all
    -- Done when every upcoming in-person session is arranged; with only online sessions there is nothing to arrange,
    -- and with no sessions yet there is nothing to judge. Detail: "arranged/total", or "none_in_person".
    select 'logistics', 10, false, c.sessions > 0 and c.in_person = c.in_person_arranged,
      case when c.sessions = 0 then null when c.in_person = 0 then 'none_in_person'
           else c.in_person_arranged || '/' || c.in_person end from c
    union all
    select 'unit_requirements', 11, false, c.requirements_version is not null, c.requirements_version::text from c
  ) items (item_key, sort, gate, done, detail)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reconciliation
-- ---------------------------------------------------------------------------------------------------------------

create table credits.reconciliation_differences (
  id bigint generated always as identity primary key,
  found_at timestamptz not null default now(),
  learner_id uuid not null references identity.profiles (id),
  unit_id uuid not null references programmes.units (id),
  kind text not null check (kind in ('ledger_total', 'ledger_sequence', 'award_not_met', 'met_not_awarded')),
  detail jsonb not null default '{}'::jsonb
);

create index reconciliation_differences_found_idx on credits.reconciliation_differences (found_at desc);
revoke all on table credits.reconciliation_differences from public, anon, authenticated, service_role;

-- Compares, for every learner and unit the ledger or a frozen set touches: the ledger total with the award in force;
-- the ledger's last entry and sequence with the outcome row; and the outcome row with the rule (an award whose set is
-- no longer met, or a set in force that is met without an award). Records each difference and tells every active
-- administrator in the LMS, once a day. Returns how many differences it found; it changes no credit.
create function credits.reconcile()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found timestamptz := now();
  v_count integer;
  v_admin uuid;
begin
  with pairs as (
    select l.learner_id, l.unit_id from credits.ledger_entries l
    union
    select o.learner_id, o.unit_id from credits.learner_unit_outcomes o
    union
    select r.learner_id, uar.unit_id
    from credits.requirement_sets s
    join credits.unit_assessment_requirements uar on uar.requirement_set_id = s.id
    join assessment.results r on r.assessable_item_id = uar.assessable_item_id
    where s.frozen_at is not null and s.id = credits.current_set(s.cohort_id)
  ),
  facts as (
    select p.learner_id, p.unit_id,
      coalesce(o.awarded, false) as awarded, coalesce(o.award_seq, 0) as award_seq, o.credits, o.requirement_set_id,
      coalesce((select sum(l.credits) from credits.ledger_entries l
                where l.learner_id = p.learner_id and l.unit_id = p.unit_id), 0) as ledger_total,
      coalesce((select max(l.award_seq) from credits.ledger_entries l
                where l.learner_id = p.learner_id and l.unit_id = p.unit_id), 0) as ledger_seq,
      (select l.entry_type from credits.ledger_entries l
       where l.learner_id = p.learner_id and l.unit_id = p.unit_id order by l.award_seq desc, l.id desc limit 1) as last_type
    from pairs p
    left join credits.learner_unit_outcomes o on o.learner_id = p.learner_id and o.unit_id = p.unit_id
  ),
  differences as (
    select f.learner_id, f.unit_id, 'ledger_total'::text as kind,
      jsonb_build_object('ledger_total', f.ledger_total, 'award_credits', coalesce(f.credits, 0)) as detail
    from facts f where f.ledger_total <> case when f.awarded then f.credits else 0 end
    union all
    select f.learner_id, f.unit_id, 'ledger_sequence',
      jsonb_build_object('ledger_seq', f.ledger_seq, 'award_seq', f.award_seq, 'last_entry', f.last_type,
        'awarded', f.awarded)
    from facts f
    where f.ledger_seq <> f.award_seq
       or (f.awarded and f.last_type is distinct from 'award')
       or (not f.awarded and f.last_type = 'award')
    union all
    select f.learner_id, f.unit_id, 'award_not_met', jsonb_build_object('requirement_set_id', f.requirement_set_id)
    from facts f
    where f.awarded and credits.meeting_decisions(f.requirement_set_id, f.unit_id, f.learner_id) is null
    union all
    select f.learner_id, f.unit_id, 'met_not_awarded',
      jsonb_build_object('requirement_set_id', credits.met_set(f.unit_id, f.learner_id))
    from facts f
    where not f.awarded and credits.met_set(f.unit_id, f.learner_id) is not null
  )
  insert into credits.reconciliation_differences (found_at, learner_id, unit_id, kind, detail)
  select v_found, d.learner_id, d.unit_id, d.kind, d.detail from differences d;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    for v_admin in
      select p.id from identity.profiles p
      where p.status = 'active' and identity.has_role(p.id, 'administrator')
      order by p.id
    loop
      perform notifications.enqueue('credit_reconciliation_differences',
        'credit-reconciliation:' || to_char(v_found at time zone 'Africa/Johannesburg', 'YYYY-MM-DD'),
        v_admin, jsonb_build_object('differences', v_count, 'found_at', v_found), '/admin/credits');
    end loop;
  end if;
  return v_count;
end
$$;

revoke all on function credits.reconcile() from public, anon, authenticated, service_role;

insert into audit.scheduled_jobs (name, kind, description, handler, schedule, heartbeat_within) values
('reconcile-credits', 'recurring',
 'Compares the credit ledger with the award in force and with the requirement rule, and tells administrators of any difference.',
 'credits.reconcile', '40 0 * * *', interval '26 hours');

select cron.schedule('reconcile-credits', '40 0 * * *', format('select audit.run_job(%L)', 'reconcile-credits'));

-- Administrators: the latest reconciliation run, how many differences it found, and those differences.
create function api.get_credit_reconciliation()
returns table (
  last_run_at timestamptz,
  last_status text,
  last_success_at timestamptz,
  last_differences integer,
  differences jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with last_run as (
    select r.finished_at, r.status from audit.scheduled_runs r
    where r.job_name = 'reconcile-credits' order by r.finished_at desc limit 1
  ),
  last_success as (
    select r.finished_at, r.processed from audit.scheduled_runs r
    where r.job_name = 'reconcile-credits' and r.status = 'succeeded' order by r.finished_at desc limit 1
  )
  select
    (select lr.finished_at from last_run lr),
    (select lr.status from last_run lr),
    (select ls.finished_at from last_success ls),
    (select ls.processed from last_success ls),
    -- The differences recorded by the latest successful run: the newest batch, when that run found any.
    case when coalesce((select ls.processed from last_success ls), 0) = 0 then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'found_at', d.found_at, 'kind', d.kind, 'learner_name', p.full_name, 'unit_code', u.code,
        'unit_title', u.title, 'detail', d.detail) order by p.full_name, u.code, d.kind)
      from credits.reconciliation_differences d
      join identity.profiles p on p.id = d.learner_id
      join programmes.units u on u.id = d.unit_id
      where d.found_at = (select max(x.found_at) from credits.reconciliation_differences x)
    ), '[]'::jsonb) end
  where identity.has_role(auth.uid(), 'administrator')
$$;

revoke all on function api.get_credit_reconciliation() from public, anon, authenticated, service_role;
grant execute on function api.get_credit_reconciliation() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Notifications: a reconciliation difference
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
                 'credit_reconciliation_differences')
);
