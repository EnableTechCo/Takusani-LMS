-- The result as a first-class aggregate, and immutable decisions (S2-06, ADR-021, BR-03, ADR-016).
-- LMS-data-model.md "Assessment, results, and immutable decisions".
--
-- Why a result row at all: hold, release, appeal deadline and credit all act on "the result", and a decision is
-- append-only, so release time and appeal deadline cannot live on it. One row per learner and assessable item
-- carries the current outcome, so "where does this stand" is one lookup and there is one place to lock.
--
-- What is enforced here rather than left to the functions that will use it:
--   * held -> released happens once, and sets released_at, appeal_deadline_at and release_seq together. Any other
--     change to those columns is refused by a trigger, whoever makes it.
--   * The appeal deadline is an exclusive instant: the start of the eighth South African day after release, so the
--     learner gets seven whole days and the comparison is a plain `now() < appeal_deadline_at`.
--   * The decision chain cannot fork: one root per result, and at most one decision superseding any other.
--   * The result's current decision must belong to that result, held by a composite foreign key, not by care.
--   * Decisions are append-only: privileges revoked and the guard trigger attached (test plan, transaction test 11).
--
-- Not here: finalising a decision (S2-08 decides hold or release), moderation cycles (hold_cycle_id is a plain
-- column until those tables exist), appeals and corrections, and credit.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

-- One identifier for a task or an exam, so results, unit requirements and moderation scope can refer to either.
create table assessment.assessable_items (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references programmes.cohorts (id),
  kind text not null check (kind in ('task', 'exam')),
  task_id uuid references submissions.tasks (id),
  title text not null,
  created_at timestamptz not null default now(),
  constraint task_item_has_task check ((kind = 'task') = (task_id is not null)),
  unique (task_id)
);

create sequence assessment.release_seq;

create table assessment.results (
  id uuid primary key default gen_random_uuid(),
  assessable_item_id uuid not null references assessment.assessable_items (id),
  learner_id uuid not null references identity.profiles (id),
  -- The current outcome. The composite foreign key below ties it to a decision of this same result.
  current_decision_id uuid,
  state text not null default 'held' check (state in ('held', 'released')),
  -- Set when a moderation cycle claims this result at freeze (S4). No foreign key until those tables exist.
  hold_cycle_id uuid,
  released_at timestamptz,
  appeal_deadline_at timestamptz,
  -- For a "not yet competent" outcome: the period is stored, and the deadline is resolved at release, so a long
  -- hold delays the learner's time to resubmit instead of eating into it.
  remediation_period interval,
  remediation_deadline_at timestamptz,
  release_seq bigint unique,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessable_item_id, learner_id),
  constraint released_has_its_moment check (
    (state = 'released') = (released_at is not null)
    and (released_at is null) = (release_seq is null)
    and (released_at is null) = (appeal_deadline_at is null)
  )
);

create table assessment.assessment_instances (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references assessment.results (id),
  -- What is being assessed: a submitted version today, an exam attempt when exams arrive.
  submission_version_id uuid references submissions.submission_versions (id),
  state text not null default 'to_mark' check (state in ('to_mark', 'marking', 'decided', 'superseded')),
  assessor_id uuid references identity.profiles (id),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_version_id)
);

-- Append-only (BR-03, ADR-016). A decision is never edited: a later one supersedes it and the chain is the history.
create table assessment.decisions (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references assessment.results (id),
  instance_id uuid references assessment.assessment_instances (id),
  type text not null check (type in ('assessment', 'moderation', 'appeal', 'correction')),
  outcome text not null check (outcome in ('competent', 'not_yet_competent')),
  actor_id uuid not null references identity.profiles (id),
  acting_role text not null,
  justification text not null check (char_length(btrim(justification)) between 1 and 5000),
  supersedes_decision_id uuid references assessment.decisions (id),
  created_at timestamptz not null default now(),
  -- One decision may supersede at most one other: the chain is a line, never a fork.
  unique (supersedes_decision_id),
  -- Lets results.current_decision_id be tied to a decision of the same result.
  unique (result_id, id)
);

-- One root decision per result; every later one supersedes exactly one.
create unique index decisions_one_root_per_result on assessment.decisions (result_id)
  where supersedes_decision_id is null;

