-- Cohort setup: moderation policy, readiness and activation (S4-03; FR-701, FR-702; ADR-019; P-01). Uses the local
-- seed: coordinator@ (institution-wide), facilitator@, assessor@, moderator@, learner@, admin@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(47);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set moderator 00000000-0000-4000-8000-000000000004
\set coordinator 00000000-0000-4000-8000-000000000005
\set programme 10000000-0000-4000-8000-000000000001
\set seeded_cohort 10000000-0000-4000-8000-000000000010

-- The seed's teaching roles are institution-wide, which would cover every cohort. End them here, so the new cohort
-- starts with nobody and the checklist has something to find.
update identity.role_assignments set effective = tstzrange(lower(effective), now() - interval '1 second')
where scope_type = 'global' and role in ('facilitator', 'assessor', 'moderator') and lower(effective) < now() - interval '1 second';

-- ---------------------------------------------------------------------------------------------------------------
-- Existing cohorts keep their policy as version 1
-- ---------------------------------------------------------------------------------------------------------------

select results_eq(format($$ select c.status, v.version, v.policy, v.previous_policy from programmes.cohorts c
                            join programmes.moderation_policy_versions v on v.cohort_id = c.id where c.id = %L $$, :'seeded_cohort'),
  $$ values ('active'::text, 1, 'not_moderated'::text, null::text) $$,
  'a cohort that was already running keeps its policy, recorded as version 1');

-- ---------------------------------------------------------------------------------------------------------------
-- A new cohort starts in setup, hidden from learners
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'coordinator');
select cohort_id as cohort from api.create_cohort(:'programme', 'Setup Intake', '2027-02-01', '2027-11-30') \gset
select results_eq(format($$ select status, moderation_policy, policy_version, learners from api.get_cohort_setup(%L) $$, :'cohort'),
  $$ values ('setup'::text, null::text, 0, 0) $$, 'a new cohort is in setup, with no moderation policy: there is no default');
select results_eq(format($$ select status from api.enrol_learner(%L, 'learner@takusani.test') $$, :'cohort'),
  $$ values ('ok'::text) $$, 'learners can be enrolled while it is set up');
select results_eq(format($$ select status from api.list_enrolments(%L) $$, :'cohort'), $$ values ('pending'::text) $$,
  'their enrolment waits for activation');
select results_eq(format($$ select status from api.enrol_learner(%L, 'learner@takusani.test') $$, :'cohort'),
  $$ values ('already_enrolled'::text) $$, 'and counts as enrolled');
reset role;

-- A facilitator prepares the cohort: a published task and a scheduled session.
insert into submissions.tasks (id, cohort_id, title, brief, submission_type, late_policy, state, published_at, due_at, created_by)
values ('90000000-0000-4000-8000-000000000001', :'cohort', 'Setup task', 'Brief.', 'file_upload', 'accept_and_flag',
        'published', now(), now() + interval '30 days', :'facilitator');
insert into learning.sessions (cohort_id, title, starts_at, duration_minutes, mode, venue, created_by)
values (:'cohort', 'Welcome session', now() + interval '10 days', 60, 'in_person', 'Room 1', :'facilitator');

select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_my_tasks() where title = 'Setup task' $$,
  'a learner sees nothing of a cohort in setup: not its tasks');
select is_empty($$ select * from api.list_my_sessions() where title = 'Welcome session' $$, 'nor its sessions');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Choosing and changing the moderation policy
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.set_moderation_policy(%L, 'moderated', 0) $$, :'cohort'),
  $$ values ('not_found'::text) $$, 'only the cohort''s coordinator sets its policy');
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.set_moderation_policy(%L, 'sometimes', 0) $$, :'cohort'),
  $$ values ('invalid_policy'::text) $$, 'the policy is moderated or not moderated');
select results_eq(format($$ select status, policy_version from api.set_moderation_policy(%L, 'moderated', 0) $$, :'cohort'),
  $$ values ('ok'::text, 1) $$, 'the first choice needs no reason, and is version 1');
select results_eq(format($$ select status from api.set_moderation_policy(%L, 'not_moderated', 0, 'Old page') $$, :'cohort'),
  $$ values ('stale'::text) $$, 'a change made from an old copy of the page is refused');
select results_eq(format($$ select status from api.set_moderation_policy(%L, 'moderated', 1) $$, :'cohort'),
  $$ values ('unchanged'::text) $$, 'choosing the policy in force changes nothing');
select results_eq(format($$ select status from api.set_moderation_policy(%L, 'not_moderated', 1) $$, :'cohort'),
  $$ values ('reason_required'::text) $$, 'changing a chosen policy needs a reason');
reset role;

