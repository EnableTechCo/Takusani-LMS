-- Unit credit roll-up and ledger (S6-01; FR-801 to FR-804; ADR-022; P-07; transaction tests 10, 17, 25 and the
-- credit half of 27). Uses the local seed: Ayesha (coordinator@) coordinates "2026 Intake B", whose programme has
-- unit U3 (12 credits); Sipho (admin@) is an administrator; Nomsa (assessor@) assesses; Lerato (learner@) is enrolled.
-- The two-releases-at-once half of test 17 needs two sessions: scripts/check-credit-concurrency.mjs.
create extension if not exists pgtap with schema extensions;

begin;
select plan(54);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

create function pg_temp.learner(p_learner uuid, p_name text) returns void language plpgsql as $$
begin
  if not exists (select 1 from identity.profiles where id = p_learner) then
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', p_learner, 'authenticated', 'authenticated', 'pgtap.' || p_learner::text || '@takusani.test', now(), now());
    insert into identity.profiles (id, full_name) values (p_learner, p_name);
    insert into programmes.enrolments (cohort_id, profile_id) values ('10000000-0000-4000-8000-000000000010', p_learner);
  end if;
end $$;

-- A result with one assessment decision, held or released.
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

-- A later decision of the given type superseding the current one, which releases it through the release guard.
create function pg_temp.supersede(p_result uuid, p_type text, p_outcome text) returns uuid language plpgsql as $$
declare v_decision uuid;
begin
  insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id, remediation, resubmission_days)
  select p_result, p_type, p_outcome, '00000000-0000-4000-8000-000000000006', 'administrator', 'Reconsidered.', r.current_decision_id,
    case when p_outcome = 'not_yet_competent' then 'Redo the filing index.' end,
    case when p_outcome = 'not_yet_competent' then 14 end
  from assessment.results r where r.id = p_result
  returning id into v_decision;
  update assessment.results set current_decision_id = v_decision,
    remediation_period = case when p_outcome = 'not_yet_competent' then interval '14 days' end
  where id = p_result;
  return v_decision;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set coordinator 00000000-0000-4000-8000-000000000005
\set admin 00000000-0000-4000-8000-000000000006
\set cohort 10000000-0000-4000-8000-000000000010
\set u3 10000000-0000-4000-8000-000000000003
\set naledi 00000000-0000-4000-8000-000000000102
\set thabo 00000000-0000-4000-8000-000000000103

update programmes.cohort_moderation_state set moderation_policy = 'not_moderated' where cohort_id = :'cohort';
select pg_temp.learner(:'naledi', 'Naledi Botha');
select pg_temp.learner(:'thabo', 'Thabo Dlamini');

-- A second unit worth 8, and one with no credit value yet.
insert into programmes.units (id, qualification_id, code, title)
values ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'U4', 'Handle correspondence'),
       ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'U5', 'Plan meetings');
insert into programmes.unit_credit_values (unit_id, credits) values ('10000000-0000-4000-8000-000000000004', 8);
\set u4 10000000-0000-4000-8000-000000000004
\set u5 10000000-0000-4000-8000-000000000005

-- Three published tasks of the cohort, each with its assessable item.
insert into submissions.tasks (id, cohort_id, title, brief, submission_type, due_at, state, published_at, published_by)
values ('10000000-0000-4000-8000-000000000021', :'cohort', 'Task 4: Business letter', 'Write it.', 'text', now() + interval '30 days', 'published', now(), :'coordinator'),
       ('10000000-0000-4000-8000-000000000022', :'cohort', 'Task 5: Minutes', 'Take them.', 'text', now() + interval '30 days', 'published', now(), :'coordinator');
insert into assessment.assessable_items (cohort_id, kind, task_id, title)
values (:'cohort', 'task', '10000000-0000-4000-8000-000000000020', 'Task 3: Workplace records portfolio'),
       (:'cohort', 'task', '10000000-0000-4000-8000-000000000021', 'Task 4: Business letter'),
       (:'cohort', 'task', '10000000-0000-4000-8000-000000000022', 'Task 5: Minutes');
