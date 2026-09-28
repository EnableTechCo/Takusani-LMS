-- The hold path for moderated cohorts, finished (S4-04; FR-408; BR-04; ADR-019; P-01, P-04; test plan 4, 12, 13).
--
-- S2-08 already held a first decision in a moderated cohort: finalise reads the cohort's moderation state under a
-- shared lock, and the result stays held with no cycle, in the pending pool. What it refused was a later decision on a
-- result the learner already has, for example a resubmission marked after a released Not yet competent. P-04 says
-- such a decision is moderated by the next cycle like any other, so it is now held too:
--   * The released result keeps its current decision: the learner goes on seeing the released outcome, its appeal
--     window and resubmission deadline, and reads "your resubmission is being assessed" (their latest version is
--     newer than the one assessed). No release, no new appeal window, no notification.
--   * The new decision is written (immutable, superseding the latest decision in the chain) and recorded as the
--     result's pending decision. The result joins the pending pool: a cycle claims it at freeze, and sign-off (S4-09)
--     makes the pending decision current, which releases it through the release guard with a new sequence number.
--   * A further resubmission decided before then supersedes the pending one and takes its place.
-- Staff see it as decided and held, with no release date. The pool counts it, so the cohort cannot be switched to
-- Not moderated while it waits (S4-03).

alter table assessment.results
  add column pending_decision_id uuid,
  add constraint pending_decision_belongs_to_result
    foreign key (id, pending_decision_id) references assessment.decisions (result_id, id),
  add constraint only_a_released_result_has_a_pending_decision check (pending_decision_id is null or state = 'released');

-- The pending pool: held results with no cycle, and released results with a decision waiting.
create index results_pending_pool_idx on assessment.results (assessable_item_id)
  where hold_cycle_id is null and (state = 'held' or pending_decision_id is not null);

-- Results of the cohort still to be released: waiting for a cycle (held, or a later decision held behind a released
-- result), or held in one. Replaces the S4-03 count so the policy guard sees both.
create or replace function programmes.unreleased_results(p_cohort_id uuid)
returns table (waiting integer, held integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where r.hold_cycle_id is null)::integer,
         count(*) filter (where r.hold_cycle_id is not null)::integer
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where ai.cohort_id = p_cohort_id and (r.state = 'held' or r.pending_decision_id is not null)
$$;

-- Finalising, from 20261001090000, with the hold path for a released result in a moderated cohort.
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
    where d.instance_id = p_instance_id and d.type = 'assessment';
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

    perform audit.append('assessment.decision_finalised', 'decision', v_decision::text,
      jsonb_build_object('result_id', v_result.id, 'instance_id', p_instance_id), 'assessor', null,
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

  perform audit.append('assessment.decision_finalised', 'decision', v_decision::text,
    jsonb_build_object('result_id', v_result.id, 'instance_id', p_instance_id), 'assessor', null,
    jsonb_build_object('outcome', v_draft.outcome, 'result_state', v_result.state,
      'release_seq', v_result.release_seq, 'appeal_deadline_at', v_result.appeal_deadline_at),
    'cohort', v_cohort);

  -- S2-10 writes the learner's notification to the outbox here, in this transaction, when the result is released.
  return query select 'ok'::text, v_decision, v_result.state, v_result.released_at, v_result.appeal_deadline_at,
    v_result.remediation_deadline_at, v_policy;
end
$$;

-- The marking workspace read, from 20261001090000: a decision held behind a released result reads as held.
create or replace function api.get_marking_item(p_instance_id uuid)
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
  decisions jsonb
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
  -- This instance's decision is held behind a released result: staff see it as decided and held, with no release
  -- date, not the earlier decision's release.
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
                                          'created_at', dc.created_at) order by dc.created_at)
      from assessment.decisions dc where dc.result_id = r.id
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

