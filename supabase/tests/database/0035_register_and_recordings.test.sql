-- Attendance register and lecture recordings (S3-12; FR-208, FR-209). Uses the local seed: facilitator@ sets work in
-- "2026 Intake B", where learner@ is enrolled; assessor@ does not set work there.
create extension if not exists pgtap with schema extensions;

begin;
select plan(41);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set cohort 10000000-0000-4000-8000-000000000010
\set second 00000000-0000-4000-8000-0000000000c2
\set third 00000000-0000-4000-8000-0000000000c3

-- Two more learners in the cohort.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', :'second', 'authenticated', 'authenticated', 'second@takusani.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', :'third', 'authenticated', 'authenticated', 'third@takusani.test', now(), now());
insert into identity.profiles (id, full_name, learner_number) values
  (:'second', 'Bongani Dlamini', 'L-9002'), (:'third', 'Ayanda Zulu', 'L-9003');
insert into programmes.enrolments (profile_id, cohort_id, status) values (:'second', :'cohort', 'active'), (:'third', :'cohort', 'active');

-- A session that has started, one still to come, and one cancelled.
insert into learning.sessions (id, cohort_id, title, starts_at, duration_minutes, mode, venue, created_by) values
  ('50000000-0000-4000-8000-000000000001', :'cohort', 'Session 12: Filing', now() - interval '1 hour', 90, 'in_person', 'Room 4', :'facilitator'),
  ('50000000-0000-4000-8000-000000000002', :'cohort', 'Session 13: Records', now() + interval '1 day', 90, 'in_person', 'Room 4', :'facilitator');
insert into learning.sessions (id, cohort_id, title, starts_at, duration_minutes, mode, venue, created_by, state, cancel_reason) values
  ('50000000-0000-4000-8000-000000000003', :'cohort', 'Session 11', now() - interval '1 day', 90, 'in_person', 'Room 4', :'facilitator', 'cancelled', 'Unwell.');
\set held 50000000-0000-4000-8000-000000000001
\set later 50000000-0000-4000-8000-000000000002
\set cancelled 50000000-0000-4000-8000-000000000003

-- ---------------------------------------------------------------------------------------------------------------
-- Capturing the register
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c3", "status": "present"}]'::jsonb, 0) $$, :'held'),
  $$ values ('not_found'::text) $$, 'only someone who sets work in the cohort takes its register');
select is_empty(format($$ select * from api.get_register(%L) $$, :'held'), 'or reads it');
reset role;

select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select learner_id::text, status from api.get_register(%L), jsonb_to_recordset(roster) as r(learner_id uuid, status text) order by 1 $$, :'held'),
  format($$ values (%L::text, null::text), (%L, null), (%L, null) $$, :'learner', :'second', :'third'),
  'the roster is the cohort''s active learners, not yet marked');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c3", "status": "present"}]'::jsonb, 0) $$, :'later'),
  $$ values ('not_started'::text) $$, 'a register is taken once the session has started');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c3", "status": "present"}]'::jsonb, 0) $$, :'cancelled'),
  $$ values ('session_cancelled'::text) $$, 'a cancelled session has no register');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "absent"}]'::jsonb, 0) $$, :'held'),
  $$ values ('incomplete'::text) $$, 'the first save must mark everyone on the roster');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "late"}]'::jsonb, 0) $$, :'held'),
  $$ values ('invalid_marks'::text) $$, 'a mark is present or absent');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c3", "status": "present"}]'::jsonb
                                   || jsonb_build_array(jsonb_build_object('learner_id', %L, 'status', 'present')), 0) $$, :'held', :'learner'),
  $$ values ('invalid_marks'::text) $$, 'each learner once');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c3", "status": "present"}]'::jsonb
                                   || jsonb_build_array(jsonb_build_object('learner_id', %L, 'status', 'present')), 0) $$, :'held', :'assessor'),
  $$ values ('not_on_roster'::text) $$, 'and only learners on the roster');
reset role;
select is((select register_version from learning.sessions where id = :'held'), 0, 'nothing was written by a refused save');
select pg_temp.act_as(:'facilitator');

select results_eq(format($$ select status, register_version, changed from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "absent"}, {"learner_id": "00000000-0000-4000-8000-0000000000c3", "status": "present"}]'::jsonb, 0) $$, :'held'),
  $$ values ('ok'::text, 1, 3) $$, 'the register is captured');
