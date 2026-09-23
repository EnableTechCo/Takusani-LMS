-- Tasks (S2-02, FR-201 to FR-203): who may set work, what a draft accepts, what publishing fixes, and that a
-- learner sees a task only once it is published and only if it is theirs.
-- Uses the local seed: facilitator@, coordinator@, learner@, staff@ and the cohort "2026 Intake B". Records it
-- creates start with pgTAP so the test does not collide with records someone made by hand in a local database.
create extension if not exists pgtap with schema extensions;

begin;
select plan(32);

-- Switch to a signed-in user. Call only as postgres: `reset role` first, since authenticated cannot run it.
create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set cohort 10000000-0000-4000-8000-000000000010
\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set coordinator 00000000-0000-4000-8000-000000000005

-- A second learner in the same cohort, so "named learners" is a real choice.
reset role;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated',
        'authenticated', 'pgtap.learner2@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values ('00000000-0000-4000-8000-0000000000a1', 'pgTAP Second Learner');
insert into identity.role_assignments (profile_id, role, scope_type) values ('00000000-0000-4000-8000-0000000000a1', 'learner', 'global');
insert into programmes.enrolments (cohort_id, profile_id) values (:'cohort', '00000000-0000-4000-8000-0000000000a1');

-- Who may set work
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status from api.create_task(%L, 'pgTAP Task', 'Write it up.') $$, :'cohort'),
  $$ values ('forbidden'::text) $$, 'a learner cannot create a task');

reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(
  format($$ select status from api.create_task(%L, '  ', 'Write it up.') $$, :'cohort'),
  $$ values ('invalid_title'::text) $$, 'a task needs a title');
select results_eq(
  format($$ select status from api.create_task(%L, 'pgTAP Task', 'Write it up.', 'carrier_pigeon') $$, :'cohort'),
  $$ values ('invalid_submission_type'::text) $$, 'the submission type is one we support');
select (select task_id from api.create_task(:'cohort', 'pgTAP Task 1', 'Write up the workplace records.')) as task \gset
reset role;
select results_eq(
  format($$ select state, audience, due_at is null from submissions.tasks where id = %L $$, :'task'),
  $$ values ('draft'::text, 'cohort'::text, true) $$, 'a new task is a draft for the whole cohort, with no date yet');
select pg_temp.act_as(:'facilitator');
select results_eq(
  format($$ select status from api.create_task(%L, 'pgTAP Task 1', 'Again.') $$, :'cohort'),
  $$ values ('title_taken'::text) $$, 'task titles are unique within a cohort');

-- A coordinator of the cohort may also set work
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select status from api.create_task(%L, 'pgTAP Coordinator task', 'Set by the coordinator.') $$, :'cohort'),
  $$ values ('ok'::text) $$, 'a coordinator of the cohort may set work too');

-- Editing the draft
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(
  format($$ select name from api.list_work_cohorts() where id = %L $$, :'cohort'),
  $$ values ('2026 Intake B'::text) $$, 'a facilitator lists the cohorts they may set work in');
select results_eq(
  format($$ select status from api.update_task(%L, 'pgTAP Task 1', 'Write up the workplace records, with evidence.',
           'file_upload', now() + interval '14 days', 'accept_and_flag') $$, :'task'),
  $$ values ('ok'::text) $$, 'the draft can be edited');
