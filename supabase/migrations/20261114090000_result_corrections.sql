-- Administrative correction under dual control (S4-12; P-12 confirmed 29 Sep 2026; BR-03; CR-18; test plan 27).
-- A wrongly released outcome is corrected without waiting for an appeal:
--   * A coordinator of the cohort proposes: the outcome that should stand, its justification, and why the correction
--     is needed. A different coordinator of the cohort, or an administrator, approves or declines. Nobody who took a
--     decision on the result, as assessor, appeal reviewer or moderator, may propose or approve; that is checked when
--     the correction is concluded, under the result lock, whatever changed since the proposal.
--   * Only a released result is corrected; a held one goes through moderation. A result whose current decision came
--     from an appeal is not corrected: appeal decisions are final (FR-613). A decision that is waiting behind the
--     release (P-04) is moderation's, so the result is not corrected until it is signed off.
--   * Approval appends a `correction` decision that supersedes the current one; the original stays on record
--     (BR-03). Moving the pointer releases it at once through the release guard, with a new sequence number and a
--     new appeal window; the marks and feedback of the corrected decision are carried, and a Not yet competent
--     correction carries what the learner must do and their resubmission period. The learner is told it was
--     corrected, the proposer is told the outcome, and every step is audited.
--   * Credit re-evaluation (FR-801) waits for the credits module (S6-01), as it does for appeals.

-- ---------------------------------------------------------------------------------------------------------------
-- Records
-- ---------------------------------------------------------------------------------------------------------------

create table assessment.corrections (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references assessment.results (id),
  -- The decision it corrects: the result's current decision at the proposal.
  decision_id uuid not null references assessment.decisions (id),
  cohort_id uuid not null references programmes.cohorts (id),
  proposed_by uuid not null references identity.profiles (id),
  proposed_at timestamptz not null default now(),
  outcome text not null check (outcome in ('competent', 'not_yet_competent')),
  justification text not null check (char_length(btrim(justification)) between 1 and 5000),
  -- Why the released outcome was wrong: kept with the record, read by the approver.
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  remediation text check (remediation is null or char_length(btrim(remediation)) between 1 and 5000),
  resubmission_days integer check (resubmission_days is null or resubmission_days between 1 and 90),
  state text not null default 'proposed' check (state in ('proposed', 'approved', 'declined', 'withdrawn')),
  concluded_by uuid references identity.profiles (id),
  concluded_at timestamptz,
  conclusion_reason text check (conclusion_reason is null or char_length(btrim(conclusion_reason)) between 1 and 2000),
  correction_decision_id uuid references assessment.decisions (id),
  constraint nyc_correction_has_remediation check (
    outcome <> 'not_yet_competent' or (remediation is not null and resubmission_days is not null)
  ),
  constraint conclusion_is_recorded check (
    (state = 'proposed') = (concluded_by is null and concluded_at is null)
  ),
  constraint approval_has_its_decision check ((state = 'approved') = (correction_decision_id is not null)),
  constraint decline_has_its_reason check (state <> 'declined' or conclusion_reason is not null)
);

create unique index corrections_one_open_per_result on assessment.corrections (result_id) where state = 'proposed';
create index corrections_cohort_idx on assessment.corrections (cohort_id, proposed_at desc);
create index corrections_result_idx on assessment.corrections (result_id);
create index corrections_decision_idx on assessment.corrections (decision_id);
create index corrections_correction_decision_idx on assessment.corrections (correction_decision_id);
create index corrections_proposed_by_idx on assessment.corrections (proposed_by);
create index corrections_concluded_by_idx on assessment.corrections (concluded_by);

revoke all on table assessment.corrections from public, anon, authenticated, service_role;

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
                 'correction_proposed', 'correction_concluded', 'result_corrected')
);

