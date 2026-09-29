-- Self-marked attendance, confirmed by the facilitator (FR-209, CR-03). Uses the local seed: facilitator@ sets work
-- in "2026 Intake B", where learner@ is enrolled; coordinator@ coordinates it; assessor@ does neither.
create extension if not exists pgtap with schema extensions;

begin;
select plan(38);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set cohort 10000000-0000-4000-8000-000000000010
\set second 00000000-0000-4000-8000-0000000000c2

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', :'second', 'authenticated', 'authenticated', 'second@takusani.test', now(), now());
insert into identity.profiles (id, full_name, learner_number) values (:'second', 'Bongani Dlamini', 'L-9002');
insert into programmes.enrolments (profile_id, cohort_id, status) values (:'second', :'cohort', 'active');
-- Only these two learners in the cohort, whatever else the local database holds.
update programmes.enrolments set status = 'withdrawn' where cohort_id = :'cohort' and profile_id not in (:'learner', :'second');

-- A session on now, one still to come, one long over, one that ended a moment ago, and one cancelled.
insert into learning.sessions (id, cohort_id, title, starts_at, duration_minutes, mode, venue, created_by) values
  ('50000000-0000-4000-8000-000000000001', :'cohort', 'Session 12: Filing', now() - interval '20 minutes', 90, 'in_person', 'Room 4', :'facilitator'),
  ('50000000-0000-4000-8000-000000000002', :'cohort', 'Session 13: Records', now() + interval '1 day', 90, 'in_person', 'Room 4', :'facilitator'),
  ('50000000-0000-4000-8000-000000000003', :'cohort', 'Session 10: Intro', now() - interval '3 days', 90, 'in_person', 'Room 4', :'facilitator'),
  ('50000000-0000-4000-8000-000000000004', :'cohort', 'Session 11: Retention', now() - interval '100 minutes', 90, 'in_person', 'Room 4', :'facilitator'),
  ('50000000-0000-4000-8000-000000000006', :'cohort', 'Session 9: Opens soon', now() + interval '15 minutes', 60, 'in_person', 'Room 4', :'facilitator');
insert into learning.sessions (id, cohort_id, title, starts_at, duration_minutes, mode, venue, created_by, state, cancel_reason) values
  ('50000000-0000-4000-8000-000000000005', :'cohort', 'Session 8', now() - interval '1 hour', 90, 'in_person', 'Room 4', :'facilitator', 'cancelled', 'Unwell.');
\set held 50000000-0000-4000-8000-000000000001
\set later 50000000-0000-4000-8000-000000000002
\set old 50000000-0000-4000-8000-000000000003
\set justended 50000000-0000-4000-8000-000000000004
\set cancelled 50000000-0000-4000-8000-000000000005
\set soon 50000000-0000-4000-8000-000000000006

-- ---------------------------------------------------------------------------------------------------------------
-- The check-in window
-- ---------------------------------------------------------------------------------------------------------------

select results_eq(format($$ select learning.checkin_state(s) from learning.sessions s where s.id in (%L, %L, %L, %L, %L, %L) order by s.title $$,
                         :'held', :'later', :'old', :'justended', :'cancelled', :'soon'),
  $$ values ('closed'::text), ('open'), ('open'), ('not_open'), ('cancelled'), ('not_open') $$,
  'check-in opens ten minutes before the start and closes thirty minutes after the end; a cancelled session has none');

-- ---------------------------------------------------------------------------------------------------------------
-- A learner marks themselves present
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status from api.mark_my_attendance(%L) $$, :'held'),
  $$ values ('not_found'::text) $$, 'only a learner enrolled in the cohort can check in');
reset role;

select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.mark_my_attendance(%L) $$, :'later'),
  $$ values ('not_open'::text) $$, 'not before the window opens');
select results_eq(format($$ select status from api.mark_my_attendance(%L) $$, :'old'),
  $$ values ('closed'::text) $$, 'not once it has closed');
select results_eq(format($$ select status from api.mark_my_attendance(%L) $$, :'cancelled'),
  $$ values ('session_cancelled'::text) $$, 'not at a cancelled session');
select results_eq(format($$ select status, checked_in_at is not null from api.mark_my_attendance(%L) $$, :'held'),
  $$ values ('ok'::text, true) $$, 'the learner checks in to a session that is on');
