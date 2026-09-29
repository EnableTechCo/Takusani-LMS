-- Programme reports and exports (S6-04; FR-708; R-20). Uses the local seed: Ayesha (coordinator@) coordinates
-- "2026 Intake B" of the CBA-NQF4 programme; Lerato (learner@) is enrolled; Nomsa (assessor@) assesses; Zanele
-- (staff@) is on the staff.
create extension if not exists pgtap with schema extensions;

begin;
select plan(35);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set naledi 00000000-0000-4000-8000-000000000102
\set programme 10000000-0000-4000-8000-000000000001
\set cohort 10000000-0000-4000-8000-000000000010
\set task 10000000-0000-4000-8000-000000000020

update programmes.cohort_moderation_state set moderation_policy = 'not_moderated' where cohort_id = :'cohort';
-- Only these two learners in the cohort, whatever the local database holds.
update programmes.enrolments set status = 'withdrawn' where cohort_id = :'cohort' and profile_id <> :'learner';
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :'naledi', 'authenticated', 'authenticated', 'pgtap.reports@takusani.test', now(), now())
on conflict do nothing;
insert into identity.profiles (id, full_name) values (:'naledi', 'Naledi Botha') on conflict do nothing;
insert into programmes.enrolments (cohort_id, profile_id) values (:'cohort', :'naledi')
on conflict (cohort_id, profile_id) do update set status = 'active';
update submissions.tasks set due_at = now() - interval '5 days' where id = :'task';
insert into assessment.assessable_items (cohort_id, kind, task_id, title)
values (:'cohort', 'task', :'task', 'Task 3: Workplace records portfolio');
select id as item3 from assessment.assessable_items where task_id = :'task' \gset

-- Submission progress: Lerato on time, Naledi late.
insert into submissions.submissions (id, task_id, profile_id) values
  ('a0000000-0000-4000-8000-000000000001', :'task', :'learner'),
  ('a0000000-0000-4000-8000-000000000002', :'task', :'naledi');
insert into submissions.submission_versions (id, submission_id, version_number, submitted_at, is_late, receipt_reference) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, now() - interval '6 days', false, 'R-1'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 1, now() - interval '4 days', true, 'R-2');

-- Assessment: Lerato decided Competent three days after handing in and released; Naledi waiting to be marked.
insert into assessment.results (id, assessable_item_id, learner_id) values
  ('a2000000-0000-4000-8000-000000000001', :'item3', :'learner'),
  ('a2000000-0000-4000-8000-000000000002', :'item3', :'naledi');
insert into assessment.assessment_instances (id, result_id, submission_version_id, state, assessor_id) values
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'decided', :'assessor'),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'to_mark', null);
insert into assessment.decisions (id, result_id, instance_id, type, outcome, actor_id, acting_role, justification, created_at)
values ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
        'assessment', 'competent', :'assessor', 'assessor', 'Meets every criterion.', now() - interval '3 days');
update assessment.results set current_decision_id = 'a4000000-0000-4000-8000-000000000001' where id = 'a2000000-0000-4000-8000-000000000001';

-- Credits: U3 requires Task 3; releasing Lerato's result awards it.
select pg_temp.act_as(:'coordinator');
select requirement_set_id as draft from api.save_requirement_draft(:'cohort', jsonb_build_array(
  jsonb_build_object('unit_id', '10000000-0000-4000-8000-000000000003', 'assessable_item_id', :'item3'))) \gset
select status as frozen from api.freeze_requirement_set(:'cohort', :'draft', null) \gset
reset role;
update assessment.results set state = 'released' where id = 'a2000000-0000-4000-8000-000000000001';

