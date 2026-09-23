-- Learner home (S2-12, screen L-01, P0-03): the learner's own enrolments, for the header ("Certificate in Business
-- Administration, NQF Level 4 · 2026 Intake B") and the first-day welcome. Everything else on the page comes from the
-- task and result reads the learner already has (api.list_my_tasks, api.list_my_results).
create function api.list_my_enrolments()
returns table (
  cohort_id uuid,
  cohort_name text,
  programme_title text,
  nqf_level smallint,
  starts_on date,
  ends_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, p.title, p.nqf_level, c.starts_on, c.ends_on
  from programmes.enrolments e
  join programmes.cohorts c on c.id = e.cohort_id
  join programmes.programmes p on p.id = c.programme_id
  where e.profile_id = auth.uid()
    and e.status = 'active'
    and c.status = 'active'
  order by c.starts_on desc, c.name
$$;

revoke all on function api.list_my_enrolments() from public, anon, authenticated, service_role;
grant execute on function api.list_my_enrolments() to authenticated;
