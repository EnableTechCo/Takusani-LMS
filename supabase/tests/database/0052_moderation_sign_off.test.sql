-- Sign-off and release (S4-09; FR-510, FR-511; BR-04, BR-05; P-05, P-06; test plan 6, 7, 13, 22, 23). Builds on a
-- frozen cycle as 0049 makes it, plus a released result with a decision held behind it (P-04) and a decision
-- finalised after the freeze.
create extension if not exists pgtap with schema extensions;

begin;
select plan(42);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A learner's decided result (held, or released with the decision current), with one submitted version and one file.
create function pg_temp.decided_result(p_learner uuid, p_name text, p_item uuid, p_assessor uuid, p_outcome text, p_decided_at timestamptz, p_state text)
returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_result uuid; v_decision uuid; v_submission uuid; v_version uuid; v_instance uuid; v_intent uuid; v_file uuid; v_key text;
begin
  if not exists (select 1 from identity.profiles where id = p_learner) then
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', p_learner, 'authenticated', 'authenticated',
            'pgtap.' || p_learner::text || '@takusani.test', now(), now());
    insert into identity.profiles (id, full_name, learner_number) values (p_learner, p_name, 'KSI-' || right(p_learner::text, 4));
    insert into programmes.enrolments (cohort_id, profile_id) values ('10000000-0000-4000-8000-000000000010', p_learner);
  end if;
  v_key := v_task::text || '/' || p_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  insert into submissions.file_upload_intents (profile_id, context_type, context_id, object_key, original_filename, declared_media_type,
    declared_bytes, max_bytes, allowed_media_types, expires_at, finalised_at)
  values (p_learner, 'task_submission', v_task, v_key, 'portfolio.pdf', 'application/pdf', 2048, 26214400,
    array['application/pdf'], now() + interval '2 hours', now()) returning id into v_intent;
  insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
  values (v_intent, 'submissions', v_key, 'portfolio.pdf', 2048, 'application/pdf', p_learner) returning id into v_file;
  insert into submissions.submissions (task_id, profile_id) values (v_task, p_learner) returning id into v_submission;
  insert into submissions.submission_versions (submission_id, version_number, submitted_at, is_late, receipt_reference)
  values (v_submission, 1, p_decided_at - interval '1 day', false, 'SUB-' || left(gen_random_uuid()::text, 8)) returning id into v_version;
  insert into submissions.submission_files (version_id, stored_file_id) values (v_version, v_file);
  insert into assessment.results (assessable_item_id, learner_id, state) values (p_item, p_learner, 'held') returning id into v_result;
  insert into assessment.assessment_instances (result_id, submission_version_id, assessor_id, state)
  values (v_result, v_version, p_assessor, 'decided') returning id into v_instance;
  insert into assessment.decisions (result_id, instance_id, type, outcome, actor_id, acting_role, justification, created_at,
                                    scores, feedback, remediation, resubmission_days)
  values (v_result, v_instance, 'assessment', p_outcome, p_assessor, 'assessor', 'Judged against every criterion.', p_decided_at,
          '[{"ordinal": 1, "points": 3, "comment": "Clear index."}]'::jsonb, 'Well organised.',
          case when p_outcome = 'not_yet_competent' then 'Add the retention schedule.' end,
          case when p_outcome = 'not_yet_competent' then 14 end)
  returning id into v_decision;
  update assessment.results set current_decision_id = v_decision,
    remediation_period = case when p_outcome = 'not_yet_competent' then interval '14 days' end
  where id = v_result;
  if p_state = 'released' then
    update programmes.cohort_moderation_state set moderation_policy = 'not_moderated' where cohort_id = '10000000-0000-4000-8000-000000000010';
    update assessment.results set state = 'released' where id = v_result;
    update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = '10000000-0000-4000-8000-000000000010';
  end if;
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set moderator 00000000-0000-4000-8000-000000000004
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set cohort 10000000-0000-4000-8000-000000000010

update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = :'cohort';
insert into assessment.assessable_items (cohort_id, kind, task_id, title)
values (:'cohort', 'task', '10000000-0000-4000-8000-000000000020', 'Task 3: Workplace records portfolio');
select id as item3 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000020' \gset
insert into submissions.task_criteria (task_id, ordinal, title, descriptor, points)
values ('10000000-0000-4000-8000-000000000020', 1, 'Filing index', 'Others can find records from it.', 4)
on conflict do nothing;

