-- Cohort archival (S6-05; FR-111, FR-112; ADR-019). Uses the local seed: Sipho (admin@) is an administrator; Ayesha
-- (coordinator@) coordinates the CBA-NQF4 programme; Nomsa (assessor@) assesses; Lerato (learner@) is a learner. The
-- test makes its own cohort so nothing else in the database affects it.
create extension if not exists pgtap with schema extensions;

begin;
select plan(29);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

create function pg_temp.blocker(p_cohort uuid, p_key text) returns text language sql as $$
  select to_jsonb(b) ->> p_key from programmes.archival_blockers(p_cohort) b
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set admin 00000000-0000-4000-8000-000000000006
\set programme 10000000-0000-4000-8000-000000000001
\set cohort b0000000-0000-4000-8000-000000000001
\set setup_cohort b0000000-0000-4000-8000-000000000002
\set task b0000000-0000-4000-8000-000000000010

insert into programmes.cohorts (id, programme_id, name, starts_on, ends_on, status, activated_at) values
  (:'cohort', :'programme', '2025 Intake A', '2025-01-15', '2025-12-10', 'active', now() - interval '1 year');
insert into programmes.cohorts (id, programme_id, name, starts_on, ends_on) values
  (:'setup_cohort', :'programme', '2027 Intake A', '2027-01-15', '2027-12-10');
insert into programmes.cohort_moderation_state (cohort_id, moderation_policy) values
  (:'cohort', 'not_moderated'), (:'setup_cohort', 'not_moderated');
insert into programmes.enrolments (cohort_id, profile_id) values (:'cohort', :'learner');
insert into submissions.tasks (id, cohort_id, title, brief, submission_type, due_at, state, published_at, published_by)
values (:'task', :'cohort', 'Final portfolio', 'Hand it in.', 'text', now() - interval '30 days', 'published', now() - interval '60 days', :'coordinator');
insert into assessment.assessable_items (id, cohort_id, kind, task_id, title)
values ('b0000000-0000-4000-8000-000000000020', :'cohort', 'task', :'task', 'Final portfolio');

-- ---------------------------------------------------------------------------------------------------------------
-- Who may archive
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.archive_cohort(%L) $$, :'cohort'), $$ values ('forbidden'::text) $$,
  'a coordinator cannot archive a cohort');
select is_empty($$ select * from api.list_cohort_archival() $$, 'nor see the archive screen');
reset role;

select pg_temp.act_as(:'admin');
select results_eq(format($$ select status from api.archive_cohort(%L) $$, :'setup_cohort'), $$ values ('not_active'::text) $$,
  'a cohort still in setup cannot be archived');
select results_eq($$ select status from api.archive_cohort(gen_random_uuid()) $$, $$ values ('not_found'::text) $$,
  'nor one that does not exist');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- What blocks it (FR-111)
-- ---------------------------------------------------------------------------------------------------------------

-- Handed in, not yet assessed.
insert into assessment.results (id, assessable_item_id, learner_id)
values ('b0000000-0000-4000-8000-000000000030', 'b0000000-0000-4000-8000-000000000020', :'learner');
select is(pg_temp.blocker(:'cohort', 'not_assessed'), '1', 'work handed in and not assessed blocks archiving');

select pg_temp.act_as(:'admin');
select results_eq(format($$ select status, (blockers ->> 'not_assessed')::integer, (blockers ->> 'archivable')::boolean from api.archive_cohort(%L) $$, :'cohort'),
  $$ values ('blocked'::text, 1, false) $$, 'archiving is refused with the blocker counted');
reset role;
select is((select count(*)::integer from audit.events where action = 'programmes.cohort_archive_refused' and object_id = :'cohort'), 1,
  'the refusal is audited');

-- Decided but still held.
insert into assessment.decisions (id, result_id, type, outcome, actor_id, acting_role, justification)
values ('b0000000-0000-4000-8000-000000000040', 'b0000000-0000-4000-8000-000000000030', 'assessment', 'competent', :'assessor', 'assessor', 'Meets every criterion.');
update assessment.results set current_decision_id = 'b0000000-0000-4000-8000-000000000040' where id = 'b0000000-0000-4000-8000-000000000030';
select is(pg_temp.blocker(:'cohort', 'held'), '1', 'a decided result that is still held blocks archiving');
select is(pg_temp.blocker(:'cohort', 'not_assessed'), '0', 'and is no longer counted as not assessed');

-- Released: its appeal window is open.
update assessment.results set state = 'released' where id = 'b0000000-0000-4000-8000-000000000030';
select is(pg_temp.blocker(:'cohort', 'held'), '0', 'released, it is no longer held');
select ok(pg_temp.blocker(:'cohort', 'appeal_window_until')::timestamptz > now(), 'but its appeal window is still open');

-- An appeal lodged and still open.
insert into appeals.appeals (id, reference, result_id, learner_id, decision_id, type, grounds, lodged_at, deadline_at, client_appeal_id)
select 'b0000000-0000-4000-8000-000000000050', 'AP-ARCH-1', r.id, :'learner', r.current_decision_id, 'remark',
  repeat('The portfolio covers every criterion, including the index. ', 2), now(), r.appeal_deadline_at, gen_random_uuid()
