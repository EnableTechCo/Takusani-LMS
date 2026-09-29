-- Administrative correction under dual control (S4-12; P-12; BR-03; test plan 27). Uses the local seed: Ayesha
-- (coordinator@) coordinates "2026 Intake B"; Zanele (staff@) also coordinates it and assesses there; Sipho
-- (admin@) is an administrator; Nomsa (assessor@) assesses; Lerato (learner@) is enrolled.
create extension if not exists pgtap with schema extensions;

begin;
select plan(44);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A released result for a learner, decided by p_assessor, released in a cohort that is not moderated.
create function pg_temp.released_result(p_learner uuid, p_name text, p_item uuid, p_assessor uuid, p_outcome text)
returns uuid language plpgsql as $$
declare v_result uuid; v_decision uuid;
begin
  if not exists (select 1 from identity.profiles where id = p_learner) then
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', p_learner, 'authenticated', 'authenticated', 'pgtap.' || p_learner::text || '@takusani.test', now(), now());
    insert into identity.profiles (id, full_name) values (p_learner, p_name);
    insert into programmes.enrolments (cohort_id, profile_id) values ('10000000-0000-4000-8000-000000000010', p_learner);
  end if;
  insert into assessment.results (assessable_item_id, learner_id, state) values (p_item, p_learner, 'held') returning id into v_result;
  insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, scores, feedback, remediation, resubmission_days)
  values (v_result, 'assessment', p_outcome, p_assessor, 'assessor', 'Judged against every criterion.',
          '[{"ordinal": 1, "points": 2, "comment": "Thin."}]'::jsonb, 'Keep going.',
          case when p_outcome = 'not_yet_competent' then 'Add the access register.' end,
          case when p_outcome = 'not_yet_competent' then 14 end)
  returning id into v_decision;
  update assessment.results set current_decision_id = v_decision,
    remediation_period = case when p_outcome = 'not_yet_competent' then interval '14 days' end
  where id = v_result;
  update assessment.results set state = 'released' where id = v_result;
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set admin 00000000-0000-4000-8000-000000000006
\set staff 00000000-0000-4000-8000-000000000007
\set cohort 10000000-0000-4000-8000-000000000010

update programmes.cohort_moderation_state set moderation_policy = 'not_moderated' where cohort_id = :'cohort';
insert into assessment.assessable_items (cohort_id, kind, task_id, title)
values (:'cohort', 'task', '10000000-0000-4000-8000-000000000020', 'Task 3: Workplace records portfolio');
select id as item3 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000020' \gset
insert into submissions.task_criteria (task_id, ordinal, title, descriptor, points)
values ('10000000-0000-4000-8000-000000000020', 1, 'Filing index', 'Others can find records from it.', 4)
on conflict do nothing;

-- Lerato: released Not yet competent by Nomsa, wrongly. Naledi: released Competent by Zanele.
select pg_temp.released_result(:'learner', 'Lerato Mokoena', :'item3', :'assessor', 'not_yet_competent') as r1 \gset
select pg_temp.released_result('00000000-0000-4000-8000-000000000102', 'Naledi Botha', :'item3', :'staff', 'competent') as r2 \gset
select current_decision_id as d1, release_seq as seq1 from assessment.results where id = :'r1' \gset

-- ---------------------------------------------------------------------------------------------------------------
-- Who may propose
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.propose_correction(%L, 'competent', 'All criteria met.', 'Mis-scored.') $$, :'r1'),
  $$ values ('not_found'::text) $$, 'a learner cannot propose a correction');
select is_empty(format($$ select * from api.list_correctable_results(%L) $$, :'cohort'), 'nor list correctable results');
reset role;

select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status from api.propose_correction(%L, 'competent', 'All criteria met.', 'Mis-scored.') $$, :'r1'),
  $$ values ('not_found'::text) $$, 'nor an assessor who does not coordinate the cohort');
reset role;

