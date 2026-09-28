-- The appeal reviewer's workspace and conclusion (S3-04; FR-609 to FR-611; BR-02, BR-03; screens R-01, R-02).
--
-- The allocated reviewer opens the appeal (it moves to "under review") and sees the learner's grounds, the work as it
-- was assessed, the marks and feedback of the decision appealed, the chain of decisions, and any moderation findings
-- (FR-609; there are none until moderation is built, S4). They mark the work again, choose the outcome and give
-- reasons (FR-610). The appeal is then:
--   * upheld, when the outcome and the total are unchanged;
--   * amended upward, when the outcome goes from not yet competent to competent, or stays the same with a higher total;
--   * amended downward, the other way round.
-- The database works this out from the marks, so the label always matches what was recorded.
--
-- Concluding, in one transaction (API design, "POST /api/appeals/{id}/conclusion"):
--   * locks the result, then the appeal, and re-checks that the reviewer took no assessment decision on the result,
--     whatever changed since the allocation (BR-02; transaction test 9);
--   * appends an appeal decision superseding the current one; nothing is edited and the original stays (BR-03, FR-611);
--   * moves the result to it, which releases it at once with a new sequence number (ADR-021). An appeal decision is
--     final (FR-613): its appeal window closes as it is released, and it is never claimed by a moderation cycle;
--   * for "not yet competent", carries remediation and a resubmission period like any such decision (P-09 working
--     decision). When the appeal is upheld, the learner keeps the resubmission deadline they already had;
--   * tells the learner, every assessor of the result and the cohort's coordinators (FR-611).
-- Credit re-evaluation joins this transaction when the credits ledger is built (S6-01).
--
-- The reviewer is never named to the learner (UX Q7): the learner's result view leaves the name out for an appeal
-- decision. Reviewers read the work under review through a storage rule tied to their allocation, which is why an
-- assessor from another cohort (tier 3) can open this one appeal and nothing else.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

alter table appeals.appeals
  add column review_opened_at timestamptz,
  add column outcome_category text check (outcome_category in ('upheld', 'amended_up', 'amended_down')),
  add column concluded_at timestamptz,
  add column conclusion_decision_id uuid references assessment.decisions (id),
  add column conclusion_command_id uuid,
  add constraint conclusion_is_recorded check (
    (outcome_category is null) = (concluded_at is null)
    and (outcome_category is null) = (conclusion_decision_id is null)
    and (outcome_category is null) = (conclusion_command_id is null)
    and (outcome_category is null or (type = 'remark' and state = 'concluded'))
  );

alter table appeals.appeal_events drop constraint appeal_events_event_check;
alter table appeals.appeal_events add constraint appeal_events_event_check check (
  event in ('lodged', 'admitted', 'inadmissible', 'allocated', 'reallocated', 'allocation_refused', 'script_viewed',
            'review_opened', 'concluded', 'conclusion_refused')
);

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Release: an appeal decision is final, and is announced by the appeal itself
-- ---------------------------------------------------------------------------------------------------------------

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
      -- An appeal decision is final (FR-613): its window is closed the moment it is released.
      new.appeal_deadline_at := case
        when (select d.type from assessment.decisions d where d.id = new.current_decision_id) = 'appeal'
          then new.released_at
        else assessment.appeal_deadline(new.released_at)
      end;
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

create or replace function notifications.on_result_released()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- An appeal decision is announced by the appeal's own notification (appeal_decided), which says it is final.
  if (select d.type from assessment.decisions d where d.id = new.current_decision_id) = 'appeal' then
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

