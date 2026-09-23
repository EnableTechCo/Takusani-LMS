-- The notification centre (S2-11, NFR-11): each person reads only their own notifications, with the delivery
-- evidence, and read state is theirs to change. Uses the local seed: "2026 Intake B" with learner@ enrolled.
create extension if not exists pgtap with schema extensions;

begin;
select plan(26);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- The learner hands in Task 3 and the assessor finalises it: the result is released and the learner told.
create function pg_temp.release_result() returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_learner uuid := '00000000-0000-4000-8000-000000000001';
  v_assessor uuid := '00000000-0000-4000-8000-000000000003';
  v_intent uuid;
  v_file uuid;
  v_key text := v_task::text || '/' || v_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  v_instance uuid;
  v_result uuid;
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

  select i.id, i.result_id into v_instance, v_result from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  where r.learner_id = v_learner and i.state = 'to_mark';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_assessor, 'role', 'authenticated')::text, true);
  perform api.take_marking(v_instance);
  perform api.save_marking_draft(v_instance, 0, '[]'::jsonb, 'Feedback.', 'competent', 'Judged.');
  perform api.finalise_decision(v_instance, 1);
  perform set_config('role', 'postgres', true);
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set cohort 10000000-0000-4000-8000-000000000010

-- A task published (email off), then a result released, then a task published with email on
reset role;
select pg_temp.act_as(:'facilitator');
select task_id as task from api.create_task(:'cohort', 'pgTAP Centre Task', 'Write it up.', 'file_upload',
  now() + interval '10 days') \gset
select is(status, 'ok', 'a task is published while email is off') from api.publish_task(:'task');
reset role;
update notifications.notifications set created_at = now() - interval '2 hours'
where event_key = 'task_published:' || :'task';
select pg_temp.release_result() as result \gset
update notifications.notifications set created_at = now() - interval '1 hour'
where event_key like 'result_released:' || :'result' || ':%';
update notifications.settings set email_enabled = true;
select pg_temp.act_as(:'facilitator');
select task_id as emailed_task from api.create_task(:'cohort', 'pgTAP Emailed Task', 'Write it up.', 'file_upload',
  now() + interval '10 days') \gset
select is(status, 'ok', 'another is published with email on') from api.publish_task(:'emailed_task');

-- The learner's list: newest first, with counts for the whole list
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  $$ select event_type, payload ->> 'title', total_count, unread_count, template_version
     from api.list_my_notifications() $$,
  $$ values ('task_published'::text, 'pgTAP Emailed Task'::text, 3, 3, 1),
            ('result_released', null, 3, 3, 1),
            ('task_published', 'pgTAP Centre Task', 3, 3, 1) $$,
  'the learner sees their three notifications, newest first, all unread');
select is(api.my_unread_notification_count(), 3, 'the bell counts three unread');

-- Delivery evidence (NFR-11)
select results_eq(
  $$ select email ->> 'state', email ->> 'address', (email ->> 'created_at') is not null
     from api.list_my_notifications() where payload ->> 'title' = 'pgTAP Emailed Task' $$,
  $$ values ('pending'::text, null::text, true) $$,
  'an email waiting to be sent shows as pending');
select results_eq(
  $$ select email from api.list_my_notifications() where payload ->> 'title' = 'pgTAP Centre Task' $$,
  $$ values (null::jsonb) $$, 'with email off there is no email evidence, only the LMS record');
select results_eq(
  $$ select first_opened_at from api.list_my_notifications() where event_type = 'result_released' $$,
  $$ values (null::timestamptz) $$, 'a result not yet opened says so');
select ok((select count(*) = 1 from api.get_my_result(:'result')), 'the learner opens the result');
select results_eq(
  $$ select first_opened_at is not null from api.list_my_notifications() where event_type = 'result_released' $$,
  $$ values (true) $$, 'and the notification now shows when they first opened it');

-- Filters and pages
select results_eq($$ select count(*)::int, max(total_count) from api.list_my_notifications('results') $$,
  $$ values (1, 1) $$, 'Results shows the result only');
select results_eq($$ select count(*)::int, max(total_count) from api.list_my_notifications('deadlines') $$,
  $$ values (2, 2) $$, 'Deadlines shows the two new tasks');
select results_eq($$ select event_type, total_count from api.list_my_notifications('all', 2, 1) $$,
  $$ values ('result_released'::text, 3) $$, 'page 2 of 1 per page is the second newest, with the full count');
select is_empty($$ select * from api.list_my_notifications('all', 4, 1) $$, 'past the last page there is nothing');

-- Opening one marks it read, once, and says where it points
select id as result_note, link as result_link from api.list_my_notifications('results') \gset
select results_eq(format($$ select status, link from api.open_my_notification(%L) $$, :'result_note'),
  format($$ values ('ok'::text, %L::text) $$, :'result_link'), 'opening a notification returns its link');
select read_at as first_read from api.list_my_notifications('results') \gset
select isnt(:'first_read'::timestamptz, null::timestamptz, 'and marks it read');
select ok((select status = 'ok' from api.open_my_notification(:'result_note')), 'it can be opened again');
select results_eq($$ select read_at from api.list_my_notifications('results') $$,
  format($$ values (%L::timestamptz) $$, :'first_read'), 'opening it again keeps the first read time');
select is(api.my_unread_notification_count(), 2, 'two remain unread');

-- Nobody reads or opens anyone else's
reset role;
select pg_temp.act_as(:'assessor');
select is_empty($$ select * from api.list_my_notifications() $$, 'the assessor has none of the learner''s');
select results_eq(format($$ select status from api.open_my_notification(%L) $$, :'result_note'),
  $$ values ('not_found'::text) $$, 'and cannot open one');
select results_eq($$ select status, marked from api.mark_my_notifications_read() $$,
  $$ values ('ok'::text, 0) $$, 'marking all read touches only their own (none)');

-- Mark all as read, by category
reset role;
select pg_temp.act_as(:'learner');
select results_eq($$ select status, marked from api.mark_my_notifications_read('deadlines') $$,
  $$ values ('ok'::text, 2) $$, 'marking the Deadlines read marks the two tasks');
select is(api.my_unread_notification_count(), 0, 'nothing is unread');
select results_eq($$ select marked from api.mark_my_notifications_read() $$, $$ values (0) $$,
  'marking all read again changes nothing');

-- Signed out: nothing
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select is_empty($$ select * from api.list_my_notifications() $$, 'someone not signed in sees nothing');
select results_eq($$ select status from api.mark_my_notifications_read() $$, $$ values ('unauthenticated'::text) $$,
  'and cannot mark anything read');

select * from finish();
rollback;