select id as item3 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000020' \gset
select id as item4 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000021' \gset
select id as item5 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000022' \gset

-- Released before any requirement set exists: counts once one is frozen.
select pg_temp.result(:'learner', :'item3', 'competent', true) as l3 \gset

-- ---------------------------------------------------------------------------------------------------------------
-- Who may draft, and what a draft may hold
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.save_requirement_draft(%L, '[]') $$, :'cohort'),
  $$ values ('not_found'::text) $$, 'a learner cannot draft requirements');
select is_empty(format($$ select * from api.get_cohort_credit_requirements(%L) $$, :'cohort'), 'nor read them');
reset role;

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.save_requirement_draft(%L, '{"a": 1}') $$, :'cohort'),
  $$ values ('invalid_requirements'::text) $$, 'the requirements are an array of pairs');
select results_eq(format($$ select status from api.save_requirement_draft(%L, %L) $$, :'cohort',
  jsonb_build_array(jsonb_build_object('unit_id', gen_random_uuid(), 'assessable_item_id', :'item3'))),
  $$ values ('unit_not_in_programme'::text) $$, 'a unit must belong to the cohort''s programme');
select results_eq(format($$ select status from api.save_requirement_draft(%L, %L) $$, :'cohort',
  jsonb_build_array(jsonb_build_object('unit_id', :'u3', 'assessable_item_id', gen_random_uuid()))),
  $$ values ('item_not_in_cohort'::text) $$, 'an item must be one of the cohort''s assessments');

-- U5 has no credit value: freezing is refused and names it.
select requirement_set_id as draft1 from api.save_requirement_draft(:'cohort', jsonb_build_array(
  jsonb_build_object('unit_id', :'u3', 'assessable_item_id', :'item3'),
  jsonb_build_object('unit_id', :'u5', 'assessable_item_id', :'item5'))) \gset
select results_eq(format($$ select status, missing from api.freeze_requirement_set(%L, %L, null) $$, :'cohort', :'draft1'),
  $$ values ('credit_value_missing'::text, array['U5']) $$, 'a unit without a credit value in force cannot be frozen');

-- Version 1: U3 needs Tasks 3 and 4; U4 needs Task 4. One item counts towards two units.
select results_eq(format($$ select status, requirement_set_id::text, version from api.save_requirement_draft(%L, %L) $$, :'cohort',
  jsonb_build_array(
    jsonb_build_object('unit_id', :'u3', 'assessable_item_id', :'item3'),
    jsonb_build_object('unit_id', :'u3', 'assessable_item_id', :'item4'),
    jsonb_build_object('unit_id', :'u4', 'assessable_item_id', :'item4'))),
  format($$ values ('ok'::text, %L::text, 1) $$, :'draft1'), 'saving again replaces the same draft');
select results_eq(format($$ select status from api.freeze_requirement_set(%L, gen_random_uuid(), null) $$, :'cohort'),
  $$ values ('stale_draft'::text) $$, 'freezing names the draft that was read');
reset role;
select is((select count(*)::integer from credits.ledger_entries), 0, 'nothing is awarded before a set is frozen');
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status, version, awarded from api.freeze_requirement_set(%L, %L, null) $$, :'cohort', :'draft1'),
  $$ values ('ok'::text, 1, 0) $$, 'version 1 is frozen; Lerato has one of the two assessments U3 needs');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Award when every required item is released Competent (test 17)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.result(:'learner', :'item4', 'competent', true) as l4 \gset
select current_decision_id as d3 from assessment.results where id = :'l3' \gset
select current_decision_id as d4 from assessment.results where id = :'l4' \gset

