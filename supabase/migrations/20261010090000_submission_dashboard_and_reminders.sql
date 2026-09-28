-- The facilitator's submission dashboard and reminders (S2-16; FR-210, FR-211, FR-212; screens F-08, F-09, F-10).
--
-- Who has handed in, who has not, and who was late, for each task in a cohort the facilitator sets work in, with a
-- drill-down to one learner's history. Operational status only: no outcome, mark or integrity data reaches a
-- facilitator here (P0-10 boundaries).
--
-- A reminder goes to selected learners who have not handed the task in. Each one is logged against the learner
-- (submissions.task_reminders, append-only) and reaches them as an in-app notification (email follows when it is
-- switched on). A learner reminded about the same task in the last hour is skipped, so a double click does not send
-- two. Learners who have handed in by the time the reminder is sent are skipped too.
--
-- Status of a learner for a task: "submitted" when their latest version was on time, "late" when it was late,
-- "outstanding" when they have handed nothing in. "Overdue" is outstanding after the due time.

-- ---------------------------------------------------------------------------------------------------------------
-- The reminder log
-- ---------------------------------------------------------------------------------------------------------------

create table submissions.task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references submissions.tasks (id),
  learner_id uuid not null references identity.profiles (id),
  sent_by uuid not null references identity.profiles (id),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  notification_id uuid references notifications.notifications (id),
  sent_at timestamptz not null default now()
);

create index task_reminders_learner_idx on submissions.task_reminders (task_id, learner_id, sent_at desc);

revoke all on table submissions.task_reminders from public, anon, authenticated, service_role;

create trigger task_reminders_append_only
  before update or delete on submissions.task_reminders
  for each row execute function audit.forbid_mutation();

create trigger task_reminders_append_only_truncate
  before truncate on submissions.task_reminders
  for each statement execute function audit.forbid_mutation();

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled')
);

