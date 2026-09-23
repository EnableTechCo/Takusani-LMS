-- Notifications: the transactional outbox, the delivery queue and the worker's functions (S2-10, ADR-008, ADR-025,
-- NFR-11). Academic commits never wait for email, and no committed event is lost.
--
-- In the same transaction as the academic change:
--   * the in-app notification is written (the record that the learner was told, NFR-11),
--   * the outbox row and its email delivery are written, and
--   * the delivery is sent to the queue with pgmq.send (test plan 29: a rollback takes all of it with it).
-- The worker (a Vercel function, called by Vercel Cron and straight after the commits that notify) reads a bounded
-- batch with a visibility timeout, sends each email with an idempotency key derived from the outbox deduplication
-- key, and records the delivery state and archives the message in one transaction. Overlapping runs are harmless:
-- a message being worked on is invisible to the others. A message read too many times is retired as failed by the
-- queue's own read count.
--
-- Where the events come from: triggers on the two aggregates, which run inside the domain function's transaction.
--   * results: a new release_seq (held -> released, or a new decision on a released result) is "result released".
--     Every release path notifies, including sign-off (S4) and appeals (S3), without each having to remember to.
--   * tasks: draft -> published is "task published", for each learner in the audience.
-- The receipt notification on submit is not in the MVP (S2-10 names "result released" and "task published" first).

create extension if not exists pgmq;
select pgmq.create('notification_delivery');

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

-- The in-app notification: what the learner reads in the LMS, and the evidence that they were told (NFR-11).
create table notifications.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references identity.profiles (id),
  event_type text not null check (event_type in ('result_released', 'task_published')),
  -- The logical event, for example "result_released:<result>:<release_seq>". One notification per event and person.
  event_key text not null,
  -- The facts the wording is made from (item title, dates); the words themselves live in the application's
  -- templates, so the in-app text and the email say the same thing.
  payload jsonb not null,
  link text not null check (link like '/%'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (event_key, recipient_id)
);

create index notifications_recipient_idx on notifications.notifications (recipient_id, created_at desc);

-- One row per event, person, channel and template version (data model, "outbox uniqueness").
create table notifications.outbox_messages (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications.notifications (id),
  recipient_id uuid not null references identity.profiles (id),
  event_type text not null,
  channel text not null check (channel in ('email')),
  template_version integer not null check (template_version >= 1),
  dedupe_key text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- The delivery ledger: the state of each send, with the provider's reference and the times (NFR-11).
create table notifications.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_message_id uuid not null unique references notifications.outbox_messages (id),
  channel text not null check (channel in ('email')),
  -- Sent to the provider so a repeated send is not a second email. A digest of the dedupe key: no personal data.
  idempotency_key text not null unique,
  state text not null default 'pending'
    check (state in ('pending', 'accepted', 'delivered', 'failed', 'skipped')),
  -- The address it was sent to, as it was at the time.
  address text,
  attempts integer not null default 0 check (attempts >= 0),
  provider text,
  provider_message_id text,
  last_error text check (char_length(last_error) <= 1000),
  accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accepted_has_time check (state not in ('accepted', 'delivered') or accepted_at is not null),
  constraint failed_has_time check (state <> 'failed' or failed_at is not null)
);

-- The alert on the oldest undelivered row reads this.
create index deliveries_pending_idx on notifications.notification_deliveries (created_at) where state = 'pending';

revoke all on table notifications.notifications, notifications.outbox_messages, notifications.notification_deliveries
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Enqueue: in-app notification, outbox row, delivery row and queue message, all in the caller's transaction
-- ---------------------------------------------------------------------------------------------------------------

