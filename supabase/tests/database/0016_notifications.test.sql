-- Notifications: outbox, queue and the worker's functions (S2-10, ADR-025, NFR-11; test plan transaction test 29).
-- Uses the local seed: "2026 Intake B" (not moderated) with learner@ enrolled, facilitator@, assessor@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(27);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

create function pg_temp.queued() returns bigint language sql as $$
  select count(*) from pgmq.q_notification_delivery
$$;

-- The learner hands in Task 3 and the assessor saves a draft with this outcome. Returns the instance.
create function pg_temp.ready_item(p_outcome text) returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_learner uuid := '00000000-0000-4000-8000-000000000001';
  v_assessor uuid := '00000000-0000-4000-8000-000000000003';
  v_intent uuid;
  v_file uuid;
  v_key text := v_task::text || '/' || v_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  v_instance uuid;
begin
  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, object_key, original_filename, declared_media_type, declared_bytes,
    max_bytes, allowed_media_types, expires_at, finalised_at
  )
  values (v_learner, 'task_submission', v_task, v_key, 'portfolio.pdf', 'application/pdf', 2048, 26214400,
    array['application/pdf'], now() + interval '2 hours', now())
  returning id into v_intent;
  insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
  values (v_intent, 'submissions', v_key, 'portfolio.pdf', 2048, 'application/pdf', v_learner)
  returning id into v_file;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_learner, 'role', 'authenticated')::text, true);
  perform api.submit_task(v_task, jsonb_build_array(jsonb_build_object('file_id', v_file, 'requirement_id', null)),
    gen_random_uuid());
  perform set_config('role', 'postgres', true);

  select i.id into v_instance from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  where r.learner_id = v_learner and i.state = 'to_mark';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_assessor, 'role', 'authenticated')::text, true);
  perform api.take_marking(v_instance);
  perform api.save_marking_draft(v_instance, 0, '[]'::jsonb, 'Feedback.', p_outcome, 'Judged.',
    case when p_outcome = 'not_yet_competent' then 'Add the schedule.' end,
    case when p_outcome = 'not_yet_competent' then 14 end);
  perform set_config('role', 'postgres', true);
  return v_instance;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set cohort 10000000-0000-4000-8000-000000000010

-- The seed publishes Task 3 by inserting it, not by the publish command, so nothing is queued yet.
reset role;
select is(pg_temp.queued(), 0::bigint, 'nothing is queued before anything happens');

-- Task published: an in-app notification, an outbox row, a pending email delivery and a queue message per learner
reset role;
select pg_temp.act_as(:'facilitator');
select task_id as task from api.create_task(:'cohort', 'pgTAP Notified Task', 'Write it up.', 'file_upload',
  now() + interval '10 days') \gset
select is(status, 'ok', 'the facilitator publishes the task') from api.publish_task(:'task');
reset role;
select results_eq(
  format($$ select n.recipient_id, n.event_type, n.link, n.payload ->> 'title', d.state, d.channel
            from notifications.notifications n
            join notifications.outbox_messages o on o.notification_id = n.id
            join notifications.notification_deliveries d on d.outbox_message_id = o.id
            where n.event_key = 'task_published:' || %L $$, :'task'),
  format($$ values (%L::uuid, 'task_published'::text, '/learn/tasks/' || %L, 'pgTAP Notified Task'::text,
                    'pending'::text, 'email'::text) $$, :'learner', :'task'),
  'publishing notifies the one enrolled learner in the LMS, with an email waiting to be sent');
select is(pg_temp.queued(), 1::bigint, 'and its email delivery is on the queue');

-- Test plan 29: a message sent in a domain transaction that rolls back is absent from the queue
select pg_temp.ready_item('not_yet_competent') as nyc \gset
select r.id as result from assessment.results r join assessment.assessment_instances i on i.result_id = r.id
where i.id = :'nyc' \gset
create function pg_temp.explode() returns trigger language plpgsql as $$
begin raise exception 'forced failure after the release was written'; end $$;
create trigger pgtap_explode before insert on audit.events for each row
  when (new.action = 'assessment.decision_finalised') execute function pg_temp.explode();
reset role;
select pg_temp.act_as(:'assessor');
select throws_ok(format($$ select * from api.finalise_decision(%L, 1) $$, :'nyc'), 'P0001', null,
  'finalising fails after the result was released and its notification enqueued');
reset role;
select is(pg_temp.queued(), 1::bigint, 'the rolled-back release left no queue message (test plan 29)');
select is_empty(format($$ select 1 from notifications.notifications where event_key like 'result_released:' || %L || ':%%' $$,
  :'result'), 'and no notification, outbox row or delivery');
drop trigger pgtap_explode on audit.events;

