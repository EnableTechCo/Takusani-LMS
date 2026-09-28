-- Where an assessor's work stands, and when each decision was released (S4-11; FR-409; UX spec 7.3, 7.4).
--
-- Staff screens show "decided" and "released" as two facts with two dates (UX principle 1). The decision's date is
-- its own; the release date was not recorded per decision. results.released_at is the result's first release, and it
-- is written once: a later decision that the learner gets (a resubmission in a cohort that is not moderated, an appeal
-- decision, and from S4-09 a decision signed off by moderation) moves the result's pointer and has no release moment
-- of its own. So:
--   * assessment.decision_releases records the moment each decision reached the learner. A trigger on the result
--     writes it whenever a released result's current decision is set or changes, whoever changes it, so sign-off and
--     corrections are covered when they arrive. Append-only.
--   * Existing released results are backfilled: the decision current at first release, at that moment; every later
--     decision in the chain up to the current one, when it was made (those became current in the same transaction).
--   * api.list_my_release_status gives the assessor each of their decisions in the cohorts they assess, with where it
--     stands: held waiting for a cycle, held in moderation, released, or replaced by a later decision.
--   * The marking workspace's decision history carries each decision's release, so it can say "Decided 10 Sep 2026.
--     Released 22 Sep 2026." for the decision on screen, not the result's first release.
-- Not here: "sampled" and "returned to you". Samples and returns are the moderation cycle's (S4-05 to S4-08); until
-- those tables exist a held result is either waiting for a cycle or claimed by one (hold_cycle_id).

-- ---------------------------------------------------------------------------------------------------------------
-- When each decision was released
-- ---------------------------------------------------------------------------------------------------------------

create table assessment.decision_releases (
  decision_id uuid primary key,
  result_id uuid not null,
  released_at timestamptz not null default now(),
  constraint release_of_a_decision_of_the_result
    foreign key (result_id, decision_id) references assessment.decisions (result_id, id)
);

create index decision_releases_result_idx on assessment.decision_releases (result_id);

revoke all on table assessment.decision_releases from public, anon, authenticated, service_role;

create trigger decision_releases_append_only
  before update or delete on assessment.decision_releases
  for each row execute function audit.forbid_mutation();

create trigger decision_releases_append_only_truncate
  before truncate on assessment.decision_releases
  for each statement execute function audit.forbid_mutation();

-- After the release guard has written the release facts: the result is released and its current decision is new to
-- the learner, either because the result was just released or because the pointer moved on a released result.
create function assessment.record_decision_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state = 'released' and new.current_decision_id is not null
     and (old.state <> 'released' or new.current_decision_id is distinct from old.current_decision_id) then
    insert into assessment.decision_releases (decision_id, result_id, released_at)
    values (new.current_decision_id, new.id, case when old.state <> 'released' then new.released_at else now() end)
    on conflict (decision_id) do nothing;
  end if;
  return null;
end
$$;

revoke all on function assessment.record_decision_release() from public, anon, authenticated, service_role;

create trigger results_record_decision_release
  after update of state, current_decision_id on assessment.results
  for each row execute function assessment.record_decision_release();

-- The releases the history implies, for the backfill, and for a test that the trigger agrees with it. Walk each
-- released result's chain back from its current decision (a pending decision is not in it). A decision made at or
-- after the first release became current when it was made; of the ones made before, the latest was current at the
-- first release.
create function assessment.derived_decision_releases()
returns table (decision_id uuid, result_id uuid, released_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select r.id as result_id, r.current_decision_id as decision_id, r.released_at as first_release
    from assessment.results r
    where r.state = 'released' and r.current_decision_id is not null
    union all
    select c.result_id, d.supersedes_decision_id, c.first_release
    from chain c
    join assessment.decisions d on d.id = c.decision_id
    where d.supersedes_decision_id is not null
  ),
  placed as (
    select c.result_id, c.decision_id, c.first_release, d.created_at,
           row_number() over (partition by c.result_id, d.created_at >= c.first_release order by d.created_at desc) as rn
    from chain c
    join assessment.decisions d on d.id = c.decision_id
  )
  select p.decision_id, p.result_id, greatest(p.created_at, p.first_release)
  from placed p
  where p.created_at >= p.first_release or p.rn = 1
$$;

revoke all on function assessment.derived_decision_releases() from public, anon, authenticated, service_role;

insert into assessment.decision_releases (decision_id, result_id, released_at)
select x.decision_id, x.result_id, x.released_at from assessment.derived_decision_releases() x;

-- ---------------------------------------------------------------------------------------------------------------
-- The assessor's release status (A-03)
-- ---------------------------------------------------------------------------------------------------------------

-- Each decision this assessor made, in a cohort they still assess, newest first, with where it stands:
--   waiting_for_cycle  held (or held behind a released result, P-04), not yet claimed by a moderation cycle
--   in_moderation      held and claimed by a cycle
--   released           the learner has it: released_at is when
--   replaced           a later decision took its place; replaced_by and replaced_at say which kind and when, and
--                      released_at says whether the learner ever had this one
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
  replaced_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.instance_id, r.id, c.id, c.name, ms.moderation_policy, ai.id, ai.title, lp.full_name,
    lp.learner_number, d.outcome, d.created_at,
    case
      when d.id = r.pending_decision_id or (d.id = r.current_decision_id and r.state = 'held')
        then case when r.hold_cycle_id is null then 'waiting_for_cycle' else 'in_moderation' end
      when d.id = r.current_decision_id and dr.decision_id is not null then 'released'
      else 'replaced'
    end,
    dr.released_at, nd.type, nd.created_at
  from assessment.decisions d
  join assessment.results r on r.id = d.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join programmes.cohort_moderation_state ms on ms.cohort_id = c.id
  join identity.profiles lp on lp.id = r.learner_id
  left join assessment.decision_releases dr on dr.decision_id = d.id
  left join assessment.decisions nd on nd.supersedes_decision_id = d.id
  where d.actor_id = auth.uid()
    and d.type = 'assessment'
    and assessment.can_assess(auth.uid(), c.id)
  order by d.created_at desc, d.id
$$;

revoke all on function api.list_my_release_status() from public, anon, authenticated, service_role;
grant execute on function api.list_my_release_status() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The marking workspace
-- ---------------------------------------------------------------------------------------------------------------

-- The marking workspace read, from 20261027090000: each decision in the history carries when it was released.
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
                                          'created_at', dc.created_at, 'instance_id', dc.instance_id,
                                          'released_at', dcr.released_at) order by dc.created_at)
      from assessment.decisions dc
      left join assessment.decision_releases dcr on dcr.decision_id = dc.id
      where dc.result_id = r.id
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
