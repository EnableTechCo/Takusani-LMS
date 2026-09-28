-- Coordinator notices (S2-17; FR-703; screen C-09). A coordinator messages a cohort, a role group or everyone, now or
-- at a later time, and the delivery is logged per recipient.
--
-- Who may send to whom:
--   * a cohort (its active learners): a coordinator of that cohort (programmes.can_coordinate);
--   * a role group (everyone holding the role) or everyone: a coordinator whose scope is the whole institution, or an
--     administrator. A programme-scoped coordinator messages their own cohorts.
-- The sender is never among the recipients.
--
-- Delivering a notice writes one in-app notification per recipient in one transaction (S2-10), with its email when
-- email is switched on. Those rows are the delivery log: when each person was told in the LMS, and whether they have
-- read it (S2-11). A notice sent "now" is delivered in the command's own transaction. A scheduled one is released by a
-- database job every minute (pg_cron, ADR-025: pure-database schedules run in the database, not on Vercel), so it goes
-- out on time on any hosting plan; releasing takes the notice under a row lock, so it goes out once.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------------------------------------------
-- Notices
-- ---------------------------------------------------------------------------------------------------------------

create table notifications.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  audience text not null check (audience in ('cohort', 'role', 'everyone')),
  cohort_id uuid references programmes.cohorts (id),
  role text references identity.roles (code),
  send_at timestamptz not null,
  state text not null default 'scheduled' check (state in ('scheduled', 'sent', 'cancelled')),
  sent_at timestamptz,
  recipients integer check (recipients >= 0),
  created_by uuid not null references identity.profiles (id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint audience_is_complete check (
    (audience = 'cohort' and cohort_id is not null and role is null)
    or (audience = 'role' and role is not null and cohort_id is null)
    or (audience = 'everyone' and cohort_id is null and role is null)
  ),
  constraint sent_is_recorded check ((state = 'sent') = (sent_at is not null and recipients is not null)),
  constraint cancelled_is_recorded check ((state = 'cancelled') = (cancelled_at is not null))
);

create index notices_due_idx on notifications.notices (send_at) where state = 'scheduled';

revoke all on table notifications.notices from public, anon, authenticated, service_role;

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------------------------

