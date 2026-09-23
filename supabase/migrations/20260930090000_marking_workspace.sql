-- The marking workspace (S2-07, FR-401 to FR-405, screen P0-11): an assessor's queue, taking an item, reading the
-- evidence, and a marking draft that saves as they work. Finalising the decision, and whether it is held or
-- released, is S2-08; this migration stops at a complete draft.
--
-- What it carries:
--   * Scope (FR-401): an assessor marks in the cohorts their role covers. A request for an item outside that scope
--     returns nothing and is written to the audit log, so a probe is visible afterwards.
--   * Allocation: opening an item takes it. Someone else's item is readable to them in scope but not markable, so
--     two assessors cannot mark the same work at once.
--   * The draft is the assessor's working copy (FR-403): rubric scores, feedback, the outcome, its justification,
--     and for "not yet competent" the remediation and the resubmission period (FR-404, FR-405). It can be
--     incomplete; S2-08 refuses to finalise one that is. Each save carries the version it started from, so a second
--     tab cannot silently overwrite the first.
--   * Evidence: an assessor in scope may read the stored files of the work they may mark, through a storage policy.
--
-- Integrity log, judgement and the accommodation flag arrive with exams (S5-10).

-- ---------------------------------------------------------------------------------------------------------------
-- Scope
-- ---------------------------------------------------------------------------------------------------------------

-- Does this person hold a current assessor role covering the cohort (institution, its programme, or the cohort)?
create function assessment.can_assess(p_profile_id uuid, p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from programmes.cohorts c
    join identity.role_assignments ra on ra.profile_id = p_profile_id
    join identity.profiles p on p.id = ra.profile_id
    where c.id = p_cohort_id
      and ra.role = 'assessor'
      and ra.effective @> now()
      and p.status = 'active'
      and (
        ra.scope_type = 'global'
        or (ra.scope_type = 'programme' and ra.scope_key = c.programme_id)
        or (ra.scope_type = 'cohort' and ra.scope_key = c.id)
      )
  )
$$;