-- Lodging: an appeal decision is refused as final before the window is looked at.
create or replace function api.lodge_appeal(p_result_id uuid, p_type text, p_grounds text, p_client_appeal_id uuid)
returns table (status text, appeal_id uuid, reference text, lodged_at timestamptz, deadline_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result assessment.results;
  v_decision_type text;
  v_grounds text := btrim(coalesce(p_grounds, ''));
  v_existing appeals.appeals;
  v_appeal appeals.appeals;
  v_item text;
  v_cohort_id uuid;
  v_cohort_name text;
  v_learner_name text;
  v_coordinator uuid;
begin
  if v_actor is null then
    return query select 'unauthenticated'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  -- A replay (a retry after a lost response) returns the appeal already lodged, whatever the clock says now.
  select * into v_existing from appeals.appeals a where a.learner_id = v_actor and a.client_appeal_id = p_client_appeal_id;
  if found then
    return query select 'ok'::text, v_existing.id, v_existing.reference, v_existing.lodged_at, v_existing.deadline_at;
    return;
  end if;

  if p_type is null or p_type not in ('view_script', 'remark') then
    return query select 'invalid_type'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  -- Lock the result, then compare the clock with its deadline (API design, "POST /api/appeals").
  select * into v_result from assessment.results r where r.id = p_result_id and r.learner_id = v_actor for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  if v_result.state <> 'released' then
    return query select 'not_released'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  -- Finality first: an appeal decision's window closes as it is released, and "final" is the true reason.
  select d.type into v_decision_type from assessment.decisions d where d.id = v_result.current_decision_id;
  if v_decision_type = 'appeal' then
    return query select 'decision_final'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  if now() >= v_result.appeal_deadline_at then
    return query select 'window_closed'::text, null::uuid, null::text, null::timestamptz, v_result.appeal_deadline_at;
    return;
  end if;

  if v_grounds = '' then
    return query select 'grounds_required'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  if char_length(v_grounds) < 50 then
    return query select 'grounds_too_short'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;
  if char_length(v_grounds) > 2000 then
    return query select 'grounds_too_long'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  select * into v_existing from appeals.appeals a
  where a.result_id = v_result.id and a.type = p_type and a.state not in ('inadmissible', 'concluded');
  if found then
    return query select 'already_open'::text, v_existing.id, v_existing.reference, v_existing.lodged_at,
      v_existing.deadline_at;
    return;
  end if;
  if p_type = 'remark' then
    select * into v_existing from appeals.appeals a
    where a.result_id = v_result.id and a.type = 'remark' and a.admissibility = 'admitted';
    if found then
      return query select 'remark_used'::text, v_existing.id, v_existing.reference, v_existing.lodged_at,
        v_existing.deadline_at;
      return;
    end if;
  end if;

  if (select count(*) from appeals.appeals a where a.learner_id = v_actor and a.lodged_at > now() - interval '1 day') >= 10 then
    return query select 'rate_limited'::text, null::uuid, null::text, null::timestamptz, null::timestamptz; return;
  end if;

  insert into appeals.appeals (reference, result_id, learner_id, decision_id, type, grounds, deadline_at, client_appeal_id)
  values (
    format('APL-%s-%s', to_char(now() at time zone 'Africa/Johannesburg', 'YYYY'),
           lpad(nextval('appeals.reference_seq')::text, 4, '0')),
    v_result.id, v_actor, v_result.current_decision_id, p_type, v_grounds, v_result.appeal_deadline_at,
    p_client_appeal_id)
  returning * into v_appeal;

  insert into appeals.appeal_events (appeal_id, event, actor_id, details)
  values (v_appeal.id, 'lodged', v_actor, jsonb_build_object('type', p_type));

  select ai.title, ai.cohort_id, c.name into v_item, v_cohort_id, v_cohort_name
  from assessment.assessable_items ai join programmes.cohorts c on c.id = ai.cohort_id
  where ai.id = v_result.assessable_item_id;
  select p.full_name into v_learner_name from identity.profiles p where p.id = v_actor;

  perform audit.append('appeals.appeal_lodged', 'appeal', v_appeal.id::text, '{}'::jsonb, 'learner', null,
    jsonb_build_object('reference', v_appeal.reference, 'result_id', v_result.id, 'type', p_type,
                       'decision_id', v_appeal.decision_id, 'deadline_at', v_appeal.deadline_at),
    'cohort', v_cohort_id);

  -- The learner's receipt (FR-604), and every coordinator of the cohort.
  perform notifications.enqueue('appeal_received', 'appeal_received:' || v_appeal.id::text, v_actor,
    jsonb_build_object('appeal_id', v_appeal.id, 'reference', v_appeal.reference, 'item_title', v_item,
                       'type', p_type, 'lodged_at', v_appeal.lodged_at, 'deadline_at', v_appeal.deadline_at,
                       'turnaround_working_days', appeals.turnaround_working_days()),
    '/learn/appeals/' || v_appeal.id::text);
  for v_coordinator in
    select cc.profile_id from appeals.cohort_coordinators(v_cohort_id) cc where cc.profile_id <> v_actor
  loop
    perform notifications.enqueue('appeal_lodged', 'appeal_lodged:' || v_appeal.id::text, v_coordinator,
      jsonb_build_object('appeal_id', v_appeal.id, 'reference', v_appeal.reference, 'item_title', v_item,
                         'cohort_name', v_cohort_name, 'type', p_type, 'learner_name', v_learner_name,
                         'lodged_at', v_appeal.lodged_at),
      '/coordinate/appeals/' || v_appeal.id::text);
  end loop;

  return query select 'ok'::text, v_appeal.id, v_appeal.reference, v_appeal.lodged_at, v_appeal.deadline_at;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Evidence: the storage rule for appeal reviewers
-- ---------------------------------------------------------------------------------------------------------------

-- May this person read this stored object? Only if it belongs to the version assessed in the decision of an appeal
-- they are the reviewer of.
create function appeals.may_read_review_evidence(p_profile_id uuid, p_bucket text, p_object_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from appeals.appeals a
    join assessment.decisions d on d.id = a.decision_id
    join assessment.assessment_instances i on i.id = d.instance_id
    join submissions.submission_files vf on vf.version_id = i.submission_version_id
    join submissions.stored_files sf on sf.id = vf.stored_file_id
    where a.reviewer_id = p_profile_id
      and sf.bucket = p_bucket
      and sf.object_key = p_object_key
  )
$$;

revoke all on function appeals.may_read_review_evidence(uuid, text, text) from public, anon, authenticated, service_role;
-- The policy below runs as the signed-in role, which therefore needs EXECUTE (as with may_read_evidence).
grant execute on function appeals.may_read_review_evidence(uuid, text, text) to authenticated;

create policy "appeal reviewers read the work under review"
  on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and appeals.may_read_review_evidence(auth.uid(), bucket_id, name));

