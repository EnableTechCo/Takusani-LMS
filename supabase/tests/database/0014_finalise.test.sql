-- Finalising: hold or release (S2-08, FR-408, BR-04; test plan transaction tests 4, 12 and 13).
-- Uses the local seed: the published task in "2026 Intake B" (not moderated), the enrolled learner, assessor@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(27);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A submitted version for the learner, taken by the assessor and with a draft saved: ready to finalise. Returns
-- the instance. Runs as postgres, then leaves the caller as postgres.
create function pg_temp.ready_item(p_outcome text) returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_learner uuid := '00000000-0000-4000-8000-000000000001';
  v_assessor uuid := '00000000-0000-4000-8000-000000000003';
  v_intent uuid;
  v_file uuid;
  v_key text := v_task::text || '/' || v_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  v_instance uuid;
begin
  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, object_key, original_filename, declared_media_type, declared_bytes,
    max_bytes, allowed_media_types, expires_at, finalised_at
  )
  values (v_learner, 'task_submission', v_task, v_key, 'portfolio.pdf', 'application/pdf', 2048, 26214400,
    array['application/pdf'], now() + interval '2 hours', now())
  returning id into v_intent;
  insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
  values (v_intent, 'submissions', v_key, 'portfolio.pdf', 2048, 'application/pdf', v_learner)
  returning id into v_file;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_learner, 'role', 'authenticated')::text, true);
  perform api.submit_task(v_task, jsonb_build_array(jsonb_build_object('file_id', v_file, 'requirement_id', null)),
    gen_random_uuid());
  perform set_config('role', 'postgres', true);

  select i.id into v_instance from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  where r.learner_id = v_learner and i.state = 'to_mark';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_assessor, 'role', 'authenticated')::text, true);
  perform api.take_marking(v_instance);
  perform api.save_marking_draft(v_instance, 0, '[{"ordinal": 1, "points": 9}]'::jsonb, 'Clear and complete.',
    p_outcome, 'Judged against every criterion.',
    case when p_outcome = 'not_yet_competent' then 'Add the retention schedule.' end,
    case when p_outcome = 'not_yet_competent' then 14 end);
  perform set_config('role', 'postgres', true);
  return v_instance;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set staff 00000000-0000-4000-8000-000000000007
\set cohort 10000000-0000-4000-8000-000000000010

-- Refusals before anything is decided
reset role;
select pg_temp.ready_item('not_yet_competent') as nyc \gset
select pg_temp.act_as(:'staff');
select results_eq(format($$ select status from api.finalise_decision(%L, 1) $$, :'nyc'),
  $$ values ('not_your_item'::text) $$, 'only the assessor who has the item can finalise it');
reset role;
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status, detail from api.finalise_decision(%L, 0) $$, :'nyc'),
  $$ values ('stale_version'::text, '1'::text) $$,
  'finalising what the assessor did not see is refused, and says which draft version is current');

-- Not moderated: released at once (FR-408, BR-04)
select results_eq(
  format($$ select status, result_state, released_at is not null, appeal_deadline_at is not null,
                   remediation_deadline_at is not null, detail from api.finalise_decision(%L, 1) $$, :'nyc'),
  $$ values ('ok'::text, 'released'::text, true, true, true, 'not_moderated'::text) $$,
  'in a cohort that is not moderated the result is released, with its appeal window and resubmission deadline');

reset role;
select results_eq(
  format($$ select d.outcome, d.remediation, d.resubmission_days, d.feedback, jsonb_array_length(d.scores)
            from assessment.decisions d where d.instance_id = %L $$, :'nyc'),
  $$ values ('not_yet_competent'::text, 'Add the retention schedule.'::text, 14, 'Clear and complete.'::text, 1) $$,
  'the decision records the marks, feedback, remediation and period the learner will read');
select results_eq(
  format($$ select (r.remediation_deadline_at - r.released_at) = interval '14 days'
            from assessment.results r join assessment.assessment_instances i on i.result_id = r.id
            where i.id = %L $$, :'nyc'),
  $$ values (true) $$, 'the resubmission deadline is fourteen days from release');
select results_eq(
  format($$ select (r.appeal_deadline_at at time zone 'Africa/Johannesburg')::date
                   - (r.released_at at time zone 'Africa/Johannesburg')::date
            from assessment.results r join assessment.assessment_instances i on i.result_id = r.id
            where i.id = %L $$, :'nyc'),
  $$ values (8) $$, 'the appeal window is seven whole days, closing at the start of the eighth (P-11)');