revoke all on function assessment.can_assess(uuid, uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Drafts
-- ---------------------------------------------------------------------------------------------------------------

create table assessment.marking_drafts (
  instance_id uuid primary key references assessment.assessment_instances (id),
  assessor_id uuid not null references identity.profiles (id),
  -- [{ordinal, points, comment}] against the task's rubric rows, in their order.
  scores jsonb not null default '[]'::jsonb check (jsonb_typeof(scores) = 'array'),
  feedback text check (char_length(feedback) <= 10000),
  outcome text check (outcome in ('competent', 'not_yet_competent')),
  justification text check (char_length(justification) <= 5000),
  remediation text check (char_length(remediation) <= 5000),
  -- Days after release in which the learner may resubmit (FR-405). The date is resolved at release (ADR-021).
  resubmission_days integer check (resubmission_days between 1 and 90),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

revoke all on table assessment.marking_drafts from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Evidence: the storage policy for assessors
-- ---------------------------------------------------------------------------------------------------------------

-- May this person read this stored object? Only if it is part of a submitted version whose result they may mark.
create function assessment.may_read_evidence(p_profile_id uuid, p_bucket text, p_object_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from submissions.stored_files sf
    join submissions.submission_files vf on vf.stored_file_id = sf.id
    join assessment.assessment_instances i on i.submission_version_id = vf.version_id
    join assessment.results r on r.id = i.result_id
    join assessment.assessable_items ai on ai.id = r.assessable_item_id
    where sf.bucket = p_bucket
      and sf.object_key = p_object_key
      and assessment.can_assess(p_profile_id, ai.cohort_id)
  )
$$;

revoke all on function assessment.may_read_evidence(uuid, text, text) from public, anon, authenticated, service_role;
-- The policy below runs as the signed-in role, which therefore needs EXECUTE (as with may_upload_object).
grant execute on function assessment.may_read_evidence(uuid, text, text) to authenticated;

-- Fix to S2-03: the policy letting learners read their own uploads queried submissions.file_upload_intents directly.
-- Storage evaluates every read policy on the bucket, and the signed-in role cannot read that table, so any read in
-- the bucket failed with "permission denied" as soon as something read a file. It goes through a security-definer
-- check instead, like the upload rule.
create function submissions.owns_upload(p_profile_id uuid, p_bucket text, p_object_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from submissions.file_upload_intents i
    where i.bucket = p_bucket and i.object_key = p_object_key and i.profile_id = p_profile_id
  )
$$;

revoke all on function submissions.owns_upload(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function submissions.owns_upload(uuid, text, text) to authenticated;

drop policy "read your own uploads" on storage.objects;
create policy "read your own uploads"
  on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and submissions.owns_upload(auth.uid(), bucket_id, name));

create policy "assessors read the evidence they may mark"
  on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and assessment.may_read_evidence(auth.uid(), bucket_id, name));

-- ---------------------------------------------------------------------------------------------------------------
-- Queue and item
-- ---------------------------------------------------------------------------------------------------------------

-- Work waiting to be marked in the cohorts this assessor covers, oldest first, with who has taken it.
create function api.list_marking_queue(p_cohort_id uuid default null)
returns table (
  instance_id uuid,
  instance_state text,
  learner_name text,
  learner_number text,
  task_title text,
  cohort_id uuid,
  cohort_name text,
  version_number integer,
  submitted_at timestamptz,
  is_late boolean,
  assessor_id uuid,
  assessor_name text,
  draft_saved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.state, lp.full_name, lp.learner_number, ai.title, ai.cohort_id, c.name,
         sv.version_number, sv.submitted_at, sv.is_late, i.assessor_id, ap.full_name, d.updated_at
  from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join identity.profiles lp on lp.id = r.learner_id
  join submissions.submission_versions sv on sv.id = i.submission_version_id
  left join identity.profiles ap on ap.id = i.assessor_id
  left join assessment.marking_drafts d on d.instance_id = i.id
  where i.state in ('to_mark', 'marking')
    and (p_cohort_id is null or ai.cohort_id = p_cohort_id)
    and assessment.can_assess(auth.uid(), ai.cohort_id)
  order by sv.submitted_at, lp.full_name
$$;

-- Everything the workspace shows for one item. Outside the assessor's scope it returns nothing and the refusal is
-- audited (FR-401), so this function writes and is therefore volatile.
create function api.get_marking_item(p_instance_id uuid)
returns table (
  instance_id uuid,
  instance_state text,
  instance_version integer,
  assessor_id uuid,
  assessor_name text,
  result_id uuid,
  result_state text,
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
  select i.id, i.state, i.version, i.assessor_id, ap.full_name, r.id, r.state, lp.full_name, lp.learner_number,
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
    -- Every version this learner submitted for the task, newest first, with its files: the one being assessed and
    -- the ones it replaced (FR-310).
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

-- ---------------------------------------------------------------------------------------------------------------
-- Taking an item and saving the draft
-- ---------------------------------------------------------------------------------------------------------------

-- Taking an item makes this assessor its marker. Taking your own again is harmless; taking someone else's is not.
create function api.take_marking(p_instance_id uuid)
returns table (status text, instance_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_instance assessment.assessment_instances;
  v_cohort uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select i.* into v_instance from assessment.assessment_instances i where i.id = p_instance_id for update;
  if not found then return query select 'not_found'::text, null::integer; return; end if;
  select ai.cohort_id into v_cohort
  from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where r.id = v_instance.result_id;
  if not assessment.can_assess(v_actor, v_cohort) then
    perform audit.append('assessment.access_refused', 'assessment_instance', p_instance_id::text,
      jsonb_build_object('reason', 'outside_scope'), null, null, null, 'cohort', v_cohort);
    return query select 'not_found'::text, null::integer; return;
  end if;
  if v_instance.state not in ('to_mark', 'marking') then
    return query select 'not_open_for_marking'::text, v_instance.version; return;
  end if;
  if v_instance.assessor_id is not null and v_instance.assessor_id <> v_actor then
    return query select 'allocated_to_someone_else'::text, v_instance.version; return;
  end if;
  if v_instance.assessor_id = v_actor then
    return query select 'ok'::text, v_instance.version; return;
  end if;

  update assessment.assessment_instances
  set assessor_id = v_actor, state = 'marking', version = version + 1, updated_at = now()
  where id = p_instance_id;

  perform audit.append('assessment.marking_taken', 'assessment_instance', p_instance_id::text,
    '{}'::jsonb, 'assessor', jsonb_build_object('state', v_instance.state),
    jsonb_build_object('state', 'marking', 'assessor_id', v_actor), 'cohort', v_cohort);
  return query select 'ok'::text, v_instance.version + 1;
end
$$;

-- Saves the working copy. It may be incomplete; what is there must make sense. p_expected_version is the draft
-- version the assessor started from (0 for none), so a second tab cannot silently overwrite the first.
create function api.save_marking_draft(
  p_instance_id uuid,
  p_expected_version integer,
  p_scores jsonb,
  -- A draft may leave any of these empty; leaving one out clears it.
  p_feedback text default null,
  p_outcome text default null,
  p_justification text default null,
  p_remediation text default null,
  p_resubmission_days integer default null
)
returns table (status text, draft_version integer, saved_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_instance assessment.assessment_instances;
  v_task uuid;
  v_draft assessment.marking_drafts;
  v_row jsonb;
  v_max integer;
  v_now timestamptz := now();
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::timestamptz; return; end if;
  select i.* into v_instance from assessment.assessment_instances i where i.id = p_instance_id for update;
  if not found then return query select 'not_found'::text, null::integer, null::timestamptz; return; end if;
  if v_instance.assessor_id is distinct from v_actor then
    return query select 'not_your_item'::text, null::integer, null::timestamptz; return;
  end if;
  if v_instance.state <> 'marking' then
    return query select 'not_open_for_marking'::text, null::integer, null::timestamptz; return;
  end if;

  select ai.task_id into v_task
  from assessment.results r join assessment.assessable_items ai on ai.id = r.assessable_item_id
  where r.id = v_instance.result_id;

  select d.* into v_draft from assessment.marking_drafts d where d.instance_id = p_instance_id for update;
  if coalesce(v_draft.version, 0) <> coalesce(p_expected_version, 0) then
    return query select 'stale_version'::text, v_draft.version, v_draft.updated_at; return;
  end if;

  if p_outcome is not null and p_outcome not in ('competent', 'not_yet_competent') then
    return query select 'invalid_outcome'::text, null::integer, null::timestamptz; return;
  end if;
  if p_resubmission_days is not null and p_resubmission_days not between 1 and 90 then
    return query select 'invalid_resubmission_days'::text, null::integer, null::timestamptz; return;
  end if;
  if jsonb_typeof(coalesce(p_scores, '[]'::jsonb)) <> 'array' then
    return query select 'invalid_scores'::text, null::integer, null::timestamptz; return;
  end if;
  -- Points cannot exceed what the rubric row is worth, and a row with no points takes none.
  for v_row in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) loop
    if v_row ->> 'points' is null or v_row ->> 'points' = '' then continue; end if;
    select tc.points into v_max from submissions.task_criteria tc
    where tc.task_id = v_task and tc.ordinal = (v_row ->> 'ordinal')::integer;
    if not found or v_max is null or (v_row ->> 'points') !~ '^\d+$' or (v_row ->> 'points')::integer > v_max then
      return query select 'invalid_points'::text, null::integer, null::timestamptz; return;
    end if;
  end loop;

  insert into assessment.marking_drafts as d (
    instance_id, assessor_id, scores, feedback, outcome, justification, remediation, resubmission_days, version,
    updated_at
  )
  values (
    p_instance_id, v_actor, coalesce(p_scores, '[]'::jsonb), nullif(btrim(p_feedback), ''), p_outcome,
    nullif(btrim(p_justification), ''), nullif(btrim(p_remediation), ''), p_resubmission_days, 1, v_now
  )
  on conflict (instance_id) do update
  set scores = excluded.scores, feedback = excluded.feedback, outcome = excluded.outcome,
      justification = excluded.justification, remediation = excluded.remediation,
      resubmission_days = excluded.resubmission_days, version = d.version + 1, updated_at = v_now;

  -- Drafts are working copies: they are not audited field by field, only finalised decisions are (S2-08).
  return query select 'ok'::text, coalesce(v_draft.version, 0) + 1, v_now;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.list_marking_queue(uuid) from public, anon, authenticated, service_role;
revoke all on function api.get_marking_item(uuid) from public, anon, authenticated, service_role;
revoke all on function api.take_marking(uuid) from public, anon, authenticated, service_role;
revoke all on function api.save_marking_draft(uuid, integer, jsonb, text, text, text, text, integer)
  from public, anon, authenticated, service_role;

grant execute on function api.list_marking_queue(uuid) to authenticated;
grant execute on function api.get_marking_item(uuid) to authenticated;
grant execute on function api.take_marking(uuid) to authenticated;
grant execute on function api.save_marking_draft(uuid, integer, jsonb, text, text, text, text, integer)
  to authenticated;