-- A correction is announced by its own notification, not the generic release notice.
create or replace function notifications.on_result_released()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select d.type from assessment.decisions d where d.id = new.current_decision_id) in ('appeal', 'correction') then
    return null;
  end if;
  perform notifications.enqueue(
    'result_released',
    'result_released:' || new.id::text || ':' || new.release_seq::text,
    new.learner_id,
    (select jsonb_build_object('result_id', new.id, 'item_title', ai.title, 'cohort_name', c.name,
                               'released_at', new.released_at, 'appeal_deadline_at', new.appeal_deadline_at)
     from assessment.assessable_items ai join programmes.cohorts c on c.id = ai.cohort_id
     where ai.id = new.assessable_item_id),
    '/learn/results/' || new.id::text
  );
  return null;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------

-- Who may propose or approve for a cohort: a coordinator covering it, or an administrator.
create function assessment.may_correct(p_profile_id uuid, p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select programmes.can_coordinate(p_profile_id, p_cohort_id) or identity.has_role(p_profile_id, 'administrator')
$$;

-- Whether this person took a decision on the result: any decision in its chain, or a moderation finding on it.
create function assessment.took_a_decision(p_profile_id uuid, p_result_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from assessment.decisions d where d.result_id = p_result_id and d.actor_id = p_profile_id)
      or exists (select 1 from moderation.findings f join moderation.sample_items si on si.id = f.sample_item_id
                 where si.result_id = p_result_id and f.moderator_id = p_profile_id)
$$;

-- Why a result cannot be corrected now, or null: not released, waiting for moderation behind its release, or its
-- current decision is an appeal decision.
create function assessment.correction_blocker(p_result assessment.results)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_result.state <> 'released' then 'not_released'
    when p_result.pending_decision_id is not null then 'pending_moderation'
    when (select d.type from assessment.decisions d where d.id = p_result.current_decision_id) = 'appeal' then 'appeal_final'
  end
$$;

revoke all on function assessment.may_correct(uuid, uuid), assessment.took_a_decision(uuid, uuid),
  assessment.correction_blocker(assessment.results)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------------------------

-- The released results of a cohort a correction could be proposed for, with what stands and why one could not be.
create function api.list_correctable_results(p_cohort_id uuid)
returns table (
  result_id uuid,
  learner_name text,
  learner_number text,
  item_title text,
  outcome text,
  decision_type text,
  decided_by_name text,
  released_at timestamptz,
  blocker text,
  open_correction_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, lp.full_name, lp.learner_number, ai.title, d.outcome, d.type, dp.full_name, r.released_at,
    assessment.correction_blocker(r),
    (select c.id from assessment.corrections c where c.result_id = r.id and c.state = 'proposed')
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join identity.profiles lp on lp.id = r.learner_id
  join assessment.decisions d on d.id = r.current_decision_id
  left join identity.profiles dp on dp.id = d.actor_id
  where ai.cohort_id = p_cohort_id and r.state = 'released'
    and assessment.may_correct(auth.uid(), p_cohort_id)
  order by lp.full_name, ai.title
$$;

-- The corrections this person may see: every one in the cohorts they coordinate, or all of them for an
-- administrator; open ones first, newest first.
create function api.list_corrections()
returns table (
  correction_id uuid,
  result_id uuid,
  cohort_id uuid,
  cohort_name text,
  learner_name text,
  learner_number text,
  item_title text,
  current_outcome text,
  proposed_outcome text,
  proposed_by_name text,
  proposed_at timestamptz,
  state text,
  concluded_by_name text,
  concluded_at timestamptz,
  mine boolean,
  may_conclude boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.result_id, c.cohort_id, co.name, lp.full_name, lp.learner_number, ai.title,
    cur.outcome, c.outcome, pp.full_name, c.proposed_at, c.state, cp.full_name, c.concluded_at,
    c.proposed_by = auth.uid(),
    c.state = 'proposed' and c.proposed_by <> auth.uid() and not assessment.took_a_decision(auth.uid(), c.result_id)
  from assessment.corrections c
  join programmes.cohorts co on co.id = c.cohort_id
  join assessment.results r on r.id = c.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join identity.profiles lp on lp.id = r.learner_id
  join assessment.decisions cur on cur.id = r.current_decision_id
  join identity.profiles pp on pp.id = c.proposed_by
  left join identity.profiles cp on cp.id = c.concluded_by
  where assessment.may_correct(auth.uid(), c.cohort_id)
  order by c.state <> 'proposed', c.proposed_at desc
$$;

-- One correction with everything the approver needs: the decision it corrects, the proposal, and whether this
-- person may conclude it (and if not, why).
create function api.get_correction(p_correction_id uuid)
returns table (
  correction_id uuid,
  result_id uuid,
  cohort_id uuid,
  cohort_name text,
  learner_name text,
  learner_number text,
  item_title text,
  state text,
  proposed_by_name text,
  proposed_at timestamptz,
  proposed_outcome text,
  justification text,
  reason text,
  remediation text,
  resubmission_days integer,
  corrected_outcome text,
  corrected_decided_by_name text,
  corrected_decided_at timestamptz,
  corrected_decision_type text,
  corrected_released_at timestamptz,
  result_changed boolean,
  concluded_by_name text,
  concluded_at timestamptz,
  conclusion_reason text,
  mine boolean,
  may_conclude boolean,
  cannot_conclude_because text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.result_id, c.cohort_id, co.name, lp.full_name, lp.learner_number, ai.title, c.state,
    pp.full_name, c.proposed_at, c.outcome, c.justification, c.reason, c.remediation, c.resubmission_days,
    d.outcome, dp.full_name, d.created_at, d.type, dr.released_at,
    r.current_decision_id <> c.decision_id,
    cp.full_name, c.concluded_at, c.conclusion_reason,
    c.proposed_by = auth.uid(),
    c.state = 'proposed' and c.proposed_by <> auth.uid() and not assessment.took_a_decision(auth.uid(), c.result_id)
      and r.current_decision_id = c.decision_id,
    case
      when c.state <> 'proposed' then 'concluded'
      when c.proposed_by = auth.uid() then 'own_proposal'
      when assessment.took_a_decision(auth.uid(), c.result_id) then 'took_a_decision'
      when r.current_decision_id <> c.decision_id then 'result_changed'
    end
  from assessment.corrections c
  join programmes.cohorts co on co.id = c.cohort_id
  join assessment.results r on r.id = c.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join identity.profiles lp on lp.id = r.learner_id
  join assessment.decisions d on d.id = c.decision_id
  left join identity.profiles dp on dp.id = d.actor_id
  left join assessment.decision_releases dr on dr.decision_id = d.id
  join identity.profiles pp on pp.id = c.proposed_by
  left join identity.profiles cp on cp.id = c.concluded_by
  where c.id = p_correction_id and assessment.may_correct(auth.uid(), c.cohort_id)
$$;

-- L-15: whether the learner's current decision is a correction, when it was made, and who assessed the work. The
-- correction's actor is the approver, not the learner's assessor, so the page names the assessor of the latest
-- assessment decision in the chain instead.
create function api.get_my_result_correction(p_result_id uuid)
returns table (corrected_at timestamptz, assessor_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.created_at,
    (select p.full_name from assessment.decisions a join identity.profiles p on p.id = a.actor_id
     where a.result_id = r.id and a.type = 'assessment' order by a.created_at desc limit 1)
  from assessment.results r
  join assessment.decisions d on d.id = r.current_decision_id
  where r.id = p_result_id and r.learner_id = auth.uid() and r.state = 'released' and d.type = 'correction'
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------------------------

-- Proposes a correction. Refusals: unauthenticated, not_found, took_a_decision, not_released, pending_moderation,
-- appeal_final, already_proposed, invalid_outcome, unchanged, justification_required, justification_too_long,
-- reason_required, reason_too_long, remediation_required, resubmission_days_required.
create function api.propose_correction(
  p_result_id uuid,
  p_outcome text,
  p_justification text,
  p_reason text,
  p_remediation text default null,
  p_resubmission_days integer default null
)
returns table (status text, correction_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result assessment.results;
  v_cohort uuid;
  v_current assessment.decisions;
  v_justification text := nullif(btrim(coalesce(p_justification, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_remediation text := nullif(btrim(coalesce(p_remediation, '')), '');
  v_blocker text;
  v_id uuid;
  v_learner text;
  v_item text;
  v_cohort_name text;
  v_proposer text;
  v_coordinator uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  select ai.cohort_id into v_cohort from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where r.id = p_result_id;
  if v_cohort is null or not assessment.may_correct(v_actor, v_cohort) then
    return query select 'not_found'::text, null::uuid; return;
  end if;
  select * into v_result from assessment.results r where r.id = p_result_id for update;
  if assessment.took_a_decision(v_actor, p_result_id) then
    return query select 'took_a_decision'::text, null::uuid; return;
  end if;
  v_blocker := assessment.correction_blocker(v_result);
  if v_blocker is not null then return query select v_blocker, null::uuid; return; end if;
  if exists (select 1 from assessment.corrections c where c.result_id = p_result_id and c.state = 'proposed') then
    return query select 'already_proposed'::text, null::uuid; return;
  end if;
  if p_outcome is null or p_outcome not in ('competent', 'not_yet_competent') then
    return query select 'invalid_outcome'::text, null::uuid; return;
  end if;
  select * into v_current from assessment.decisions d where d.id = v_result.current_decision_id;
  if v_current.outcome = p_outcome then return query select 'unchanged'::text, null::uuid; return; end if;
  if v_justification is null then return query select 'justification_required'::text, null::uuid; return; end if;
  if char_length(v_justification) > 5000 then return query select 'justification_too_long'::text, null::uuid; return; end if;
  if v_reason is null then return query select 'reason_required'::text, null::uuid; return; end if;
  if char_length(v_reason) > 2000 then return query select 'reason_too_long'::text, null::uuid; return; end if;
  if p_outcome = 'not_yet_competent' then
    if v_remediation is null or char_length(v_remediation) > 5000 then
      return query select 'remediation_required'::text, null::uuid; return;
    end if;
    if p_resubmission_days is null or p_resubmission_days not between 1 and 90 then
      return query select 'resubmission_days_required'::text, null::uuid; return;
    end if;
  end if;

  insert into assessment.corrections (result_id, decision_id, cohort_id, proposed_by, outcome, justification, reason, remediation, resubmission_days)
  values (p_result_id, v_result.current_decision_id, v_cohort, v_actor, p_outcome, v_justification, v_reason,
          case when p_outcome = 'not_yet_competent' then v_remediation end,
          case when p_outcome = 'not_yet_competent' then p_resubmission_days end)
  returning id into v_id;

  perform audit.append('assessment.correction_proposed', 'correction', v_id::text,
    jsonb_build_object('result_id', p_result_id, 'decision_id', v_result.current_decision_id, 'reason', v_reason),
    case when programmes.can_coordinate(v_actor, v_cohort) then 'coordinator' else 'administrator' end,
    jsonb_build_object('outcome', v_current.outcome), jsonb_build_object('proposed_outcome', p_outcome),
    'cohort', v_cohort);

  select lp.full_name, ai.title, co.name into v_learner, v_item, v_cohort_name
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts co on co.id = ai.cohort_id
  join identity.profiles lp on lp.id = r.learner_id
  where r.id = p_result_id;
  select p.full_name into v_proposer from identity.profiles p where p.id = v_actor;

  -- The cohort's other coordinators: one of them, or an administrator, must approve.
  for v_coordinator in select cc.profile_id from appeals.cohort_coordinators(v_cohort) cc where cc.profile_id <> v_actor loop
    perform notifications.enqueue('correction_proposed', 'correction_proposed:' || v_id::text, v_coordinator,
      jsonb_build_object('correction_id', v_id, 'learner_name', v_learner, 'item_title', v_item, 'cohort_name', v_cohort_name,
                         'proposed_by', v_proposer, 'current_outcome', v_current.outcome, 'proposed_outcome', p_outcome),
      '/coordinate/corrections/' || v_id::text);
  end loop;

  return query select 'ok'::text, v_id;
end
$$;

-- Approves or declines a correction. Refusals: unauthenticated, not_found, not_open, same_person, took_a_decision,
-- result_changed, reason_required (declining), reason_too_long. Approval releases the corrected decision at once.
create function api.conclude_correction(p_correction_id uuid, p_approve boolean, p_reason text default null)
returns table (status text, decision_id uuid, released_at timestamptz, appeal_deadline_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_correction assessment.corrections;
  v_result assessment.results;
  v_current assessment.decisions;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_role text;
  v_decision uuid;
  v_learner text;
  v_item text;
  v_cohort_name text;
  v_approver text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::timestamptz, null::timestamptz; return; end if;
  select * into v_correction from assessment.corrections c where c.id = p_correction_id;
  if not found or not assessment.may_correct(v_actor, v_correction.cohort_id) then
    return query select 'not_found'::text, null::uuid, null::timestamptz, null::timestamptz; return;
  end if;
  -- Lock order: the result, then the correction.
  select * into v_result from assessment.results r where r.id = v_correction.result_id for update;
  select * into v_correction from assessment.corrections c where c.id = p_correction_id for update;
  if v_correction.state <> 'proposed' then
    return query select 'not_open'::text, v_correction.correction_decision_id, null::timestamptz, null::timestamptz; return;
  end if;
  if v_correction.proposed_by = v_actor then
    return query select 'same_person'::text, null::uuid, null::timestamptz, null::timestamptz; return;
  end if;
  -- Under the lock, whatever changed since the proposal (test plan 27).
  if assessment.took_a_decision(v_actor, v_result.id) then
    return query select 'took_a_decision'::text, null::uuid, null::timestamptz, null::timestamptz; return;
  end if;
  if p_approve and v_result.current_decision_id <> v_correction.decision_id then
    return query select 'result_changed'::text, null::uuid, null::timestamptz, null::timestamptz; return;
  end if;
  if not p_approve then
    if v_reason is null then return query select 'reason_required'::text, null::uuid, null::timestamptz, null::timestamptz; return; end if;
    if char_length(v_reason) > 2000 then return query select 'reason_too_long'::text, null::uuid, null::timestamptz, null::timestamptz; return; end if;
  end if;

  v_role := case when programmes.can_coordinate(v_actor, v_correction.cohort_id) then 'coordinator' else 'administrator' end;
  select lp.full_name, ai.title, co.name into v_learner, v_item, v_cohort_name
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts co on co.id = ai.cohort_id
  join identity.profiles lp on lp.id = r.learner_id
  where r.id = v_result.id;
  select p.full_name into v_approver from identity.profiles p where p.id = v_actor;

  if not p_approve then
    update assessment.corrections c
    set state = 'declined', concluded_by = v_actor, concluded_at = now(), conclusion_reason = v_reason
    where c.id = p_correction_id;
    perform audit.append('assessment.correction_declined', 'correction', p_correction_id::text,
      jsonb_build_object('result_id', v_result.id, 'reason', v_reason), v_role,
      jsonb_build_object('state', 'proposed'), jsonb_build_object('state', 'declined'), 'cohort', v_correction.cohort_id);
    perform notifications.enqueue('correction_concluded', 'correction_concluded:' || p_correction_id::text, v_correction.proposed_by,
      jsonb_build_object('correction_id', p_correction_id, 'learner_name', v_learner, 'item_title', v_item,
                         'cohort_name', v_cohort_name, 'concluded_by', v_approver, 'approved', false, 'reason', v_reason),
      '/coordinate/corrections/' || p_correction_id::text);
    return query select 'ok'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  select * into v_current from assessment.decisions d where d.id = v_result.current_decision_id;

  -- The correction decision: the approver's, superseding the corrected one, carrying its marks and feedback.
  insert into assessment.decisions (result_id, instance_id, type, outcome, actor_id, acting_role, justification,
                                    supersedes_decision_id, scores, feedback, remediation, resubmission_days)
  values (v_result.id, v_current.instance_id, 'correction', v_correction.outcome, v_actor, v_role,
          v_correction.justification, v_result.current_decision_id, v_current.scores, v_current.feedback,
          v_correction.remediation, v_correction.resubmission_days)
  returning id into v_decision;

  -- Moving the pointer releases the correction at once: new sequence number, new appeal window (ADR-021).
  update assessment.results r
  set current_decision_id = v_decision,
      remediation_period = case when v_correction.outcome = 'not_yet_competent'
                                then make_interval(days => v_correction.resubmission_days) end
  where r.id = v_result.id
  returning * into v_result;

  update assessment.corrections c
  set state = 'approved', concluded_by = v_actor, concluded_at = now(), correction_decision_id = v_decision
  where c.id = p_correction_id;

  perform audit.append('assessment.correction_approved', 'correction', p_correction_id::text,
    jsonb_build_object('result_id', v_result.id, 'decision_id', v_decision, 'proposed_by', v_correction.proposed_by,
                       'reason', v_correction.reason, 'release_seq', v_result.release_seq),
    v_role, jsonb_build_object('decision_id', v_current.id, 'outcome', v_current.outcome),
    jsonb_build_object('decision_id', v_decision, 'outcome', v_correction.outcome), 'cohort', v_correction.cohort_id);

  perform notifications.enqueue('result_corrected', 'result_corrected:' || v_result.id::text || ':' || v_result.release_seq::text,
    v_result.learner_id,
    jsonb_build_object('result_id', v_result.id, 'item_title', v_item, 'cohort_name', v_cohort_name,
                       'released_at', v_result.released_at, 'appeal_deadline_at', v_result.appeal_deadline_at),
    '/learn/results/' || v_result.id::text);
  perform notifications.enqueue('correction_concluded', 'correction_concluded:' || p_correction_id::text, v_correction.proposed_by,
    jsonb_build_object('correction_id', p_correction_id, 'learner_name', v_learner, 'item_title', v_item,
                       'cohort_name', v_cohort_name, 'concluded_by', v_approver, 'approved', true),
    '/coordinate/corrections/' || p_correction_id::text);

  return query select 'ok'::text, v_decision, v_result.released_at, v_result.appeal_deadline_at;
end
$$;

-- The proposer withdraws an open proposal.
create function api.withdraw_correction(p_correction_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_correction assessment.corrections;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_correction from assessment.corrections c where c.id = p_correction_id for update;
  if not found or v_correction.proposed_by <> v_actor then return query select 'not_found'::text; return; end if;
  if v_correction.state <> 'proposed' then return query select 'not_open'::text; return; end if;
  update assessment.corrections c set state = 'withdrawn', concluded_by = v_actor, concluded_at = now() where c.id = p_correction_id;
  perform audit.append('assessment.correction_withdrawn', 'correction', p_correction_id::text,
    jsonb_build_object('result_id', v_correction.result_id),
    case when programmes.can_coordinate(v_actor, v_correction.cohort_id) then 'coordinator' else 'administrator' end,
    jsonb_build_object('state', 'proposed'), jsonb_build_object('state', 'withdrawn'), 'cohort', v_correction.cohort_id);
  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.list_correctable_results(uuid), api.list_corrections(), api.get_correction(uuid),
  api.get_my_result_correction(uuid), api.propose_correction(uuid, text, text, text, text, integer),
  api.conclude_correction(uuid, boolean, text), api.withdraw_correction(uuid)
  from public, anon, authenticated, service_role;
grant execute on function api.list_correctable_results(uuid), api.list_corrections(), api.get_correction(uuid),
  api.get_my_result_correction(uuid), api.propose_correction(uuid, text, text, text, text, integer),
  api.conclude_correction(uuid, boolean, text), api.withdraw_correction(uuid)
  to authenticated;