-- Checked at once, not at commit: a decision is always written before the result points at it, so nothing needs
-- the check put off, and a wrong pointer fails at the statement that sets it.
alter table assessment.results
  add constraint current_decision_belongs_to_result
  foreign key (id, current_decision_id) references assessment.decisions (result_id, id);

create index results_learner_idx on assessment.results (learner_id);
create index results_item_idx on assessment.results (assessable_item_id, state);
create index instances_result_idx on assessment.assessment_instances (result_id);
create index decisions_result_idx on assessment.decisions (result_id, created_at);

revoke all on table assessment.assessable_items, assessment.results, assessment.assessment_instances,
  assessment.decisions from public, anon, authenticated, service_role;
revoke update, delete, truncate on assessment.decisions from public, anon, authenticated, service_role;

create trigger decisions_append_only
  before update or delete on assessment.decisions
  for each row execute function audit.forbid_mutation();

create trigger decisions_append_only_truncate
  before truncate on assessment.decisions
  for each statement execute function audit.forbid_mutation();

-- ---------------------------------------------------------------------------------------------------------------
-- Release: once, and all of it together (ADR-021)
-- ---------------------------------------------------------------------------------------------------------------

-- The exclusive instant a learner's appeal window closes: the start of the eighth South African day after release,
-- so seven whole days are available whatever time of day the release happened.
create function assessment.appeal_deadline(p_released_at timestamptz, p_days integer default 7)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (((p_released_at at time zone 'Africa/Johannesburg')::date + (p_days + 1)) || ' 00:00')::timestamp
           at time zone 'Africa/Johannesburg'
$$;

create function assessment.guard_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A released result never goes back, and its release facts never change.
  if old.state = 'released' then
    if new.state <> 'released' then
      raise exception 'A released result cannot be held again: record a new decision instead.'
        using errcode = '23514';
    end if;
    if new.released_at is distinct from old.released_at
      or new.release_seq is distinct from old.release_seq
      or (new.appeal_deadline_at is distinct from old.appeal_deadline_at
          and new.current_decision_id is not distinct from old.current_decision_id) then
      raise exception 'Release facts are written once: released_at, release_seq and the appeal deadline cannot be edited.'
        using errcode = '23514';
    end if;
  end if;

  -- Releasing sets the three together, from the server's clock and the sequence, whatever the caller passed.
  if old.state = 'held' and new.state = 'released' then
    new.released_at := now();
    new.release_seq := nextval('assessment.release_seq');
    new.appeal_deadline_at := assessment.appeal_deadline(new.released_at);
    if new.remediation_period is not null then
      new.remediation_deadline_at := new.released_at + new.remediation_period;
    end if;
  elsif old.state = 'held' and new.state = 'held' then
    -- While held, the release facts stay empty: nothing can be pre-dated.
    if new.released_at is not null or new.release_seq is not null or new.appeal_deadline_at is not null then
      raise exception 'A held result has no release facts yet.' using errcode = '23514';
    end if;
  end if;

  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end
$$;

create trigger results_release_guard
  before update on assessment.results
  for each row execute function assessment.guard_release();

revoke all on function assessment.appeal_deadline(timestamptz, integer) from public, anon, authenticated, service_role;
revoke all on function assessment.guard_release() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Opening the work for assessment
-- ---------------------------------------------------------------------------------------------------------------