select results_eq(format($$ select learner_id::text, status from api.get_register(%L), jsonb_to_recordset(roster) as r(learner_id uuid, status text) order by 1 $$, :'held'),
  format($$ values (%L::text, 'present'::text), (%L, 'absent'), (%L, 'present') $$, :'learner', :'second', :'third'),
  'with each learner''s mark');
select results_eq(format($$ select captured_by_name, jsonb_array_length(amendments) from api.get_register(%L) $$, :'held'),
  $$ values ('Pieter van Wyk'::text, 0) $$, 'saying who captured it, with no amendments yet');
reset role;
select results_eq(format($$ select kind, previous_status, reason from learning.attendance_changes where session_id = %L and learner_id = %L $$, :'held', :'second'),
  $$ values ('captured'::text, null::text, null::text) $$, 'the capture is in the log');
select is((select (details ->> 'absent')::int from audit.events where action = 'learning.register_captured' and object_id = :'held'), 1,
  'and audited with the counts');

-- ---------------------------------------------------------------------------------------------------------------
-- Amending it
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c3", "status": "present"}]'::jsonb, 0) $$, :'held'),
  $$ values ('stale'::text) $$, 'a save from an old copy of the register is refused');
select results_eq(format($$ select status from api.save_register(%L, jsonb_build_array(jsonb_build_object('learner_id', %L, 'status', 'present')), 1) $$, :'held', :'second'),
  $$ values ('reason_required'::text) $$, 'an amendment needs its reason');
select results_eq(format($$ select status from api.save_register(%L, jsonb_build_array(jsonb_build_object('learner_id', %L, 'status', 'present')), 1, %L) $$,
                         :'held', :'second', repeat('x', 501)),
  $$ values ('reason_too_long'::text) $$, 'of up to 500 characters');
select results_eq(format($$ select status, changed from api.save_register(%L, '[{"learner_id": "00000000-0000-4000-8000-000000000001", "status": "present"}, {"learner_id": "00000000-0000-4000-8000-0000000000c2", "status": "absent"}, {"learner_id": "00000000-0000-4000-8000-0000000000c3", "status": "present"}]'::jsonb, 1, 'Same again.') $$, :'held'),
  $$ values ('unchanged'::text, 0) $$, 'saving the same marks changes nothing');
select results_eq(format($$ select status, register_version, changed from api.save_register(%L,
                             jsonb_build_array(jsonb_build_object('learner_id', %L, 'status', 'present')), 1, 'Arrived late; signed the paper register.') $$,
                         :'held', :'second'),
  $$ values ('ok'::text, 2, 1) $$, 'only the changed mark is amended');
select results_eq(format($$ select a.learner_name, a.previous_status, a.status, a.reason, a.changed_by_name, a.register_version
                            from api.get_register(%L), jsonb_to_recordset(amendments)
                            as a(learner_name text, previous_status text, status text, reason text, changed_by_name text, register_version int) $$, :'held'),
  $$ values ('Bongani Dlamini'::text, 'absent'::text, 'present'::text, 'Arrived late; signed the paper register.'::text, 'Pieter van Wyk'::text, 2) $$,
  'the amendment is logged with the mark it replaced, the reason and who made it');
reset role;
select results_eq(format($$ select before -> 0 ->> 'status', after -> 0 ->> 'status', details ->> 'reason' from audit.events
                            where action = 'learning.register_amended' and object_id = %L $$, :'held'),
  $$ values ('absent'::text, 'present'::text, 'Arrived late; signed the paper register.'::text) $$, 'and audited with before and after');
select throws_ok($$ update learning.attendance_changes set reason = 'edited' $$, '42501', null,
  'the log cannot be edited, even by the database owner');

-- A learner who leaves stays on the register with their mark; one who joins can be added with a reason.
update programmes.enrolments set status = 'withdrawn' where profile_id = :'third' and cohort_id = :'cohort';
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000c4', 'authenticated', 'authenticated', 'fourth@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values ('00000000-0000-4000-8000-0000000000c4', 'Zanele Khumalo');
insert into programmes.enrolments (profile_id, cohort_id, status) values ('00000000-0000-4000-8000-0000000000c4', :'cohort', 'active');
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select full_name, enrolled, status from api.get_register(%L),
                            jsonb_to_recordset(roster) as r(full_name text, enrolled boolean, status text) order by full_name $$, :'held'),
  $$ values ('Ayanda Zulu'::text, false, 'present'::text), ('Bongani Dlamini', true, 'present'),
            ('Lerato Mokoena', true, 'present'), ('Zanele Khumalo', true, null) $$,
  'a learner who left keeps their mark; one who joined is on the roster unmarked');