select results_eq(format($$ select state from assessment.assessment_instances where id = %L $$, :'nyc'),
  $$ values ('decided'::text) $$, 'the instance is now decided');
select results_eq(
  format($$ select after ->> 'result_state', acting_role from audit.events
            where action = 'assessment.decision_finalised' and details ->> 'instance_id' = %L $$, :'nyc'),
  $$ values ('released'::text, 'assessor'::text) $$, 'finalising is audited with what happened to the result');

-- Test plan 4: a second finalisation produces no second decision
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status, result_state from api.finalise_decision(%L, 1) $$, :'nyc'),
  $$ values ('already_finalised'::text, 'released'::text) $$,
  'finalising again says it is already decided, and with what result');
reset role;
select results_eq(format($$ select count(*)::int from assessment.decisions where instance_id = %L $$, :'nyc'),
  $$ values (1) $$, 'there is still exactly one decision for the item');
select throws_ok(
  format($$ insert into assessment.decisions (result_id, instance_id, type, outcome, actor_id, acting_role,
            justification, supersedes_decision_id)
            select r.id, i.id, 'assessment', 'competent', %L, 'assessor', 'A second go.', r.current_decision_id
            from assessment.assessment_instances i join assessment.results r on r.id = i.result_id
            where i.id = %L $$, :'assessor', :'nyc'),
  '23505', null, 'and even a direct insert cannot add a second assessment decision to the same item');
select throws_ok(
  format($$ insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
            select i.result_id, 'appeal', 'not_yet_competent', %L, 'assessor', 'x'
            from assessment.assessment_instances i where i.id = %L $$, :'assessor', :'nyc'),
  '23505', null, 'a result still has only one root decision');

-- The drafted work is kept; a draft cannot be saved on a decided item
select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select status from api.save_marking_draft(%L, 1, '[]'::jsonb, 'Changed my mind') $$, :'nyc'),
  $$ values ('not_open_for_marking'::text) $$, 'a decided item cannot be re-drafted: a new decision is recorded instead');

-- A resubmission is decided on the same result, and released in its own right (ADR-021)
reset role;
select (select r.release_seq from assessment.results r join assessment.assessment_instances i on i.result_id = r.id
        where i.id = :'nyc') as first_seq \gset
select pg_temp.ready_item('competent') as resubmission \gset
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status, result_state, remediation_deadline_at is null from api.finalise_decision(%L, 1) $$,
    :'resubmission'),
  $$ values ('ok'::text, 'released'::text, true) $$,
  'the resubmission is marked Competent and released, and no resubmission deadline remains');
reset role;
select results_eq(
  format($$ select count(*)::int, count(*) filter (where supersedes_decision_id is not null)::int
            from assessment.decisions d join assessment.assessment_instances i on i.result_id = d.result_id
            where i.id = %L $$, :'resubmission'),
  $$ values (2, 1) $$, 'the result now has two decisions: the new one supersedes the first, which stays on record');
select ok(
  (select r.release_seq from assessment.results r join assessment.assessment_instances i on i.result_id = r.id
   where i.id = :'resubmission') > :'first_seq'::bigint,
  'the new decision takes a new release sequence number, so an external feed sees the change');
select results_eq(
  format($$ select d.outcome from assessment.results r join assessment.decisions d on d.id = r.current_decision_id
            join assessment.assessment_instances i on i.result_id = r.id where i.id = %L $$, :'resubmission'),
  $$ values ('competent'::text) $$, 'and the result''s current outcome is Competent');

-- Test plan 13: in a moderated cohort a finalised decision is held, and nothing reaches the learner
update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = :'cohort';
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'authenticated',
        'authenticated', 'pgtap.moderated@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values ('00000000-0000-4000-8000-0000000000c1', 'pgTAP Moderated Learner');
