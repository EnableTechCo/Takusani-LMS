-- Role assignment with the separation-of-duties advisory (S3-07; FR-104, FR-105, FR-107; U-01; transaction test 31).
-- Uses the local seed: the published task in "2026 Intake B", the learner, facilitator@, assessor@ (who decides the
-- result), coordinator@ (institution-wide) and admin@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(30);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- The learner hands in a version and assessor@ finalises it "not yet competent" (released at once). Returns the
-- result. Runs as postgres, then leaves the caller as postgres.
create function pg_temp.released_result() returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_learner uuid := '00000000-0000-4000-8000-000000000001';
  v_assessor uuid := '00000000-0000-4000-8000-000000000003';
  v_intent uuid;
  v_file uuid;
  v_key text := v_task::text || '/' || v_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  v_instance uuid;
  v_result uuid;
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

  select i.id, r.id into v_instance, v_result from assessment.assessment_instances i
  join assessment.results r on r.id = i.result_id
  where r.learner_id = v_learner and i.state = 'to_mark';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_assessor, 'role', 'authenticated')::text, true);
  perform api.take_marking(v_instance);
  perform api.save_marking_draft(v_instance, 0,
    '[{"ordinal": 1, "points": 9, "comment": ""}, {"ordinal": 2, "points": 2, "comment": ""}]'::jsonb,
    'The retention schedule is missing.', 'not_yet_competent', 'Judged against every criterion.',
    'Add the retention schedule.', 14);
  perform api.finalise_decision(v_instance, 1);
  perform set_config('role', 'postgres', true);
  return v_result;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set admin 00000000-0000-4000-8000-000000000006
\set cohort 10000000-0000-4000-8000-000000000010
\set grounds '''Criterion 2 asks for the retention rules. Page 4 of my portfolio sets them out, with the schedule.'''

reset role;
select pg_temp.released_result() as result \gset

-- Transaction test 31: the Moderator role for someone who assessed in the cohort succeeds, with an advisory
reset role;
select pg_temp.act_as(:'admin');
select status as assigned, assignment_id as moderator_role, advisories
from api.assign_role(:'assessor', 'moderator', 'cohort', :'cohort') \gset
select is(:'assigned'::text, 'ok', 'assigning Moderator to someone who assessed in the cohort succeeds (U-01)');
select results_eq(
  format($$ select e ->> 'type', e ->> 'item_title', (e ->> 'results')::int from jsonb_array_elements(%L::jsonb) e $$,
         :'advisories'),
  $$ values ('separation_of_duties_exclusions'::text, 'Task 3: Workplace records portfolio'::text, 1) $$,
  'and the reply names the results they will be kept away from');
reset role;
select results_eq(
  format($$ select role, scope_type::text, scope_key, assigned_by, effective @> now() from identity.role_assignments where id = %L $$,
         :'moderator_role'),
  format($$ values ('moderator'::text, 'cohort'::text, %L::uuid, %L::uuid, true) $$, :'cohort', :'admin'),
  'the role is in force now, recorded with who assigned it');
select results_eq(
  format($$ select acting_role, after ->> 'role', after ->> 'scope_label', before, (details ->> 'advisory_results')::int
            from audit.events where action = 'identity.role_assigned' and object_id = %L order by id desc limit 1 $$, :'assessor'),
  $$ values ('administrator'::text, 'moderator'::text, '2026 Intake B'::text, null::jsonb, 1) $$,
  'the assignment is audited with the previous value (none) and the advisory (FR-107)');
select is((select count(*)::int from notifications.notifications where recipient_id = :'assessor' and event_type = 'role_assigned'),
  1, 'and the person is told');

-- ... and allocating them to one of those results is refused with the conflict named (block at allocation)
select pg_temp.act_as(:'learner');
select appeal_id as appeal from api.lodge_appeal(:'result', 'remark', :grounds, gen_random_uuid()) \gset
reset role;
select pg_temp.act_as(:'coordinator');
select status as admitted from api.decide_appeal_admissibility(:'appeal', true) \gset
select results_eq(
  format($$ select status, jsonb_array_length(conflicts) from api.allocate_appeal_reviewer(%L, %L) $$, :'appeal', :'assessor'),
  $$ values ('separation_of_duties_conflict'::text, 1) $$,
  'allocating them to review a result they assessed is refused, naming the decision');

-- Assigning with nothing to advise, and what is refused
reset role;
select pg_temp.act_as(:'admin');
select results_eq(
  format($$ select status, advisories from api.assign_role(%L, 'assessor', 'cohort', %L) $$, :'facilitator', :'cohort'),
  $$ values ('ok'::text, '[]'::jsonb) $$, 'someone who assessed nothing there gets no advisory');