create or replace function notifications.category(p_event_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_event_type = 'result_released' then 'results'
    when p_event_type in ('task_published', 'task_reminder') then 'deadlines'
    when p_event_type like 'session\_%' then 'sessions'
    else 'notices'
  end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- A learner's standing on a task
-- ---------------------------------------------------------------------------------------------------------------

-- The audience of a published task with each learner's latest version (if any) and last reminder: one row per
-- learner. The reads below build on it; it checks nothing about the caller, so it is never granted.
create function submissions.task_standing(p_task_id uuid)
returns table (
  learner_id uuid,
  full_name text,
  learner_number text,
  status text,
  latest_version integer,
  submitted_at timestamptz,
  late_by_seconds integer,
  files_waiting boolean,
  last_reminder_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.learner_number,
    case when v.version_number is null then 'outstanding' when v.is_late then 'late' else 'submitted' end,
    v.version_number, v.submitted_at, v.late_by_seconds,
    v.version_number is null and exists (
      select 1 from submissions.file_upload_intents i
      join submissions.stored_files sf on sf.intent_id = i.id
      where i.profile_id = p.id and i.context_type = 'task_submission' and i.context_id = t.id
        and i.consumed_at is null and i.discarded_at is null
    ),
    (select max(r.sent_at) from submissions.task_reminders r where r.task_id = t.id and r.learner_id = p.id)
  from submissions.tasks t
  join programmes.enrolments e on e.cohort_id = t.cohort_id and e.status = 'active'
  join identity.profiles p on p.id = e.profile_id
  left join lateral (
    select sv.version_number, sv.submitted_at, sv.is_late, sv.late_by_seconds
    from submissions.submissions s
    join submissions.submission_versions sv on sv.submission_id = s.id
    where s.task_id = t.id and s.profile_id = p.id
    order by sv.version_number desc
    limit 1
  ) v on true
  where t.id = p_task_id
    and t.state = 'published'
    and (t.audience = 'cohort'
         or exists (select 1 from submissions.task_targets tt where tt.task_id = t.id and tt.profile_id = p.id))
$$;

revoke all on function submissions.task_standing(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads (facilitators, within the cohorts they set work in)
-- ---------------------------------------------------------------------------------------------------------------

-- By task: how many handed in on time, late, and not at all (F-08, "By task").
create function api.list_task_submission_counts(p_cohort_id uuid)
returns table (
  task_id uuid,
  title text,
  due_at timestamptz,
  late_policy text,
  audience integer,
  submitted integer,
  late integer,
  outstanding integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, t.due_at, t.late_policy,
    count(st.*)::integer,
    (count(*) filter (where st.status = 'submitted'))::integer,
    (count(*) filter (where st.status = 'late'))::integer,
    (count(*) filter (where st.status = 'outstanding'))::integer
  from submissions.tasks t
  left join lateral submissions.task_standing(t.id) st on true
  where t.cohort_id = p_cohort_id
    and t.state = 'published'
    and submissions.can_set_work(auth.uid(), p_cohort_id)
  group by t.id
  order by t.due_at desc nulls last, t.title
$$;

-- One task's learners, outstanding first, then late, then submitted, each by name (F-08 table, and the export).
create function api.list_task_submissions(p_task_id uuid)
returns table (
  learner_id uuid,
  full_name text,
  learner_number text,
  status text,
  latest_version integer,
  submitted_at timestamptz,
  late_by_seconds integer,
  files_waiting boolean,
  last_reminder_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select st.*
  from submissions.tasks t
  cross join lateral submissions.task_standing(t.id) st
  where t.id = p_task_id and submissions.can_set_work(auth.uid(), t.cohort_id)
  order by case st.status when 'outstanding' then 0 when 'late' then 1 else 2 end, st.full_name
$$;

-- One learner's history across the tasks of cohorts this facilitator sets work in (F-09): every version, and every
-- reminder sent. Nothing if the learner is in none of them.
create function api.get_learner_submission_history(p_learner_id uuid)
returns table (
  learner_id uuid,
  full_name text,
  learner_number text,
  task_id uuid,
  task_title text,
  cohort_name text,
  due_at timestamptz,
  status text,
  versions jsonb,
  reminders jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.learner_number, t.id, t.title, c.name, t.due_at, st.status,
    coalesce((
      select jsonb_agg(jsonb_build_object('version_number', sv.version_number, 'submitted_at', sv.submitted_at,
                                          'is_late', sv.is_late, 'late_by_seconds', sv.late_by_seconds,
                                          'receipt_reference', sv.receipt_reference) order by sv.version_number desc)
      from submissions.submissions s
      join submissions.submission_versions sv on sv.submission_id = s.id
      where s.task_id = t.id and s.profile_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('sent_at', r.sent_at, 'sent_by', sp.full_name, 'message', r.message)
                       order by r.sent_at desc)
      from submissions.task_reminders r join identity.profiles sp on sp.id = r.sent_by
      where r.task_id = t.id and r.learner_id = p.id
    ), '[]'::jsonb)
  from identity.profiles p
  join programmes.enrolments e on e.profile_id = p.id and e.status = 'active'
  join programmes.cohorts c on c.id = e.cohort_id
  join submissions.tasks t on t.cohort_id = c.id and t.state = 'published'
  cross join lateral (select st.status from submissions.task_standing(t.id) st where st.learner_id = p.id) st
  where p.id = p_learner_id and submissions.can_set_work(auth.uid(), c.id)
  order by t.due_at desc nulls last, t.title
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Sending a reminder (FR-212)
-- ---------------------------------------------------------------------------------------------------------------

create function api.send_task_reminder(p_task_id uuid, p_learner_ids uuid[], p_message text)
returns table (status text, sent integer, skipped_submitted integer, skipped_recent integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_cohort_name text;
  v_row record;
  v_notification uuid;
  v_reminder uuid;
  v_sent integer := 0;
  v_submitted integer := 0;
  v_recent integer := 0;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer, null::integer; return; end if;
  select * into v_task from submissions.tasks t where t.id = p_task_id;
  if not found or v_task.state <> 'published' then
    return query select 'task_not_found'::text, null::integer, null::integer, null::integer; return;
  end if;
  if not submissions.can_set_work(v_actor, v_task.cohort_id) then
    return query select 'forbidden'::text, null::integer, null::integer, null::integer; return;
  end if;
  if char_length(v_message) not between 1 and 1000 then
    return query select 'invalid_message'::text, null::integer, null::integer, null::integer; return;
  end if;
  if coalesce(array_length(p_learner_ids, 1), 0) = 0 then
    return query select 'no_learners'::text, null::integer, null::integer, null::integer; return;
  end if;
  if array_length(p_learner_ids, 1) > 2000 then
    return query select 'too_many'::text, null::integer, null::integer, null::integer; return;
  end if;
  select c.name into v_cohort_name from programmes.cohorts c where c.id = v_task.cohort_id;

  -- Only learners in the task's audience; anyone else in the list is ignored.
  for v_row in
    select st.* from submissions.task_standing(p_task_id) st where st.learner_id = any (p_learner_ids)
  loop
    if v_row.status <> 'outstanding' then
      v_submitted := v_submitted + 1;
      continue;
    end if;
    if v_row.last_reminder_at is not null and v_row.last_reminder_at > now() - interval '1 hour' then
      v_recent := v_recent + 1;
      continue;
    end if;

    v_reminder := gen_random_uuid();
    v_notification := notifications.enqueue('task_reminder', 'task_reminder:' || v_reminder::text, v_row.learner_id,
      jsonb_build_object('task_id', p_task_id, 'title', v_task.title, 'cohort_name', v_cohort_name,
                         'due_at', v_task.due_at, 'message', v_message),
      '/learn/tasks/' || p_task_id::text);
    insert into submissions.task_reminders (id, task_id, learner_id, sent_by, message, notification_id)
    values (v_reminder, p_task_id, v_row.learner_id, v_actor, v_message, v_notification);
    v_sent := v_sent + 1;
  end loop;

  perform audit.append('submissions.reminder_sent', 'task', p_task_id::text,
    jsonb_build_object('message', v_message), 'facilitator', null,
    jsonb_build_object('sent', v_sent, 'skipped_submitted', v_submitted, 'skipped_recent', v_recent),
    'cohort', v_task.cohort_id);

  return query select 'ok'::text, v_sent, v_submitted, v_recent;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.list_task_submission_counts(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_task_submissions(uuid) from public, anon, authenticated, service_role;
revoke all on function api.get_learner_submission_history(uuid) from public, anon, authenticated, service_role;
revoke all on function api.send_task_reminder(uuid, uuid[], text) from public, anon, authenticated, service_role;

grant execute on function api.list_task_submission_counts(uuid) to authenticated;
grant execute on function api.list_task_submissions(uuid) to authenticated;
grant execute on function api.get_learner_submission_history(uuid) to authenticated;
grant execute on function api.send_task_reminder(uuid, uuid[], text) to authenticated;