select results_eq(format($$ select status, checked_in_at is not null from api.mark_my_attendance(%L) $$, :'held'),
  $$ values ('already_marked'::text, true) $$, 'once: a second check-in says so and changes nothing');
select results_eq(format($$ select status from api.mark_my_attendance(%L) $$, :'justended'),
  $$ values ('ok'::text) $$, 'a late check-in within thirty minutes of the end still counts');
select results_eq(format($$ select checkin_state, checked_in_at is not null, attendance from api.list_my_sessions() where id = %L $$, :'held'),
  $$ values ('open'::text, true, null::text) $$, 'the learner''s sessions show the check-in and no mark yet');
select results_eq($$ select title, checkin_state, checked_in_at is not null, attendance from api.list_my_attendance() $$,
  $$ values ('Session 12: Filing'::text, 'open'::text, true, null::text), ('Session 11: Retention', 'open', true, null),
            ('Session 10: Intro', 'closed', false, null) $$,
  'the attendance record lists every session that has started, latest first, cancelled ones left out');
reset role;

select is((select count(*)::int from learning.attendance_checkins where session_id = :'held'), 1, 'one check-in is kept');
select results_eq(format($$ select acting_role, details ->> 'learner_id' from audit.events where action = 'learning.attendance_self_marked' and object_id = %L $$, :'held'),
  format($$ values ('learner'::text, %L::text) $$, :'learner'), 'and audited as the learner''s own act');
select throws_ok(format($$ delete from learning.attendance_checkins where session_id = %L $$, :'held'), '42501', null,
  'a check-in is never removed, even by the database owner');
select throws_ok(format($$ update learning.attendance_checkins set checked_in_at = now() where session_id = %L $$, :'held'), '42501', null,
  'nor changed');

-- ---------------------------------------------------------------------------------------------------------------
-- The facilitator confirms the register from the check-ins
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select learner_id::text, status, checked_in_at is not null from api.get_register(%L), jsonb_to_recordset(roster) as r(learner_id uuid, status text, checked_in_at timestamptz) order by 1 $$, :'held'),
  format($$ values (%L::text, null::text, true), (%L, null, false) $$, :'learner', :'second'),
  'the register shows who has checked in, before any mark');
select results_eq(format($$ select checkin_state, checked_in, present, absent, register_version from api.list_sessions() where id = %L $$, :'held'),
  $$ values ('open'::text, 1, 0, 0, 0) $$, 'the facilitator''s sessions count the check-ins as they happen');
select results_eq(format($$ select status, register_version, changed from api.save_register(%L,
                             '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "absent"}]'::jsonb, 0) $$, :'held'),
  $$ values ('ok'::text, 1, 2) $$, 'the facilitator confirms the register');
select results_eq(format($$ select checkin_state, checked_in, present, absent, register_version from api.list_sessions() where id = %L $$, :'held'),
  $$ values ('confirmed'::text, 1, 1, 1, 1) $$, 'and the counts follow');
reset role;
select results_eq(format($$ select learner_id::text, self_marked from learning.attendance_changes where session_id = %L order by 1 $$, :'held'),
  format($$ values (%L::text, true), (%L, false) $$, :'learner', :'second'),
  'the log says which confirmed marks came from the learner''s own check-in');
select is((select (details ->> 'self_marked')::int from audit.events where action = 'learning.register_captured' and object_id = :'held'), 1,
  'and the audit event counts them');

select pg_temp.act_as(:'second');
select results_eq(format($$ select status from api.mark_my_attendance(%L) $$, :'held'),
  $$ values ('already_confirmed'::text) $$, 'once the register is confirmed, a learner can no longer check in');
select results_eq(format($$ select checkin_state, checked_in_at, attendance, confirmed_at is not null from api.list_my_attendance() where session_id = %L $$, :'held'),
  $$ values ('confirmed'::text, null::timestamptz, 'absent'::text, true) $$, 'and sees the confirmed mark');
reset role;

-- An amendment after a late arrival is not a self-mark.
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.save_register(%L, jsonb_build_array(jsonb_build_object('learner_id', %L, 'status', 'present')), 1, 'Arrived late.') $$, :'held', :'second'),
  $$ values ('ok'::text) $$, 'the facilitator amends the register as before');