select results_eq(format($$ select unit_id::text, award_seq, entry_type, credits, credit_value, requirement_set_version, cause
  from credits.ledger_entries where learner_id = %L order by unit_id $$, :'learner'),
  format($$ values (%L::text, 1, 'award'::text, 12, 12, 1, 'release'::text), (%L::text, 1, 'award'::text, 8, 8, 1, 'release'::text) $$, :'u3', :'u4'),
  'the second release awards U3 (both items) and U4 (one item serving two units), once each');
select is((select contributing_decision_ids @> array[:'d3'::uuid, :'d4'::uuid] and cardinality(contributing_decision_ids) = 2
  from credits.ledger_entries where learner_id = :'learner' and unit_id = :'u3'), true, 'the U3 award names both contributing decisions');
select is((select contributing_decision_ids from credits.ledger_entries where learner_id = :'learner' and unit_id = :'u4'),
  array[:'d4'::uuid], 'the U4 award names its one decision');
select results_eq(format($$ select awarded, award_seq, credits from credits.learner_unit_outcomes where learner_id = %L order by unit_id $$, :'learner'),
  $$ values (true, 1, 12), (true, 1, 8) $$, 'the outcome rows hold the awards in force');

-- Test 10: evaluating again, or retrying the entry, adds nothing.
select is(credits.evaluate_unit(:'learner', :'u3', 'release', null), 'unchanged', 'a retry of the evaluation changes nothing');
select is(credits.evaluate_unit(:'learner', :'u3', 'release', null), 'unchanged', 'nor does a second retry');
select is((select count(*)::integer from credits.ledger_entries where learner_id = :'learner'), 2, 'still one ledger effect per award');
select throws_ok(format($$ insert into credits.ledger_entries (learner_id, unit_id, award_seq, entry_type, credits, credit_value,
    requirement_set_id, requirement_set_version, contributing_decision_ids, cause)
  values (%L, %L, 1, 'award', 12, 12, %L, 1, array[%L::uuid], 'release') $$, :'learner', :'u3', :'draft1', :'d3'),
  '23505', null, 'the ledger refuses a second award of the same sequence');

-- FR-804: a held result contributes nothing, even when its decision is Competent.
select pg_temp.result(:'naledi', :'item3', 'competent', true) as n3 \gset
select pg_temp.result(:'naledi', :'item4', 'competent', false) as n4 \gset
select is((select count(*)::integer from credits.ledger_entries where learner_id = :'naledi'), 0,
  'a held Competent decision earns no credit');
update assessment.results set state = 'released' where id = :'n4';
select is((select count(*)::integer from credits.ledger_entries where learner_id = :'naledi' and entry_type = 'award'), 2,
  'released, it completes both units');

-- Not yet competent does not award.
select pg_temp.result(:'thabo', :'item4', 'not_yet_competent', true) as t4 \gset
select is((select count(*)::integer from credits.ledger_entries where learner_id = :'thabo'), 0, 'Not yet competent earns nothing');
select is((select awarded from credits.learner_unit_outcomes where learner_id = :'thabo' and unit_id = :'u4'), false,
  'and the outcome row says so');

-- ---------------------------------------------------------------------------------------------------------------
-- Reversal and re-award: appeal to NYC, correction back (tests 17 and 27)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.supersede(:'l4', 'appeal', 'not_yet_competent') as a4 \gset
select results_eq(format($$ select unit_id::text, award_seq, entry_type, credits, cause, cause_decision_id::text
  from credits.ledger_entries where learner_id = %L and entry_type = 'reversal' order by unit_id $$, :'learner'),
  format($$ values (%L::text, 1, 'reversal'::text, -12, 'appeal'::text, %L::text), (%L::text, 1, 'reversal'::text, -8, 'appeal'::text, %L::text) $$,
    :'u3', :'a4', :'u4', :'a4'),
  'an appeal amending a required item to NYC reverses both awards it contributed to');
select is((select contributing_decision_ids @> array[:'a4'::uuid] from credits.ledger_entries
  where learner_id = :'learner' and unit_id = :'u3' and entry_type = 'reversal'), true, 'the reversal names the NYC decision');
