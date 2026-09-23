-- Tasks (S2-02, FR-201 to FR-203): a facilitator writes a task as a draft, sets its criteria and audience, and
-- publishes it. LMS-data-model.md "Programme and learning delivery"; UX architecture screens F-02 and F-03.
--
-- Rules carried here:
--   * A draft is invisible to learners (FR-202). Learners read published tasks through api.list_my_tasks() only.
--   * A task is written while it is a draft. Publishing fixes the brief, criteria, due date and audience, because
--     learners plan their work around them; a change after that is a new task.
--   * The audience is the whole cohort or named enrolled learners (FR-201). Only active enrolments count.
--
-- Not here yet: publishing must also notify the audience and put the due date on their calendars (FR-203). The
-- outbox and queue arrive with S2-10 and the calendar with L-07; publish_task returns the number of learners it
-- will notify, and the notification ticket writes the outbox row inside this same command. Submissions against a
-- task, their evidence requirements and versions are S2-03 and S2-04.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create table submissions.tasks (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references programmes.cohorts (id),
  module_id uuid references programmes.modules (id),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  brief text not null check (char_length(btrim(brief)) between 1 and 20000),
  submission_type text not null check (submission_type in ('file_upload', 'text')),
  -- Required to publish, not to draft: a facilitator writes the brief before fixing the date.
  due_at timestamptz,
  -- FR-309: what happens to work handed in after the due date. The decision is the task's, not the submission's.
  late_policy text not null default 'accept_and_flag' check (late_policy in ('accept_and_flag', 'closed_at_due')),
  audience text not null default 'cohort' check (audience in ('cohort', 'named')),
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid references identity.profiles (id),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references identity.profiles (id),
  constraint published_has_due_date check (state <> 'published' or due_at is not null),
  constraint published_has_time check (state = 'draft' or published_at is not null),
  unique (cohort_id, title)
);

-- The marking rubric's rows (FR-201). Points are optional: some tasks are judged criterion by criterion without a
-- score. The marking workspace (S2-07) reads these rows; it never edits them.
create table submissions.task_criteria (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references submissions.tasks (id) on delete cascade,
  ordinal integer not null check (ordinal between 1 and 50),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  descriptor text check (char_length(btrim(descriptor)) <= 2000),
  points integer check (points between 0 and 1000),
  unique (task_id, ordinal)
);

-- Named learners, when the audience is not the whole cohort. Rows are kept in step with the task's enrolments by
-- api.set_task_audience; an unenrolled learner is refused there rather than stored and ignored.
create table submissions.task_targets (
  task_id uuid not null references submissions.tasks (id) on delete cascade,
  profile_id uuid not null references identity.profiles (id),
  added_at timestamptz not null default now(),
  primary key (task_id, profile_id)
);

create index tasks_cohort_idx on submissions.tasks (cohort_id, state);
create index task_targets_profile_idx on submissions.task_targets (profile_id);

revoke all on table submissions.tasks, submissions.task_criteria, submissions.task_targets
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Authorization predicates (written once, ADR-024 point 4)
-- ---------------------------------------------------------------------------------------------------------------

-- Who may set work in a cohort: a facilitator whose role covers it (globally, for its programme, or for the cohort
-- itself), or a coordinator of that cohort, who also runs delivery.
create function submissions.can_set_work(p_profile_id uuid, p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from programmes.cohorts c
    where c.id = p_cohort_id
      and (
        programmes.can_coordinate(p_profile_id, c.id)
        or exists (
          select 1
          from identity.role_assignments ra
          join identity.profiles p on p.id = ra.profile_id
          where ra.profile_id = p_profile_id
            and ra.role = 'facilitator'
            and ra.effective @> now()
            and p.status = 'active'
            and (
              ra.scope_type = 'global'
              or (ra.scope_type = 'programme' and ra.scope_key = c.programme_id)
              or (ra.scope_type = 'cohort' and ra.scope_key = c.id)
            )
        )
      )
  )
$$;

