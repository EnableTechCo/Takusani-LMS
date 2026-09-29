-- Tasks are called assignments in everything people read. The notification templates that mention them get a new
-- version (the words of a message already queued never change), so enqueue now records a version per event type.

-- The template version in force for each event type. The application renders each version's words
-- (src/modules/notifications/templates.ts); a reworded template is a new version here and there.
create function notifications.template_version(p_event_type text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_event_type
    when 'task_published' then 2
    when 'task_reminder' then 2
    when 'readiness_item_assigned' then 2
    else 1
  end
$$;

revoke all on function notifications.template_version(text) from public, anon, authenticated, service_role;

create or replace function notifications.enqueue(
  p_event_type text,
  p_event_key text,
  p_recipient_id uuid,
  p_payload jsonb,
  p_link text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template_version integer := notifications.template_version(p_event_type);
  v_dedupe text := p_event_key || ':' || p_recipient_id::text || ':email:v' || v_template_version;
  v_notification uuid;
  v_outbox uuid;
  v_delivery uuid;
begin
  insert into notifications.notifications (recipient_id, event_type, event_key, payload, link)
  values (p_recipient_id, p_event_type, p_event_key, p_payload, p_link)
  on conflict (event_key, recipient_id) do nothing
  returning id into v_notification;
  if v_notification is null then return null; end if;
  if not coalesce((select st.email_enabled from notifications.settings st), false) then return v_notification; end if;

  insert into notifications.outbox_messages (
    notification_id, recipient_id, event_type, channel, template_version, dedupe_key, payload
  )
  values (v_notification, p_recipient_id, p_event_type, 'email', v_template_version, v_dedupe, p_payload)
  returning id into v_outbox;

  insert into notifications.notification_deliveries (outbox_message_id, channel, idempotency_key)
  values (v_outbox, 'email', encode(extensions.digest(v_dedupe, 'sha256'), 'hex'))
  returning id into v_delivery;

  perform pgmq.send('notification_delivery', jsonb_build_object('delivery_id', v_delivery));
  return v_notification;
end
$$;