insert into programmes.enrolments (cohort_id, profile_id) values (:'cohort', '00000000-0000-4000-8000-0000000000c1');
insert into assessment.results (assessable_item_id, learner_id)
select ai.id, '00000000-0000-4000-8000-0000000000c1' from assessment.assessable_items ai
where ai.task_id = '10000000-0000-4000-8000-000000000020'
returning id as held_result \gset
insert into assessment.assessment_instances (result_id, assessor_id, state)
values (:'held_result', :'assessor', 'marking') returning id as held_instance \gset
insert into assessment.marking_drafts (instance_id, assessor_id, outcome, justification)
values (:'held_instance', :'assessor', 'competent', 'Meets every criterion.');

select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select status, result_state, released_at, appeal_deadline_at, detail from api.finalise_decision(%L, 1) $$,
    :'held_instance'),
  $$ values ('ok'::text, 'held'::text, null::timestamptz, null::timestamptz, 'moderated'::text) $$,
  'in a moderated cohort the result is held: no release, no appeal window (test plan 13)');
reset role;
select results_eq(
  format($$ select state, hold_cycle_id, release_seq, current_decision_id is not null from assessment.results where id = %L $$,
    :'held_result'),
  $$ values ('held'::text, null::uuid, null::bigint, true) $$,
  'it waits in the pending pool with no cycle, for the next cycle to claim at freeze');

-- A result already released cannot be moved by a moderated resubmission until the hold path exists (S4-04)
insert into assessment.assessment_instances (result_id, assessor_id, state)
select r.id, :'assessor', 'marking' from assessment.results r
join assessment.assessment_instances i on i.result_id = r.id where i.id = :'resubmission'
returning id as late_instance \gset
insert into assessment.marking_drafts (instance_id, assessor_id, outcome, justification)
values (:'late_instance', :'assessor', 'competent', 'Still fine.');
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status from api.finalise_decision(%L, 1) $$, :'late_instance'),
  $$ values ('moderated_resubmission_not_yet_supported'::text) $$,
  'a released result in a moderated cohort is refused with a clear status, not guessed at');
reset role;
update programmes.cohort_moderation_state set moderation_policy = 'not_moderated' where cohort_id = :'cohort';

-- Completeness (FR-404, FR-405)
insert into assessment.assessment_instances (result_id, assessor_id, state)
values (:'held_result', :'assessor', 'marking') returning id as incomplete \gset
insert into assessment.marking_drafts (instance_id, assessor_id, outcome)
values (:'incomplete', :'assessor', 'not_yet_competent');
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status, detail from api.finalise_decision(%L, 1) $$, :'incomplete'),
  $$ values ('incomplete'::text, 'justification'::text) $$, 'a decision without a justification is refused, and says so');
reset role;
update assessment.marking_drafts set justification = 'Not met.', version = 2 where instance_id = :'incomplete';
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status, detail from api.finalise_decision(%L, 2) $$, :'incomplete'),
  $$ values ('incomplete'::text, 'remediation'::text) $$, 'not yet competent without remediation is refused');

-- Test plan 12: a failure midway leaves nothing behind
reset role;
update assessment.marking_drafts
set remediation = 'Add the schedule.', resubmission_days = 7, version = 3 where instance_id = :'incomplete';
create function pg_temp.explode() returns trigger language plpgsql as $$
begin raise exception 'forced failure after the decision was written'; end $$;
create trigger pgtap_explode before insert on audit.events for each row execute function pg_temp.explode();
select pg_temp.act_as(:'assessor');
select throws_like(format($$ select * from api.finalise_decision(%L, 3) $$, :'incomplete'),
  '%forced failure%', 'the audit write fails after the decision and the result were changed');
reset role;
drop trigger pgtap_explode on audit.events;
select results_eq(
  format($$ select (select count(*) from assessment.decisions where instance_id = %L)::int,
                   (select state from assessment.assessment_instances where id = %L) $$, :'incomplete', :'incomplete'),
  $$ values (0, 'marking'::text) $$,
  'and nothing was kept: no decision, and the item is still being marked (test plan 12)');

-- Not reachable around the function
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.finalise_decision(%L, 3) $$, :'incomplete'),
  $$ values ('not_your_item'::text) $$, 'a learner cannot finalise anything');
reset role;
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select status from api.finalise_decision(%L, 1) $$, gen_random_uuid()),
  $$ values ('not_found'::text) $$, 'an unknown item is not found');
reset role;
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select result_state, result_released_at is not null from api.get_marking_item(%L) $$, :'nyc'),
  $$ values ('released'::text, true) $$, 'the workspace can show where the result stands after finalising');

select * from finish();
rollback;