-- A role group or everyone: an institution-wide coordinator, or an administrator.
create function notifications.can_notice_everyone(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select identity.has_role(p_profile_id, 'administrator') or exists (
    select 1 from identity.role_assignments ra
    join identity.profiles p on p.id = ra.profile_id
    where ra.profile_id = p_profile_id and ra.role = 'coordinator' and ra.scope_type = 'global'
      and ra.effective @> now() and p.status = 'active'
  )
$$;

-- Who a notice reaches, at the moment it is delivered. Active accounts only; never the sender.
create function notifications.notice_audience(p_notice notifications.notices)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id
  from identity.profiles p
  where p.status = 'active'
    and p.id <> p_notice.created_by
    and case p_notice.audience
      when 'cohort' then exists (
        select 1 from programmes.enrolments e
        where e.profile_id = p.id and e.cohort_id = p_notice.cohort_id and e.status = 'active')
      when 'role' then exists (
        select 1 from identity.role_assignments ra
        where ra.profile_id = p.id and ra.role = p_notice.role and ra.effective @> now())
      else true
    end
$$;

-- Delivers a scheduled notice now: one notification per recipient (the delivery log), then marks it sent.
create function notifications.deliver_notice(p_notice_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notice notifications.notices;
  v_sender text;
  v_payload jsonb;
  v_profile uuid;
  v_count integer := 0;
begin
  select * into v_notice from notifications.notices n where n.id = p_notice_id and n.state = 'scheduled' for update skip locked;
  if not found then return null; end if;
  select p.full_name into v_sender from identity.profiles p where p.id = v_notice.created_by;
  v_payload := jsonb_build_object('notice_id', v_notice.id, 'title', v_notice.title, 'body', v_notice.body,
                                  'sender_name', v_sender);
  for v_profile in select a.profile_id from notifications.notice_audience(v_notice) a loop
    if notifications.enqueue('notice', 'notice:' || v_notice.id::text, v_profile, v_payload,
                             '/notifications?show=notices') is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  update notifications.notices n set state = 'sent', sent_at = now(), recipients = v_count where n.id = v_notice.id;
  return v_count;
end
$$;

-- The job pg_cron runs every minute: release every scheduled notice whose time has come.
create function notifications.release_due_notices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_released integer := 0;
begin
  for v_id in
    select n.id from notifications.notices n where n.state = 'scheduled' and n.send_at <= now() order by n.send_at
  loop
    if notifications.deliver_notice(v_id) is not null then v_released := v_released + 1; end if;
  end loop;
  return v_released;
end
$$;

revoke all on function notifications.can_notice_everyone(uuid) from public, anon, authenticated, service_role;
revoke all on function notifications.notice_audience(notifications.notices) from public, anon, authenticated, service_role;
revoke all on function notifications.deliver_notice(uuid) from public, anon, authenticated, service_role;
revoke all on function notifications.release_due_notices() from public, anon, authenticated, service_role;

select cron.schedule('release-scheduled-notices', '* * * * *', 'select notifications.release_due_notices()');

-- ---------------------------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------------------------

-- Send now (p_send_at null or not in the future) or schedule. Returns how many were told, or, for a scheduled notice,
-- how many it would reach today.
create function api.create_notice(
  p_title text,
  p_body text,
  p_audience text,
  p_cohort_id uuid default null,
  p_role text default null,
  p_send_at timestamptz default null
)
returns table (status text, notice_id uuid, recipients integer, scheduled boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_notice notifications.notices;
  v_send_at timestamptz := coalesce(p_send_at, now());
  v_count integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::integer, null::boolean; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 150 then
    return query select 'invalid_title'::text, null::uuid, null::integer, null::boolean; return;
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    return query select 'invalid_body'::text, null::uuid, null::integer, null::boolean; return;
  end if;
  if p_audience = 'cohort' then
    if p_cohort_id is null or not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id) then
      return query select 'cohort_not_found'::text, null::uuid, null::integer, null::boolean; return;
    end if;
    if not programmes.can_coordinate(v_actor, p_cohort_id) then
      return query select 'forbidden'::text, null::uuid, null::integer, null::boolean; return;
    end if;
  elsif p_audience in ('role', 'everyone') then
    if p_audience = 'role' and not exists (select 1 from identity.roles r where r.code = p_role) then
      return query select 'invalid_role'::text, null::uuid, null::integer, null::boolean; return;
    end if;
    if not notifications.can_notice_everyone(v_actor) then
      return query select 'forbidden'::text, null::uuid, null::integer, null::boolean; return;
    end if;
  else
    return query select 'invalid_audience'::text, null::uuid, null::integer, null::boolean; return;
  end if;
  if v_send_at < now() - interval '1 minute' then
    return query select 'send_in_past'::text, null::uuid, null::integer, null::boolean; return;
  end if;

  insert into notifications.notices (title, body, audience, cohort_id, role, send_at, created_by)
  values (btrim(p_title), btrim(p_body), p_audience,
          case when p_audience = 'cohort' then p_cohort_id end,
          case when p_audience = 'role' then p_role end,
          greatest(v_send_at, now()), v_actor)
  returning * into v_notice;

  perform audit.append('notifications.notice_created', 'notice', v_notice.id::text, '{}'::jsonb, 'coordinator', null,
    jsonb_build_object('title', v_notice.title, 'audience', v_notice.audience, 'cohort_id', v_notice.cohort_id,
                       'role', v_notice.role, 'send_at', v_notice.send_at),
    case when v_notice.cohort_id is not null then 'cohort' else 'global' end, v_notice.cohort_id);

  if v_notice.send_at <= now() then
    v_count := notifications.deliver_notice(v_notice.id);
    return query select 'ok'::text, v_notice.id, v_count, false;
  else
    select count(*)::integer into v_count from notifications.notice_audience(v_notice);
    return query select 'ok'::text, v_notice.id, v_count, true;
  end if;
end
$$;

create function api.cancel_notice(p_notice_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_notice notifications.notices;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_notice from notifications.notices n where n.id = p_notice_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_notice.created_by <> v_actor and not notifications.can_notice_everyone(v_actor) then
    return query select 'forbidden'::text; return;
  end if;
  if v_notice.state <> 'scheduled' then return query select 'already_sent'::text; return; end if;
  update notifications.notices n set state = 'cancelled', cancelled_at = now() where n.id = p_notice_id;
  perform audit.append('notifications.notice_cancelled', 'notice', p_notice_id::text, '{}'::jsonb, 'coordinator',
    jsonb_build_object('state', 'scheduled'), jsonb_build_object('state', 'cancelled'),
    case when v_notice.cohort_id is not null then 'cohort' else 'global' end, v_notice.cohort_id);
  return query select 'ok'::text;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads (coordinators): notices they may see, and each one's delivery log
-- ---------------------------------------------------------------------------------------------------------------

-- A notice is visible to its sender, to institution-wide coordinators and administrators, and to a coordinator of its
-- cohort.
create function notifications.can_see_notice(p_profile_id uuid, p_notice notifications.notices)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_notice.created_by = p_profile_id
    or notifications.can_notice_everyone(p_profile_id)
    or (p_notice.cohort_id is not null and programmes.can_coordinate(p_profile_id, p_notice.cohort_id))
$$;

revoke all on function notifications.can_see_notice(uuid, notifications.notices) from public, anon, authenticated, service_role;

create function api.list_notices()
returns table (
  id uuid,
  title text,
  audience text,
  cohort_name text,
  role text,
  send_at timestamptz,
  state text,
  sent_at timestamptz,
  recipients integer,
  read_count integer,
  sender_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.title, n.audience, c.name, n.role, n.send_at, n.state, n.sent_at, n.recipients,
    (select count(*)::integer from notifications.notifications x
     where x.event_key = 'notice:' || n.id::text and x.read_at is not null),
    p.full_name
  from notifications.notices n
  left join programmes.cohorts c on c.id = n.cohort_id
  join identity.profiles p on p.id = n.created_by
  where notifications.can_see_notice(auth.uid(), n)
  order by n.send_at desc
$$;

create function api.get_notice(p_notice_id uuid)
returns table (
  id uuid,
  title text,
  body text,
  audience text,
  cohort_name text,
  role text,
  send_at timestamptz,
  state text,
  sent_at timestamptz,
  recipients integer,
  sender_name text,
  can_cancel boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.title, n.body, n.audience, c.name, n.role, n.send_at, n.state, n.sent_at, n.recipients, p.full_name,
    n.state = 'scheduled' and (n.created_by = auth.uid() or notifications.can_notice_everyone(auth.uid()))
  from notifications.notices n
  left join programmes.cohorts c on c.id = n.cohort_id
  join identity.profiles p on p.id = n.created_by
  where n.id = p_notice_id and notifications.can_see_notice(auth.uid(), n)
$$;

-- The delivery log (FR-703): each recipient, when they were told in the LMS, whether they have read it, and the email
-- when one was recorded.
create function api.list_notice_deliveries(p_notice_id uuid)
returns table (
  recipient_name text,
  learner_number text,
  told_at timestamptz,
  read_at timestamptz,
  email_state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.learner_number, x.created_at, x.read_at,
    (select d.state from notifications.outbox_messages o
     join notifications.notification_deliveries d on d.outbox_message_id = o.id
     where o.notification_id = x.id limit 1)
  from notifications.notices n
  join notifications.notifications x on x.event_key = 'notice:' || n.id::text
  join identity.profiles p on p.id = x.recipient_id
  where n.id = p_notice_id and notifications.can_see_notice(auth.uid(), n)
  order by p.full_name
$$;

-- The cohorts a coordinator may send to, and whether they may send to role groups and everyone.
create function api.my_notice_audiences()
returns table (cohort_id uuid, cohort_name text, programme_title text, learners integer, can_send_wide boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, pr.title,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = c.id and e.status = 'active'),
    notifications.can_notice_everyone(auth.uid())
  from programmes.cohorts c
  join programmes.programmes pr on pr.id = c.programme_id
  where c.status = 'active' and programmes.can_coordinate(auth.uid(), c.id)
  union all
  select null, null, null, null, true
  where notifications.can_notice_everyone(auth.uid())
    and not exists (select 1 from programmes.cohorts c where c.status = 'active' and programmes.can_coordinate(auth.uid(), c.id))
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.create_notice(text, text, text, uuid, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function api.cancel_notice(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_notices() from public, anon, authenticated, service_role;
revoke all on function api.get_notice(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_notice_deliveries(uuid) from public, anon, authenticated, service_role;
revoke all on function api.my_notice_audiences() from public, anon, authenticated, service_role;

grant execute on function api.create_notice(text, text, text, uuid, text, timestamptz) to authenticated;
grant execute on function api.cancel_notice(uuid) to authenticated;
grant execute on function api.list_notices() to authenticated;
grant execute on function api.get_notice(uuid) to authenticated;
grant execute on function api.list_notice_deliveries(uuid) to authenticated;
grant execute on function api.my_notice_audiences() to authenticated;