select results_eq(format($$ select status from api.save_register(%L,
                             '[{"learner_id": "00000000-0000-4000-8000-0000000000c4", "status": "absent"}]'::jsonb, 2, 'Enrolled after the session.') $$, :'held'),
  $$ values ('ok'::text) $$, 'and can be added to the register as an amendment');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Recordings
-- ---------------------------------------------------------------------------------------------------------------

select results_eq($$ select file_size_limit, allowed_mime_types from storage.buckets where id = 'recordings' $$,
  $$ values (52428800::bigint, array['video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4']) $$,
  'recordings have their own private bucket for video and audio, at the storage limit');
select results_eq($$ select value, in_use from audit.configuration_versions v join audit.configuration_keys k using (key) where key = 'recording.max_mb' $$,
  $$ values ('50'::jsonb, true) $$, 'the largest recording is a versioned setting');

select pg_temp.act_as(:'facilitator');
select material_id as rec from api.create_recording(:'cohort', 'Session 12 recording', 'Filing, part 1.') \gset
select material_id as doc from api.create_material(:'cohort', 'Filing checklist') \gset
select results_eq(format($$ select id::text, category, has_captions from api.list_materials() where id in (%L, %L) order by title $$, :'doc', :'rec'),
  format($$ values (%L::text, 'material'::text, false), (%L, 'recording', false) $$, :'doc', :'rec'),
  'a recording is a material of its own category');

select results_eq(format($$ select status, bucket, max_bytes from api.authorise_upload('material', %L, 'lecture.mp4', 'video/mp4', 40000000) $$, :'rec'),
  $$ values ('ok'::text, 'recordings'::text, 52428800::bigint) $$, 'a recording''s upload goes to the recordings bucket, within its limit');
select results_eq(format($$ select status from api.authorise_upload('material', %L, 'lecture.mp4', 'video/mp4', 60000000) $$, :'rec'),
  $$ values ('too_large'::text) $$, 'and no larger');
select results_eq(format($$ select status from api.authorise_upload('material', %L, 'lecture.pdf', 'application/pdf', 1000) $$, :'rec'),
  $$ values ('type_not_allowed'::text) $$, 'video and audio only');
select results_eq(format($$ select status, bucket from api.authorise_upload('material', %L, 'checklist.pdf', 'application/pdf', 1000) $$, :'doc'),
  $$ values ('ok'::text, 'materials'::text) $$, 'other material still goes to the materials bucket');
select results_eq(format($$ select status from api.authorise_upload('material', %L, 'lecture.mp4', 'video/mp4', 1000) $$, :'doc'),
  $$ values ('type_not_allowed'::text) $$, 'which takes no video');

reset role;
insert into audit.configuration_versions (key, version, value, previous_value, effective_from, reason)
values ('recording.max_mb', 2, '20', '50', now() - interval '1 second', 'Test.');
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status, max_bytes from api.authorise_upload('material', %L, 'lecture.mp4', 'video/mp4', 30000000) $$, :'rec'),
  $$ values ('too_large'::text, 20971520::bigint) $$, 'the configured limit applies');
select is((select recording_max_mb from api.public_settings()), 20, 'and every signed-in page can read it');

select results_eq(format($$ select status from api.set_recording_captions(%L, true) $$, :'rec'),
  $$ values ('ok'::text) $$, 'the facilitator records that captions are available');
select results_eq(format($$ select status from api.set_recording_captions(%L, true) $$, :'doc'),
  $$ values ('not_a_recording'::text) $$, 'only for a recording');
select results_eq(format($$ select status from api.update_material(%L, 'Session 12 recording', 'Filing, part 1.', null, 'https://teams.microsoft.com/l/meetup-join/x') $$, :'rec'),
  $$ values ('ok'::text) $$, 'a link is the preferred way to add a recording');
select results_eq(format($$ select status from api.publish_material(%L) $$, :'rec'), $$ values ('ok'::text) $$, 'and it is published like any material');
reset role;

select pg_temp.act_as(:'learner');
select results_eq(format($$ select category, has_captions, kind from api.list_my_materials() where id = %L $$, :'rec'),
  $$ values ('recording'::text, true, 'link'::text) $$, 'learners find it in the material library as a recording, with its captions');
select results_eq(format($$ select category, has_captions from api.get_my_material(%L) $$, :'rec'),
  $$ values ('recording'::text, true) $$, 'and on its own page');
reset role;

select * from finish();
rollback;