reset role;
select is((select self_marked from learning.attendance_changes where session_id = :'held' and learner_id = :'second' and kind = 'amended'), false,
  'an amendment is the facilitator''s mark, not the learner''s');

-- ---------------------------------------------------------------------------------------------------------------
-- The cohort's attendance
-- ---------------------------------------------------------------------------------------------------------------

-- An older session, confirmed with the learner absent, so the rates differ.
insert into learning.attendance (session_id, learner_id, status, marked_by, marked_at) values
  (:'old', :'learner', 'absent', :'facilitator', now()), (:'old', :'second', 'present', :'facilitator', now());
update learning.sessions set register_version = 1, register_captured_at = now(), register_captured_by = :'facilitator' where id = :'old';

select pg_temp.act_as(:'assessor');
select is_empty(format($$ select * from api.get_cohort_attendance(%L) $$, :'cohort'), 'someone who neither sets work nor coordinates sees no attendance');
select is_empty(format($$ select * from api.list_cohort_registers(%L) $$, :'cohort'), 'nor registers');
reset role;

select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select full_name, enrolled, sessions, present, absent, last_absent_at is not null from api.get_cohort_attendance(%L) $$, :'cohort'),
  $$ values ('Lerato Mokoena'::text, true, 2, 1, 1, true), ('Bongani Dlamini', true, 2, 2, 0, false) $$,
  'the facilitator sees each learner''s confirmed marks, lowest attendance first');
select results_eq(format($$ select title, register_version, checkin_state, checked_in, present, absent, confirmed_by_name from api.list_cohort_registers(%L) $$, :'cohort'),
  $$ values ('Session 12: Filing'::text, 2, 'confirmed'::text, 1, 2, 0, 'Pieter van Wyk'::text),
            ('Session 11: Retention', 0, 'open', 1, 0, 0, null),
            ('Session 10: Intro', 1, 'confirmed', 0, 1, 1, 'Pieter van Wyk') $$,
  'and every session that has started with its register''s state, latest first; a cancelled one is not a register');
reset role;

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select full_name, sessions, present from api.get_cohort_attendance(%L) $$, :'cohort'),
  $$ values ('Lerato Mokoena'::text, 2, 1), ('Bongani Dlamini', 2, 2) $$, 'the coordinator sees the same');
select results_eq(format($$ select count(*)::int from api.list_cohort_registers(%L) $$, :'cohort'),
  $$ values (3) $$, 'registers included');
reset role;

-- A learner who leaves keeps their marks; one who never had a mark and left is gone.
update programmes.enrolments set status = 'withdrawn' where profile_id = :'second' and cohort_id = :'cohort';
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select full_name, enrolled, sessions from api.get_cohort_attendance(%L) where full_name = 'Bongani Dlamini' $$, :'cohort'),
  $$ values ('Bongani Dlamini'::text, false, 2) $$, 'a learner who left stays on the cohort''s attendance with their marks');
reset role;

-- A confirmation locks against a check-in: the facilitator's lock is exclusive, so it cannot interleave.
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.mark_my_attendance(%L) $$, :'soon'),
  $$ values ('not_open'::text) $$, 'fifteen minutes before the start is too early');
reset role;
update learning.sessions set starts_at = now() + interval '9 minutes' where id = :'soon';
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.mark_my_attendance(%L) $$, :'soon'),
  $$ values ('ok'::text) $$, 'nine minutes before is within the window');
select results_eq(format($$ select checkin_state, checked_in_at is not null from api.list_my_sessions() where id = %L $$, :'soon'),
  $$ values ('open'::text, true) $$, 'and the upcoming session shows it');
reset role;

-- The register cannot be confirmed before the start even when a learner has checked in early.
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}]'::jsonb, 0) $$, :'soon'),
  $$ values ('not_started'::text) $$, 'a register is confirmed once the session has started');
reset role;

-- Privileges: the check-in table and the helpers are reachable only through the api functions.
select table_privs_are('learning', 'attendance_checkins', 'authenticated', array[]::text[], 'authenticated has no privilege on check-ins');
select function_privs_are('learning', 'checkin_state', array['learning.sessions'], 'authenticated', array[]::text[], 'nor on the window helper');
select function_privs_are('learning', 'may_read_cohort_attendance', array['uuid', 'uuid'], 'authenticated', array[]::text[], 'nor on the scope helper');

select * from finish();
rollback;
