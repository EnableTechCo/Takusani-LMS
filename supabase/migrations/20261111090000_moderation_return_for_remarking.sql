-- Return for re-marking (S4-08; FR-509, FR-410; BR-03; ADR-019). The correction loop between moderator and assessor:
--   * A moderator who disagrees returns the item: the disagreement is recorded as a finding as before, and with it the
--     required corrections and a deadline. The assessor and every coordinator of the cohort are told (FR-509). The
--     sample item is "returned", the assessment instance is "returned", and the result stays held.
--   * The assessor starts the re-mark: the instance is open for marking again, and the draft starts from the decision
--     that was returned, so they correct rather than start over. Finalising records a new decision that supersedes
--     the returned one (FR-410, BR-03); the original stays on record, the result stays held, the return is closed,
--     the sample item is "re-marked", and the moderator is told to review it again.
--   * The moderator reviews the revised decision and agrees, or returns it again. Sign-off (S4-09) is refused while a
--     return is open.
-- A disagreement without a return no longer exists: the "disagreed" state goes, and the one place that had it (an
-- item disagreed with under S4-07) reopens as "allocated", its finding kept.

-- ---------------------------------------------------------------------------------------------------------------
-- States and the returns table
-- ---------------------------------------------------------------------------------------------------------------

alter table assessment.assessment_instances drop constraint assessment_instances_state_check;
alter table assessment.assessment_instances
  add constraint assessment_instances_state_check check (state in ('to_mark', 'marking', 'decided', 'superseded', 'returned'));

update moderation.sample_items set state = 'allocated' where state = 'disagreed';
alter table moderation.sample_items drop constraint sample_items_state_check;
alter table moderation.sample_items
  add constraint sample_items_state_check check (state in ('unallocated', 'allocated', 'agreed', 'returned', 'remarked'));

-- A re-mark is a second assessment decision on the same instance, so the one-per-instance index from 20261001090000
-- goes. What it guarded against, a second finalisation of one draft, is still refused: the instance is locked and
-- must be "marking", and a decision supersedes exactly one other (unique supersedes_decision_id; one root per result).
drop index assessment.decisions_one_per_assessment_instance;
create index decisions_instance_idx on assessment.decisions (instance_id, created_at);

-- One return of one sampled item: what must be corrected, by when, and once re-marked, the decision that answered it.
create table moderation.returns (
  id uuid primary key default gen_random_uuid(),
  sample_item_id uuid not null references moderation.sample_items (id),
  cycle_id uuid not null references moderation.cycles (id),
  finding_id uuid not null references moderation.findings (id),
  moderator_id uuid not null references identity.profiles (id),
  -- The decision returned, the instance it came from, and who must re-mark it.
  decision_id uuid not null references assessment.decisions (id),
  instance_id uuid not null references assessment.assessment_instances (id),
  assessor_id uuid not null references identity.profiles (id),
  corrections text not null check (char_length(btrim(corrections)) between 1 and 4000),
  due_on date not null,
  returned_at timestamptz not null default clock_timestamp(),
  remarked_at timestamptz,
  remark_decision_id uuid references assessment.decisions (id),
  constraint remark_is_recorded check ((remarked_at is null) = (remark_decision_id is null))
);

create index returns_item_idx on moderation.returns (sample_item_id, returned_at desc);
create index returns_cycle_idx on moderation.returns (cycle_id);
create index returns_finding_idx on moderation.returns (finding_id);
create index returns_moderator_idx on moderation.returns (moderator_id);
create index returns_decision_idx on moderation.returns (decision_id);
create index returns_instance_idx on moderation.returns (instance_id);
create index returns_remark_decision_idx on moderation.returns (remark_decision_id);
create index returns_open_by_assessor_idx on moderation.returns (assessor_id, due_on) where remarked_at is null;

-- One return open per sample item at a time.
create unique index returns_one_open_per_item on moderation.returns (sample_item_id) where remarked_at is null;

revoke all on table moderation.returns from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Notifications
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
                 'moderation_item_returned', 'moderation_return_logged', 'moderation_item_remarked')
);

-- ---------------------------------------------------------------------------------------------------------------
-- The moderator returns an item
-- ---------------------------------------------------------------------------------------------------------------

