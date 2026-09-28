-- The learner's view of their marked work (S3-03; FR-606, FR-607; screen L-18). Once a coordinator has granted a
-- request to see the marked work (S3-02), the learner sees the version that was assessed, the mark and comment for
-- each criterion, and the assessor's feedback, all from the decision they appealed. Every opening is logged on the
-- appeal's record (FR-606), so the coordinator can see when and how often it was read.
--
-- The page also shows the time still left to ask for a re-mark (FR-607). Viewing does not extend it (P-08): the
-- window is the result's own, and a re-mark is lodged through the same command as always, which checks it again.

alter table appeals.appeal_events drop constraint appeal_events_event_check;
alter table appeals.appeal_events add constraint appeal_events_event_check check (
  event in ('lodged', 'admitted', 'inadmissible', 'allocated', 'reallocated', 'allocation_refused', 'script_viewed')
);

-- Refusals: unauthenticated, not_found (not the learner's appeal), not_a_view (a re-mark request), not_granted (still
-- being checked), refused (recorded as inadmissible). Volatile: an opening is recorded.
create function api.view_my_marked_work(p_appeal_id uuid)
returns table (
  status text,
  reference text,
  result_id uuid,
  item_title text,
  cohort_name text,
  outcome text,
  feedback text,
  assessor_name text,
  marks jsonb,
  assessed_version jsonb,
  files jsonb,
  -- The result's appeal deadline, the remark this result may still have, and whether its decision is final.
  appeal_deadline_at timestamptz,
  remark_standing text,
  remark_appeal_id uuid,
  remark_reference text,
  decision_final boolean,
  first_viewed_at timestamptz,
  views integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_appeal appeals.appeals;
begin
  if v_actor is null then
    return query select 'unauthenticated'::text, null::text, null::uuid, null::text, null::text, null::text, null::text,
      null::text, null::jsonb, null::jsonb, null::jsonb, null::timestamptz, null::text, null::uuid, null::text,
      null::boolean, null::timestamptz, null::integer;
    return;
  end if;
  select * into v_appeal from appeals.appeals a where a.id = p_appeal_id and a.learner_id = v_actor;
  if not found or v_appeal.type <> 'view_script' or v_appeal.admissibility is distinct from 'admitted' then
    return query select
      case when not found then 'not_found'
           when v_appeal.type <> 'view_script' then 'not_a_view'
           when v_appeal.admissibility = 'inadmissible' then 'refused'
           else 'not_granted' end::text,
      null::text, null::uuid, null::text, null::text, null::text, null::text, null::text, null::jsonb, null::jsonb,
      null::jsonb, null::timestamptz, null::text, null::uuid, null::text, null::boolean, null::timestamptz,
      null::integer;
    return;
  end if;

  insert into appeals.appeal_events (appeal_id, event, actor_id) values (v_appeal.id, 'script_viewed', v_actor);

  return query
  select 'ok'::text, v_appeal.reference, r.id, ai.title, c.name, d.outcome, nullif(btrim(d.feedback), ''),
    ap.full_name,
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
    r.appeal_deadline_at,
    coalesce(rs.standing, 'available'), rs.appeal_id, rs.reference,
    cd.type = 'appeal',
    (select min(e.at) from appeals.appeal_events e where e.appeal_id = v_appeal.id and e.event = 'script_viewed'),
    (select count(*)::integer from appeals.appeal_events e where e.appeal_id = v_appeal.id and e.event = 'script_viewed')
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join assessment.decisions d on d.id = v_appeal.decision_id
  join assessment.decisions cd on cd.id = r.current_decision_id
  left join identity.profiles ap on ap.id = d.actor_id
  left join lateral (select * from appeals.remark_standing(r.id)) rs on true
  where r.id = v_appeal.result_id;
end
$$;

revoke all on function api.view_my_marked_work(uuid) from public, anon, authenticated, service_role;
grant execute on function api.view_my_marked_work(uuid) to authenticated;
