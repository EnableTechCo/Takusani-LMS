-- Finalising a decision: hold or release (S2-08, FR-408, BR-04, BR-05, ADR-019, ADR-021).
-- Working decisions P-01, P-04 and P-11 applied on the owner's go-ahead (design register, section 1).
--
-- BR-04 cannot be bypassed: whether a finalised decision reaches the learner is decided here, from the cohort's
-- moderation policy, read under a shared lock on its one state row (ADR-019), so a policy change or a cycle freeze
-- cannot slip between reading the policy and acting on it.
--   * Not moderated: the result is released at once. The release trigger (S2-06) writes the time, the next release
--     sequence number, the exclusive appeal deadline and, for "not yet competent", the resubmission deadline.
--   * Moderated: the result stays held with no cycle, in the pending pool the next cycle claims at freeze. Nothing
--     reaches the learner: no release, no appeal window, no deadline (test plan 13).
--
-- A decision is immutable and carries what the learner will read: the marks per criterion, the feedback, the
-- remediation and the resubmission period, copied from the draft at the moment of finalising.
--
-- One finalisation per assessment instance is structural (a unique index), so two finalisations racing produce one
-- decision (test plan 4); the loser is told the item is already decided. Everything happens in one transaction, so a
-- failure midway leaves nothing behind (test plan 12).
--
-- Not here: credit and unit re-evaluation (credits module), the learner's notification (S2-10), and the hold path
-- for a result that was already released in a moderated cohort (S4-04), which is refused with a typed status.

-- ---------------------------------------------------------------------------------------------------------------
-- What a decision records
-- ---------------------------------------------------------------------------------------------------------------

alter table assessment.decisions
  add column scores jsonb check (scores is null or jsonb_typeof(scores) = 'array'),
  add column feedback text check (char_length(feedback) <= 10000),
  add column remediation text check (char_length(remediation) <= 5000),
  add column resubmission_days integer check (resubmission_days between 1 and 90),
  add constraint nyc_has_remediation check (
    type <> 'assessment' or outcome <> 'not_yet_competent'
    or (remediation is not null and resubmission_days is not null)
  );

-- One assessment decision per instance: a second finalisation cannot add another (test plan 4).
create unique index decisions_one_per_assessment_instance on assessment.decisions (instance_id)
  where type = 'assessment';

-- ---------------------------------------------------------------------------------------------------------------
-- Release guard: a later decision on a released result takes a new release (ADR-021)
-- ---------------------------------------------------------------------------------------------------------------

-- Replaces the S2-06 guard. The rules are unchanged except one: when a released result's current decision moves to
-- a later decision (a resubmission marked Competent, later an appeal), that decision is released in its own right,
-- with its own time, sequence number and appeal window. The facts are still written only by this trigger.
create or replace function assessment.guard_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.state = 'released' then
    if new.state <> 'released' then
      raise exception 'A released result cannot be held again: record a new decision instead.'
        using errcode = '23514';
    end if;
    if new.current_decision_id is distinct from old.current_decision_id then
      new.released_at := now();
      new.release_seq := nextval('assessment.release_seq');
      new.appeal_deadline_at := assessment.appeal_deadline(new.released_at);
      new.remediation_deadline_at := case when new.remediation_period is null then null
                                          else new.released_at + new.remediation_period end;
    elsif new.released_at is distinct from old.released_at
      or new.release_seq is distinct from old.release_seq
      or new.appeal_deadline_at is distinct from old.appeal_deadline_at then
      raise exception 'Release facts are written once: released_at, release_seq and the appeal deadline cannot be edited.'
        using errcode = '23514';
    end if;
  elsif old.state = 'held' and new.state = 'released' then
    new.released_at := now();
    new.release_seq := nextval('assessment.release_seq');
    new.appeal_deadline_at := assessment.appeal_deadline(new.released_at);
    new.remediation_deadline_at := case when new.remediation_period is null then null
                                        else new.released_at + new.remediation_period end;
  elsif old.state = 'held' and new.state = 'held' then
    if new.released_at is not null or new.release_seq is not null or new.appeal_deadline_at is not null then
      raise exception 'A held result has no release facts yet.' using errcode = '23514';
    end if;
  end if;

  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Finalise
-- ---------------------------------------------------------------------------------------------------------------

create function api.finalise_decision(p_instance_id uuid, p_expected_draft_version integer)
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

  -- The hold path for a result already released in a moderated cohort is S4-04; until then it is refused, not
  -- guessed at.
  if v_policy = 'moderated' and v_result.state = 'released' then
    return query select 'moderated_resubmission_not_yet_supported'::text, null::uuid, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz, null::text;
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

revoke all on function api.finalise_decision(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function api.finalise_decision(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The workspace shows where the result stands after finalising
-- ---------------------------------------------------------------------------------------------------------------

-- api.get_marking_item gains the release facts, so a decided item reads as a record ("Decided and released ...
-- appeal window closes at the end of ..."). New output columns mean replacing it; its grant is given again.
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
  select i.id, i.state, i.version, i.assessor_id, ap.full_name, r.id, r.state, r.released_at, r.appeal_deadline_at,
    r.remediation_deadline_at, lp.full_name, lp.learner_number,
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
  where i.id = p_instance_id;
end
$$;

revoke all on function api.get_marking_item(uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_marking_item(uuid) to authenticated;
