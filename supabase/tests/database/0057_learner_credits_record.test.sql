-- The learner's credits record (S6-02; L-19; FR-318, FR-801 to FR-804). Uses the local seed: Ayesha (coordinator@)
-- coordinates "2026 Intake B", whose programme has unit U3 (12 credits); Lerato (learner@) is enrolled.
create extension if not exists pgtap with schema extensions;

begin;
select plan(19);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

create function pg_temp.result(p_learner uuid, p_item uuid, p_outcome text, p_release boolean)
returns uuid language plpgsql as $$
declare v_result uuid; v_decision uuid;
begin
  insert into assessment.results (assessable_item_id, learner_id, state) values (p_item, p_learner, 'held') returning id into v_result;
  insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, remediation, resubmission_days)
  values (v_result, 'assessment', p_outcome, '00000000-0000-4000-8000-000000000003', 'assessor', 'Judged against every criterion.',
          case when p_outcome = 'not_yet_competent' then 'Add the access register.' end,
          case when p_outcome = 'not_yet_competent' then 14 end)
  returning id into v_decision;
  update assessment.results set current_decision_id = v_decision,
    remediation_period = case when p_outcome = 'not_yet_competent' then interval '14 days' end
  where id = v_result;
  if p_release then update assessment.results set state = 'released' where id = v_result; end if;
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set coordinator 00000000-0000-4000-8000-000000000005
\set cohort 10000000-0000-4000-8000-000000000010
\set u3 10000000-0000-4000-8000-000000000003
\set u4 10000000-0000-4000-8000-000000000004

update programmes.cohort_moderation_state set moderation_policy = 'not_moderated' where cohort_id = :'cohort';
insert into programmes.units (id, qualification_id, code, title)
values (:'u4', '10000000-0000-4000-8000-000000000002', 'U4', 'Handle correspondence');
insert into programmes.unit_credit_values (unit_id, credits) values (:'u4', 8);
insert into submissions.tasks (id, cohort_id, title, brief, submission_type, due_at, state, published_at, published_by)
values ('10000000-0000-4000-8000-000000000021', :'cohort', 'Task 4: Business letter', 'Write it.', 'text', '2027-03-01 17:00+02', 'published', now(), :'coordinator');
insert into assessment.assessable_items (cohort_id, kind, task_id, title)
values (:'cohort', 'task', '10000000-0000-4000-8000-000000000020', 'Task 3: Workplace records portfolio'),
       (:'cohort', 'task', '10000000-0000-4000-8000-000000000021', 'Task 4: Business letter');
select id as item3 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000020' \gset
select id as item4 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000021' \gset

-- ---------------------------------------------------------------------------------------------------------------
-- Before any requirements are frozen
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select results_eq($$ select unit_code, credits, earned, awarded, requirements_set, items from api.get_my_credits() order by unit_code $$,
  $$ values ('U3'::text, 12, 0, false, false, '[]'::jsonb), ('U4', 8, 0, false, false, '[]') $$,
  'the learner sees every unit of the programme, with nothing required yet');
select is((select cohort_name from api.get_my_credits() limit 1), '2026 Intake B', 'from their cohort');
select is_empty($$ select * from api.list_my_credit_history() $$, 'and an empty history');
reset role;

select pg_temp.act_as(:'coordinator');
select is_empty($$ select * from api.get_my_credits() $$, 'someone not enrolled sees no units');
select requirement_set_id as draft from api.save_requirement_draft(:'cohort', jsonb_build_array(
  jsonb_build_object('unit_id', :'u3', 'assessable_item_id', :'item3'),
  jsonb_build_object('unit_id', :'u3', 'assessable_item_id', :'item4'),
  jsonb_build_object('unit_id', :'u4', 'assessable_item_id', :'item4'))) \gset
select status from api.freeze_requirement_set(:'cohort', :'draft', null) \gset
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- In progress: a released Competent and a held result (FR-804)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.result(:'learner', :'item3', 'competent', true) as r3 \gset
select pg_temp.result(:'learner', :'item4', 'competent', false) as r4 \gset

select pg_temp.act_as(:'learner');
select is((select items from api.get_my_credits() where unit_code = 'U3'),
  jsonb_build_array(
    jsonb_build_object('title', 'Task 3: Workplace records portfolio', 'state', 'competent', 'result_id', :'r3', 'deadline_at', null, 'due_at', null),
    jsonb_build_object('title', 'Task 4: Business letter', 'state', 'being_assessed', 'result_id', null, 'deadline_at', null, 'due_at', null)),
  'a held Competent reads as being assessed: no outcome and no link to the result');