-- Moderation: one frozen cycle with a population of 2, one sampled item agreed.
insert into moderation.cycles (id, cohort_id, name, state, planned_by, planned_at, frozen_at)
values ('a5000000-0000-4000-8000-000000000001', :'cohort', 'Term 3 assignments', 'frozen', :'coordinator', now() - interval '2 days', now() - interval '1 day');
insert into moderation.populations (cycle_id, size, digest, basis) values ('a5000000-0000-4000-8000-000000000001', 2, repeat('a', 64), '{}');
insert into moderation.samples (id, cycle_id, seed, algorithm_version, rule_version, percentage, population_digest, strata, mandatory_nyc, mandatory_first_time, random_draw)
values ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 's', 'v1', 1, 50, repeat('a', 64), '{}', 0, 0, 1);
insert into moderation.sample_items (id, sample_id, cycle_id, result_id, stratum, inclusion_reason, moderator_id, state)
values ('a7000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001',
        'a2000000-0000-4000-8000-000000000001', 'all', 'random', :'staff', 'agreed');
insert into moderation.findings (sample_item_id, cycle_id, moderator_id, decision_id, finding, reasons)
values ('a7000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', :'staff', 'a4000000-0000-4000-8000-000000000001', 'agree', 'Sound.');

-- Appeals: a remark upheld after two days, and a view-script request still open.
insert into appeals.appeals (reference, result_id, learner_id, decision_id, type, grounds, lodged_at, deadline_at, state, client_appeal_id,
  outcome_category, concluded_at, conclusion_decision_id, conclusion_command_id)
values ('AP-T-1', 'a2000000-0000-4000-8000-000000000001', :'learner', 'a4000000-0000-4000-8000-000000000001', 'remark',
        repeat('The filing index does match the records I handed in. ', 2), now() - interval '3 days', now() + interval '4 days', 'concluded',
        gen_random_uuid(), 'upheld', now() - interval '1 day', 'a4000000-0000-4000-8000-000000000001', gen_random_uuid()),
       ('AP-T-2', 'a2000000-0000-4000-8000-000000000001', :'learner', 'a4000000-0000-4000-8000-000000000001', 'view_script',
        repeat('I would like to see my marked script for this task. ', 2), now() - interval '1 day', now() + interval '4 days', 'lodged',
        gen_random_uuid(), null, null, null, null);

-- Attendance and logistics: an in-person session yesterday, register confirmed, Lerato present and Naledi absent;
-- catering for 5 arranged.
insert into learning.sessions (id, cohort_id, title, starts_at, duration_minutes, mode, venue, created_by, register_captured_at, register_captured_by, register_version)
values ('a8000000-0000-4000-8000-000000000001', :'cohort', 'Workshop: filing', now() - interval '1 day', 60, 'in_person', 'Room 4',
        :'coordinator', now() - interval '20 hours', :'coordinator', 1);
insert into learning.attendance (session_id, learner_id, status, marked_by, marked_at) values
  ('a8000000-0000-4000-8000-000000000001', :'learner', 'present', :'coordinator', now()),
  ('a8000000-0000-4000-8000-000000000001', :'naledi', 'absent', :'coordinator', now());
insert into learning.attendance_checkins (session_id, learner_id, checked_in_at)
values ('a8000000-0000-4000-8000-000000000001', :'learner', now() - interval '1 day');
insert into learning.session_logistics (session_id, venue_arranged_at, venue_arranged_by, catering_needed, headcount, headcount_source,
  catering_arranged_at, catering_arranged_by, updated_by)
values ('a8000000-0000-4000-8000-000000000001', now(), :'coordinator', true, 5, 'manual', now(), :'coordinator', :'coordinator');

-- A second assignment whose title a spreadsheet would read as a formula.
insert into submissions.tasks (cohort_id, title, brief, submission_type, due_at, state, published_at, published_by)
values (:'cohort', '=HYPERLINK("x")', 'Odd.', 'text', now() + interval '10 days', 'published', now(), :'coordinator');

-- ---------------------------------------------------------------------------------------------------------------
-- Who may run reports
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_report_types() $$, 'a learner sees no reports');
select results_eq(format($$ select status from api.run_report('attendance', %L, null, null, null) $$, :'programme'),
  $$ values ('not_found'::text) $$, 'nor can run one');
select results_eq(format($$ select status from api.request_report_export('attendance', %L, null, null, null) $$, :'programme'),
  $$ values ('not_found'::text) $$, 'nor export one');