-- ---------------------------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------------------------

-- A decision's total where the rubric carries points, or null when no criterion does.
create function appeals.decision_total(p_task_id uuid, p_scores jsonb)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) = 0 then null else sum(coalesce((sc.score ->> 'points')::integer, 0))::integer end
  from submissions.task_criteria tc
  left join lateral (
    select e as score from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) e
    where (e ->> 'ordinal')::integer = tc.ordinal
    limit 1
  ) sc on true
  where tc.task_id = p_task_id and tc.points is not null
$$;

-- Upheld, amended upward or amended downward, from the outcome first and then the total.
create function appeals.outcome_category(
  p_old_outcome text, p_old_total integer, p_new_outcome text, p_new_total integer
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_old_outcome <> p_new_outcome then
      case when p_new_outcome = 'competent' then 'amended_up' else 'amended_down' end
    when p_old_total is distinct from p_new_total then
      case when coalesce(p_new_total, 0) > coalesce(p_old_total, 0) then 'amended_up' else 'amended_down' end
    else 'upheld'
  end
$$;

revoke all on function appeals.decision_total(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function appeals.outcome_category(text, integer, text, integer) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- The learner's result: an appeal decision is final, and its reviewer is not named
-- ---------------------------------------------------------------------------------------------------------------

drop function api.get_my_result(uuid);
create function api.get_my_result(p_result_id uuid)
returns table (
  result_id uuid,
  task_id uuid,
  item_title text,
  cohort_name text,
  moderated boolean,
  -- The task no longer takes new versions (closed at its due time), so the page does not offer a resubmission the
  -- submit command would refuse.
  task_closed boolean,
  state text,
  -- Released only; null while the result is held.
  outcome text,
  released_at timestamptz,
  appeal_deadline_at timestamptz,
  remediation text,
  remediation_deadline_at timestamptz,
  feedback text,
  assessor_name text,
  marks jsonb,
  assessed_version jsonb,
  first_viewed_at timestamptz,
  -- The learner's own latest version, held or released: a resubmission may be waiting behind a released result.
  latest_version jsonb,
  -- The current decision came from an appeal: it is final, and the reviewer is not named (UX Q7).
  decided_on_appeal boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result assessment.results;
begin
  if v_actor is null then return; end if;
  select * into v_result from assessment.results r where r.id = p_result_id and r.learner_id = v_actor;
  if not found then return; end if;

  if v_result.state = 'released' then
    insert into assessment.result_first_views (result_id, release_seq, learner_id)
    values (v_result.id, v_result.release_seq, v_actor)
    on conflict do nothing;
  end if;

  return query
  select r.id, t.id, ai.title, c.name, ms.moderation_policy = 'moderated',
    t.late_policy = 'closed_at_due' and t.due_at is not null and now() > t.due_at, r.state,
    rel.outcome, rel.released_at, rel.appeal_deadline_at, rel.remediation, rel.remediation_deadline_at,
    rel.feedback, case when rel.decision_type = 'appeal' then null else rel.assessor_name end, rel.marks,
    rel.assessed_version, rel.first_viewed_at,
    (
      select jsonb_build_object(
               'version_number', v.version_number, 'submitted_at', v.submitted_at, 'is_late', v.is_late,
               'receipt_reference', v.receipt_reference,
               'files', (select count(*) from submissions.submission_files vf where vf.version_id = v.id),
               'bytes', (select coalesce(sum(sf.bytes), 0) from submissions.submission_files vf
                         join submissions.stored_files sf on sf.id = vf.stored_file_id where vf.version_id = v.id))
      from submissions.submission_versions v
      join submissions.submissions s on s.id = v.submission_id
      where s.task_id = t.id and s.profile_id = r.learner_id
      order by v.version_number desc
      limit 1
    ),
    coalesce(rel.decision_type = 'appeal', false)
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join submissions.tasks t on t.id = ai.task_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join programmes.cohort_moderation_state ms on ms.cohort_id = c.id
  -- Everything below is joined only when the result is released, so a held result cannot leak it.
  left join lateral (
    select d.type as decision_type, d.outcome, r.released_at, r.appeal_deadline_at,
      case when d.outcome = 'not_yet_competent' then d.remediation end as remediation,
      case when d.outcome = 'not_yet_competent' then r.remediation_deadline_at end as remediation_deadline_at,
      nullif(btrim(d.feedback), '') as feedback, ap.full_name as assessor_name,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'ordinal', tc.ordinal, 'title', tc.title, 'max_points', tc.points,
                 'points', (sc.score ->> 'points')::integer,
                 'comment', nullif(btrim(sc.score ->> 'comment'), '')) order by tc.ordinal)
        from submissions.task_criteria tc
        left join lateral (
          select e as score from jsonb_array_elements(coalesce(d.scores, '[]'::jsonb)) e
          where (e ->> 'ordinal')::integer = tc.ordinal
          limit 1
        ) sc on true
        where tc.task_id = t.id
      ), '[]'::jsonb) as marks,
      (
        select jsonb_build_object('version_number', v.version_number, 'submitted_at', v.submitted_at,
                                  'is_late', v.is_late, 'receipt_reference', v.receipt_reference)
        from assessment.assessment_instances i
        join submissions.submission_versions v on v.id = i.submission_version_id
        where i.id = d.instance_id
      ) as assessed_version,
      fv.first_viewed_at
    from assessment.decisions d
    left join identity.profiles ap on ap.id = d.actor_id
    left join assessment.result_first_views fv on fv.result_id = r.id and fv.release_seq = r.release_seq
    where d.id = r.current_decision_id
      and r.state = 'released'
  ) rel on true
  where r.id = v_result.id;