-- Three held results: two by Nomsa (assessor@), one Not yet competent, and one by Zanele (staff@). One released
-- result (Lerato's earlier release) with a later decision by Nomsa held behind it (P-04).
select pg_temp.decided_result(:'learner', 'Lerato Mokoena', :'item3', :'assessor', 'not_yet_competent', now() - interval '20 days', 'released') as r_lerato \gset
select pg_temp.decided_result('00000000-0000-4000-8000-000000000102', 'Naledi Botha', :'item3', :'assessor', 'competent', now() - interval '3 days', 'held') as r2 \gset
select pg_temp.decided_result('00000000-0000-4000-8000-000000000103', 'Kagiso Mahlangu', :'item3', :'assessor', 'not_yet_competent', now() - interval '2 days', 'held') as r3 \gset
select pg_temp.decided_result('00000000-0000-4000-8000-000000000104', 'Sizwe Ndlovu', :'item3', :'staff', 'competent', now() - interval '2 days', 'held') as r4 \gset
select release_seq as lerato_first_seq from assessment.results where id = :'r_lerato' \gset
-- Lerato's resubmission, decided Competent by Nomsa, held behind the released result.
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id, created_at)
select :'r_lerato', 'assessment', 'competent', :'assessor', 'assessor', 'Resubmission meets every criterion.', r.current_decision_id, now() - interval '1 day'
from assessment.results r where r.id = :'r_lerato' returning id as pending_decision \gset
update assessment.results set pending_decision_id = :'pending_decision' where id = :'r_lerato';

-- Plan and freeze. Everyone's decisions are first-time, so all four results are sampled.
select pg_temp.act_as(:'coordinator');
select cycle_id as cycle from api.plan_moderation_cycle(:'cohort', 'Term 3 assignments', array[:'item3']::uuid[]) \gset
select results_eq(format($$ select status, population, sample from api.freeze_moderation_cycle(%L, 1) $$, :'cycle'),
  $$ values ('ok'::text, 4, 4) $$, 'the cycle is frozen with all four results in its population');
reset role;

-- A decision finalised after the freeze: it waits for the next cycle (test plan 13, 23).
select pg_temp.decided_result('00000000-0000-4000-8000-000000000105', 'Thandi Mbeki', :'item3', :'staff', 'competent', now() - interval '1 hour', 'held') as r_after \gset
select is((select hold_cycle_id from assessment.results where id = :'r_after'), null, 'a result decided after the freeze is not in the population');

-- Thabo (moderator@) holds every item; Zanele assessed one population result, so she cannot sign off.
update moderation.sample_items set moderator_id = :'moderator', state = 'allocated', allocated_at = now() where cycle_id = :'cycle';
select id as item_r2 from moderation.sample_items where cycle_id = :'cycle' and result_id = :'r2' \gset

-- ---------------------------------------------------------------------------------------------------------------
-- Blocked (FR-510, test plan 6)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select is_empty(format($$ select * from api.get_sign_off(%L) $$, :'cycle'), 'someone who is not a moderator of the cohort sees no sign-off page');
select results_eq(format($$ select status from api.sign_off_moderation_cycle(%L, 2, 'All reviewed.') $$, :'cycle'),
  $$ values ('not_found'::text) $$, 'and cannot sign off');
reset role;

select pg_temp.act_as(:'moderator');
select results_eq(format($$ select population, competent, not_yet_competent, sample, concluded, after_freeze, jsonb_array_length(blockers), may_sign, assessed_by_me, other_signers, appeal_window_days from api.get_sign_off(%L) $$, :'cycle'),
  $$ values (4, 3, 1, 4, 0, 1, 4, true, 0, '[]'::jsonb, 7) $$,
  'the sign-off page counts the population by outcome, the sample, what blocks, the newer decisions, and says the moderator may sign');
select results_eq(format($$ select status, jsonb_array_length(details), details -> 0 ->> 'state' from api.sign_off_moderation_cycle(%L, 2, 'All reviewed.') $$, :'cycle'),
  $$ values ('blocked'::text, 4, 'allocated'::text) $$, 'sign-off is refused while items are not concluded, listing them');
reset role;
select is((select count(*)::int from assessment.results where hold_cycle_id = :'cycle' and state = 'released' and id <> :'r_lerato'), 0,
  'and nothing was released (test plan 6)');

-- Conclude three, return one: still blocked, by the return.
select pg_temp.act_as(:'moderator');
select results_eq(format($$ select count(*) from (select api.record_moderation_finding(l.item_id, 'agree', 'Sound.') from api.list_my_sample_items(%L) l where l.item_id <> %L) x $$, :'cycle', :'item_r2'),
  $$ values (3::bigint) $$, 'three items agreed');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'disagree', 'AC 3.1 not evidenced.', 'Re-judge AC 3.1.', (now() at time zone 'Africa/Johannesburg')::date + 5) $$, :'item_r2'),
  $$ values ('ok'::text) $$, 'one item returned');