-- Returns the notification, or null when this event was already recorded for this person (a replay is harmless).
create function notifications.enqueue(
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
  v_template_version constant integer := 1;
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

revoke all on function notifications.enqueue(text, text, uuid, jsonb, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------------------------------------------

-- "Your result for Task 3 is ready." The email names the item and the appeal closing day and links to the result,
-- but not the outcome: that stays behind sign-in (UX architecture, walkthrough of release, assumption).
create function notifications.on_result_released()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform notifications.enqueue(
    'result_released',
    'result_released:' || new.id::text || ':' || new.release_seq::text,
    new.learner_id,
    (select jsonb_build_object('result_id', new.id, 'item_title', ai.title, 'cohort_name', c.name,
                               'released_at', new.released_at, 'appeal_deadline_at', new.appeal_deadline_at)
     from assessment.assessable_items ai join programmes.cohorts c on c.id = ai.cohort_id
     where ai.id = new.assessable_item_id),
    '/learn/results/' || new.id::text
  );
  return null;
end
$$;

revoke all on function notifications.on_result_released() from public, anon, authenticated, service_role;

-- No column list ("update of release_seq"): release_seq is written by the release guard, a BEFORE trigger, and a
-- column-specific trigger only fires for columns named in the statement's SET list. The WHEN clause is the filter.
create trigger results_notify_release
  after update on assessment.results
  for each row
  when (new.release_seq is not null and new.release_seq is distinct from old.release_seq)
  execute function notifications.on_result_released();

-- "New task: Task 3." One notification per learner the task is for, when it is published.
create function notifications.on_task_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cohort_name text;
  v_learner uuid;
begin
  select c.name into v_cohort_name from programmes.cohorts c where c.id = new.cohort_id;
  for v_learner in
    select e.profile_id
    from programmes.enrolments e
    where e.cohort_id = new.cohort_id
      and e.status = 'active'
      and (new.audience = 'cohort'
           or exists (select 1 from submissions.task_targets tt where tt.task_id = new.id and tt.profile_id = e.profile_id))
  loop
    perform notifications.enqueue(
      'task_published',
      'task_published:' || new.id::text,
      v_learner,
      jsonb_build_object('task_id', new.id, 'title', new.title, 'cohort_name', v_cohort_name, 'due_at', new.due_at),
      '/learn/tasks/' || new.id::text
    );
  end loop;
  return null;
end
$$;

revoke all on function notifications.on_task_published() from public, anon, authenticated, service_role;

create trigger tasks_notify_publish
  after update on submissions.tasks
  for each row
  when (old.state = 'draft' and new.state = 'published')
  execute function notifications.on_task_published();

-- ---------------------------------------------------------------------------------------------------------------
-- The worker's functions. Called with the secret key (service_role) by the delivery worker only.
-- ---------------------------------------------------------------------------------------------------------------

-- Claims up to p_limit deliveries, each hidden from other workers for p_visibility_seconds. Settles, without
-- returning them, the ones there is nothing to send for: already settled (a repeat after a crash), no address or a
-- deactivated account (skipped), or read more than p_max_attempts times (poison: failed).
create function api.claim_notification_deliveries(
  p_limit integer default 10,
  p_visibility_seconds integer default 120,
  p_max_attempts integer default 5
)
returns table (
  msg_id bigint,
  attempt integer,
  delivery_id uuid,
  idempotency_key text,
  event_type text,
  template_version integer,
  payload jsonb,
  link text,
  address text,
  recipient_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg record;
  v_delivery notifications.notification_deliveries;
  v_outbox notifications.outbox_messages;
  v_address text;
  v_name text;
  v_active boolean;
begin
  for v_msg in
    select q.msg_id, q.read_ct, q.message
    from pgmq.read('notification_delivery', greatest(p_visibility_seconds, 30), least(greatest(p_limit, 1), 50)) q
  loop
    select d.* into v_delivery from notifications.notification_deliveries d
    where d.id = (v_msg.message ->> 'delivery_id')::uuid for update;

    if not found or v_delivery.state <> 'pending' then
      perform pgmq.archive('notification_delivery', v_msg.msg_id);
      continue;
    end if;

    if v_msg.read_ct > p_max_attempts then
      update notifications.notification_deliveries d
      set state = 'failed', failed_at = now(), attempts = v_msg.read_ct - 1, updated_at = now(),
          last_error = left(coalesce(d.last_error || ' ', '') || '(gave up after ' || (v_msg.read_ct - 1)::text
                            || ' attempts)', 1000)
      where d.id = v_delivery.id;
      perform pgmq.archive('notification_delivery', v_msg.msg_id);
      continue;
    end if;

    select o.* into v_outbox from notifications.outbox_messages o where o.id = v_delivery.outbox_message_id;
    select u.email, p.full_name, p.status = 'active' into v_address, v_name, v_active
    from identity.profiles p join auth.users u on u.id = p.id
    where p.id = v_outbox.recipient_id;

    if v_address is null or not coalesce(v_active, false) then
      update notifications.notification_deliveries d
      set state = 'skipped', updated_at = now(),
          last_error = case when v_address is null then 'no email address' else 'account deactivated' end
      where d.id = v_delivery.id;
      perform pgmq.archive('notification_delivery', v_msg.msg_id);
      continue;
    end if;

    update notifications.notification_deliveries d
    set attempts = v_msg.read_ct, address = v_address, updated_at = now()
    where d.id = v_delivery.id;

    return query
    select v_msg.msg_id, v_msg.read_ct, v_delivery.id, v_delivery.idempotency_key, v_outbox.event_type,
      v_outbox.template_version, v_outbox.payload, n.link, v_address, v_name
    from notifications.notifications n where n.id = v_outbox.notification_id;
  end loop;
end
$$;

revoke all on function api.claim_notification_deliveries(integer, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function api.claim_notification_deliveries(integer, integer, integer) to service_role;

-- Records what happened to one send. The delivery state and the archive of its message commit together, so a
-- message is never archived without its outcome on record, and a recorded outcome is never sent again.
--   accepted: the provider took it.   failed: the provider refused it for good.   skipped: nothing to send.
--   retry: keep it pending and show it again after p_retry_seconds.
create function api.settle_notification_delivery(
  p_msg_id bigint,
  p_delivery_id uuid,
  p_outcome text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null,
  p_retry_seconds integer default 60
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  if p_outcome not in ('accepted', 'failed', 'skipped', 'retry') then
    return query select 'invalid_outcome'::text; return;
  end if;
  select d.state into v_state from notifications.notification_deliveries d where d.id = p_delivery_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  -- Already settled (a duplicate run): the record stands, and the message goes.
  if v_state <> 'pending' then
    perform pgmq.archive('notification_delivery', p_msg_id);
    return query select 'already_settled'::text; return;
  end if;

  if p_outcome = 'retry' then
    update notifications.notification_deliveries d
    set last_error = left(p_error, 1000), updated_at = now() where d.id = p_delivery_id;
    perform pgmq.set_vt('notification_delivery', p_msg_id, greatest(p_retry_seconds, 0));
    return query select 'ok'::text; return;
  end if;

  update notifications.notification_deliveries d
  set state = p_outcome,
      provider = p_provider,
      provider_message_id = p_provider_message_id,
      last_error = left(p_error, 1000),
      accepted_at = case when p_outcome = 'accepted' then now() end,
      failed_at = case when p_outcome = 'failed' then now() end,
      updated_at = now()
  where d.id = p_delivery_id;
  perform pgmq.archive('notification_delivery', p_msg_id);
  return query select 'ok'::text;
end
$$;

revoke all on function api.settle_notification_delivery(bigint, uuid, text, text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function api.settle_notification_delivery(bigint, uuid, text, text, text, text, integer)
  to service_role;

-- For the alert (ADR-025 6; operations, initial thresholds): the oldest undelivered outbox row and the oldest queue
-- message, and failures in the last hour.
create function api.notification_outbox_health()
returns table (
  pending integer,
  oldest_pending_at timestamptz,
  queue_length bigint,
  oldest_queued_seconds integer,
  failed_last_hour integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from notifications.notification_deliveries where state = 'pending'),
    (select min(created_at) from notifications.notification_deliveries where state = 'pending'),
    m.queue_length,
    m.oldest_msg_age_sec,
    (select count(*)::integer from notifications.notification_deliveries
     where state = 'failed' and failed_at > now() - interval '1 hour')
  from pgmq.metrics('notification_delivery') m
$$;

revoke all on function api.notification_outbox_health() from public, anon, authenticated, service_role;
grant execute on function api.notification_outbox_health() to service_role;
