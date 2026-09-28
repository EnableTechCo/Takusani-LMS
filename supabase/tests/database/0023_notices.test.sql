-- Coordinator notices (S2-17, FR-703). Uses the local seed: coordinator@ (institution-wide), learner@ in
-- "2026 Intake B", assessor@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(27);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set local_coordinator 00000000-0000-4000-8000-0000000000f1
\set cohort 10000000-0000-4000-8000-000000000010
\set programme 10000000-0000-4000-8000-000000000001

-- A coordinator of one programme only
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :'local_coordinator', 'authenticated', 'authenticated',
        'programme.coordinator@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values (:'local_coordinator', 'Programme Coordinator');
insert into identity.role_assignments (profile_id, role, scope_type, scope_key)
values (:'local_coordinator', 'coordinator', 'programme', :'programme');

select ok(pg_extension.extname = 'pg_cron', 'the scheduler is installed') from pg_extension where extname = 'pg_cron';
select results_eq($$ select schedule, command from cron.job where jobname = 'release-scheduled-notices' $$,
  $$ values ('* * * * *'::text, 'select notifications.release_due_notices()'::text) $$,
  'scheduled notices are released by a database job every minute');

-- Who may send
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.create_notice('Hello', 'Body', 'cohort', %L) $$, :'cohort'),
  $$ values ('forbidden'::text) $$, 'a learner cannot send a notice');
reset role;
select pg_temp.act_as(:'local_coordinator');
select results_eq($$ select status from api.create_notice('Hello', 'Body', 'everyone') $$,
  $$ values ('forbidden'::text) $$, 'a programme coordinator cannot message everyone');
select results_eq($$ select status from api.create_notice('Hello', 'Body', 'role', null, 'assessor') $$,
  $$ values ('forbidden'::text) $$, 'nor a role group');
select results_eq(format($$ select status, recipients, scheduled from api.create_notice('Venue change',
    'We have moved to Training Room 2.', 'cohort', %L) $$, :'cohort'),
  $$ values ('ok'::text, 1, false) $$, 'but can message a cohort in their programme, now: its one learner is told');

-- Refusals
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq($$ select status from api.create_notice('  ', 'Body', 'everyone') $$, $$ values ('invalid_title'::text) $$,
  'a notice needs a title');
select results_eq($$ select status from api.create_notice('Title', '', 'everyone') $$, $$ values ('invalid_body'::text) $$,
  'and a message');
select results_eq($$ select status from api.create_notice('Title', 'Body', 'role', null, 'wizard') $$,
  $$ values ('invalid_role'::text) $$, 'a role group must be a real role');
select results_eq($$ select status from api.create_notice('Title', 'Body', 'everyone', null, null, now() - interval '1 day') $$,
  $$ values ('send_in_past'::text) $$, 'a notice cannot be scheduled in the past');

-- Everyone, and a role group
reset role;
select (count(*) - 1)::integer as everyone from identity.profiles where status = 'active' \gset
select count(distinct ra.profile_id)::integer as assessors from identity.role_assignments ra
join identity.profiles p on p.id = ra.profile_id
where ra.role = 'assessor' and ra.effective @> now() and p.status = 'active' and p.id <> :'coordinator' \gset
select pg_temp.act_as(:'coordinator');
select results_eq(
  $$ select recipients from api.create_notice('Closed on Friday', 'The office is closed on Friday for maintenance.', 'everyone') $$,
  format($$ values (%s) $$, :'everyone'),
  'everyone means every active account except the sender');
select results_eq($$ select recipients from api.create_notice('Marking week', 'Marking opens on Monday.', 'role', null, 'assessor') $$,
  format($$ values (%s) $$, :'assessors'), 'a role group reaches everyone holding the role');
reset role;
select is((select count(*)::int from notifications.notifications where recipient_id = :'coordinator' and event_type = 'notice'), 0,
  'the sender is never among the recipients');

-- Scheduling: released by the job once its time has come, once
select pg_temp.act_as(:'coordinator');
select notice_id as later, recipients as expected from api.create_notice('Session 16 moved',
  'Session 16 is now on Thursday.', 'cohort', :'cohort', null, now() + interval '1 hour') \gset
select is(:'expected'::integer, 1, 'a scheduled notice says how many it will reach');
reset role;
select is(notifications.release_due_notices(), 0, 'nothing is released before its time');
select is((select count(*)::int from notifications.notifications where event_key = 'notice:' || :'later'), 0,
  'and nobody has it yet');
update notifications.notices set send_at = now() - interval '1 second' where id = :'later';
select is(notifications.release_due_notices(), 1, 'the job releases it once its time has come');
select results_eq(format($$ select state, recipients, sent_at is not null from notifications.notices where id = %L $$, :'later'),
  $$ values ('sent'::text, 1, true) $$, 'and it is marked sent with its count');
select is(notifications.release_due_notices(), 0, 'running the job again sends nothing twice');

-- Cancelling a scheduled notice
select pg_temp.act_as(:'coordinator');
select notice_id as cancelme from api.create_notice('Draft', 'Not yet.', 'everyone', null, null, now() + interval '2 days') \gset
select results_eq(format($$ select status from api.cancel_notice(%L) $$, :'cancelme'), $$ values ('ok'::text) $$,
  'a scheduled notice can be cancelled');
select results_eq(format($$ select status from api.cancel_notice(%L) $$, :'later'), $$ values ('already_sent'::text) $$,
  'a sent one cannot');
reset role;
update notifications.notices set send_at = now() - interval '1 second' where id = :'cancelme';
select is(notifications.release_due_notices(), 0, 'a cancelled notice is never released');

-- The delivery log (FR-703)
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select recipient_name, read_at from api.list_notice_deliveries(%L) $$, :'later'),
  $$ values ('Lerato Mokoena'::text, null::timestamptz) $$, 'the log names each recipient, not yet read');
reset role;
select pg_temp.act_as(:'learner');
select ok((select status = 'ok' from api.open_my_notification(
  (select id from api.list_my_notifications('notices') where (payload ->> 'notice_id') = :'later'))),
  'the learner opens it from their notifications');
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select read_at is not null from api.list_notice_deliveries(%L) $$, :'later'),
  $$ values (true) $$, 'and the log shows it read');
select results_eq(format($$ select read_count from api.list_notices() where id = %L $$, :'later'),
  $$ values (1) $$, 'the notices list counts it read');

-- Nobody else reads the log
reset role;
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_notices() $$, 'a learner sees no notices list');

select * from finish();
rollback;