select is(status, 'already_assigned', 'the same role and scope twice is refused')
from api.assign_role(:'facilitator', 'assessor', 'cohort', :'cohort');
select is(status, 'invalid_role', 'an unknown role is refused') from api.assign_role(:'facilitator', 'wizard', 'global');
select is(status, 'invalid_scope', 'a global role with a scope key is refused')
from api.assign_role(:'facilitator', 'moderator', 'global', :'cohort');
select is(status, 'invalid_scope', 'a cohort that does not exist is refused')
from api.assign_role(:'facilitator', 'moderator', 'cohort', gen_random_uuid());
select is(status, 'invalid_until', 'an end in the past is refused')
from api.assign_role(:'facilitator', 'moderator', 'cohort', :'cohort', now() - interval '1 day');
select is(status, 'not_found', 'an unknown person is refused') from api.assign_role(gen_random_uuid(), 'moderator', 'global');

reset role;
select pg_temp.act_as(:'assessor');
select is(status, 'forbidden', 'an assessor cannot assign roles') from api.assign_role(:'facilitator', 'moderator', 'global');
reset role;
select pg_temp.act_as(:'coordinator');
select is(status, 'ok', 'a coordinator assigns Moderator in a cohort they coordinate (FR-701)')
from api.assign_role(:'facilitator', 'moderator', 'cohort', :'cohort');
select is(status, 'forbidden', 'but not Administrator') from api.assign_role(:'facilitator', 'administrator', 'global');

-- FR-105: ending a role that open marking depends on is refused, naming the work
reset role;
select id as facilitator_assessor from identity.role_assignments
where profile_id = :'facilitator' and role = 'assessor' and scope_type = 'cohort' \gset
-- Assigned earlier in this same transaction; give it a start in the past, as a real assignment would have.
update identity.role_assignments set effective = tstzrange(now() - interval '1 day', null) where id = :'facilitator_assessor';
insert into assessment.assessment_instances (result_id, state, assessor_id) values (:'result', 'marking', :'facilitator');
select pg_temp.act_as(:'admin');
select results_eq(
  format($$ select status, allocations -> 0 ->> 'cohort_name', (allocations -> 0 ->> 'items')::int from api.end_role(%L) $$,
         :'facilitator_assessor'),
  $$ values ('open_allocations'::text, '2026 Intake B'::text, 1) $$,
  'ending the only assessor role covering their open marking is refused, naming the work');
reset role;
select ok((select effective @> now() from identity.role_assignments where id = :'facilitator_assessor'),
  'and the role stays in force');
select is((select count(*)::int from audit.events where action = 'identity.role_end_refused' and object_id = :'facilitator'), 1,
  'the refusal is recorded');

-- With another role covering the cohort, the same role can end
select pg_temp.act_as(:'admin');
select is(status, 'ok', 'an institution-wide assessor role is added') from api.assign_role(:'facilitator', 'assessor', 'global');
select is(status, 'ok', 'so the cohort role can now end: the work is still covered') from api.end_role(:'facilitator_assessor');
select is(status, 'already_ended', 'ending it again changes nothing') from api.end_role(:'facilitator_assessor');
reset role;
select results_eq(
  format($$ select before ->> 'until', after ->> 'until' is not null from audit.events
            where action = 'identity.role_ended' and object_id = %L $$, :'facilitator'),
  $$ values (null::text, true) $$, 'the end is audited with the previous value: no end date (FR-107)');
select is((select count(*)::int from identity.role_assignments where id = :'facilitator_assessor'), 1,
  'the ended assignment is kept for history');

-- X-04 reads, for administrators only
select pg_temp.act_as(:'admin');
select results_eq(
  format($$ select role, scope_label, in_force, dependent_items from api.list_account_role_assignments(%L)
            where role = 'assessor' order by in_force desc $$, :'facilitator'),
  $$ values ('assessor'::text, 'All programmes'::text, true, 1), ('assessor', '2026 Intake B', false, 0) $$,
  'the administrator sees each assignment, whether it is in force, and the work that depends on it');
select results_eq(
  format($$ select kind, cohort_name, items from api.list_account_open_allocations(%L) $$, :'facilitator'),
  $$ values ('marking'::text, '2026 Intake B'::text, 1) $$, 'and the open allocations');
select ok((select count(*) from api.list_account_history(:'facilitator')) >= 4,
  'and the change history: assigned, assigned, refused, ended');
select is((select email from api.get_account(:'facilitator')), 'facilitator@takusani.test', 'and the person''s details');
select ok(exists (select 1 from api.list_role_scopes() where scope_type = 'cohort' and scope_key = :'cohort'),
  'the cohort is offered as a scope');
reset role;
select pg_temp.act_as(:'coordinator');
select is_empty(format($$ select * from api.list_account_role_assignments(%L) $$, :'facilitator'),
  'a coordinator does not read the administrator''s account screen');

select * from finish();
rollback;