reset role;

select pg_temp.act_as(:'coordinator');
select is((select count(*)::integer from api.list_report_types()), 8, 'a coordinator sees the eight reports of FR-708');
select results_eq(format($$ select status from api.run_report('nope', %L, null, null, null) $$, :'programme'),
  $$ values ('invalid_type'::text) $$, 'an unknown report is refused');
select results_eq(format($$ select status from api.run_report('attendance', %L, null, '2026-10-01', '2026-09-01') $$, :'programme'),
  $$ values ('invalid_range'::text) $$, 'a range that ends before it starts is refused');
select results_eq(format($$ select status from api.run_report('attendance', %L, null, '2020-01-01', '2026-01-01') $$, :'programme'),
  $$ values ('range_too_long'::text) $$, 'as is one over three years');
select results_eq(format($$ select status from api.run_report('attendance', %L, gen_random_uuid(), null, null) $$, :'programme'),
  $$ values ('not_found'::text) $$, 'a cohort outside the programme is not found');

-- ---------------------------------------------------------------------------------------------------------------
-- Each report
-- ---------------------------------------------------------------------------------------------------------------

select is((select (rows -> 0) - 'due' from api.run_report('submission_progress', :'programme', :'cohort', null, null)),
  '{"cohort": "2026 Intake B", "assignment": "Task 3: Workplace records portfolio", "learners": 2, "handed_in": 2, "on_time": 1, "late": 1, "not_handed_in": 0}'::jsonb,
  'submission progress counts who handed in, on time and late');
select is((select total from api.run_report('submission_progress', :'programme', null, (current_date + 30), (current_date + 60))), 0,
  'a date range with no assignment due in it has no rows');
select is((select rows -> 0 from api.run_report('assessment_turnaround', :'programme', null, null, null)),
  '{"cohort": "2026 Intake B", "assessment": "Task 3: Workplace records portfolio", "decisions": 1, "median_days": 3.0, "longest_days": 3.0, "waiting_now": 1, "oldest_waiting_days": 4.0}'::jsonb,
  'assessment turnaround measures hand-in to decision, and what waits now');
select is((select rows -> 0 from api.run_report('competency_rates', :'programme', null, null, null)),
  '{"cohort": "2026 Intake B", "assessment": "Task 3: Workplace records portfolio", "released": 1, "competent": 1, "not_yet_competent": 0, "competent_percent": 100.0}'::jsonb,
  'competency rates count released results only');
select is((select rows -> 0 from api.run_report('credit_accumulation', :'programme', null, null, null)),
  '{"cohort": "2026 Intake B", "unit": "U3: Keep workplace records", "unit_credits": 12, "learners": 2, "holding_award": 1, "awards": 1, "reversals": 0, "net_credits": 12}'::jsonb,
  'credit accumulation comes from the ledger');
select is((select rows -> 0 from api.run_report('moderation_findings', :'programme', null, null, null)),
  '{"cohort": "2026 Intake B", "cycle": "Term 3 assignments", "state": "Frozen, being moderated", "population": 2, "sampled": 1, "agreed": 1, "disagreed": 0, "returned": 0, "remarked": 0, "signed_off": null, "released": null}'::jsonb,
  'moderation findings summarise each cycle');
select results_eq(format($$ select r ->> 'appeal_type', (r ->> 'lodged')::integer, (r ->> 'open')::integer, (r ->> 'upheld')::integer, (r ->> 'median_days')::numeric
  from api.run_report('appeals', %L, null, null, null) x, jsonb_array_elements(x.rows) r $$, :'programme'),
  $$ values ('Remark'::text, 1, 0, 1, 2.0), ('View marked script', 1, 1, 0, null) $$,
  'appeal volumes and outcomes by kind');
select is((select (rows -> 0) - 'starts' from api.run_report('attendance', :'programme', null, null, null)),
  '{"cohort": "2026 Intake B", "session": "Workshop: filing", "mode": "In person", "register": "Confirmed", "present": 1, "absent": 1, "rate_percent": 50.0, "checked_in": 1}'::jsonb,
  'attendance comes from confirmed registers');