from assessment.results r where r.id = 'b0000000-0000-4000-8000-000000000030';
select is(pg_temp.blocker(:'cohort', 'open_appeals'), '1', 'an open appeal blocks archiving');
update appeals.appeals set state = 'inadmissible', admissibility = 'inadmissible', admissibility_reason = 'Out of time.',
  admissibility_decided_at = now(), admissibility_decided_by = :'coordinator'
where id = 'b0000000-0000-4000-8000-000000000050';
select is(pg_temp.blocker(:'cohort', 'open_appeals'), '0', 'one found inadmissible no longer does');

-- A resubmission waiting to be marked.
insert into assessment.assessment_instances (id, result_id, state)
values ('b0000000-0000-4000-8000-000000000060', 'b0000000-0000-4000-8000-000000000030', 'to_mark');
select is(pg_temp.blocker(:'cohort', 'resubmissions'), '1', 'a resubmission waiting to be marked blocks archiving');
update assessment.assessment_instances set state = 'superseded' where id = 'b0000000-0000-4000-8000-000000000060';

-- A moderation cycle not signed off.
insert into moderation.cycles (id, cohort_id, name, planned_by) values ('b0000000-0000-4000-8000-000000000070', :'cohort', 'Final cycle', :'coordinator');
select is(pg_temp.blocker(:'cohort', 'open_cycles'), '1', 'a moderation cycle not signed off blocks archiving');
update moderation.cycles set state = 'cancelled', cancelled_at = now(), cancelled_by = :'coordinator', cancel_reason = 'Not needed.'
where id = 'b0000000-0000-4000-8000-000000000070';
select is(pg_temp.blocker(:'cohort', 'open_cycles'), '0', 'a cancelled one does not');

-- The appeal window closes: an appeal decision is final, so its window closes on release.
insert into assessment.decisions (id, result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
values ('b0000000-0000-4000-8000-000000000041', 'b0000000-0000-4000-8000-000000000030', 'appeal', 'competent', :'admin', 'administrator',
        'Upheld.', 'b0000000-0000-4000-8000-000000000040');
update assessment.results set current_decision_id = 'b0000000-0000-4000-8000-000000000041' where id = 'b0000000-0000-4000-8000-000000000030';
select is(pg_temp.blocker(:'cohort', 'appeal_window_until'), null, 'with every appeal window closed');
select is(pg_temp.blocker(:'cohort', 'archivable'), 'true', 'nothing blocks archiving');

select pg_temp.act_as(:'admin');
select results_eq(format($$ select archivable, open_cycles, held, open_appeals from api.list_cohort_archival() where cohort_id = %L $$, :'cohort'),
  $$ values (true, 0, 0, 0) $$, 'the administrator sees it ready to archive');

-- ---------------------------------------------------------------------------------------------------------------
-- Archiving
-- ---------------------------------------------------------------------------------------------------------------

select results_eq(format($$ select status from api.archive_cohort(%L) $$, :'cohort'), $$ values ('ok'::text) $$, 'the cohort is archived');
select results_eq(format($$ select status from api.archive_cohort(%L) $$, :'cohort'), $$ values ('already_archived'::text) $$,
  'and cannot be archived twice');
select results_eq(format($$ select status, archived_by_name, archivable from api.list_cohort_archival() where cohort_id = %L $$, :'cohort'),
  $$ values ('archived'::text, 'Sipho Mahlangu'::text, false) $$, 'the screen records who archived it');
reset role;
select results_eq(format($$ select action, before ->> 'status', after ->> 'status' from audit.events where action = 'programmes.cohort_archived' and object_id = %L $$, :'cohort'),
  $$ values ('programmes.cohort_archived'::text, 'active'::text, 'archived'::text) $$, 'archiving is audited');

-- ---------------------------------------------------------------------------------------------------------------
-- Read-only, but still readable (FR-112)
-- ---------------------------------------------------------------------------------------------------------------

select throws_ok(format($$ insert into submissions.tasks (cohort_id, title, brief, submission_type) values (%L, 'New', 'x', 'text') $$, :'cohort'),
  '55000', null, 'no assignment can be added');
select throws_ok(format($$ insert into programmes.enrolments (cohort_id, profile_id) values (%L, '00000000-0000-4000-8000-000000000102') $$, :'cohort'),
  '55000', null, 'no learner can be enrolled');
select throws_ok($$ update assessment.results set remediation_period = interval '1 day' where id = 'b0000000-0000-4000-8000-000000000030' $$,
  '55000', null, 'no result can change');
select throws_ok($$ insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
  values ('b0000000-0000-4000-8000-000000000030', 'correction', 'not_yet_competent', '00000000-0000-4000-8000-000000000006', 'administrator', 'x', 'b0000000-0000-4000-8000-000000000041') $$,
  '55000', null, 'and no decision can be added, even by the database owner');
select lives_ok($$ insert into submissions.tasks (cohort_id, title, brief, submission_type) values ('10000000-0000-4000-8000-000000000010', 'Still open', 'x', 'text') $$,
  'another cohort is untouched');

select pg_temp.act_as(:'coordinator');
select is((select (rows -> 0 ->> 'released')::integer from api.run_report('competency_rates', :'programme', :'cohort')), 1,
  'reports still read the archived cohort');
reset role;

select * from finish();
rollback;