select results_eq(
  format($$ select status from api.set_task_criteria(%L, '[{"title": "Records are complete", "points": 10},
           {"title": "Retention rules applied", "descriptor": "Cites the schedule.", "points": 5}]'::jsonb) $$, :'task'),
  $$ values ('ok'::text) $$, 'the rubric rows are set on the draft');
reset role;
select results_eq(
  format($$ select ordinal, title, points from submissions.task_criteria where task_id = %L order by ordinal $$, :'task'),
  $$ values (1, 'Records are complete'::text, 10), (2, 'Retention rules applied'::text, 5) $$,
  'the rubric keeps the order it was given in');
select pg_temp.act_as(:'facilitator');
select results_eq(
  format($$ select status from api.set_task_criteria(%L, '[{"title": ""}]'::jsonb) $$, :'task'),
  $$ values ('invalid_criterion_title'::text) $$, 'a rubric row needs a title');
select results_eq(
  format($$ select criteria_count from api.set_task_criteria(%L, '[{"title": "Records are complete", "points": 10},
           {"title": "Retention rules applied", "points": 5}]'::jsonb) $$, :'task'),
  $$ values (2) $$, 'setting the rubric again replaces it rather than adding to it');

-- Audience
select results_eq(
  format($$ select status from api.set_task_audience(%L, 'named', array['nobody@takusani.test']) $$, :'task'),
  $$ values ('learner_not_enrolled'::text) $$, 'a named learner must be enrolled in the cohort');
select results_eq(
  format($$ select status from api.set_task_audience(%L, 'named', array[]::text[]) $$, :'task'),
  $$ values ('no_learners_named'::text) $$, 'naming nobody is refused');
select results_eq(
  format($$ select status, audience_size from api.set_task_audience(%L, 'named', array['LEARNER@takusani.test']) $$, :'task'),
  $$ values ('ok'::text, 1) $$, 'named learners are matched by email, ignoring case');
select results_eq(
  format($$ select status, audience_size from api.set_task_audience(%L, 'cohort') $$, :'task'),
  $$ values ('ok'::text, 2) $$, 'the whole cohort is everyone currently enrolled');

-- Publishing
select (select task_id from api.create_task(:'cohort', 'pgTAP Task 2', 'No date yet.')) as undated \gset
select results_eq(format($$ select status from api.publish_task(%L) $$, :'undated'),
  $$ values ('due_date_required'::text) $$, 'a task cannot be published without a due date');
select results_eq(
  format($$ select status from api.update_task(%L, 'pgTAP Task 2', 'No date yet.', 'file_upload',
           now() - interval '1 day', 'accept_and_flag') $$, :'undated'),
  $$ values ('ok'::text) $$, 'a draft may hold a date in the past');
select results_eq(format($$ select status from api.publish_task(%L) $$, :'undated'),
  $$ values ('due_date_passed'::text) $$, 'but it cannot be published with the due date already gone');

select results_eq(format($$ select status, notified from api.publish_task(%L) $$, :'task'),
  $$ values ('ok'::text, 2) $$, 'publishing says how many learners the task is for');
select results_eq(format($$ select status from api.publish_task(%L) $$, :'task'),
  $$ values ('already_published'::text) $$, 'publishing twice is refused');
select results_eq(
  format($$ select status from api.update_task(%L, 'pgTAP Task 1', 'Changed my mind.', 'file_upload',
           now() + interval '20 days', 'accept_and_flag') $$, :'task'),
  $$ values ('not_a_draft'::text) $$, 'a published task is fixed: it cannot be edited');
select results_eq(
  format($$ select status from api.set_task_criteria(%L, '[{"title": "New rule"}]'::jsonb) $$, :'task'),
  $$ values ('not_a_draft'::text) $$, 'nor can its rubric be changed');

reset role;
select results_eq(
  format($$ select acting_role, scope_type, scope_key, after ->> 'learners' from audit.events
            where action = 'submissions.task_published' and object_id = %L $$, :'task'),
  format($$ values ('facilitator'::text, 'cohort'::text, %L::uuid, '2'::text) $$, :'cohort'),
  'publishing is audited with the acting role, the cohort and the number of learners');

-- What a learner sees (FR-202)
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select title from api.list_my_tasks() where id = %L $$, :'task'),
  $$ values ('pgTAP Task 1'::text) $$, 'a learner sees the published task');
select is_empty(
  format($$ select * from api.list_my_tasks() where id = %L $$, :'undated'),
  'a learner never sees a draft');
select is_empty(format($$ select * from api.get_task(%L) $$, :'task'),
  'a learner cannot read the staff view of a task');
select is_empty($$ select * from api.list_tasks() $$, 'and lists no tasks as staff would');
select is_empty($$ select * from api.list_work_cohorts() $$, 'and no cohorts to set work in');

-- A learner who is not in the audience sees nothing
reset role;
select pg_temp.act_as(:'facilitator');
select (select task_id from api.create_task(:'cohort', 'pgTAP Task 3', 'For one learner.', 'text',
        now() + interval '7 days')) as named \gset
select results_eq(
  format($$ select status from api.set_task_audience(%L, 'named', array['pgtap.learner2@takusani.test']) $$, :'named'),
  $$ values ('ok'::text) $$, 'the task is set for one named learner');
select results_eq(format($$ select status, notified from api.publish_task(%L) $$, :'named'),
  $$ values ('ok'::text, 1) $$, 'publishing it notifies that one learner');
reset role;
select pg_temp.act_as(:'learner');
select is_empty(format($$ select * from api.list_my_tasks() where id = %L $$, :'named'),
  'a learner outside the named audience does not see it');

select * from finish();
rollback;