-- A finding on an item the moderator holds (FR-508). Agreeing concludes the item. Disagreeing returns it to the
-- assessor with the required corrections and a deadline (FR-509): p_corrections and p_due_on are required, and the
-- deadline is a South African date after today and within ninety days. An item already returned waits for the
-- assessor; nothing more can be recorded on it until it is re-marked.
drop function api.record_moderation_finding(uuid, text, text);
create function api.record_moderation_finding(
  p_item_id uuid,
  p_finding text,
  p_reasons text,
  p_corrections text default null,
  p_due_on date default null
)
returns table (status text, finding_id uuid, return_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item moderation.sample_items;
  v_cycle moderation.cycles;
  v_decision assessment.decisions;
  v_instance assessment.assessment_instances;
  v_finding uuid;
  v_return uuid;
  v_assessor uuid;
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_cohort_name text;
  v_learner text;
  v_title text;
  v_moderator text;
  v_coordinator uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::uuid; return; end if;
  select * into v_item from moderation.sample_items si where si.id = p_item_id and si.moderator_id = v_actor for update;
  if not found then return query select 'not_found'::text, null::uuid, null::uuid; return; end if;
  if moderation.assessed_result(v_actor, v_item.result_id) then
    return query select 'separation_of_duties_conflict'::text, null::uuid, null::uuid; return;
  end if;
  select * into v_cycle from moderation.cycles c where c.id = v_item.cycle_id;
  if v_cycle.state <> 'frozen' then return query select 'not_open'::text, null::uuid, null::uuid; return; end if;
  if v_item.state = 'returned' then return query select 'item_returned'::text, null::uuid, null::uuid; return; end if;
  if p_finding is null or p_finding not in ('agree', 'disagree') then
    return query select 'invalid_finding'::text, null::uuid, null::uuid; return;
  end if;
  if char_length(btrim(coalesce(p_reasons, ''))) not between 1 and 4000 then
    return query select 'reasons_required'::text, null::uuid, null::uuid; return;
  end if;

  select d.* into v_decision from assessment.decisions d
  join assessment.results r on r.id = v_item.result_id
  where d.id = coalesce(r.pending_decision_id, r.current_decision_id);

  if p_finding = 'disagree' then
    if char_length(btrim(coalesce(p_corrections, ''))) not between 1 and 4000 then
      return query select 'corrections_required'::text, null::uuid, null::uuid; return;
    end if;
    if p_due_on is null or p_due_on <= v_today or p_due_on > v_today + 90 then
      return query select 'invalid_due_on'::text, null::uuid, null::uuid; return;
    end if;
    -- The instance the decision came from is what the assessor re-marks. One made another way (an import, a
    -- correction) has none; one replaced by a later version is being marked afresh, and that decision will come here.
    select i.* into v_instance from assessment.assessment_instances i where i.id = v_decision.instance_id for update;
    if not found then return query select 'cannot_return'::text, null::uuid, null::uuid; return; end if;
    if v_instance.state = 'superseded' then return query select 'superseded'::text, null::uuid, null::uuid; return; end if;
    if v_instance.state <> 'decided' then return query select 'cannot_return'::text, null::uuid, null::uuid; return; end if;
  end if;

  insert into moderation.findings (sample_item_id, cycle_id, moderator_id, decision_id, finding, reasons)
  values (v_item.id, v_item.cycle_id, v_actor, v_decision.id, p_finding, btrim(p_reasons))
  returning id into v_finding;

  if p_finding = 'agree' then
    update moderation.sample_items si set state = 'agreed' where si.id = v_item.id;
    perform audit.append('moderation.finding_recorded', 'moderation_sample_item', v_item.id::text,
      jsonb_build_object('finding_id', v_finding, 'decision_id', v_decision.id, 'finding', 'agree'), 'moderator',
      jsonb_build_object('state', v_item.state), jsonb_build_object('state', 'agreed'), 'cohort', v_cycle.cohort_id);
    return query select 'ok'::text, v_finding, null::uuid;
    return;
  end if;

  -- The return (FR-509).
  v_assessor := coalesce(v_instance.assessor_id, v_decision.actor_id);
  update assessment.assessment_instances i
  set state = 'returned', assessor_id = v_assessor, version = i.version + 1, updated_at = now()
  where i.id = v_instance.id;

  insert into moderation.returns (
    sample_item_id, cycle_id, finding_id, moderator_id, decision_id, instance_id, assessor_id, corrections, due_on
  )
  values (v_item.id, v_item.cycle_id, v_finding, v_actor, v_decision.id, v_instance.id, v_assessor, btrim(p_corrections), p_due_on)
  returning id into v_return;

  update moderation.sample_items si set state = 'returned' where si.id = v_item.id;

  select co.name into v_cohort_name from programmes.cohorts co where co.id = v_cycle.cohort_id;
  select lp.full_name, ai.title into v_learner, v_title
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join identity.profiles lp on lp.id = r.learner_id
  where r.id = v_item.result_id;
  select mp.full_name into v_moderator from identity.profiles mp where mp.id = v_actor;

  perform audit.append('moderation.finding_recorded', 'moderation_sample_item', v_item.id::text,
    jsonb_build_object('finding_id', v_finding, 'decision_id', v_decision.id, 'finding', 'disagree'), 'moderator',
    jsonb_build_object('state', v_item.state), jsonb_build_object('state', 'returned'), 'cohort', v_cycle.cohort_id);
  perform audit.append('moderation.item_returned', 'moderation_sample_item', v_item.id::text,
    jsonb_build_object('return_id', v_return, 'finding_id', v_finding, 'decision_id', v_decision.id,
                       'instance_id', v_instance.id, 'assessor_id', v_assessor, 'due_on', p_due_on),
    'moderator', jsonb_build_object('instance_state', v_instance.state),
    jsonb_build_object('instance_state', 'returned'), 'cohort', v_cycle.cohort_id);

  -- The assessor, and every coordinator of the cohort (FR-509).
  perform notifications.enqueue('moderation_item_returned', 'moderation_item_returned:' || v_return::text, v_assessor,
    jsonb_build_object('return_id', v_return, 'instance_id', v_instance.id, 'learner_name', v_learner,
                       'item_title', v_title, 'cohort_name', v_cohort_name, 'cycle_name', v_cycle.name,
                       'moderator_name', v_moderator, 'due_on', p_due_on, 'corrections', btrim(p_corrections)),
    '/assess/instances/' || v_instance.id::text);
  for v_coordinator in select cc.profile_id from appeals.cohort_coordinators(v_cycle.cohort_id) cc loop
    perform notifications.enqueue('moderation_return_logged', 'moderation_return_logged:' || v_return::text, v_coordinator,
      jsonb_build_object('return_id', v_return, 'cycle_id', v_cycle.id, 'learner_name', v_learner,
                         'item_title', v_title, 'cohort_name', v_cohort_name, 'cycle_name', v_cycle.name,
                         'moderator_name', v_moderator, 'due_on', p_due_on),
      '/coordinate/cohorts/' || v_cycle.cohort_id::text || '/moderation/cycles/' || v_cycle.id::text);
  end loop;

  return query select 'ok'::text, v_finding, v_return;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The assessor re-marks
-- ---------------------------------------------------------------------------------------------------------------

-- Opens a returned item for re-marking by its assessor (FR-410). The draft starts from the decision that was
-- returned, so the assessor corrects what the moderator asked for rather than starting over. A repeat while the
-- re-mark is in progress is harmless.
create function api.start_remark(p_instance_id uuid)
returns table (status text, instance_version integer, draft_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_instance assessment.assessment_instances;
  v_cohort uuid;
  v_return moderation.returns;
  v_decision assessment.decisions;
  v_draft_version integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer; return; end if;
  select i.* into v_instance from assessment.assessment_instances i where i.id = p_instance_id for update;
  if not found then return query select 'not_found'::text, null::integer, null::integer; return; end if;
  select ai.cohort_id into v_cohort
  from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where r.id = v_instance.result_id;
  if not assessment.can_assess(v_actor, v_cohort) then
    perform audit.append('assessment.access_refused', 'assessment_instance', p_instance_id::text,
      jsonb_build_object('reason', 'outside_scope'), null, null, null, 'cohort', v_cohort);
    return query select 'not_found'::text, null::integer, null::integer; return;
  end if;
  if v_instance.assessor_id is distinct from v_actor then
    return query select 'not_your_item'::text, v_instance.version, null::integer; return;
  end if;

  select rt.* into v_return from moderation.returns rt
  where rt.instance_id = p_instance_id and rt.remarked_at is null
  order by rt.returned_at desc limit 1;

  if v_instance.state = 'marking' and found then
    return query select 'ok'::text, v_instance.version,
      (select d.version from assessment.marking_drafts d where d.instance_id = p_instance_id);
    return;
  end if;
  if v_instance.state <> 'returned' or not found then
    return query select 'not_returned'::text, v_instance.version, null::integer; return;
  end if;

  select d.* into v_decision from assessment.decisions d where d.id = v_return.decision_id;

  update assessment.assessment_instances i
  set state = 'marking', version = i.version + 1, updated_at = now()
  where i.id = p_instance_id;

  insert into assessment.marking_drafts as d (
    instance_id, assessor_id, scores, feedback, outcome, justification, remediation, resubmission_days, version, updated_at
  )
  values (
    p_instance_id, v_actor, coalesce(v_decision.scores, '[]'::jsonb), v_decision.feedback, v_decision.outcome,
    v_decision.justification, v_decision.remediation, v_decision.resubmission_days, 1, now()
  )
  on conflict (instance_id) do update
  set assessor_id = excluded.assessor_id, scores = excluded.scores, feedback = excluded.feedback,
      outcome = excluded.outcome, justification = excluded.justification, remediation = excluded.remediation,
      resubmission_days = excluded.resubmission_days, version = d.version + 1, updated_at = now()
  returning version into v_draft_version;

  perform audit.append('assessment.remark_started', 'assessment_instance', p_instance_id::text,
    jsonb_build_object('return_id', v_return.id, 'decision_id', v_decision.id), 'assessor',
    jsonb_build_object('state', 'returned'), jsonb_build_object('state', 'marking'), 'cohort', v_cohort);

  return query select 'ok'::text, v_instance.version + 1, v_draft_version;
end
$$;

-- Closes the open return on a result when a new decision lands on it: the return records the decision that answered
-- it, the sample item is "re-marked" for the moderator to review again, and the moderator is told. Called by
-- finalise; true when a return was closed.
create function moderation.record_remark(p_result_id uuid, p_decision_id uuid, p_actor uuid, p_cohort_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_any boolean := false;
begin
  for v_row in
    select rt.id as return_id, rt.moderator_id, si.id as item_id, si.state as item_state, si.cycle_id, c.name as cycle_name,
      co.name as cohort_name, lp.full_name as learner_name, ai.title as item_title
    from moderation.returns rt
    join moderation.sample_items si on si.id = rt.sample_item_id
    join moderation.cycles c on c.id = si.cycle_id
    join programmes.cohorts co on co.id = c.cohort_id
    join assessment.results r on r.id = si.result_id
    join assessment.assessable_items ai on ai.id = r.assessable_item_id
    join identity.profiles lp on lp.id = r.learner_id
    where si.result_id = p_result_id and rt.remarked_at is null
    for update of rt
  loop
    update moderation.returns rt set remarked_at = now(), remark_decision_id = p_decision_id where rt.id = v_row.return_id;
    update moderation.sample_items si set state = 'remarked' where si.id = v_row.item_id and si.state = 'returned';
    perform audit.append('moderation.item_remarked', 'moderation_sample_item', v_row.item_id::text,
      jsonb_build_object('return_id', v_row.return_id, 'decision_id', p_decision_id), 'assessor',
      jsonb_build_object('state', v_row.item_state), jsonb_build_object('state', 'remarked'), 'cohort', p_cohort_id);
    perform notifications.enqueue('moderation_item_remarked', 'moderation_item_remarked:' || v_row.return_id::text,
      v_row.moderator_id,
      jsonb_build_object('return_id', v_row.return_id, 'item_id', v_row.item_id, 'cycle_id', v_row.cycle_id,
                         'cycle_name', v_row.cycle_name, 'cohort_name', v_row.cohort_name,
                         'learner_name', v_row.learner_name, 'item_title', v_row.item_title),
      '/moderate/cycles/' || v_row.cycle_id::text || '/items/' || v_row.item_id::text);
    v_any := true;
  end loop;
  return v_any;
end
$$;

revoke all on function moderation.record_remark(uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;

-- Finalising, from 20261027090000, now also the re-mark: the instance is marked again after a return, the new
-- decision supersedes the returned one, and the open return is closed. "Already finalised" names the latest
-- decision of the instance, since a re-marked instance has more than one.
create or replace function api.finalise_decision(p_instance_id uuid, p_expected_draft_version integer)
returns table (
  status text,
  decision_id uuid,
  result_state text,
  released_at timestamptz,
  appeal_deadline_at timestamptz,
  remediation_deadline_at timestamptz,
  detail text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_instance assessment.assessment_instances;
  v_result assessment.results;
  v_draft assessment.marking_drafts;
  v_cohort uuid;
  v_policy text;
  v_decision uuid;
  v_existing uuid;
  v_remark boolean;
begin
  if v_actor is null then
    return query select 'unauthenticated'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
      null::timestamptz, null::text;
    return;
  end if;

  -- Lock order: the cohort's moderation state (shared), then the result, then the instance. Every function that
  -- finalises, freezes, signs off or cancels takes them in this order (ADR-019), so they cannot deadlock.
  select ai.cohort_id into v_cohort
  from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where i.id = p_instance_id;
  if v_cohort is null then
    return query select 'not_found'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
      null::timestamptz, null::text;
    return;
  end if;

  select ms.moderation_policy into v_policy
  from programmes.cohort_moderation_state ms where ms.cohort_id = v_cohort for share;

  select r.* into v_result from assessment.results r
  join assessment.assessment_instances i on i.result_id = r.id
  where i.id = p_instance_id for update of r;
  select i.* into v_instance from assessment.assessment_instances i where i.id = p_instance_id for update;

  if v_instance.assessor_id is distinct from v_actor then
    return query select 'not_your_item'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
      null::timestamptz, null::text;
    return;
  end if;

  -- Already decided: a retry, or the loser of a race. Say so, with the decision that stands.
  if v_instance.state = 'decided' then
    select d.id into v_existing from assessment.decisions d
    where d.instance_id = p_instance_id and d.type = 'assessment'
    order by d.created_at desc limit 1;
    return query select 'already_finalised'::text, v_existing, v_result.state, v_result.released_at,
      v_result.appeal_deadline_at, v_result.remediation_deadline_at, null::text;
    return;
  end if;
  if v_instance.state <> 'marking' then
    return query select 'not_open_for_marking'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
      null::timestamptz, null::text;
    return;
  end if;

  select d.* into v_draft from assessment.marking_drafts d where d.instance_id = p_instance_id for update;
  if not found or v_draft.version <> p_expected_draft_version then
    return query select 'stale_version'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
      null::timestamptz, coalesce(v_draft.version, 0)::text;
    return;
  end if;

  -- The decision must be complete (FR-404, FR-405). Name the first thing missing.
  if v_draft.outcome is null then
    return query select 'incomplete'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
      null::timestamptz, 'outcome'::text;
    return;
  end if;
  if v_draft.justification is null then
    return query select 'incomplete'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
      null::timestamptz, 'justification'::text;
    return;
  end if;
  if v_draft.outcome = 'not_yet_competent' and (v_draft.remediation is null or v_draft.resubmission_days is null) then
    return query select 'incomplete'::text, null::uuid, null::text, null::timestamptz, null::timestamptz,
      null::timestamptz, case when v_draft.remediation is null then 'remediation' else 'resubmission_days' end;
    return;
  end if;

  -- P-04: a later decision on a result the learner already has waits for the next cycle. It supersedes the latest
  -- decision in the chain (a pending one, if a resubmission is already waiting) and becomes the result's pending
  -- decision; the released outcome stays current, so nothing reaches the learner until sign-off.
  if v_policy = 'moderated' and v_result.state = 'released' then
    insert into assessment.decisions (
      result_id, instance_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id,
      scores, feedback, remediation, resubmission_days
    )
    values (
      v_result.id, p_instance_id, 'assessment', v_draft.outcome, v_actor, 'assessor', v_draft.justification,
      coalesce(v_result.pending_decision_id, v_result.current_decision_id), v_draft.scores, v_draft.feedback,
      case when v_draft.outcome = 'not_yet_competent' then v_draft.remediation end,
      case when v_draft.outcome = 'not_yet_competent' then v_draft.resubmission_days end
    )
    returning id into v_decision;

    update assessment.assessment_instances
    set state = 'decided', version = version + 1, updated_at = now()
    where id = p_instance_id;

    update assessment.results r set pending_decision_id = v_decision where r.id = v_result.id;

    v_remark := moderation.record_remark(v_result.id, v_decision, v_actor, v_cohort);

    perform audit.append('assessment.decision_finalised', 'decision', v_decision::text,
      jsonb_build_object('result_id', v_result.id, 'instance_id', p_instance_id, 'remark', v_remark), 'assessor', null,
      jsonb_build_object('outcome', v_draft.outcome, 'result_state', 'held', 'held_behind_release', true),
      'cohort', v_cohort);

    return query select 'ok'::text, v_decision, 'held'::text, null::timestamptz, null::timestamptz,
      null::timestamptz, v_policy;
    return;
  end if;

  insert into assessment.decisions (
    result_id, instance_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id,
    scores, feedback, remediation, resubmission_days
  )
  values (
    v_result.id, p_instance_id, 'assessment', v_draft.outcome, v_actor, 'assessor', v_draft.justification,
    v_result.current_decision_id, v_draft.scores, v_draft.feedback,
    case when v_draft.outcome = 'not_yet_competent' then v_draft.remediation end,
    case when v_draft.outcome = 'not_yet_competent' then v_draft.resubmission_days end
  )
  returning id into v_decision;

  update assessment.assessment_instances
  set state = 'decided', version = version + 1, updated_at = now()
  where id = p_instance_id;

  -- BR-04: released only when the cohort is not moderated. The trigger writes the release facts.
  update assessment.results r
  set current_decision_id = v_decision,
      remediation_period = case when v_draft.outcome = 'not_yet_competent'
                                then make_interval(days => v_draft.resubmission_days) end,
      state = case when v_policy = 'not_moderated' then 'released' else r.state end
  where r.id = v_result.id
  returning r.* into v_result;

  v_remark := moderation.record_remark(v_result.id, v_decision, v_actor, v_cohort);

  perform audit.append('assessment.decision_finalised', 'decision', v_decision::text,
    jsonb_build_object('result_id', v_result.id, 'instance_id', p_instance_id, 'remark', v_remark), 'assessor', null,
    jsonb_build_object('outcome', v_draft.outcome, 'result_state', v_result.state,
      'release_seq', v_result.release_seq, 'appeal_deadline_at', v_result.appeal_deadline_at),
    'cohort', v_cohort);

  return query select 'ok'::text, v_decision, v_result.state, v_result.released_at, v_result.appeal_deadline_at,
    v_result.remediation_deadline_at, v_policy;
end
$$;

-- A later version from the learner supersedes a returned instance too: the new version is marked afresh, and that
-- decision answers the return (record_remark closes it by result).
create or replace function assessment.open_instance(p_task_id uuid, p_learner_id uuid, p_submission_version_id uuid)
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
  where result_id = v_result and state in ('to_mark', 'marking', 'returned');

  insert into assessment.assessment_instances (result_id, submission_version_id)
  values (v_result, p_submission_version_id)
  returning id into v_instance;

  return v_instance;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The assessor's reads
-- ---------------------------------------------------------------------------------------------------------------

-- A-04: the items returned to this assessor and not yet re-marked, soonest deadline first.
create function api.list_my_returned_items()
returns table (
  return_id uuid,
  instance_id uuid,
  instance_state text,
  result_id uuid,
  learner_name text,
  learner_number text,
  item_title text,
  cohort_name text,
  cycle_name text,
  moderator_name text,
  corrections text,
  due_on date,
  returned_at timestamptz,
  overdue boolean,
  outcome text,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select rt.id, rt.instance_id, i.state, si.result_id, lp.full_name, lp.learner_number, ai.title, co.name, c.name,
    mp.full_name, rt.corrections, rt.due_on, rt.returned_at,
    rt.due_on < (now() at time zone 'Africa/Johannesburg')::date, d.outcome, d.created_at
  from moderation.returns rt
  join moderation.sample_items si on si.id = rt.sample_item_id
  join moderation.cycles c on c.id = rt.cycle_id
  join programmes.cohorts co on co.id = c.cohort_id
  join assessment.assessment_instances i on i.id = rt.instance_id
  join assessment.results r on r.id = si.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join identity.profiles lp on lp.id = r.learner_id
  join identity.profiles mp on mp.id = rt.moderator_id
  join assessment.decisions d on d.id = rt.decision_id
  where rt.assessor_id = auth.uid() and rt.remarked_at is null
  order by rt.due_on, rt.returned_at
$$;

-- The marking workspace read, from 20261029090000, now with the returns on the result (newest first): the open one
-- is what the assessor must correct; earlier ones are history.
drop function api.get_marking_item(uuid);
create function api.get_marking_item(p_instance_id uuid)
returns table (
  instance_id uuid,
  instance_state text,
  instance_version integer,
  assessor_id uuid,
  assessor_name text,
  result_id uuid,
  result_state text,
  result_released_at timestamptz,
  result_appeal_deadline_at timestamptz,
  result_remediation_deadline_at timestamptz,
  learner_name text,
  learner_number text,
  task_id uuid,
  task_title text,
  task_brief text,
  cohort_name text,
  moderation_policy text,
  version_number integer,
  submitted_at timestamptz,
  is_late boolean,
  criteria jsonb,
  requirements jsonb,
  versions jsonb,
  draft jsonb,
  decisions jsonb,
  returns jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cohort uuid;
begin
  select ai.cohort_id into v_cohort
  from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where i.id = p_instance_id;

  if v_actor is null or v_cohort is null then return; end if;
  if not assessment.can_assess(v_actor, v_cohort) then
    perform audit.append('assessment.access_refused', 'assessment_instance', p_instance_id::text,
      jsonb_build_object('reason', 'outside_scope'), null, null, null, 'cohort', v_cohort);
    return;
  end if;

  return query
  select i.id, i.state, i.version, i.assessor_id, ap.full_name, r.id,
    case when pd.id is not null then 'held' else r.state end,
    case when pd.id is null then r.released_at end,
    case when pd.id is null then r.appeal_deadline_at end,
    case when pd.id is null then r.remediation_deadline_at end,
    lp.full_name, lp.learner_number,
    t.id, t.title, t.brief, c.name, ms.moderation_policy, sv.version_number, sv.submitted_at, sv.is_late,
    coalesce((
      select jsonb_agg(jsonb_build_object('ordinal', tc.ordinal, 'title', tc.title, 'descriptor', tc.descriptor,
                                          'points', tc.points) order by tc.ordinal)
      from submissions.task_criteria tc where tc.task_id = t.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title, 'mandatory', q.mandatory) order by q.ordinal)
      from submissions.task_evidence_requirements q where q.task_id = t.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'version_number', v.version_number, 'submitted_at', v.submitted_at, 'is_late', v.is_late,
               'receipt_reference', v.receipt_reference, 'assessed', v.id = i.submission_version_id,
               'files', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'filename', sf.original_filename, 'bytes', sf.bytes, 'media_type', sf.media_type,
                          'bucket', sf.bucket, 'object_key', sf.object_key, 'requirement', q.title)
                          order by q.ordinal nulls last, sf.original_filename), '[]'::jsonb)
                 from submissions.submission_files vf
                 join submissions.stored_files sf on sf.id = vf.stored_file_id
                 left join submissions.task_evidence_requirements q on q.id = vf.requirement_id
                 where vf.version_id = v.id
               )) order by v.version_number desc)
      from submissions.submission_versions v
      where v.submission_id = sv.submission_id
    ), '[]'::jsonb),
    (select to_jsonb(d) - 'instance_id' from assessment.marking_drafts d where d.instance_id = i.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('type', dc.type, 'outcome', dc.outcome, 'acting_role', dc.acting_role,
                                          'created_at', dc.created_at, 'instance_id', dc.instance_id,
                                          'released_at', dcr.released_at) order by dc.created_at)
      from assessment.decisions dc
      left join assessment.decision_releases dcr on dcr.decision_id = dc.id
      where dc.result_id = r.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'return_id', rt.id, 'instance_id', rt.instance_id, 'corrections', rt.corrections, 'due_on', rt.due_on,
               'returned_at', rt.returned_at, 'remarked_at', rt.remarked_at, 'moderator_name', mp.full_name,
               'cycle_name', cy.name, 'outcome', rd.outcome, 'decided_at', rd.created_at)
             order by rt.returned_at desc)
      from moderation.returns rt
      join moderation.sample_items si on si.id = rt.sample_item_id
      join moderation.cycles cy on cy.id = rt.cycle_id
      join identity.profiles mp on mp.id = rt.moderator_id
      join assessment.decisions rd on rd.id = rt.decision_id
      where si.result_id = r.id
    ), '[]'::jsonb)
  from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join submissions.tasks t on t.id = ai.task_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join programmes.cohort_moderation_state ms on ms.cohort_id = c.id
  join identity.profiles lp on lp.id = r.learner_id
  join submissions.submission_versions sv on sv.id = i.submission_version_id
  left join identity.profiles ap on ap.id = i.assessor_id
  left join assessment.decisions pd on pd.id = r.pending_decision_id and pd.instance_id = i.id
  where i.id = p_instance_id;