select pg_temp.act_as(:'staff');
select results_eq(format($$ select status from api.propose_correction(%L, 'not_yet_competent', 'x', 'y', 'z', 14) $$, :'r2'),
  $$ values ('took_a_decision'::text) $$, 'a coordinator who decided the result cannot propose correcting it');
reset role;

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select learner_name, outcome, decision_type, blocker, open_correction_id from api.list_correctable_results(%L) order by learner_name $$, :'cohort'),
  $$ values ('Lerato Mokoena'::text, 'not_yet_competent'::text, 'assessment'::text, null::text, null::uuid),
            ('Naledi Botha', 'competent', 'assessment', null, null) $$,
  'the coordinator lists the released results of the cohort');
select results_eq(format($$ select status from api.propose_correction(%L, 'not_yet_competent', 'Same.', 'None.', 'x', 14) $$, :'r1'),
  $$ values ('unchanged'::text) $$, 'a correction changes the outcome');
select results_eq(format($$ select status from api.propose_correction(%L, 'competent', ' ', 'Mis-scored.') $$, :'r1'),
  $$ values ('justification_required'::text) $$, 'it needs the justification');
select results_eq(format($$ select status from api.propose_correction(%L, 'competent', 'All criteria met.', ' ') $$, :'r1'),
  $$ values ('reason_required'::text) $$, 'and why the released outcome was wrong');
select results_eq(format($$ select status from api.propose_correction(%L, 'not_yet_competent', 'Missing records.', 'Mis-scored.') $$, :'r2'),
  $$ values ('remediation_required'::text) $$, 'a Not yet competent correction says what the learner must do');
select results_eq(format($$ select status, correction_id is not null from api.propose_correction(%L, 'competent', 'The access register was in the appendix; every criterion is met.', 'The assessor missed the appendix.') $$, :'r1'),
  $$ values ('ok'::text, true) $$, 'the coordinator proposes a correction');
select correction_id as c1 from api.list_corrections() where result_id = :'r1' \gset
select results_eq(format($$ select status from api.propose_correction(%L, 'competent', 'Again.', 'Again.') $$, :'r1'),
  $$ values ('already_proposed'::text) $$, 'one open proposal per result');
select results_eq(format($$ select state, mine, may_conclude, current_outcome, proposed_outcome from api.list_corrections() where correction_id = %L $$, :'c1'),
  $$ values ('proposed'::text, true, false, 'not_yet_competent'::text, 'competent'::text) $$,
  'the proposer sees it as theirs and cannot conclude it');
reset role;

select results_eq($$ select recipient_id, payload ->> 'proposed_outcome' from notifications.notifications where event_type = 'correction_proposed' $$,
  $$ values ('00000000-0000-4000-8000-000000000007'::uuid, 'competent'::text) $$, 'the cohort''s other coordinator is told it needs approving');
select is((select state from assessment.results where id = :'r1'), 'released', 'nothing changed for the learner yet');
select is((select current_decision_id from assessment.results where id = :'r1'), :'d1'::uuid, 'the released decision still stands');

-- ---------------------------------------------------------------------------------------------------------------
-- Dual control (test plan 27)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.conclude_correction(%L, true) $$, :'c1'),
  $$ values ('same_person'::text) $$, 'the proposer cannot approve their own correction');
reset role;

-- Zanele coordinates the cohort and assessed Naledi's result: she may not approve a correction of it.
select pg_temp.act_as(:'coordinator');
select correction_id as c0 from api.propose_correction(:'r2', 'not_yet_competent', 'Two records are missing.', 'Released as Competent in error.', 'Add the access register.', 14) \gset
reset role;
select pg_temp.act_as(:'staff');
select results_eq(format($$ select may_conclude, cannot_conclude_because from api.get_correction(%L) $$, :'c0'),
  $$ values (false, 'took_a_decision'::text) $$, 'a coordinator who took a decision on the result is told she cannot conclude it');