-- Is this published task part of the learner's work? The whole cohort, or named and on the list.
create function submissions.is_audience(p_profile_id uuid, p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from submissions.tasks t
    join programmes.enrolments e on e.cohort_id = t.cohort_id and e.profile_id = p_profile_id
    where t.id = p_task_id
      and t.state = 'published'
      and e.status = 'active'
      and (
        t.audience = 'cohort'
        or exists (select 1 from submissions.task_targets tt where tt.task_id = t.id and tt.profile_id = p_profile_id)
      )
  )
$$;

revoke all on function submissions.can_set_work(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function submissions.is_audience(uuid, uuid) from public, anon, authenticated, service_role;

-- How many learners a task is for, which publish states and the notification ticket (S2-10) will send to.
create function submissions.audience_size(p_task_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from programmes.enrolments e
  join submissions.tasks t on t.cohort_id = e.cohort_id
  where t.id = p_task_id
    and e.status = 'active'
    and (
      t.audience = 'cohort'
      or exists (select 1 from submissions.task_targets tt where tt.task_id = t.id and tt.profile_id = e.profile_id)
    )
$$;

revoke all on function submissions.audience_size(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands (exposed through api; the actor is auth.uid(); typed refusals; audit in the same transaction)
-- ---------------------------------------------------------------------------------------------------------------

create function api.create_task(
  p_cohort_id uuid,
  p_title text,
  p_brief text,
  p_submission_type text default 'file_upload',
  p_due_at timestamptz default null,
  p_late_policy text default 'accept_and_flag',
  p_module_id uuid default null
)
returns table (status text, task_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_brief text := btrim(coalesce(p_brief, ''));
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not exists (select 1 from programmes.cohorts where id = p_cohort_id) then
    return query select 'cohort_not_found'::text, null::uuid; return;
  end if;
  if not submissions.can_set_work(v_actor, p_cohort_id) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  -- The alias matters: `status` is also this function's OUT column.
  if exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status = 'archived') then
    return query select 'cohort_archived'::text, null::uuid; return;
  end if;
  if char_length(v_title) not between 1 and 200 then return query select 'invalid_title'::text, null::uuid; return; end if;
  if char_length(v_brief) not between 1 and 20000 then return query select 'invalid_brief'::text, null::uuid; return; end if;
  if p_submission_type not in ('file_upload', 'text') then
    return query select 'invalid_submission_type'::text, null::uuid; return;
  end if;
  if p_late_policy not in ('accept_and_flag', 'closed_at_due') then
    return query select 'invalid_late_policy'::text, null::uuid; return;
  end if;
  if p_module_id is not null and not exists (
    select 1 from programmes.modules m join programmes.cohorts c on c.programme_id = m.programme_id
    where m.id = p_module_id and c.id = p_cohort_id
  ) then
    return query select 'module_not_in_programme'::text, null::uuid; return;
  end if;
  if exists (select 1 from submissions.tasks where cohort_id = p_cohort_id and title = v_title) then
    return query select 'title_taken'::text, null::uuid; return;
  end if;

  insert into submissions.tasks (cohort_id, module_id, title, brief, submission_type, due_at, late_policy, created_by)
  values (p_cohort_id, p_module_id, v_title, v_brief, p_submission_type, p_due_at, p_late_policy, v_actor)
  returning id into v_id;

  perform audit.append('submissions.task_created', 'task', v_id::text,
    jsonb_build_object('cohort_id', p_cohort_id), 'facilitator', null,
    jsonb_build_object('title', v_title, 'submission_type', p_submission_type, 'due_at', p_due_at,
      'late_policy', p_late_policy, 'state', 'draft'),
    'cohort', p_cohort_id);
  return query select 'ok'::text, v_id;
end
$$;

-- Edits the draft. A published task is fixed: learners have planned around it (FR-202).
create function api.update_task(
  p_task_id uuid,
  p_title text,
  p_brief text,
  p_submission_type text default 'file_upload',
  -- Defaulted so that leaving the date out clears it: a draft may go back to having no date.
  p_due_at timestamptz default null,
  p_late_policy text default 'accept_and_flag',
  p_module_id uuid default null
)
returns table (status text, task_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_title text := btrim(coalesce(p_title, ''));
  v_brief text := btrim(coalesce(p_brief, ''));
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  select * into v_task from submissions.tasks where id = p_task_id for update;
  if not found then return query select 'task_not_found'::text, null::uuid; return; end if;
  if not submissions.can_set_work(v_actor, v_task.cohort_id) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  if v_task.state <> 'draft' then return query select 'not_a_draft'::text, p_task_id; return; end if;
  if char_length(v_title) not between 1 and 200 then return query select 'invalid_title'::text, p_task_id; return; end if;
  if char_length(v_brief) not between 1 and 20000 then return query select 'invalid_brief'::text, p_task_id; return; end if;
  if p_submission_type not in ('file_upload', 'text') then
    return query select 'invalid_submission_type'::text, p_task_id; return;
  end if;
  if p_late_policy not in ('accept_and_flag', 'closed_at_due') then
    return query select 'invalid_late_policy'::text, p_task_id; return;
  end if;
  if p_module_id is not null and not exists (
    select 1 from programmes.modules m join programmes.cohorts c on c.programme_id = m.programme_id
    where m.id = p_module_id and c.id = v_task.cohort_id
  ) then
    return query select 'module_not_in_programme'::text, p_task_id; return;
  end if;
  if exists (select 1 from submissions.tasks where cohort_id = v_task.cohort_id and title = v_title and id <> p_task_id) then
    return query select 'title_taken'::text, p_task_id; return;
  end if;

  update submissions.tasks
  set title = v_title, brief = v_brief, submission_type = p_submission_type, due_at = p_due_at,
      late_policy = p_late_policy, module_id = p_module_id, updated_at = now()
  where id = p_task_id;

  perform audit.append('submissions.task_updated', 'task', p_task_id::text,
    jsonb_build_object('cohort_id', v_task.cohort_id), 'facilitator',
    jsonb_build_object('title', v_task.title, 'submission_type', v_task.submission_type, 'due_at', v_task.due_at,
      'late_policy', v_task.late_policy),
    jsonb_build_object('title', v_title, 'submission_type', p_submission_type, 'due_at', p_due_at,
      'late_policy', p_late_policy),
    'cohort', v_task.cohort_id);
  return query select 'ok'::text, p_task_id;
end
$$;

-- Replaces the rubric rows of a draft. p_criteria is a JSON array of {title, descriptor, points}; order is the
-- order marking will show them in.
create function api.set_task_criteria(p_task_id uuid, p_criteria jsonb)
returns table (status text, criteria_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_row jsonb;
  v_ordinal integer := 0;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_task from submissions.tasks where id = p_task_id for update;
  if not found then return query select 'task_not_found'::text, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_task.cohort_id) then
    return query select 'forbidden'::text, null::integer; return;
  end if;
  if v_task.state <> 'draft' then return query select 'not_a_draft'::text, null::integer; return; end if;
  if jsonb_typeof(coalesce(p_criteria, 'null'::jsonb)) <> 'array' then
    return query select 'invalid_criteria'::text, null::integer; return;
  end if;
  if jsonb_array_length(p_criteria) > 50 then return query select 'too_many_criteria'::text, null::integer; return; end if;

  for v_row in select * from jsonb_array_elements(p_criteria) loop
    if char_length(btrim(coalesce(v_row ->> 'title', ''))) not between 1 and 200 then
      return query select 'invalid_criterion_title'::text, null::integer; return;
    end if;
    if v_row ? 'points' and v_row ->> 'points' is not null
       and ((v_row ->> 'points') !~ '^\d+$' or (v_row ->> 'points')::integer > 1000) then
      return query select 'invalid_points'::text, null::integer; return;
    end if;
  end loop;

  delete from submissions.task_criteria where task_id = p_task_id;
  for v_row in select * from jsonb_array_elements(p_criteria) loop
    v_ordinal := v_ordinal + 1;
    insert into submissions.task_criteria (task_id, ordinal, title, descriptor, points)
    values (p_task_id, v_ordinal, btrim(v_row ->> 'title'), nullif(btrim(coalesce(v_row ->> 'descriptor', '')), ''),
      nullif(v_row ->> 'points', '')::integer);
  end loop;

  update submissions.tasks set updated_at = now() where id = p_task_id;
  perform audit.append('submissions.task_criteria_set', 'task', p_task_id::text,
    jsonb_build_object('cohort_id', v_task.cohort_id), 'facilitator', null,
    jsonb_build_object('criteria_count', v_ordinal), 'cohort', v_task.cohort_id);
  return query select 'ok'::text, v_ordinal;
end
$$;

-- Sets who the draft is for: the whole cohort, or the named learners given by email. Every named learner must hold
-- an active enrolment in the task's cohort.
create function api.set_task_audience(p_task_id uuid, p_audience text, p_emails text[] default null)
returns table (status text, audience_size integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_email text;
  v_profile uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_task from submissions.tasks where id = p_task_id for update;
  if not found then return query select 'task_not_found'::text, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_task.cohort_id) then
    return query select 'forbidden'::text, null::integer; return;
  end if;
  if v_task.state <> 'draft' then return query select 'not_a_draft'::text, null::integer; return; end if;
  if p_audience not in ('cohort', 'named') then return query select 'invalid_audience'::text, null::integer; return; end if;

  delete from submissions.task_targets where task_id = p_task_id;

  if p_audience = 'named' then
    if coalesce(array_length(p_emails, 1), 0) = 0 then
      return query select 'no_learners_named'::text, null::integer; return;
    end if;
    foreach v_email in array p_emails loop
      select p.id into v_profile
      from identity.profiles p
      join auth.users u on u.id = p.id
      join programmes.enrolments e on e.profile_id = p.id and e.cohort_id = v_task.cohort_id and e.status = 'active'
      where lower(u.email) = lower(btrim(v_email));
      if v_profile is null then return query select 'learner_not_enrolled'::text, null::integer; return; end if;
      insert into submissions.task_targets (task_id, profile_id) values (p_task_id, v_profile)
      on conflict do nothing;
    end loop;
  end if;

  update submissions.tasks set audience = p_audience, updated_at = now() where id = p_task_id;
  perform audit.append('submissions.task_audience_set', 'task', p_task_id::text,
    jsonb_build_object('cohort_id', v_task.cohort_id), 'facilitator',
    jsonb_build_object('audience', v_task.audience),
    jsonb_build_object('audience', p_audience, 'learners', submissions.audience_size(p_task_id)),
    'cohort', v_task.cohort_id);
  return query select 'ok'::text, submissions.audience_size(p_task_id);
end
$$;

-- Publishes the draft (FR-202): from here learners see it. Returns how many learners it is for, which is what the
-- confirmation on screen states, and what S2-10 will notify.
create function api.publish_task(p_task_id uuid)
returns table (status text, notified integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_audience integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_task from submissions.tasks where id = p_task_id for update;
  if not found then return query select 'task_not_found'::text, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_task.cohort_id) then
    return query select 'forbidden'::text, null::integer; return;
  end if;
  if v_task.state = 'published' then return query select 'already_published'::text, null::integer; return; end if;
  if v_task.state <> 'draft' then return query select 'not_a_draft'::text, null::integer; return; end if;
  if v_task.due_at is null then return query select 'due_date_required'::text, null::integer; return; end if;
  if v_task.due_at <= now() then return query select 'due_date_passed'::text, null::integer; return; end if;
  if exists (select 1 from programmes.cohorts c where c.id = v_task.cohort_id and c.status = 'archived') then
    return query select 'cohort_archived'::text, null::integer; return;
  end if;

  v_audience := submissions.audience_size(p_task_id);
  if v_audience = 0 then return query select 'no_learners'::text, 0; return; end if;

  update submissions.tasks
  set state = 'published', published_at = now(), published_by = v_actor, updated_at = now()
  where id = p_task_id;

  -- S2-10 writes the outbox row for the audience here, in this transaction (ADR-025).
  perform audit.append('submissions.task_published', 'task', p_task_id::text,
    jsonb_build_object('cohort_id', v_task.cohort_id), 'facilitator',
    jsonb_build_object('state', 'draft'),
    jsonb_build_object('state', 'published', 'due_at', v_task.due_at, 'learners', v_audience),
    'cohort', v_task.cohort_id);
  return query select 'ok'::text, v_audience;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Queries
-- ---------------------------------------------------------------------------------------------------------------

-- Staff view: every task of the cohorts this person sets work in, drafts included.
create function api.list_tasks(p_cohort_id uuid default null)
returns table (
  id uuid,
  cohort_id uuid,
  cohort_name text,
  title text,
  state text,
  submission_type text,
  due_at timestamptz,
  late_policy text,
  audience text,
  audience_size integer,
  criteria_count integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.cohort_id, c.name, t.title, t.state, t.submission_type, t.due_at, t.late_policy, t.audience,
         submissions.audience_size(t.id),
         (select count(*)::integer from submissions.task_criteria tc where tc.task_id = t.id),
         t.published_at
  from submissions.tasks t
  join programmes.cohorts c on c.id = t.cohort_id
  where (p_cohort_id is null or t.cohort_id = p_cohort_id)
    and submissions.can_set_work(auth.uid(), t.cohort_id)
  order by t.state, t.due_at nulls last, t.title
$$;

create function api.get_task(p_task_id uuid)
returns table (
  id uuid,
  cohort_id uuid,
  cohort_name text,
  module_id uuid,
  title text,
  brief text,
  state text,
  submission_type text,
  due_at timestamptz,
  late_policy text,
  audience text,
  audience_size integer,
  criteria jsonb,
  named_learners jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.cohort_id, c.name, t.module_id, t.title, t.brief, t.state, t.submission_type, t.due_at,
         t.late_policy, t.audience, submissions.audience_size(t.id),
         coalesce((
           select jsonb_agg(jsonb_build_object('ordinal', tc.ordinal, 'title', tc.title, 'descriptor', tc.descriptor,
                                               'points', tc.points) order by tc.ordinal)
           from submissions.task_criteria tc where tc.task_id = t.id
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(jsonb_build_object('full_name', p.full_name, 'email', u.email) order by p.full_name)
           from submissions.task_targets tt
           join identity.profiles p on p.id = tt.profile_id
           join auth.users u on u.id = p.id
           where tt.task_id = t.id
         ), '[]'::jsonb)
  from submissions.tasks t
  join programmes.cohorts c on c.id = t.cohort_id
  where t.id = p_task_id
    and submissions.can_set_work(auth.uid(), t.cohort_id)
$$;

-- The cohorts this person may set work in, for the "which cohort" choice on the task editor. A facilitator
-- cannot call api.list_cohorts(), which answers for coordinators.
create function api.list_work_cohorts()
returns table (id uuid, name text, programme_title text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, p.title, c.status
  from programmes.cohorts c
  join programmes.programmes p on p.id = c.programme_id
  where c.status = 'active'
    and submissions.can_set_work(auth.uid(), c.id)
  order by c.starts_on desc, c.name
$$;

-- Learner view (FR-202): published tasks they are the audience for. A draft never appears here.
create function api.list_my_tasks()
returns table (
  id uuid,
  cohort_name text,
  title text,
  submission_type text,
  due_at timestamptz,
  late_policy text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, c.name, t.title, t.submission_type, t.due_at, t.late_policy, t.published_at
  from submissions.tasks t
  join programmes.cohorts c on c.id = t.cohort_id
  where t.state = 'published'
    and submissions.is_audience(auth.uid(), t.id)
  order by t.due_at, t.title
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.create_task(uuid, text, text, text, timestamptz, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function api.update_task(uuid, text, text, text, timestamptz, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function api.set_task_criteria(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function api.set_task_audience(uuid, text, text[]) from public, anon, authenticated, service_role;
revoke all on function api.publish_task(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_tasks(uuid) from public, anon, authenticated, service_role;
revoke all on function api.get_task(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_tasks() from public, anon, authenticated, service_role;
revoke all on function api.list_work_cohorts() from public, anon, authenticated, service_role;

grant execute on function api.create_task(uuid, text, text, text, timestamptz, text, uuid) to authenticated;
grant execute on function api.update_task(uuid, text, text, text, timestamptz, text, uuid) to authenticated;
grant execute on function api.set_task_criteria(uuid, jsonb) to authenticated;
grant execute on function api.set_task_audience(uuid, text, text[]) to authenticated;
grant execute on function api.publish_task(uuid) to authenticated;
grant execute on function api.list_tasks(uuid) to authenticated;
grant execute on function api.get_task(uuid) to authenticated;
grant execute on function api.list_my_tasks() to authenticated;
grant execute on function api.list_work_cohorts() to authenticated;