select results_eq(format($$ select status, jsonb_array_length(details), details -> 0 ->> 'state', details -> 0 ->> 'learner_name', (details -> 0 ->> 'due_on') is not null from api.sign_off_moderation_cycle(%L, 2, 'All reviewed.') $$, :'cycle'),
  $$ values ('blocked'::text, 1, 'returned'::text, 'Naledi Botha'::text, true) $$,
  'sign-off is refused while a return is open, naming the item, the learner and the deadline (FR-510)');
select results_eq(format($$ select concluded, jsonb_array_length(blockers), blockers -> 0 ->> 'assessor_name' from api.get_sign_off(%L) $$, :'cycle'),
  $$ values (3, 1, 'Nomsa Dlamini'::text) $$, 'and the page lists the same');
reset role;

-- The assessor re-marks; the moderator agrees.
select pg_temp.act_as(:'assessor');
select instance_id as inst from api.list_my_returned_items() \gset
select results_eq(format($$ select status from api.start_remark(%L) $$, :'inst'), $$ values ('ok'::text) $$, 'the assessor starts the re-mark');
select results_eq(format($$ select status from api.save_marking_draft(%L, 1, '[{"ordinal": 1, "points": 2, "comment": "Partly."}]'::jsonb, null, 'competent', 'AC 3.1 met by the register.') $$, :'inst'),
  $$ values ('ok'::text) $$, 'corrects it');
select results_eq(format($$ select status, result_state from api.finalise_decision(%L, 2) $$, :'inst'), $$ values ('ok'::text, 'held'::text) $$, 'and finalises, still held');
reset role;
select pg_temp.act_as(:'moderator');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'agree', 'Now sound.') $$, :'item_r2'), $$ values ('ok'::text) $$, 'the moderator agrees with the re-mark');

-- ---------------------------------------------------------------------------------------------------------------
-- Eligibility (P-05, tightened) and the other refusals
-- ---------------------------------------------------------------------------------------------------------------

select results_eq(format($$ select status, details ->> 'version' from api.sign_off_moderation_cycle(%L, 1, 'All reviewed.') $$, :'cycle'),
  $$ values ('stale_version'::text, '2'::text) $$, 'a sign-off from an old copy of the cycle is refused');
select results_eq(format($$ select status from api.sign_off_moderation_cycle(%L, 2, '  ') $$, :'cycle'),
  $$ values ('statement_required'::text) $$, 'the sign-off statement is required');
reset role;
select pg_temp.act_as(:'staff');
select results_eq(format($$ select may_sign, assessed_by_me, other_signers from api.get_sign_off(%L) $$, :'cycle'),
  $$ values (false, 1, '["Thabo Nkosi"]'::jsonb) $$, 'a moderator who assessed a population result is told so, and who can sign instead');
select results_eq(format($$ select status, details ->> 'assessed', details ->> 'population' from api.sign_off_moderation_cycle(%L, 2, 'All reviewed.') $$, :'cycle'),
  $$ values ('not_eligible'::text, '1'::text, '4'::text) $$, 'and cannot sign off, even though the result she assessed was not sampled by her (P-05)');
reset role;
select is((select state from moderation.cycles where id = :'cycle'), 'frozen', 'nothing changed');

-- ---------------------------------------------------------------------------------------------------------------
-- The release (FR-511; P-06; test plan 7, 13, 23)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'moderator');
select results_eq(format($$ select population, sample, concluded, jsonb_array_length(blockers), may_sign from api.get_sign_off(%L) $$, :'cycle'),
  $$ values (4, 4, 4, 0, true) $$, 'the page says the cycle is ready');
select results_eq(format($$ select status, signed_off_at is not null, released, notified, (details ->> 'held_behind_release')::int from api.sign_off_moderation_cycle(%L, 2, 'Every sampled decision reviewed; marking is consistent across assessors.') $$, :'cycle'),
  $$ values ('ok'::text, true, 4, 4, 1) $$, 'the moderator signs off: four results released, four learners told, one of them behind an earlier release');
select results_eq(format($$ select status, released, notified from api.sign_off_moderation_cycle(%L, 2, 'Again.') $$, :'cycle'),
  $$ values ('already_signed_off'::text, 4, 4) $$, 'a retry returns the original facts');
select results_eq(format($$ select state, signed_off_by_name, sign_off_statement, released_count, notified_count from api.get_sign_off(%L) $$, :'cycle'),
  $$ values ('signed_off'::text, 'Thabo Nkosi'::text, 'Every sampled decision reviewed; marking is consistent across assessors.'::text, 4, 4) $$,
  'and the page shows the sign-off record');
reset role;