select is((select (rows -> 0) - 'starts' from api.run_report('logistics', :'programme', null, null, null)),
  '{"cohort": "2026 Intake B", "session": "Workshop: filing", "venue": "Room 4", "venue_arranged": "Yes", "catering": "Arranged", "equipment": "None asked for", "headcount": 5, "present": 1, "difference": -4, "reconciled": "No"}'::jsonb,
  'logistics sets the headcount against who came');
select ok(not exists (select 1 from api.run_report('attendance', :'programme', null, (current_date - 30), (current_date - 3)) r where r.total > 0),
  'a session outside the range is left out');
select is((select truncated from api.run_report('submission_progress', :'programme', null, null, null)), false, 'a short report is not truncated');
reset role;

-- A person on the staff who coordinates nothing gets nothing.
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status from api.run_report('appeals', %L, null, null, null) $$, :'programme'),
  $$ values ('not_found'::text) $$, 'an assessor cannot run a report');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Exports
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'coordinator');
select export_id as export1 from api.request_report_export('submission_progress', :'programme', null, null, null) \gset
select results_eq($$ select state from api.list_my_report_exports() $$, $$ values ('queued'::text) $$,
  'an export is recorded and waits for the job');
reset role;
select is((select count(*)::integer from audit.events where action = 'reporting.export_requested' and object_id = :'export1'), 1,
  'the request is audited');

select is(audit.run_job('build-report-exports'), 1, 'the job builds it');
select is((select split_part(content, E'\r\n', 1) from reporting.report_exports where id = :'export1'),
  '"Cohort","Assignment","Due (SAST)","Learners","Handed in","On time","Late","Not handed in"', 'with a header row');
select ok((select content like '%"''=HYPERLINK(""x"")"%' from reporting.report_exports where id = :'export1'),
  'a cell a spreadsheet would read as a formula is escaped');
select is((select row_count from reporting.report_exports where id = :'export1'), 2, 'every row is in the export');
select is((select count(*)::integer from notifications.notifications
  where event_type = 'report_export_ready' and recipient_id = :'coordinator'), 1, 'the requester is told it is ready');

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status, filename like 'submission-progress-%%.csv', content like '"Cohort",%%' from api.download_report_export(%L) $$, :'export1'),
  $$ values ('ok'::text, true, true) $$, 'the requester downloads the CSV');
reset role;
select is((select count(*)::integer from audit.events where action = 'reporting.export_downloaded' and object_id = :'export1'), 1,
  'the download is audited');

select pg_temp.act_as(:'staff');
select results_eq(format($$ select status from api.download_report_export(%L) $$, :'export1'),
  $$ values ('not_found'::text) $$, 'nobody else can download it');
select is_empty($$ select * from api.list_my_report_exports() $$, 'or see it');
reset role;

-- At most three waiting at once.
select pg_temp.act_as(:'coordinator');
select status from api.request_report_export('appeals', :'programme', null, null, null) \gset
select status from api.request_report_export('attendance', :'programme', null, null, null) \gset
select status from api.request_report_export('logistics', :'programme', null, null, null) \gset
select results_eq(format($$ select status from api.request_report_export('competency_rates', %L, null, null, null) $$, :'programme'),
  $$ values ('too_many_exports'::text) $$, 'a fourth waiting export is refused');
reset role;

-- After seven days the content is removed.
update reporting.report_exports set expires_at = now() - interval '1 minute' where id = :'export1';
select is(audit.run_job('build-report-exports'), 3, 'the job builds the three waiting');
select results_eq(format($$ select state, content is null from reporting.report_exports where id = %L $$, :'export1'),
  $$ values ('expired'::text, true) $$, 'and removes the content of an expired export');
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.download_report_export(%L) $$, :'export1'),
  $$ values ('expired'::text) $$, 'which can no longer be downloaded');
reset role;

select * from finish();
rollback;