select results_eq(format($$ select status from api.conclude_correction(%L, true) $$, :'c0'),
  $$ values ('took_a_decision'::text) $$, 'and is refused under the result lock, whatever changed since the proposal');
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.withdraw_correction(%L) $$, :'c0'), $$ values ('ok'::text) $$, 'that proposal is withdrawn');
reset role;

-- Declining needs a reason; an administrator may conclude.
select pg_temp.act_as(:'admin');
select results_eq(format($$ select state, may_conclude, cannot_conclude_because, corrected_outcome, corrected_decided_by_name, reason from api.get_correction(%L) $$, :'c1'),
  $$ values ('proposed'::text, true, null::text, 'not_yet_competent'::text, 'Nomsa Dlamini'::text, 'The assessor missed the appendix.'::text) $$,
  'the administrator reads the proposal beside the decision it corrects');
select results_eq(format($$ select status from api.conclude_correction(%L, false, ' ') $$, :'c1'),
  $$ values ('reason_required'::text) $$, 'declining needs a reason');
select results_eq(format($$ select status, decision_id is not null, released_at is not null, appeal_deadline_at is not null from api.conclude_correction(%L, true) $$, :'c1'),
  $$ values ('ok'::text, true, true, true) $$, 'a second authorised person approves: the correction is released with a new appeal window');
select results_eq(format($$ select status from api.conclude_correction(%L, true) $$, :'c1'),
  $$ values ('not_open'::text) $$, 'a correction is concluded once');
reset role;

select correction_decision_id as d_corr from assessment.corrections where id = :'c1' \gset
select results_eq(format($$ select type, outcome, actor_id, acting_role, feedback, remediation from assessment.decisions where id = %L $$, :'d_corr'),
  format($$ values ('correction'::text, 'competent'::text, %L::uuid, 'administrator'::text, 'Keep going.'::text, null::text) $$, :'admin'),
  'the correction is a decision of its own, by the approver, carrying the feedback');
select results_eq(format($$ select current_decision_id = %L, state, release_seq > %s, remediation_deadline_at from assessment.results where id = %L $$, :'d_corr', :'seq1', :'r1'),
  $$ values (true, 'released'::text, true, null::timestamptz) $$, 'the result points at it, released again with a new sequence number and no resubmission');
select is((select count(*)::int from assessment.decisions where result_id = :'r1'), 2, 'the original stays on record beside the correction (BR-03)');
select results_eq(format($$ select count(*)::int from assessment.decision_releases where decision_id = %L $$, :'d_corr'),
  $$ values (1) $$, 'and the release of the correction is recorded');
select is((select count(*)::int from notifications.notifications n join assessment.results r on r.id = :'r1'
           where n.event_key = 'result_released:' || r.id::text || ':' || r.release_seq::text), 0,
  'the correction does not send the generic release notice');
select results_eq(format($$ select recipient_id, event_type from notifications.notifications where event_type in ('result_corrected', 'correction_concluded') and (payload ->> 'result_id' = %L or payload ->> 'correction_id' = %L) order by event_type $$, :'r1', :'c1'),
  format($$ values (%L::uuid, 'correction_concluded'::text), (%L::uuid, 'result_corrected'::text) $$, :'coordinator', :'learner'),
  'the learner is told the result was corrected, not simply released, and the proposer is told it was approved');
select results_eq(format($$ select action, acting_role from audit.events where object_id = %L order by id $$, :'c1'),
  $$ values ('assessment.correction_proposed'::text, 'coordinator'::text), ('assessment.correction_approved', 'administrator') $$,
  'proposal and approval are audited with each role');

select pg_temp.act_as(:'learner');
select results_eq(format($$ select corrected_at is not null, assessor_name from api.get_my_result_correction(%L) $$, :'r1'),
  $$ values (true, 'Nomsa Dlamini'::text) $$, 'the learner sees their result was corrected, with their assessor still named');