end
$$;

revoke all on function api.get_my_result(uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_my_result(uuid) to authenticated;

drop function api.list_my_results();
create function api.list_my_results()
returns table (
  result_id uuid,
  task_id uuid,
  item_title text,
  cohort_name text,
  state text,
  outcome text,
  released_at timestamptz,
  appeal_deadline_at timestamptz,
  remediation_deadline_at timestamptz,
  decided_on_appeal boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, ai.task_id, ai.title, c.name, r.state,
    case when r.state = 'released' then d.outcome end,
    r.released_at, r.appeal_deadline_at,
    case when r.state = 'released' and d.outcome = 'not_yet_competent' then r.remediation_deadline_at end,
    r.state = 'released' and d.type = 'appeal'
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  left join assessment.decisions d on d.id = r.current_decision_id
  where r.learner_id = auth.uid()
  order by r.state = 'held', r.released_at desc nulls last, ai.title
$$;

revoke all on function api.list_my_results() from public, anon, authenticated, service_role;
grant execute on function api.list_my_results() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The coordinator's view gains the outcome
-- ---------------------------------------------------------------------------------------------------------------

drop function api.get_appeal_to_coordinate(uuid);
create function api.get_appeal_to_coordinate(p_appeal_id uuid)
returns table (
  id uuid,
  reference text,
  result_id uuid,
  learner_name text,
  learner_number text,
  item_title text,
  cohort_name text,
  type text,
  grounds text,
  state text,
  lodged_at timestamptz,
  deadline_at timestamptz,
  appealed_outcome text,
  points_scored integer,
  points_possible integer,
  assessor_name text,
  released_at timestamptz,
  turnaround_working_days integer,
  admissibility text,
  admissibility_reason text,
  admissibility_decided_at timestamptz,
  admissibility_decided_by_name text,
  reviewer_id uuid,
  reviewer_name text,
  reviewer_tier smallint,
  allocated_at timestamptz,
  outcome_category text,
  concluded_at timestamptz,
  review_opened_at timestamptz,
  -- Every decision on the result, oldest first, so the coordinator sees who assessed it (BR-02).
  decisions jsonb,
  events jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.reference, a.result_id, lp.full_name, lp.learner_number, ai.title, c.name, a.type, a.grounds,
    a.state, a.lodged_at, a.deadline_at, d.outcome, pts.scored, pts.possible, ap.full_name, r.released_at,
    appeals.turnaround_working_days(),
    a.admissibility, a.admissibility_reason, a.admissibility_decided_at, dp.full_name,
    a.reviewer_id, rp.full_name, a.reviewer_tier, a.allocated_at, a.outcome_category, a.concluded_at,
    a.review_opened_at,
    coalesce((select jsonb_agg(jsonb_build_object(
                'decision_id', x.id, 'type', x.type, 'outcome', x.outcome, 'decided_at', x.created_at,
                'actor_name', xp.full_name, 'version_number', v.version_number,
                'current', x.id = r.current_decision_id, 'appealed', x.id = a.decision_id,
                'justification', case when x.type = 'appeal' then x.justification end) order by x.created_at)
              from assessment.decisions x
              left join identity.profiles xp on xp.id = x.actor_id
              left join assessment.assessment_instances i on i.id = x.instance_id
              left join submissions.submission_versions v on v.id = i.submission_version_id
              where x.result_id = r.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
                'event', e.event, 'at', e.at, 'actor_name', ep.full_name, 'reason', e.details ->> 'reason',
                'reviewer_name', (select p.full_name from identity.profiles p where p.id = (e.details ->> 'reviewer_id')::uuid),
                'tier', e.details -> 'tier', 'skip_reason', e.details ->> 'skip_reason',
                'conflicts', e.details -> 'conflicts', 'category', e.details ->> 'category') order by e.id)
              from appeals.appeal_events e left join identity.profiles ep on ep.id = e.actor_id
              where e.appeal_id = a.id), '[]'::jsonb)
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join assessment.decisions d on d.id = a.decision_id
  join identity.profiles lp on lp.id = a.learner_id
  left join identity.profiles ap on ap.id = d.actor_id
  left join identity.profiles dp on dp.id = a.admissibility_decided_by
  left join identity.profiles rp on rp.id = a.reviewer_id
  left join lateral (
    select sum(coalesce((sc.score ->> 'points')::integer, 0))::integer as scored, sum(tc.points)::integer as possible
    from submissions.task_criteria tc
    left join lateral (
      select e as score from jsonb_array_elements(coalesce(d.scores, '[]'::jsonb)) e
      where (e ->> 'ordinal')::integer = tc.ordinal
      limit 1
    ) sc on true
    where tc.task_id = ai.task_id and tc.points is not null
    having count(*) > 0
  ) pts on true
  where a.id = p_appeal_id and programmes.can_coordinate(auth.uid(), c.id)
$$;

revoke all on function api.get_appeal_to_coordinate(uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_appeal_to_coordinate(uuid) to authenticated;


-- ---------------------------------------------------------------------------------------------------------------
-- Reads (the reviewer)
-- ---------------------------------------------------------------------------------------------------------------

-- R-01: the appeals this person reviews now or has reviewed; open ones first.
create function api.list_my_reviews()
returns table (
  id uuid,
  reference text,
  learner_name text,
  item_title text,
  cohort_name text,
  state text,
  lodged_at timestamptz,
  allocated_at timestamptz,
  outcome_category text,
  concluded_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.reference, lp.full_name, ai.title, c.name, a.state, a.lodged_at, a.allocated_at, a.outcome_category,
    a.concluded_at
  from appeals.appeals a
  join assessment.results r on r.id = a.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join identity.profiles lp on lp.id = a.learner_id
  where a.reviewer_id = auth.uid()
  order by a.state = 'concluded', a.allocated_at
$$;

-- R-02 (FR-609): everything the reviewer needs, for the allocated reviewer only. Opening an allocated appeal moves it
-- to "under review" and records the step, unless the reviewer has since become an assessor of the result (they are
-- then shown the conflict and nothing changes). Volatile for that reason.
create function api.open_appeal_review(p_appeal_id uuid)
returns table (
  status text,
  reference text,
  state text,
  learner_name text,
  learner_number text,
  item_title text,
  cohort_name text,
  grounds text,
  lodged_at timestamptz,
  allocated_at timestamptz,
  review_opened_at timestamptz,
  turnaround_working_days integer,
  appealed_outcome text,
  appealed_feedback text,
  appealed_remediation text,
  appealed_at timestamptz,
  assessor_name text,
  -- Each criterion with its maximum and the appealed decision's mark and comment.
  marks jsonb,
  assessed_version jsonb,
  files jsonb,
  decisions jsonb,
  moderation_findings jsonb,
  -- The reviewer took an assessment decision on the result after all (BR-02), or the result moved on since lodging.
  conflict boolean,
  result_changed boolean,
  remediation_deadline_at timestamptz,
  outcome_category text,
  concluded_at timestamptz,
  conclusion jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_appeal appeals.appeals;
  v_conflict boolean;
begin
  if v_actor is null then
    return query select 'unauthenticated'::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::text, null::timestamptz, null::timestamptz, null::timestamptz, null::integer, null::text, null::text,
      null::text, null::timestamptz, null::text, null::jsonb, null::jsonb, null::jsonb, null::jsonb, null::jsonb,
      null::boolean, null::boolean, null::timestamptz, null::text, null::timestamptz, null::jsonb;
    return;
  end if;
  select * into v_appeal from appeals.appeals a where a.id = p_appeal_id and a.reviewer_id = v_actor;
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::text, null::timestamptz, null::timestamptz, null::timestamptz, null::integer, null::text, null::text,
      null::text, null::timestamptz, null::text, null::jsonb, null::jsonb, null::jsonb, null::jsonb, null::jsonb,
      null::boolean, null::boolean, null::timestamptz, null::text, null::timestamptz, null::jsonb;
    return;
  end if;

  v_conflict := exists (select 1 from appeals.assessment_actors(v_appeal.result_id) x where x.profile_id = v_actor);
  if v_appeal.state = 'allocated' and not v_conflict then
    update appeals.appeals a set state = 'under_review', review_opened_at = now() where a.id = v_appeal.id
    returning * into v_appeal;
    insert into appeals.appeal_events (appeal_id, event, actor_id) values (v_appeal.id, 'review_opened', v_actor);
  end if;

  return query
  select 'ok'::text, v_appeal.reference, v_appeal.state, lp.full_name, lp.learner_number, ai.title, c.name,
    v_appeal.grounds, v_appeal.lodged_at, v_appeal.allocated_at, v_appeal.review_opened_at,
    appeals.turnaround_working_days(),
    d.outcome, nullif(btrim(d.feedback), ''), d.remediation, d.created_at, ap.full_name,
    coalesce((
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
    ), '[]'::jsonb),
    (select jsonb_build_object('version_number', v.version_number, 'submitted_at', v.submitted_at,
                               'is_late', v.is_late, 'receipt_reference', v.receipt_reference)
     from assessment.assessment_instances i
     join submissions.submission_versions v on v.id = i.submission_version_id
     where i.id = d.instance_id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'filename', sf.original_filename, 'bytes', sf.bytes, 'media_type', sf.media_type,
               'bucket', sf.bucket, 'object_key', sf.object_key, 'requirement', q.title)
             order by q.ordinal nulls last, sf.original_filename)
      from assessment.assessment_instances i
      join submissions.submission_files vf on vf.version_id = i.submission_version_id
      join submissions.stored_files sf on sf.id = vf.stored_file_id
      left join submissions.task_evidence_requirements q on q.id = vf.requirement_id
      where i.id = d.instance_id
    ), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
                'decision_id', x.id, 'type', x.type, 'outcome', x.outcome, 'decided_at', x.created_at,
                'actor_name', xp.full_name, 'version_number', v.version_number,
                'current', x.id = r.current_decision_id, 'appealed', x.id = v_appeal.decision_id) order by x.created_at)
              from assessment.decisions x
              left join identity.profiles xp on xp.id = x.actor_id
              left join assessment.assessment_instances i on i.id = x.instance_id
              left join submissions.submission_versions v on v.id = i.submission_version_id
              where x.result_id = r.id), '[]'::jsonb),
    -- Moderation findings arrive with moderation (S4); until then there are none to show.
    coalesce((select jsonb_agg(jsonb_build_object('decided_at', x.created_at, 'outcome', x.outcome,
                                                  'justification', x.justification) order by x.created_at)
              from assessment.decisions x where x.result_id = r.id and x.type = 'moderation'), '[]'::jsonb),
    v_conflict,
    r.current_decision_id <> v_appeal.decision_id and v_appeal.state <> 'concluded',
    case when cd.outcome = 'not_yet_competent' then r.remediation_deadline_at end,
    v_appeal.outcome_category, v_appeal.concluded_at,
    (select jsonb_build_object('outcome', n.outcome, 'reasons', n.justification, 'remediation', n.remediation,
                               'total', appeals.decision_total(ai.task_id, n.scores))
     from assessment.decisions n where n.id = v_appeal.conclusion_decision_id)
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join assessment.decisions d on d.id = v_appeal.decision_id
  join assessment.decisions cd on cd.id = r.current_decision_id
  join identity.profiles lp on lp.id = v_appeal.learner_id
  left join identity.profiles ap on ap.id = d.actor_id
  where r.id = v_appeal.result_id;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Command: conclude (FR-610, FR-611)
-- ---------------------------------------------------------------------------------------------------------------

-- p_scores is the marking as the reviewer leaves it: [{ordinal, points, comment}]. Refusals: unauthenticated,
-- not_found (not the reviewer), already_concluded, not_open, separation_of_duties_conflict, result_changed,
-- invalid_outcome, reasons_required, reasons_too_long, invalid_scores, invalid_points, remediation_required,
-- resubmission_days_required. A replay with the same p_command_id returns the conclusion already recorded.
create function api.conclude_appeal(
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

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.list_my_reviews() from public, anon, authenticated, service_role;
revoke all on function api.open_appeal_review(uuid) from public, anon, authenticated, service_role;
revoke all on function api.conclude_appeal(uuid, text, jsonb, text, text, integer, uuid) from public, anon, authenticated, service_role;

grant execute on function api.list_my_reviews() to authenticated;
grant execute on function api.open_appeal_review(uuid) to authenticated;
grant execute on function api.conclude_appeal(uuid, text, jsonb, text, text, integer, uuid) to authenticated;