select results_eq($$ select awarded, earned, requirements_set from api.get_my_credits() order by unit_code $$,
  $$ values (false, 0, true), (false, 0, true) $$, 'nothing is earned while one required result is held');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Earned, then reversed by an appeal
-- ---------------------------------------------------------------------------------------------------------------

update assessment.results set state = 'released' where id = :'r4';
select pg_temp.act_as(:'learner');
select results_eq($$ select unit_code, credits, earned, awarded, awarded_at is not null from api.get_my_credits() order by unit_code $$,
  $$ values ('U3'::text, 12, 12, true, true), ('U4', 8, 8, true, true) $$, 'released, both units are earned from the ledger');
select results_eq($$ select unit_code, credits, entry_type, cause, total from api.list_my_credit_history() order by entry_id $$,
  $$ values ('U3'::text, 12, 'award'::text, 'release'::text, 12), ('U4', 8, 'award', 'release', 20) $$,
  'the history lists each award with the running total');
reset role;

insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
select :'r4', 'appeal', 'not_yet_competent', '00000000-0000-4000-8000-000000000006', 'administrator', 'Reconsidered.', r.current_decision_id
from assessment.results r where r.id = :'r4' returning id as a4 \gset
update assessment.results set current_decision_id = :'a4', remediation_period = interval '14 days' where id = :'r4';

select pg_temp.act_as(:'learner');
select results_eq($$ select unit_code, earned, awarded from api.get_my_credits() order by unit_code $$,
  $$ values ('U3'::text, 0, false), ('U4', 0, false) $$, 'an appeal to Not yet competent takes both units out of the earned total');
select results_eq($$ select credits, entry_type, cause, total from api.list_my_credit_history() order by entry_id desc limit 2 $$,
  $$ values (-8, 'reversal'::text, 'appeal'::text, 0), (-12, 'reversal', 'appeal', 8) $$,
  'as new lines in the history: nothing earlier is rewritten');
select is((select count(*)::integer from api.list_my_credit_history()), 4, 'the two awards are still listed');
select is((select items -> 1 ->> 'state' from api.get_my_credits() where unit_code = 'U3'), 'not_yet_competent',
  'the released Not yet competent is shown');
select ok((select (items -> 1 ->> 'deadline_at') is not null from api.get_my_credits() where unit_code = 'U3'),
  'with the day by which to resubmit');
select is((select credits from api.get_my_credits() where unit_code = 'U3'), 12, 'an outstanding unit shows the value in force');
reset role;

-- A resubmission waiting to be marked reads as being assessed, not as the earlier outcome.
insert into assessment.assessment_instances (result_id, state) values (:'r4', 'to_mark');
select pg_temp.act_as(:'learner');
select is((select items -> 1 ->> 'state' from api.get_my_credits() where unit_code = 'U3'), 'being_assessed',
  'a resubmission waiting to be marked reads as being assessed');
reset role;

-- An assessment with no result yet is not started, with its due date.
delete from assessment.assessment_instances where result_id = :'r4' and state = 'to_mark';
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000109', 'authenticated', 'authenticated', 'pgtap.credits@takusani.test', now(), now();
insert into identity.profiles (id, full_name) values ('00000000-0000-4000-8000-000000000109', 'Thabo Dlamini');
insert into programmes.enrolments (cohort_id, profile_id) values (:'cohort', '00000000-0000-4000-8000-000000000109');

select pg_temp.act_as('00000000-0000-4000-8000-000000000109');
select is((select items -> 1 from api.get_my_credits() where unit_code = 'U3'),
  jsonb_build_object('title', 'Task 4: Business letter', 'state', 'not_started', 'result_id', null, 'deadline_at', null,
    'due_at', '2027-03-01T15:00:00+00:00'::timestamptz),
  'an assessment not handed in yet is not started, with its due date');
select is_empty($$ select * from api.list_my_credit_history() $$, 'another learner sees none of Lerato''s history');
select is((select sum(earned)::integer from api.get_my_credits()), 0, 'nor her credits');
reset role;

-- A learner whose enrolment is still pending (cohort in setup) sees nothing.
update programmes.enrolments set status = 'withdrawn' where profile_id = '00000000-0000-4000-8000-000000000109';
select pg_temp.act_as('00000000-0000-4000-8000-000000000109');
select is_empty($$ select * from api.get_my_credits() $$, 'a withdrawn enrolment shows no units');
reset role;

select * from finish();
rollback;