-- A committed release is always present
reset role;
select pg_temp.act_as(:'assessor');
select is(status, 'ok', 'the assessor finalises; the cohort is not moderated, so it is released')
from api.finalise_decision(:'nyc', 1);
reset role;
select is(pg_temp.queued(), 2::bigint, 'the committed release is on the queue');
select results_eq(
  format($$ select n.recipient_id, n.link, n.payload ->> 'item_title', (n.payload ->> 'appeal_deadline_at') is not null,
                   n.payload ? 'outcome'
            from notifications.notifications n where n.event_key like 'result_released:' || %L || ':%%' $$, :'result'),
  format($$ values (%L::uuid, '/learn/results/' || %L, 'Task 3: Workplace records portfolio'::text, true, false) $$,
    :'learner', :'result'),
  'the learner is told their result is ready, with the appeal closing day, and never the outcome');

-- A replay of the same event is harmless
select is(notifications.enqueue('result_released',
  (select event_key from notifications.notifications where event_key like 'result_released:' || :'result' || ':%'),
  :'learner', '{}'::jsonb, '/learn/results/x'), null, 'enqueueing the same event again records nothing');
select is(pg_temp.queued(), 2::bigint, 'and sends nothing');

-- The worker: claim, send, settle
select set_config('role', 'service_role', true);
select results_eq(
  $$ select attempt, event_type, address, recipient_name, length(idempotency_key)
     from api.claim_notification_deliveries(10, 120) order by event_type $$,
  $$ values (1, 'result_released'::text, 'learner@takusani.test'::text, 'Lerato Mokoena'::text, 64),
            (1, 'task_published', 'learner@takusani.test', 'Lerato Mokoena', 64) $$,
  'the worker claims both, with the address, the name and a 64-character idempotency key');
select is_empty($$ select * from api.claim_notification_deliveries(10, 120) $$,
  'a second worker running at the same time sees neither (the visibility timeout)');

reset role;
select d.id as task_delivery, q.msg_id as task_msg
from notifications.notification_deliveries d
join notifications.outbox_messages o on o.id = d.outbox_message_id
join pgmq.q_notification_delivery q on (q.message ->> 'delivery_id')::uuid = d.id
where o.event_type = 'task_published' \gset
select d.id as result_delivery, q.msg_id as result_msg
from notifications.notification_deliveries d
join notifications.outbox_messages o on o.id = d.outbox_message_id
join pgmq.q_notification_delivery q on (q.message ->> 'delivery_id')::uuid = d.id
where o.event_type = 'result_released' \gset

select set_config('role', 'service_role', true);
select is(status, 'ok', 'the worker records an accepted send')
from api.settle_notification_delivery(:'result_msg', :'result_delivery', 'accepted', 'resend', 'provider-123');
reset role;
select results_eq(
  format($$ select state, provider, provider_message_id, accepted_at is not null, attempts
            from notifications.notification_deliveries where id = %L $$, :'result_delivery'),
  $$ values ('accepted'::text, 'resend'::text, 'provider-123'::text, true, 1) $$,
  'the delivery is on record as accepted by the provider, with the time (NFR-11)');
select results_eq(
  format($$ select (select count(*) from pgmq.q_notification_delivery where msg_id = %s),
                   (select count(*) from pgmq.a_notification_delivery where msg_id = %s) $$, :'result_msg', :'result_msg'),
  $$ values (0::bigint, 1::bigint) $$, 'and its message is archived in the same transaction');
select set_config('role', 'service_role', true);
select is(status, 'already_settled', 'a duplicate run cannot record a second outcome')
from api.settle_notification_delivery(:'result_msg', :'result_delivery', 'failed', null, null, 'late duplicate');

-- A failed send is tried again, and a message read too often is retired as failed
select is(status, 'ok', 'a transient failure keeps it pending and shows it again at once')
from api.settle_notification_delivery(:'task_msg', :'task_delivery', 'retry', null, null, 'provider timed out', 0);
select results_eq($$ select attempt, event_type from api.claim_notification_deliveries(10, 120, 5) $$,
  $$ values (2, 'task_published'::text) $$, 'the next claim is its second attempt');
select is(status, 'ok', 'it fails again')
from api.settle_notification_delivery(:'task_msg', :'task_delivery', 'retry', null, null, 'provider timed out', 0);
select is_empty($$ select * from api.claim_notification_deliveries(10, 120, 2) $$,
  'past the attempt limit it is not handed out again');
reset role;
select results_eq(
  format($$ select state, failed_at is not null, last_error from notifications.notification_deliveries where id = %L $$,
    :'task_delivery'),
  $$ values ('failed'::text, true, 'provider timed out (gave up after 2 attempts)'::text) $$,
  'it is retired as failed by the queue''s read count, with the reason');
select is(pg_temp.queued(), 0::bigint, 'and the queue is empty');

-- Health, for the alert on the oldest undelivered row
select set_config('role', 'service_role', true);
select results_eq($$ select pending, oldest_pending_at, queue_length, failed_last_hour from api.notification_outbox_health() $$,
  $$ values (0, null::timestamptz, 0::bigint, 1) $$, 'health shows nothing pending, an empty queue and one failure');

-- Only the worker can call its functions
reset role;
select pg_temp.act_as(:'learner');
select throws_ok($$ select * from api.claim_notification_deliveries() $$, '42501', null,
  'a signed-in learner cannot claim deliveries');
select throws_ok($$ select * from api.notification_outbox_health() $$, '42501', null,
  'nor read the outbox health');

select * from finish();
rollback;
