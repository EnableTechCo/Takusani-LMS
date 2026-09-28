-- Account administration (S3-08; FR-103, FR-105, FR-106, FR-107). Uses the local seed: the learner, facilitator@,
-- assessor@, coordinator@ and admin@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(25);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- The learner hands in a version and assessor@ finalises it "not yet competent" (released at once). Returns the
-- result. Runs as postgres, then leaves the caller as postgres.
create function pg_temp.released_result() returns uuid language plpgsql as $$
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

  select i.id, r.id into v_instance, v_result from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  where r.learner_id = v_learner and i.state = 'to_mark';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_assessor, 'role', 'authenticated')::text, true);
  perform api.take_marking(v_instance);
  perform api.save_marking_draft(v_instance, 0,
    '[{"ordinal": 1, "points": 9, "comment": ""}, {"ordinal": 2, "points": 2, "comment": ""}]'::jsonb,
    'The retention schedule is missing.', 'not_yet_competent', 'Judged against every criterion.',
    'Add the retention schedule.', 14);
  perform api.finalise_decision(v_instance, 1);
  perform set_config('role', 'postgres', true);
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set admin 00000000-0000-4000-8000-000000000006

-- Editing details (FR-103, FR-107)
select pg_temp.act_as(:'coordinator');
select is(status, 'forbidden', 'only an administrator edits an account') from api.update_account(:'learner', 'Lerato M.');
reset role;
select pg_temp.act_as(:'admin');
select is(status, 'invalid_name', 'a name is required') from api.update_account(:'learner', '  ');
select is(status, 'learner_number_taken', 'a learner number already in use is refused')
from api.update_account(:'facilitator', 'Pieter van Wyk', 'KSI-2026-0417');
select is(status, 'ok', 'the administrator corrects the learner''s name')
from api.update_account(:'learner', 'Lerato Mokoena-Dube', 'KSI-2026-0417');
reset role;
select results_eq(
  format($$ select before ->> 'full_name', after ->> 'full_name' from audit.events
            where action = 'identity.account_updated' and object_id = %L $$, :'learner'),
  $$ values ('Lerato Mokoena'::text, 'Lerato Mokoena-Dube'::text) $$, 'the change is audited with the previous value');

-- Deactivating
select pg_temp.act_as(:'admin');
select is(status, 'cannot_deactivate_self', 'an administrator cannot deactivate their own account')
from api.deactivate_account(:'admin');
select is(status, 'ok', 'an account with no open work is deactivated') from api.deactivate_account(:'facilitator', 'Left the institution.');
reset role;
select results_eq(
  format($$ select status, deactivated_at is not null from identity.profiles where id = %L $$, :'facilitator'),
  $$ values ('deactivated'::text, true) $$, 'the account is deactivated, with the time');
select results_eq(
  format($$ select before ->> 'status', after ->> 'status', details ->> 'reason' from audit.events
            where action = 'identity.account_deactivated' and object_id = %L $$, :'facilitator'),
  $$ values ('active'::text, 'deactivated'::text, 'Left the institution.'::text) $$, 'and audited with the reason');

-- Deactivation blocks the existing session at once: every API request but my_access is refused
select pg_temp.act_as(:'facilitator');
select set_config('request.path', '/rpc/list_my_tasks', true);
select throws_ok('select api.check_request()', '42501', 'This account is deactivated.',
  'a deactivated account''s request is refused before it runs');
select set_config('request.path', '/rpc/my_access', true);
select lives_ok('select api.check_request()', 'except my_access, so the application can sign them out');
select is(status, 'deactivated', 'which reports the account as deactivated') from api.my_access();
reset role;
select pg_temp.act_as(:'learner');
select set_config('request.path', '/rpc/list_my_tasks', true);
select lives_ok('select api.check_request()', 'an active account''s requests go through');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select lives_ok('select api.check_request()', 'and so do requests from someone not signed in');
reset role;
select is((select setting from pg_roles r, unnest(r.rolconfig) setting where r.rolname = 'authenticator'
           and setting like 'pgrst.db_pre_request=%'),
  'pgrst.db_pre_request=api.check_request', 'the API runs the check before every request');

-- Reactivation
select pg_temp.act_as(:'admin');
select is(status, 'already_deactivated', 'deactivating twice changes nothing') from api.deactivate_account(:'facilitator');
select is(status, 'ok', 'the administrator reactivates the account') from api.reactivate_account(:'facilitator');
select is(status, 'already_active', 'reactivating twice changes nothing') from api.reactivate_account(:'facilitator');
reset role;
select results_eq(
  format($$ select status, deactivated_at from identity.profiles where id = %L $$, :'facilitator'),
  $$ values ('active'::text, null::timestamptz) $$, 'the account is active again');

-- FR-105: an account holding open work is not deactivated, and the work is named
reset role;
select pg_temp.released_result() as result \gset
insert into assessment.assessment_instances (result_id, state, assessor_id) values (:'result', 'marking', :'assessor');
select pg_temp.act_as(:'admin');
select results_eq(
  format($$ select status, allocations -> 0 ->> 'kind', allocations -> 0 ->> 'cohort_name', (allocations -> 0 ->> 'items')::int
            from api.deactivate_account(%L) $$, :'assessor'),
  $$ values ('open_allocations'::text, 'marking'::text, '2026 Intake B'::text, 1) $$,
  'an account holding open work is not deactivated, and the work is named');
reset role;
select results_eq(
  format($$ select (select status from identity.profiles where id = %L),
                   (select count(*)::int from audit.events where action = 'identity.deactivation_refused' and object_id = %L) $$,
         :'assessor', :'assessor'),
  $$ values ('active'::text, 1) $$, 'the account stays active, and the refusal is recorded');
select pg_temp.act_as(:'admin');

-- A password reset (FR-106): recorded and the person told
select results_eq(
  format($$ select status, email from api.record_password_reset(%L) $$, :'learner'),
  $$ values ('ok'::text, 'learner@takusani.test'::text) $$, 'the administrator sends a password reset');
reset role;
select results_eq(
  format($$ select (select count(*)::int from audit.events where action = 'identity.password_reset_sent' and object_id = %L),
                   (select count(*)::int from notifications.notifications where recipient_id = %L and event_type = 'password_reset_sent') $$,
         :'learner', :'learner'),
  $$ values (1, 1) $$, 'it is audited and the person is told');
select pg_temp.act_as(:'coordinator');
select is(status, 'forbidden', 'only an administrator sends one') from api.record_password_reset(:'learner');

select ok((select bool_and(has_function_privilege(r.rolname, 'api.check_request()', 'execute'))
           from pg_auth_members m join pg_roles r on r.oid = m.roleid
           where m.member = 'authenticator'::regrole and r.rolname in ('anon', 'authenticated', 'service_role')),
  'every role the API switches to can run the check, including server calls with the secret key');

select * from finish();
rollback;