-- A result decided and waiting for moderation, and one held in a cycle.
insert into assessment.assessable_items (id, cohort_id, kind, title)
values ('90000000-0000-4000-8000-000000000002', :'cohort', 'exam', 'Setup exam');
insert into assessment.results (id, assessable_item_id, learner_id) values
  ('90000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000002', :'learner');
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', 'second.setup@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values ('90000000-0000-4000-8000-0000000000f1', 'Second Learner');
insert into moderation.cycles (id, cohort_id, name, state, frozen_at, planned_by)
values ('90000000-0000-4000-8000-0000000000c1', :'cohort', 'Setup cycle', 'frozen', now(), :'coordinator');
insert into assessment.results (id, assessable_item_id, learner_id, hold_cycle_id) values
  ('90000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-0000000000f1',
   '90000000-0000-4000-8000-0000000000c1');

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status, policy_version, waiting, held from api.set_moderation_policy(%L, 'not_moderated', 1, 'Too slow.') $$, :'cohort'),
  $$ values ('results_pending_or_held'::text, 1, 1, 1) $$,
  'dropping moderation is refused while results are waiting or held, saying how many (BR-04)');
reset role;
select is((select moderation_policy from programmes.cohort_moderation_state where cohort_id = :'cohort'), 'moderated',
  'nothing changed');
select results_eq(format($$ select details ->> 'reason_code', (details ->> 'waiting')::int, (details ->> 'held')::int from audit.events
                            where action = 'programmes.moderation_policy_change_refused' and object_id = %L $$, :'cohort'),
  $$ values ('results_pending_or_held'::text, 1, 1) $$, 'and the refusal is audited');

delete from assessment.results where assessable_item_id = '90000000-0000-4000-8000-000000000002';
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status, policy_version from api.set_moderation_policy(%L, 'not_moderated', 1, 'Pilot cohort, reviewed monthly instead.') $$, :'cohort'),
  $$ values ('ok'::text, 2) $$, 'with nothing waiting or held, the change is made as version 2');
select results_eq(format($$ select status, policy_version from api.set_moderation_policy(%L, 'moderated', 2, 'Back under moderation.') $$, :'cohort'),
  $$ values ('ok'::text, 3) $$, 'changing to moderated is always allowed');
select results_eq(format($$ select kind, version, policy, previous_policy, by_name from api.list_moderation_policy_history(%L) order by version, kind desc $$, :'cohort'),
  $$ values ('version'::text, 1, 'moderated'::text, null::text, 'Ayesha Patel'::text),
            ('refused', 1, 'not_moderated', null, 'Ayesha Patel'),
            ('version', 2, 'not_moderated', 'moderated', 'Ayesha Patel'),
            ('version', 3, 'moderated', 'not_moderated', 'Ayesha Patel') $$,
  'the history shows every version and the refused change');
reset role;
select throws_ok(format($$ update programmes.moderation_policy_versions set policy = 'not_moderated' where cohort_id = %L $$, :'cohort'),
  '42501', null, 'versions cannot be edited');
select is((select count(*)::int from audit.events where action = 'programmes.moderation_policy_set' and object_id = :'cohort'), 3,
  'every version is audited');

-- ---------------------------------------------------------------------------------------------------------------
-- Readiness and activation
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select item_key, done from api.get_cohort_readiness(%L) where gate $$, :'cohort'),
  $$ values ('details'::text, true), ('moderation_policy', true), ('learners', true), ('facilitator', false),
            ('assessor', false), ('moderator', false) $$,
  'the checklist shows what activation still needs');
select results_eq(format($$ select item_key, done, detail from api.get_cohort_readiness(%L) where not gate $$, :'cohort'),
  $$ values ('materials'::text, false, '0'::text), ('published_tasks', true, '1'), ('sessions', true, '1'), ('logistics', false, '0/1'),
            ('unit_requirements', false, null) $$,
  'and what else is ready, counted from the cohort');
select results_eq(format($$ select status, missing from api.activate_cohort(%L) $$, :'cohort'),
  $$ values ('not_ready'::text, array['facilitator', 'assessor', 'moderator']) $$,
  'activation is refused with what is missing');

-- People: roles assigned from the cohort's page.
select results_eq(format($$ select status from api.assign_cohort_role(%L, 'nobody@takusani.test', 'facilitator') $$, :'cohort'),
  $$ values ('account_not_found'::text) $$, 'a role is given to an existing account, found by email');
select results_eq(format($$ select status from api.assign_cohort_role(%L, 'facilitator@takusani.test', 'coordinator') $$, :'cohort'),
  $$ values ('invalid_role'::text) $$, 'only facilitator, assessor and moderator roles are given here');