select results_eq(format($$ select status from api.lodge_appeal(%L, 'view_script', 'I would like to see the marks for each criterion on my corrected result, please, with the feedback.', gen_random_uuid()) $$, :'r1'),
  $$ values ('ok'::text) $$, 'and a corrected result can be appealed: it has its own window');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- What cannot be corrected, and withdrawing
-- ---------------------------------------------------------------------------------------------------------------

-- A held result, and an appeal decision.
select pg_temp.released_result('00000000-0000-4000-8000-000000000104', 'Sizwe Ndlovu', :'item3', :'assessor', 'competent') as r4 \gset
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
select :'r4', 'appeal', 'not_yet_competent', :'admin', 'appeal_reviewer', 'On review.', current_decision_id from assessment.results where id = :'r4'
returning id as d_appeal \gset
update assessment.results set current_decision_id = :'d_appeal', remediation_period = interval '14 days' where id = :'r4';

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select blocker from api.list_correctable_results(%L) where result_id = %L $$, :'cohort', :'r4'),
  $$ values ('appeal_final'::text) $$, 'a result decided on appeal is listed as final');
select results_eq(format($$ select status from api.propose_correction(%L, 'competent', 'x', 'y') $$, :'r4'),
  $$ values ('appeal_final'::text) $$, 'and cannot be corrected (FR-613)');

-- Withdraw: only the proposer, only while open.
select results_eq(format($$ select status from api.propose_correction(%L, 'not_yet_competent', 'Two records are missing.', 'Released as Competent in error.', 'Add the access register.', 14) $$, :'r2'),
  $$ values ('ok'::text) $$, 'another proposal');
select correction_id as c2 from api.list_corrections() where result_id = :'r2' and state = 'proposed' \gset
reset role;
select pg_temp.act_as(:'admin');
select results_eq(format($$ select status from api.withdraw_correction(%L) $$, :'c2'), $$ values ('not_found'::text) $$, 'only the proposer withdraws');
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.withdraw_correction(%L) $$, :'c2'), $$ values ('ok'::text) $$, 'the proposer withdraws it');
select results_eq(format($$ select state from api.get_correction(%L) $$, :'c2'), $$ values ('withdrawn'::text) $$, 'and it stays on record as withdrawn');

-- A decision that moves under an open proposal: approval is refused as stale.
select results_eq(format($$ select status from api.propose_correction(%L, 'not_yet_competent', 'Two records are missing.', 'Released as Competent in error.', 'Add the access register.', 14) $$, :'r2'),
  $$ values ('ok'::text) $$, 'a fresh proposal');
select correction_id as c3 from api.list_corrections() where result_id = :'r2' and state = 'proposed' \gset
reset role;
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
select :'r2', 'assessment', 'competent', :'assessor', 'assessor', 'Resubmission.', current_decision_id from assessment.results where id = :'r2'
returning id as d_new \gset
update assessment.results set current_decision_id = :'d_new' where id = :'r2';
select pg_temp.act_as(:'admin');
select results_eq(format($$ select result_changed, cannot_conclude_because from api.get_correction(%L) $$, :'c3'),
  $$ values (true, 'result_changed'::text) $$, 'the page says the result changed since the proposal');
select results_eq(format($$ select status from api.conclude_correction(%L, true) $$, :'c3'),
  $$ values ('result_changed'::text) $$, 'and approval is refused');
select results_eq(format($$ select status from api.conclude_correction(%L, false, 'The result changed; propose again if still needed.') $$, :'c3'),
  $$ values ('ok'::text) $$, 'it can still be declined, with a reason');
reset role;

-- Privileges
select table_privs_are('assessment', 'corrections', 'authenticated', array[]::text[], 'authenticated has no privilege on corrections');
select function_privs_are('assessment', 'took_a_decision', array['uuid', 'uuid'], 'authenticated', array[]::text[], 'nor on the independence helper');

select * from finish();
rollback;