-- Every submitted version opens an instance on the learner's one result for that item. A resubmission after "not
-- yet competent" belongs to the same result, so the chain of decisions reads as one story (ADR-021).
create function assessment.open_instance(p_task_id uuid, p_learner_id uuid, p_submission_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
  v_result uuid;
  v_instance uuid;
begin
  select id into v_item from assessment.assessable_items where task_id = p_task_id;
  if v_item is null then
    -- A task published before this migration has no item yet; make it now so nothing is stranded.
    insert into assessment.assessable_items (cohort_id, kind, task_id, title)
    select t.cohort_id, 'task', t.id, t.title from submissions.tasks t where t.id = p_task_id
    returning id into v_item;
  end if;

  insert into assessment.results (assessable_item_id, learner_id)
  values (v_item, p_learner_id)
  on conflict (assessable_item_id, learner_id) do nothing;
  select id into v_result from assessment.results
  where assessable_item_id = v_item and learner_id = p_learner_id for update;

  -- The earlier instance is superseded, not deleted: what was marked before stays readable.
  update assessment.assessment_instances
  set state = 'superseded', updated_at = now()
  where result_id = v_result and state in ('to_mark', 'marking');

  insert into assessment.assessment_instances (result_id, submission_version_id)
  values (v_result, p_submission_version_id)
  returning id into v_instance;

  return v_instance;
end
$$;

revoke all on function assessment.open_instance(uuid, uuid, uuid) from public, anon, authenticated, service_role;

-- Publishing a task now also gives it its assessable item, so results can point at it from the first submission.
-- Replacing the function keeps its signature; the grant is given again below.
drop function api.publish_task(uuid);

create function api.publish_task(p_task_id uuid)
returns table (status text, notified integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_audience integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_task from submissions.tasks where id = p_task_id for update;
  if not found then return query select 'task_not_found'::text, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_task.cohort_id) then
    return query select 'forbidden'::text, null::integer; return;
  end if;
  if v_task.state = 'published' then return query select 'already_published'::text, null::integer; return; end if;
  if v_task.state <> 'draft' then return query select 'not_a_draft'::text, null::integer; return; end if;
  if v_task.due_at is null then return query select 'due_date_required'::text, null::integer; return; end if;
  if v_task.due_at <= now() then return query select 'due_date_passed'::text, null::integer; return; end if;
  if exists (select 1 from programmes.cohorts c where c.id = v_task.cohort_id and c.status = 'archived') then
    return query select 'cohort_archived'::text, null::integer; return;
  end if;

  v_audience := submissions.audience_size(p_task_id);
  if v_audience = 0 then return query select 'no_learners'::text, 0; return; end if;

  update submissions.tasks
  set state = 'published', published_at = now(), published_by = v_actor, updated_at = now()
  where id = p_task_id;

  insert into assessment.assessable_items (cohort_id, kind, task_id, title)
  values (v_task.cohort_id, 'task', p_task_id, v_task.title)
  on conflict (task_id) do nothing;

  -- S2-10 writes the outbox row for the audience here, in this transaction (ADR-025).
  perform audit.append('submissions.task_published', 'task', p_task_id::text,
    jsonb_build_object('cohort_id', v_task.cohort_id), 'facilitator',
    jsonb_build_object('state', 'draft'),
    jsonb_build_object('state', 'published', 'due_at', v_task.due_at, 'learners', v_audience),
    'cohort', v_task.cohort_id);
  return query select 'ok'::text, v_audience;
end
$$;

revoke all on function api.publish_task(uuid) from public, anon, authenticated, service_role;
grant execute on function api.publish_task(uuid) to authenticated;

-- Submitting now opens the assessment instance in the same transaction, so nothing is queued for marking that is
-- not also on record as submitted. Replacing the function keeps its signature; the grant is given again below.
drop function api.submit_task(uuid, jsonb, uuid);

create function api.submit_task(p_task_id uuid, p_files jsonb, p_client_submission_id uuid)
returns table (
  status text,
  submission_id uuid,
  version_number integer,
  receipt_reference text,
  submitted_at timestamptz,
  is_late boolean,
  detail text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_submission uuid;
  v_previous submissions.submission_versions;
  v_existing submissions.submission_versions;
  v_version integer;
  v_late boolean := false;
  v_late_by integer;
  v_receipt text;
  v_version_id uuid;
  v_now timestamptz := now();
  v_row jsonb;
  v_file uuid;
  v_requirement uuid;
  v_missing text;
  v_count integer := 0;
begin
  if v_actor is null then
    return query select 'unauthenticated'::text, null::uuid, null::integer, null::text, null::timestamptz,
      null::boolean, null::text;
    return;
  end if;
  if p_client_submission_id is null then
    return query select 'client_submission_id_required'::text, null::uuid, null::integer, null::text,
      null::timestamptz, null::boolean, null::text;
    return;
  end if;

  select * into v_task from submissions.tasks where id = p_task_id;
  if not found or v_task.state <> 'published' then
    return query select 'task_not_found'::text, null::uuid, null::integer, null::text, null::timestamptz,
      null::boolean, null::text;
    return;
  end if;
  if not submissions.is_audience(v_actor, p_task_id) then
    return query select 'forbidden'::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
      null::text;
    return;
  end if;

  -- Aliases throughout: submission_id, version_number, is_late and submitted_at are also this function's OUT names.
  insert into submissions.submissions (task_id, profile_id)
  values (p_task_id, v_actor)
  on conflict (task_id, profile_id) do nothing;
  select s.id into v_submission from submissions.submissions s
  where s.task_id = p_task_id and s.profile_id = v_actor for update;

  select sv.* into v_existing from submissions.submission_versions sv
  where sv.submission_id = v_submission and sv.client_submission_id = p_client_submission_id;
  if found then
    return query select 'ok'::text, v_submission, v_existing.version_number, v_existing.receipt_reference,
      v_existing.submitted_at, v_existing.is_late, 'retry'::text;
    return;
  end if;

  if v_task.due_at is not null and v_now > v_task.due_at then
    if v_task.late_policy = 'closed_at_due' then
      return query select 'closed'::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
        null::text;
      return;
    end if;
    v_late := true;
    v_late_by := extract(epoch from (v_now - v_task.due_at))::integer;
  end if;

  select r.title into v_missing
  from submissions.task_evidence_requirements r
  where r.task_id = p_task_id
    and r.mandatory
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) f
      where (f ->> 'requirement_id')::uuid = r.id
    )
  order by r.ordinal
  limit 1;
  if v_missing is not null then
    return query select 'missing_evidence'::text, null::uuid, null::integer, null::text, null::timestamptz,
      null::boolean, v_missing;
    return;
  end if;

  if jsonb_typeof(coalesce(p_files, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_files) = 0 then
    return query select 'no_files'::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
      null::text;
    return;
  end if;

  select count(*) + 1 into v_version
  from submissions.submission_versions sv where sv.submission_id = v_submission;
  select sv.* into v_previous from submissions.submission_versions sv
  where sv.submission_id = v_submission order by sv.version_number desc limit 1;

  v_receipt := 'SUB-' || to_char(v_now at time zone 'Africa/Johannesburg', 'YYYYMMDD') || '-'
    || upper(encode(extensions.gen_random_bytes(2), 'hex'));

  insert into submissions.submission_versions (
    submission_id, version_number, submitted_at, is_late, late_by_seconds, supersedes_version_id,
    client_submission_id, receipt_reference
  )
  values (v_submission, v_version, v_now, v_late, v_late_by, v_previous.id, p_client_submission_id, v_receipt)
  returning id into v_version_id;

  for v_row in select * from jsonb_array_elements(p_files) loop
    v_file := (v_row ->> 'file_id')::uuid;
    v_requirement := nullif(v_row ->> 'requirement_id', '')::uuid;

    if v_requirement is not null and not exists (
      select 1 from submissions.task_evidence_requirements r where r.id = v_requirement and r.task_id = p_task_id
    ) then
      raise exception using errcode = 'P0001', message = 'requirement_not_on_task';
    end if;

    if not exists (
      select 1
      from submissions.stored_files sf
      join submissions.file_upload_intents i on i.id = sf.intent_id
      where sf.id = v_file
        and i.profile_id = v_actor
        and i.context_type = 'task_submission'
        and i.context_id = p_task_id
        and i.consumed_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'file_not_available';
    end if;

    insert into submissions.submission_files (version_id, stored_file_id, requirement_id)
    values (v_version_id, v_file, v_requirement);
    update submissions.file_upload_intents i
    set consumed_at = v_now
    from submissions.stored_files sf
    where sf.id = v_file and i.id = sf.intent_id;
    v_count := v_count + 1;
  end loop;

  -- The work is now waiting to be marked, on this learner's one result for the task (ADR-021).
  perform assessment.open_instance(p_task_id, v_actor, v_version_id);

  perform audit.append('submissions.version_submitted', 'submission_version', v_version_id::text,
    jsonb_build_object('task_id', p_task_id, 'cohort_id', v_task.cohort_id), 'learner', null,
    jsonb_build_object('version', v_version, 'files', v_count, 'is_late', v_late, 'receipt', v_receipt),
    'cohort', v_task.cohort_id);

  return query select 'ok'::text, v_submission, v_version, v_receipt, v_now, v_late, null::text;
exception
  when sqlstate 'P0001' then
    return query select sqlerrm::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
      null::text;
end
$$;

revoke all on function api.submit_task(uuid, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function api.submit_task(uuid, jsonb, uuid) to authenticated;