select results_eq(format($$ select status from api.assign_cohort_role(%L, ' Facilitator@Takusani.test ', 'facilitator') $$, :'cohort'),
  $$ values ('ok'::text) $$, 'the coordinator assigns a facilitator to the cohort');
select results_eq(format($$ select status from api.assign_cohort_role(%L, 'assessor@takusani.test', 'assessor') $$, :'cohort'),
  $$ values ('ok'::text) $$, 'and an assessor');
select results_eq(format($$ select full_name, role, scope_type from api.list_cohort_staff(%L) where role <> 'coordinator' order by role $$, :'cohort'),
  $$ values ('Nomsa Dlamini'::text, 'assessor'::text, 'cohort'::text), ('Pieter van Wyk', 'facilitator', 'cohort') $$,
  'the cohort''s staff lists them');

-- Assigning an open item.
select results_eq(format($$ select status from api.assign_readiness_item(%L, 'moderator', %L) $$, :'cohort', :'learner'),
  $$ values ('not_staff'::text) $$, 'an item is assigned only to someone on the cohort''s staff');
select results_eq(format($$ select status from api.assign_readiness_item(%L, 'published_tasks', %L) $$, :'cohort', :'facilitator'),
  $$ values ('already_done'::text) $$, 'a done item is not assigned');
select results_eq(format($$ select status from api.assign_readiness_item(%L, 'materials', %L, current_date - 1) $$, :'cohort', :'facilitator'),
  $$ values ('due_in_past'::text) $$, 'a due date is today or later');
select results_eq(format($$ select status from api.assign_readiness_item(%L, 'materials', %L, current_date + 7, 'The unit 1 reading pack.') $$, :'cohort', :'facilitator'),
  $$ values ('ok'::text) $$, 'the coordinator assigns an open item, with a due date and a note');
select results_eq(format($$ select assignee_name, note from api.get_cohort_readiness(%L) where item_key = 'materials' $$, :'cohort'),
  $$ values ('Pieter van Wyk'::text, 'The unit 1 reading pack.'::text) $$, 'the checklist shows who has it');
reset role;
select results_eq($$ select event_type, link, payload ->> 'item_key' from notifications.notifications
                    where recipient_id = '00000000-0000-4000-8000-000000000002' and event_type = 'readiness_item_assigned' $$,
  $$ values ('readiness_item_assigned'::text, '/teach/materials'::text, 'materials'::text) $$,
  'and the assignee is told, with a link to where the work is done');

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select done, detail from api.get_cohort_readiness(%L) where item_key = 'logistics' $$, :'cohort'),
  $$ values (false, '0/1'::text) $$, 'logistics follows from session logistics now: its in-person session is not arranged (S6-03)');
select hasnt_function('api', 'confirm_cohort_logistics', array['uuid', 'boolean'],
  'and the hand confirmation it replaced is gone');

-- A moderated cohort needs a moderator.
select results_eq(format($$ select status, missing from api.activate_cohort(%L) $$, :'cohort'),
  $$ values ('not_ready'::text, array['moderator']) $$, 'a moderated cohort cannot be activated without a moderator');
select results_eq(format($$ select status from api.assign_cohort_role(%L, 'moderator@takusani.test', 'moderator') $$, :'cohort'),
  $$ values ('ok'::text) $$, 'the coordinator assigns one');
select results_eq(format($$ select status, learners from api.activate_cohort(%L) $$, :'cohort'),
  $$ values ('ok'::text, 1) $$, 'and activates the cohort');
select results_eq(format($$ select status, activated_by_name from api.get_cohort_setup(%L) $$, :'cohort'),
  $$ values ('active'::text, 'Ayesha Patel'::text) $$, 'it is active, recorded with who activated it');
select results_eq(format($$ select status from api.list_enrolments(%L) $$, :'cohort'), $$ values ('active'::text) $$,
  'its learners are active');
select results_eq(format($$ select status from api.activate_cohort(%L) $$, :'cohort'), $$ values ('not_in_setup'::text) $$,
  'and it cannot be activated twice');
reset role;

select pg_temp.act_as(:'learner');
select results_eq($$ select title from api.list_my_tasks() where title = 'Setup task' $$, $$ values ('Setup task'::text) $$,
  'the learner now sees the cohort''s work');
reset role;

-- Enrolling after activation is active at once.
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.enrol_learner(%L, 'learner@takusani.test') $$, :'seeded_cohort'),
  $$ values ('already_enrolled'::text) $$, 'an active cohort''s enrolment is unchanged');
reset role;
select is((select status from programmes.enrolments where cohort_id = :'seeded_cohort' and profile_id = :'learner'), 'active',
  'and stays active');

select is((select count(*)::int from audit.events where action = 'programmes.cohort_activated' and object_id = :'cohort'), 1,
  'activation is audited');

select * from finish();
rollback;