select results_eq(format($$ select state, hold_cycle_id, release_seq is not null, appeal_deadline_at is not null, remediation_deadline_at is not null from assessment.results where id in (%L, %L, %L) order by learner_id $$, :'r2', :'r3', :'r4'),
  $$ values ('released'::text, null::uuid, true, true, false), ('released', null, true, true, true), ('released', null, true, true, false) $$,
  'the held population is released with sequence numbers and appeal deadlines, and the NYC result with its resubmission deadline');
select results_eq(format($$ select state, current_decision_id = %L, pending_decision_id, release_seq > %s, remediation_deadline_at from assessment.results where id = %L $$, :'pending_decision', :'lerato_first_seq', :'r_lerato'),
  $$ values ('released'::text, true, null::uuid, true, null::timestamptz) $$,
  'the decision held behind a release is now current, with a new release and no resubmission period (P-04)');
select is((select count(distinct released_at)::int from moderation.releases where cycle_id = :'cycle'), 1, 'all released at one moment: one transaction');
select results_eq(format($$ select count(*)::int, count(*) filter (where result_id = %L)::int from moderation.releases where cycle_id = %L $$, :'r_after', :'cycle'),
  $$ values (4, 0) $$, 'exactly the frozen population was released: the decision after the freeze was not (P-06, test plan 23)');
select results_eq(format($$ select state, hold_cycle_id, moderation.is_waiting(r) from assessment.results r where id = %L $$, :'r_after'),
  $$ values ('held'::text, null::uuid, true) $$, 'that result stays held and waiting for the next cycle');
select results_eq(format($$ select count(*)::int from notifications.notifications n join moderation.releases rl on n.event_key = 'result_released:' || rl.result_id::text || ':' || rl.release_seq::text where rl.cycle_id = %L $$, :'cycle'),
  $$ values (4) $$, 'each learner is told once about their release');
select results_eq(format($$ select recipient_id, (payload ->> 'released')::int from notifications.notifications where event_type = 'moderation_cycle_signed_off' order by recipient_id $$),
  format($$ values (%L::uuid, 4), (%L::uuid, 4) $$, :'coordinator', :'staff'), 'the coordinators are told');
select results_eq(format($$ select (details ->> 'released')::int, details ->> 'population_digest' = p.digest, acting_role from audit.events e, moderation.populations p where e.action = 'moderation.cycle_signed_off' and e.object_id = %L and p.cycle_id = %L $$, :'cycle', :'cycle'),
  $$ values (4, true, 'moderator'::text) $$, 'and the sign-off is audited with the count and the population digest');
select is((select bool_and(not open) from moderation.cycle_scope where cycle_id = :'cycle'), true, 'the scope closes');
select throws_ok(format($$ update moderation.releases set release_seq = 1 where cycle_id = %L $$, :'cycle'), '42501', null, 'what was released is never edited');

-- A signed-off cycle records nothing more.
select pg_temp.act_as(:'moderator');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'agree', 'Late.') $$, :'item_r2'),
  $$ values ('not_open'::text) $$, 'no finding after sign-off');
select results_eq(format($$ select state, my_concluded, total_concluded, open_returns, may_sign, released_count from api.list_my_moderation_cycles() where cycle_id = %L $$, :'cycle'),
  $$ values ('signed_off'::text, 4, 4, 0, true, 4) $$, 'the moderator''s cycle list shows it signed off');
reset role;

-- The next cycle claims what was decided after the freeze, and a resubmission on a released result waits again.
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select signed_off_by_name, released_count, held from api.list_moderation_cycles(%L) where id = %L $$, :'cohort', :'cycle'),
  $$ values ('Thabo Nkosi'::text, 4, 4) $$, 'the coordinator''s cycle list shows who signed and how many were released');
select cycle_id as next_cycle from api.plan_moderation_cycle(:'cohort', 'Term 3 follow-up', array[:'item3']::uuid[]) \gset
select results_eq(format($$ select status, population from api.freeze_moderation_cycle(%L, 1) $$, :'next_cycle'),
  $$ values ('ok'::text, 1) $$, 'a second cycle over the same item is allowed after sign-off, and claims the newer decision (test plan 23)');
reset role;

-- The assessor's release status now says released.
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select stage, released_at is not null from api.list_my_release_status() where result_id = %L and decision_id = %L $$, :'r_lerato', :'pending_decision'),
  $$ values ('released'::text, true) $$, 'the decision held behind a release reads as released to its assessor');
reset role;

-- Privileges
select table_privs_are('moderation', 'releases', 'authenticated', array[]::text[], 'authenticated has no privilege on releases');
select function_privs_are('moderation', 'sign_off_blockers', array['uuid'], 'authenticated', array[]::text[], 'nor on the blockers helper');
select function_privs_are('moderation', 'may_sign_off', array['uuid', 'uuid'], 'authenticated', array[]::text[], 'nor on the eligibility helper');

select * from finish();
rollback;
