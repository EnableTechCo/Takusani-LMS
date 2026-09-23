-- The notification centre (S2-11, screen G-05, P0-02, NFR-11): what a person was told, when, and how.
--
-- Each notification carries its delivery evidence: when it appeared in the LMS, the email's state and times when an
-- email was sent (email is switched off until go-live, so there is none yet), and, for a result, when the learner
-- first opened it (S2-09). "The message in the LMS is the record that you were told" (prototype, notifications).
--
-- Read state is the person's own and independent of the evidence: opening a notification marks it read; "Mark all as
-- read" marks the rest. Nothing here is audited: reading a notification is not an academic event, and the evidence
-- itself is never changed by reading it.

-- The wording is chosen by template version (src/modules/notifications/templates.ts), so a later change of words does
-- not rewrite what an earlier notification said.
alter table notifications.notifications
  add column template_version integer not null default 1 check (template_version >= 1);

-- The bell's unread count is read on every page.
create index notifications_unread_idx on notifications.notifications (recipient_id) where read_at is null;

-- What each filter chip shows.
create function notifications.category(p_event_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_event_type
    when 'result_released' then 'results'
    when 'task_published' then 'deadlines'
    else 'notices'
  end
$$;

revoke all on function notifications.category(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------------------------

-- The signed-in person's notifications, newest first, one page at a time. p_category is 'all', 'results' or
-- 'deadlines'. total_count and unread_count describe the whole filtered list, not the page.
create function api.list_my_notifications(
  p_category text default 'all',
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid,
  event_type text,
  template_version integer,
  payload jsonb,
  link text,
  created_at timestamptz,
  read_at timestamptz,
  -- The email, when one was recorded: state, address and times.
  email jsonb,
  -- A result only: when the learner first opened this release of it, or null if they have not yet.
  first_opened_at timestamptz,
  total_count integer,
  unread_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select n.*
    from notifications.notifications n
    where n.recipient_id = auth.uid()
      and (coalesce(p_category, 'all') = 'all' or notifications.category(n.event_type) = p_category)
  )
  select m.id, m.event_type, m.template_version, m.payload, m.link, m.created_at, m.read_at,
    (
      select jsonb_build_object('state', d.state, 'address', d.address, 'accepted_at', d.accepted_at,
                                'delivered_at', d.delivered_at, 'failed_at', d.failed_at, 'created_at', d.created_at)
      from notifications.outbox_messages o
      join notifications.notification_deliveries d on d.outbox_message_id = o.id
      where o.notification_id = m.id and o.channel = 'email'
      order by o.created_at desc
      limit 1
    ),
    case when m.event_type = 'result_released' then (
      select fv.first_viewed_at
      from assessment.result_first_views fv
      where fv.result_id = (m.payload ->> 'result_id')::uuid
        and fv.release_seq = split_part(m.event_key, ':', 3)::bigint
    ) end,
    (count(*) over ())::integer,
    (count(*) filter (where m.read_at is null) over ())::integer
  from mine m
  order by m.created_at desc, m.id
  limit least(greatest(coalesce(p_page_size, 20), 1), 100)
  offset (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 20), 1), 100)
$$;

revoke all on function api.list_my_notifications(text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function api.list_my_notifications(text, integer, integer) to authenticated;

-- For the bell in the top bar, on every page.
create function api.my_unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from notifications.notifications n
  where n.recipient_id = auth.uid() and n.read_at is null
$$;

revoke all on function api.my_unread_notification_count() from public, anon, authenticated, service_role;
grant execute on function api.my_unread_notification_count() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------------------------

-- Opening a notification: marks it read (the first time only) and returns where it points. Nothing for anyone else's.
create function api.open_my_notification(p_notification_id uuid)
returns table (status text, link text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text;
begin
  if auth.uid() is null then return query select 'unauthenticated'::text, null::text; return; end if;
  update notifications.notifications n
  set read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id and n.recipient_id = auth.uid()
  returning n.link into v_link;
  if v_link is null then return query select 'not_found'::text, null::text; return; end if;
  return query select 'ok'::text, v_link;
end
$$;

revoke all on function api.open_my_notification(uuid) from public, anon, authenticated, service_role;
grant execute on function api.open_my_notification(uuid) to authenticated;

-- "Mark all as read": every unread notification of the signed-in person, or only one category of them.
create function api.mark_my_notifications_read(p_category text default 'all')
returns table (status text, marked integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marked integer;
begin
  if auth.uid() is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  update notifications.notifications n
  set read_at = now()
  where n.recipient_id = auth.uid()
    and n.read_at is null
    and (coalesce(p_category, 'all') = 'all' or notifications.category(n.event_type) = p_category);
  get diagnostics v_marked = row_count;
  return query select 'ok'::text, v_marked;
end
$$;

revoke all on function api.mark_my_notifications_read(text) from public, anon, authenticated, service_role;
grant execute on function api.mark_my_notifications_read(text) to authenticated;