select is((select sum(credits)::integer from credits.ledger_entries where learner_id = :'learner'), 0, 'the ledger nets to nothing');
select results_eq(format($$ select awarded, award_seq from credits.learner_unit_outcomes where learner_id = %L order by unit_id $$, :'learner'),
  $$ values (false, 1), (false, 1) $$, 'the outcome rows are no longer awarded');

select pg_temp.supersede(:'l4', 'correction', 'competent') as c4 \gset
select results_eq(format($$ select unit_id::text, award_seq, credits, cause from credits.ledger_entries
  where learner_id = %L and award_seq = 2 order by unit_id $$, :'learner'),
  format($$ values (%L::text, 2, 12, 'correction'::text), (%L::text, 2, 8, 'correction'::text) $$, :'u3', :'u4'),
  'a correction back to Competent appends new awards with the next sequence');
select is((select sum(credits)::integer from credits.ledger_entries where learner_id = :'learner'), 20, 'the ledger totals 20 credits');
select is((select count(*)::integer from credits.ledger_entries where learner_id = :'learner'), 6, 'award, reversal, award for each unit');

-- A Competent decision superseding a Competent one keeps the award: nothing is appended.
select pg_temp.supersede(:'l3', 'moderation', 'competent') as m3 \gset
select is((select count(*)::integer from credits.ledger_entries where learner_id = :'learner'), 6, 'Competent after Competent appends nothing');

-- ---------------------------------------------------------------------------------------------------------------
-- A requirement change mid-cohort (test 25)
-- ---------------------------------------------------------------------------------------------------------------

-- Thabo has Task 3 Competent only.
select pg_temp.result(:'thabo', :'item3', 'competent', true) as t3 \gset
select is((select count(*)::integer from credits.ledger_entries where learner_id = :'thabo'), 0, 'Thabo meets nothing under version 1');

select pg_temp.act_as(:'coordinator');
select requirement_set_id as draft2 from api.save_requirement_draft(:'cohort', jsonb_build_array(
  jsonb_build_object('unit_id', :'u3', 'assessable_item_id', :'item3'),
  jsonb_build_object('unit_id', :'u4', 'assessable_item_id', :'item4'),
  jsonb_build_object('unit_id', :'u4', 'assessable_item_id', :'item5'))) \gset
select results_eq(format($$ select status from api.freeze_requirement_set(%L, %L, null) $$, :'cohort', :'draft2'),
  $$ values ('reason_required'::text) $$, 'changing the requirements needs a reason');
select results_eq(format($$ select status, version, awarded from api.freeze_requirement_set(%L, %L, 'U3 is now assessed by the portfolio alone.') $$, :'cohort', :'draft2'),
  $$ values ('ok'::text, 2, 1) $$, 'version 2 is frozen: the re-evaluation awards Thabo U3 under it');
reset role;

select results_eq(format($$ select unit_id::text, requirement_set_version, cause from credits.ledger_entries where learner_id = %L $$, :'thabo'),
  format($$ values (%L::text, 2, 'requirement_set'::text) $$, :'u3'), 'Thabo''s award records version 2 and why');
select is((select count(*)::integer from credits.ledger_entries where learner_id in (:'learner', :'naledi')), 8,
  'awards already made are untouched: nobody who held U4 under version 1 loses it for lacking Task 5');
select results_eq(format($$ select s.version from credits.learner_unit_outcomes o join credits.requirement_sets s on s.id = o.requirement_set_id
  where o.learner_id = %L and o.unit_id = %L $$, :'naledi', :'u4'), $$ values (1) $$, 'Naledi''s U4 award still rests on version 1');
select results_eq($$ select action, (before ->> 'version')::integer, (after ->> 'version')::integer, details ->> 'reason'
  from audit.events where action = 'credits.requirement_set_frozen' order by id desc limit 1 $$,
  $$ values ('credits.requirement_set_frozen'::text, 1, 2, 'U3 is now assessed by the portfolio alone.'::text) $$,
  'the change is audited with both versions and the reason');

