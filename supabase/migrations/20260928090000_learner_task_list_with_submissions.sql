-- The learner's task list needs to show where each task stands (S2-05, screen L-02): not started, submitted on
-- time, submitted late. That comes from their own latest version, so api.list_my_tasks() gains three columns.
-- Adding output columns means replacing the function, which drops its grant, so it is given again below.
drop function api.list_my_tasks();

create function api.list_my_tasks()
returns table (
  id uuid,
  cohort_name text,
  title text,
  submission_type text,
  due_at timestamptz,
  late_policy text,
  published_at timestamptz,
  -- The learner's own latest version of this task, if they have handed anything in.
  latest_version integer,
  latest_submitted_at timestamptz,
  latest_is_late boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, c.name, t.title, t.submission_type, t.due_at, t.late_policy, t.published_at,
         v.version_number, v.submitted_at, v.is_late
  from submissions.tasks t
  join programmes.cohorts c on c.id = t.cohort_id
  left join lateral (
    select sv.version_number, sv.submitted_at, sv.is_late
    from submissions.submission_versions sv
    join submissions.submissions s on s.id = sv.submission_id
    where s.task_id = t.id and s.profile_id = auth.uid()
    order by sv.version_number desc
    limit 1
  ) v on true
  where t.state = 'published'
    and submissions.is_audience(auth.uid(), t.id)
  order by t.due_at, t.title
$$;

revoke all on function api.list_my_tasks() from public, anon, authenticated, service_role;
grant execute on function api.list_my_tasks() to authenticated;