-- Appeal conclusion, from 20261015090000: refused while a later decision is held behind the appealed result.
create or replace function api.conclude_appeal(
  p_appeal_id uuid,
  p_outcome text,
  p_scores jsonb,
  p_reasons text,
  p_remediation text default null,
  p_resubmission_days integer default null,
  p_command_id uuid default null
)
returns table (status text, outcome_category text, decision_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ctx record;
  v_result assessment.results;
  v_appeal appeals.appeals;
  v_appealed assessment.decisions;
  v_task uuid;
  v_reasons text := btrim(coalesce(p_reasons, ''));
  v_remediation text := nullif(btrim(coalesce(p_remediation, '')), '');
  v_scores jsonb := coalesce(p_scores, '[]'::jsonb);
  v_row jsonb;
  v_max integer;
  v_exists boolean;
  v_category text;
  v_decision uuid;
  v_period interval;
  v_item text;
  v_cohort_name text;
  v_learner_name text;
  v_reviewer_name text;
  v_recipient uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::text, null::uuid; return; end if;
  select * into v_ctx from appeals.appeal_context(p_appeal_id);
  if not found then return query select 'not_found'::text, null::text, null::uuid; return; end if;

  -- Lock order: the result, then the appeal.
  select * into v_result from assessment.results r where r.id = v_ctx.result_id for update;
  select * into v_appeal from appeals.appeals a where a.id = p_appeal_id for update;
  if v_appeal.reviewer_id is distinct from v_actor then
    return query select 'not_found'::text, null::text, null::uuid; return;
  end if;
  if v_appeal.state = 'concluded' then
    if v_appeal.conclusion_command_id = p_command_id then
      return query select 'ok'::text, v_appeal.outcome_category, v_appeal.conclusion_decision_id; return;
    end if;
    return query select 'already_concluded'::text, v_appeal.outcome_category, v_appeal.conclusion_decision_id; return;
  end if;
  if v_appeal.state not in ('allocated', 'under_review') then
    return query select 'not_open'::text, null::text, null::uuid; return;
  end if;

  -- BR-02, now, under the lock (transaction test 9): whatever changed since the allocation.
  if exists (select 1 from appeals.assessment_actors(v_result.id) x where x.profile_id = v_actor) then
    insert into appeals.appeal_events (appeal_id, event, actor_id, details)
    values (v_appeal.id, 'conclusion_refused', v_actor, jsonb_build_object('reason', 'separation_of_duties_conflict'));
    return query select 'separation_of_duties_conflict'::text, null::text, null::uuid; return;
  end if;
  if v_result.current_decision_id <> v_appeal.decision_id then
    return query select 'result_changed'::text, null::text, null::uuid; return;
  end if;
  -- A later decision (a resubmission) is held behind this result for moderation (S4-04): concluding now would fork
  -- the decision chain. Once moderation signs it off, the result has changed and the appeal says so.
  if v_result.pending_decision_id is not null then
    return query select 'decision_pending_moderation'::text, null::text, null::uuid; return;
  end if;

  if p_outcome is null or p_outcome not in ('competent', 'not_yet_competent') then
    return query select 'invalid_outcome'::text, null::text, null::uuid; return;
  end if;
  if v_reasons = '' then return query select 'reasons_required'::text, null::text, null::uuid; return; end if;
  if char_length(v_reasons) > 5000 then return query select 'reasons_too_long'::text, null::text, null::uuid; return; end if;

  select ai.task_id into v_task from assessment.assessable_items ai where ai.id = v_result.assessable_item_id;
  if jsonb_typeof(v_scores) <> 'array' then
    return query select 'invalid_scores'::text, null::text, null::uuid; return;
  end if;
  for v_row in select * from jsonb_array_elements(v_scores) loop
    select true, tc.points into v_exists, v_max from submissions.task_criteria tc
    where tc.task_id = v_task and tc.ordinal = (v_row ->> 'ordinal')::integer;
    if not coalesce(v_exists, false) or char_length(coalesce(v_row ->> 'comment', '')) > 2000 then
      return query select 'invalid_scores'::text, null::text, null::uuid; return;
    end if;
    if (v_row ->> 'points') is not null and (
         v_max is null or (v_row ->> 'points')::integer < 0 or (v_row ->> 'points')::integer > v_max) then
      return query select 'invalid_points'::text, null::text, null::uuid; return;
    end if;
    v_exists := false;
  end loop;

  select * into v_appealed from assessment.decisions d where d.id = v_appeal.decision_id;
  v_category := appeals.outcome_category(
    v_appealed.outcome, appeals.decision_total(v_task, v_appealed.scores),
    p_outcome, appeals.decision_total(v_task, v_scores));

  -- P-09: "not yet competent" always carries what to do and until when. Upheld keeps the deadline the learner has.
  if p_outcome = 'not_yet_competent' then
    if v_remediation is null or char_length(v_remediation) > 5000 then
      return query select 'remediation_required'::text, null::text, null::uuid; return;
    end if;
    if v_category = 'upheld' and v_result.remediation_deadline_at is not null then
      v_period := v_result.remediation_deadline_at - now();
    elsif p_resubmission_days is null or p_resubmission_days not between 1 and 90 then
      return query select 'resubmission_days_required'::text, null::text, null::uuid; return;
    else
      v_period := make_interval(days => p_resubmission_days);
    end if;
  end if;

  insert into assessment.decisions (result_id, instance_id, type, outcome, actor_id, acting_role, justification,
                                    supersedes_decision_id, scores, feedback, remediation, resubmission_days)
  values (v_result.id, v_appealed.instance_id, 'appeal', p_outcome, v_actor, 'appeal_reviewer', v_reasons,
          v_result.current_decision_id, v_scores, v_reasons,
          case when p_outcome = 'not_yet_competent' then v_remediation end,
          case when p_outcome = 'not_yet_competent' and v_category <> 'upheld' then p_resubmission_days end)
  returning id into v_decision;

  -- Moving the pointer releases the appeal decision at once, with its own sequence number (ADR-021).
  update assessment.results r
  set current_decision_id = v_decision,
      remediation_period = case when p_outcome = 'not_yet_competent' then v_period end
  where r.id = v_result.id;

  update appeals.appeals a
  set state = 'concluded', outcome_category = v_category, concluded_at = now(), conclusion_decision_id = v_decision,
      conclusion_command_id = coalesce(p_command_id, gen_random_uuid())
  where a.id = v_appeal.id
  returning * into v_appeal;

  insert into appeals.appeal_events (appeal_id, event, actor_id, details)
  values (v_appeal.id, 'concluded', v_actor, jsonb_build_object('category', v_category, 'decision_id', v_decision));

  perform audit.append('appeals.appeal_concluded', 'appeal', v_appeal.id::text, '{}'::jsonb, 'appeal_reviewer',
    jsonb_build_object('decision_id', v_appealed.id, 'outcome', v_appealed.outcome),
    jsonb_build_object('decision_id', v_decision, 'outcome', p_outcome, 'category', v_category),
    'cohort', v_ctx.cohort_id);

  select ai.title, c.name into v_item, v_cohort_name from assessment.assessable_items ai
  join programmes.cohorts c on c.id = ai.cohort_id where ai.id = v_result.assessable_item_id;
  select p.full_name into v_learner_name from identity.profiles p where p.id = v_appeal.learner_id;
  select p.full_name into v_reviewer_name from identity.profiles p where p.id = v_actor;

  -- FR-611: the learner, every assessor of the result, and the cohort's coordinators.
  perform notifications.enqueue('appeal_decided', 'appeal_decided:' || v_appeal.id::text, v_appeal.learner_id,
    jsonb_build_object('appeal_id', v_appeal.id, 'reference', v_appeal.reference, 'item_title', v_item,
                       'category', v_category, 'outcome', p_outcome),
    '/learn/appeals/' || v_appeal.id::text);
  for v_recipient in
    select x.profile_id from appeals.assessment_actors(v_result.id) x
    union
    select cc.profile_id from appeals.cohort_coordinators(v_ctx.cohort_id) cc
  loop
    continue when v_recipient = v_actor or v_recipient = v_appeal.learner_id;
    perform notifications.enqueue('appeal_concluded', 'appeal_concluded:' || v_appeal.id::text, v_recipient,
      jsonb_build_object('appeal_id', v_appeal.id, 'reference', v_appeal.reference, 'item_title', v_item,
                         'cohort_name', v_cohort_name, 'learner_name', v_learner_name,
                         'reviewer_name', v_reviewer_name, 'category', v_category, 'outcome', p_outcome),
      case when programmes.can_coordinate(v_recipient, v_ctx.cohort_id)
           then '/coordinate/appeals/' || v_appeal.id::text
           else '/assess/instances/' || v_appealed.instance_id::text end);
  end loop;

  return query select 'ok'::text, v_category, v_decision;
end
$$;
