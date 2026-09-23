-- The learner's released result (S2-09, screen L-15, FR-316, FR-317, NFR-11, SRS 5.3).
--
-- What a learner may read is decided here, not on the page:
--   * Held: nothing about the outcome. No outcome, no marks, no feedback, no dates that hint at one (BR-04). The
--     learner reads "Being assessed" and the facts of their own submission, which they already have.
--   * Released: the current decision's outcome, marks per criterion, feedback, the assessor's name, the release time,
--     the exclusive appeal deadline and, for "not yet competent", the remediation and the resubmission deadline.
--     The decided date is never returned: a learner only ever sees when a result was released (UX architecture,
--     P0-07).
--
-- "How you were told" (NFR-11): the release time is when the result appeared in the LMS. The first time the learner
-- opens each release is recorded here, once, so "First opened by you" is evidence rather than a guess. Email
-- delivery evidence arrives with the outbox (S2-10).
--
-- Not here: decision history with a released date per decision (the result keeps only its latest release; per-decision
-- release times come with appeals, S3), the online appeal (S3-01), and credit (credits module).

-- ---------------------------------------------------------------------------------------------------------------
-- First opened by the learner, once per release
-- ---------------------------------------------------------------------------------------------------------------

create table assessment.result_first_views (
  result_id uuid not null references assessment.results (id),
  -- Each release is told separately: a resubmission marked later is a new release, first opened on its own day.
  release_seq bigint not null,
  learner_id uuid not null references identity.profiles (id),
  first_viewed_at timestamptz not null default now(),
  primary key (result_id, release_seq)
);

revoke all on table assessment.result_first_views from public, anon, authenticated, service_role;

-- Written once and never changed: it is evidence of when the learner first saw the result.
create trigger result_first_views_append_only
  before update or delete on assessment.result_first_views
  for each row execute function audit.forbid_mutation();

-- ---------------------------------------------------------------------------------------------------------------
-- One result, as its learner may read it
-- ---------------------------------------------------------------------------------------------------------------

-- Volatile because opening a released result records the first view. Returns no row for anyone but the learner.
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
  latest_version jsonb
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
    rel.feedback, rel.assessor_name, rel.marks, rel.assessed_version, rel.first_viewed_at,
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
    )
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join submissions.tasks t on t.id = ai.task_id
  join programmes.cohorts c on c.id = ai.cohort_id
  join programmes.cohort_moderation_state ms on ms.cohort_id = c.id
  -- Everything below is joined only when the result is released, so a held result cannot leak it.
  left join lateral (
    select d.outcome, r.released_at, r.appeal_deadline_at,
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

-- ---------------------------------------------------------------------------------------------------------------
-- The learner's results (L-14), and where each task's result stands for the task pages
-- ---------------------------------------------------------------------------------------------------------------

-- Released results first, newest release first; then the ones still being assessed. A held row carries no outcome
-- and no dates.
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
  remediation_deadline_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, ai.task_id, ai.title, c.name, r.state,
    case when r.state = 'released' then d.outcome end,
    r.released_at, r.appeal_deadline_at,
    case when r.state = 'released' and d.outcome = 'not_yet_competent' then r.remediation_deadline_at end
  from assessment.results r
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join programmes.cohorts c on c.id = ai.cohort_id
  left join assessment.decisions d on d.id = r.current_decision_id
  where r.learner_id = auth.uid()
  order by r.state = 'held', r.released_at desc nulls last, ai.title
$$;

revoke all on function api.list_my_results() from public, anon, authenticated, service_role;
grant execute on function api.list_my_results() to authenticated;