end
$$;

-- The assessor's release status, from 20261029090000, now with "returned to you": a decision under an open return,
-- with its deadline. It stays held; the re-mark replaces it.
drop function api.list_my_release_status();
create function api.list_my_release_status()
returns table (
  decision_id uuid,
  instance_id uuid,
  result_id uuid,
  cohort_id uuid,
  cohort_name text,
  moderation_policy text,
  item_id uuid,
  item_title text,
  learner_name text,
  learner_number text,
  outcome text,
  decided_at timestamptz,
  stage text,
  released_at timestamptz,
  replaced_by text,
  replaced_at timestamptz,
  return_due_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.instance_id, r.id, c.id, c.name, ms.moderation_policy, ai.id, ai.title, lp.full_name,
    lp.learner_number, d.outcome, d.created_at,
    case
      when rt.id is not null then 'returned'
      when d.id = r.pending_decision_id or (d.id = r.current_decision_id and r.state = 'held')
        then case when r.hold_cycle_id is null then 'waiting_for_cycle' else 'in_moderation' end
      when d.id = r.current_decision_id and dr.decision_id is not null then 'released'
      else 'replaced'
    end,
    dr.released_at, nd.type, nd.created_at, rt.due_on
  from assessment.decisions d
  join assessment.results r on r.id = d.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join programmes.cohort_moderation_state ms on ms.cohort_id = c.id
  join identity.profiles lp on lp.id = r.learner_id
  left join assessment.decision_releases dr on dr.decision_id = d.id
  left join assessment.decisions nd on nd.supersedes_decision_id = d.id
  left join moderation.returns rt on rt.decision_id = d.id and rt.remarked_at is null
  where d.actor_id = auth.uid()
    and d.type = 'assessment'
    and assessment.can_assess(auth.uid(), c.id)
  order by d.created_at desc, d.id
$$;

-- Open allocations, from 20261018090000: an item returned for re-marking also depends on the assessor role (FR-105).
create or replace function identity.open_allocations(p_profile_id uuid)
returns table (kind text, cohort_id uuid, cohort_name text, items integer, oldest_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select 'marking'::text, c.id, c.name, count(*)::integer, min(v.submitted_at)
  from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  left join submissions.submission_versions v on v.id = i.submission_version_id
  where i.assessor_id = p_profile_id and i.state = 'marking'
    and not exists (select 1 from moderation.returns rt where rt.instance_id = i.id and rt.remarked_at is null)
  group by c.id, c.name
  union all
  select 'remark'::text, c.id, c.name, count(*)::integer, min(rt.due_on::timestamptz)
  from moderation.returns rt
  join moderation.cycles cy on cy.id = rt.cycle_id
  join programmes.cohorts c on c.id = cy.cohort_id
  where rt.assessor_id = p_profile_id and rt.remarked_at is null
  group by c.id, c.name
  union all
  select 'appeal_review', null, null, count(*)::integer, min(a.allocated_at)
  from appeals.appeals a
  where a.reviewer_id = p_profile_id and a.state in ('allocated', 'under_review')
  having count(*) > 0
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The moderator's and coordinator's reads carry the return
-- ---------------------------------------------------------------------------------------------------------------

drop function api.list_my_moderation_cycles();
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
  my_returned integer,
  my_remarked integer,
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
    count(*) filter (where si.moderator_id = auth.uid() and si.state = 'returned')::integer,
    count(*) filter (where si.moderator_id = auth.uid() and si.state = 'remarked')::integer,
    count(*)::integer
  from moderation.cycles c
  join programmes.cohorts co on co.id = c.cohort_id
  join moderation.sample_items si on si.cycle_id = c.id
  where exists (select 1 from moderation.sample_items x where x.cycle_id = c.id and x.moderator_id = auth.uid())
  group by c.id, co.name
  order by c.state = 'signed_off', c.frozen_at desc
$$;

drop function api.list_my_sample_items(uuid);
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
  last_finding_at timestamptz,
  due_on date,
  remarked_at timestamptz
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
    (select max(f.created_at) from moderation.findings f where f.sample_item_id = m.id),
    (select rt.due_on from moderation.returns rt where rt.sample_item_id = m.id and rt.remarked_at is null),
    case when m.state = 'remarked' then
      (select max(rt.remarked_at) from moderation.returns rt where rt.sample_item_id = m.id) end
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

-- M-03, from 20261109090000, now with the item's returns, newest first: the open one says what the assessor was
-- asked to correct and by when; a closed one names the decision that answered it.
drop function api.open_sample_item(uuid);
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
  returns jsonb,
  my_concluded integer,
  my_items integer,
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
    coalesce((select jsonb_agg(jsonb_build_object(
                'return_id', rt.id, 'corrections', rt.corrections, 'due_on', rt.due_on, 'returned_at', rt.returned_at,
                'remarked_at', rt.remarked_at, 'moderator_name', rp.full_name, 'assessor_name', asp.full_name,
                'decision_id', rt.decision_id, 'remark_decision_id', rt.remark_decision_id)
              order by rt.returned_at desc)
              from moderation.returns rt
              join identity.profiles rp on rp.id = rt.moderator_id
              join identity.profiles asp on asp.id = rt.assessor_id
              where rt.sample_item_id = i.id), '[]'::jsonb),
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

drop function api.list_cycle_sample_items(uuid);
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
  last_finding_at timestamptz,
  due_on date,
  returned_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select si.id, row_number() over (order by si.stratum, si.result_id)::integer, lp.full_name, lp.learner_number, ai.title,
    si.inclusion_reason, si.stratum, si.state, d.outcome, ap.full_name, si.moderator_id, mp.full_name, si.allocated_at,
    (select f.finding from moderation.findings f where f.sample_item_id = si.id order by f.created_at desc limit 1),
    (select max(f.created_at) from moderation.findings f where f.sample_item_id = si.id),
    (select rt.due_on from moderation.returns rt where rt.sample_item_id = si.id and rt.remarked_at is null),
    (select rt.returned_at from moderation.returns rt where rt.sample_item_id = si.id and rt.remarked_at is null)
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

-- C-06, from 20261108090000, now with the returns still open in each cycle, so the list can say "waiting for
-- re-marks".
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
  sampled integer,
  returned integer
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
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id),
    (select count(*)::integer from moderation.returns rt where rt.cycle_id = c.id and rt.remarked_at is null)
  from moderation.cycles c
  join identity.profiles pb on pb.id = c.planned_by
  left join identity.profiles cb on cb.id = c.cancelled_by
  where c.cohort_id = p_cohort_id and programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by c.planned_at desc
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.record_moderation_finding(uuid, text, text, text, date) from public, anon, authenticated, service_role;
revoke all on function api.start_remark(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_returned_items() from public, anon, authenticated, service_role;
revoke all on function api.get_marking_item(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_release_status() from public, anon, authenticated, service_role;
revoke all on function api.list_my_moderation_cycles() from public, anon, authenticated, service_role;
revoke all on function api.list_my_sample_items(uuid) from public, anon, authenticated, service_role;
revoke all on function api.open_sample_item(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_cycle_sample_items(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_moderation_cycles(uuid) from public, anon, authenticated, service_role;

grant execute on function api.record_moderation_finding(uuid, text, text, text, date) to authenticated;
grant execute on function api.start_remark(uuid) to authenticated;
grant execute on function api.list_my_returned_items() to authenticated;
grant execute on function api.get_marking_item(uuid) to authenticated;
grant execute on function api.list_my_release_status() to authenticated;
grant execute on function api.list_my_moderation_cycles() to authenticated;
grant execute on function api.list_my_sample_items(uuid) to authenticated;
grant execute on function api.open_sample_item(uuid) to authenticated;
grant execute on function api.list_cycle_sample_items(uuid) to authenticated;
grant execute on function api.list_moderation_cycles(uuid) to authenticated;