-- Frozen sets and the ledger cannot be changed by anyone.
select throws_ok(format($$ update credits.requirement_sets set reason = 'edited' where id = %L $$, :'draft1'), '42501', null,
  'a frozen set cannot be edited');
select throws_ok(format($$ delete from credits.unit_assessment_requirements where requirement_set_id = %L $$, :'draft1'), '42501', null,
  'nor can its requirements');
select throws_ok($$ update credits.ledger_entries set credits = 0 $$, null, null, 'ledger entries cannot be updated');
select throws_ok($$ delete from credits.ledger_entries $$, null, null, 'nor deleted');

-- A draft can be discarded; then there is none.
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status, version from api.save_requirement_draft(%L, '[]') $$, :'cohort'),
  $$ values ('ok'::text, 3) $$, 'an empty draft may be saved, as version 3');
select requirement_set_id as draft3 from api.save_requirement_draft(:'cohort', '[]') \gset
select results_eq(format($$ select status from api.freeze_requirement_set(%L, %L, 'x') $$, :'cohort', :'draft3'),
  $$ values ('no_requirements'::text) $$, 'but not frozen');
select results_eq(format($$ select status from api.discard_requirement_draft(%L) $$, :'cohort'), $$ values ('ok'::text) $$, 'the draft is discarded');
select results_eq(format($$ select status from api.discard_requirement_draft(%L) $$, :'cohort'), $$ values ('no_draft'::text) $$, 'and is gone');

-- The page's read.
select results_eq(format($$ select jsonb_array_length(sets), (sets -> 1 ->> 'in_force')::boolean, (sets -> 0 ->> 'awards')::integer
  from api.get_cohort_credit_requirements(%L) $$, :'cohort'),
  $$ values (2, true, 6) $$, 'the coordinator sees both versions, version 2 in force, and the awards made under version 1');
select is((select (u ->> 'awarded_learners')::integer from api.get_cohort_credit_requirements(:'cohort') r,
  jsonb_array_elements(r.units) u where u ->> 'code' = 'U3'), 3, 'three learners hold U3 from this cohort');
reset role;

select results_eq(format($$ select done, detail from programmes.readiness(%L) where item_key = 'unit_requirements' $$, :'cohort'),
  $$ values (true, '2'::text) $$, 'readiness shows the version in force');

-- ---------------------------------------------------------------------------------------------------------------
-- Reconciliation
-- ---------------------------------------------------------------------------------------------------------------

select is(audit.run_job('reconcile-credits'), 0, 'with the ledger and the rule in step, reconciliation finds nothing');

-- Break an outcome row behind the functions' back: the ledger says awarded, the row says not.
update credits.learner_unit_outcomes
set awarded = false, requirement_set_id = null, credits = null, contributing_decision_ids = null, awarded_at = null
where learner_id = :'naledi' and unit_id = :'u3';
select is(audit.run_job('reconcile-credits'), 3, 'reconciliation finds the difference three ways');
select results_eq($$ select kind from credits.reconciliation_differences order by kind $$,
  $$ values ('ledger_sequence'::text), ('ledger_total'::text), ('met_not_awarded'::text) $$, 'naming each');
select is((select count(*)::integer from notifications.notifications
  where event_type = 'credit_reconciliation_differences' and recipient_id = :'admin'), 1, 'and tells the administrator');

select pg_temp.act_as(:'admin');
select results_eq($$ select last_status, last_differences, jsonb_array_length(differences) from api.get_credit_reconciliation() $$,
  $$ values ('succeeded'::text, 3, 3) $$, 'the administrator reads the last run and its differences');
reset role;
select pg_temp.act_as(:'coordinator');
select is_empty($$ select * from api.get_credit_reconciliation() $$, 'a coordinator does not');
reset role;

select * from finish();
rollback;
