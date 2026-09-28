-- Where an assessor's work stands, and when each decision was released (S4-11; FR-409; UX spec 7.3, 7.4).
-- Uses the local seed: the published task in "2026 Intake B", the enrolled learner, assessor@ and staff@ (who also
-- assesses, everywhere).
create extension if not exists pgtap with schema extensions;

begin;
select plan(28);

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

-- A second learner in the cohort, with a result for the task and an instance the assessor is marking.
create function pg_temp.other_learner(p_id uuid, p_name text) returns uuid language plpgsql as $$
declare
  v_result uuid;
  v_instance uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
          'pgtap.' || p_id::text || '@takusani.test', now(), now());
  insert into identity.profiles (id, full_name) values (p_id, p_name);
  insert into programmes.enrolments (cohort_id, profile_id) values ('10000000-0000-4000-8000-000000000010', p_id);
  insert into assessment.results (assessable_item_id, learner_id)
  select ai.id, p_id from assessment.assessable_items ai where ai.task_id = '10000000-0000-4000-8000-000000000020'
  returning id into v_result;
  insert into assessment.assessment_instances (result_id, assessor_id, state)
  values (v_result, '00000000-0000-4000-8000-000000000003', 'marking') returning id into v_instance;
  insert into assessment.marking_drafts (instance_id, assessor_id, outcome, justification)
  values (v_instance, '00000000-0000-4000-8000-000000000003', 'competent', 'Meets every criterion.');
  return v_instance;
end $$;

create function pg_temp.decision_of(p_instance uuid) returns uuid language sql as $$
  select id from assessment.decisions where instance_id = p_instance and type = 'assessment'
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set staff 00000000-0000-4000-8000-000000000007
\set cohort 10000000-0000-4000-8000-000000000010

-- Not moderated: released at once, and the release is recorded against the decision
reset role;
select pg_temp.ready_item('not_yet_competent') as nyc \gset
select pg_temp.act_as(:'assessor');
select 1 from api.finalise_decision(:'nyc', 1);
reset role;
select pg_temp.decision_of(:'nyc') as nyc_decision \gset
select r.id as result, r.released_at as first_release from assessment.results r
join assessment.assessment_instances i on i.result_id = r.id where i.id = :'nyc' \gset

select results_eq(format($$ select decision_id, released_at from assessment.decision_releases where result_id = %L $$, :'result'),
  format($$ values (%L::uuid, %L::timestamptz) $$, :'nyc_decision', :'first_release'),
  'releasing a result records the moment its decision reached the learner');

select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select stage, outcome, released_at, cohort_name, moderation_policy, instance_id
            from api.list_my_release_status() where decision_id = %L $$, :'nyc_decision'),
  format($$ values ('released'::text, 'not_yet_competent'::text, %L::timestamptz, '2026 Intake B'::text,
                    'not_moderated'::text, %L::uuid) $$, :'first_release', :'nyc'),
  'the assessor sees the decision as released, with when, in which cohort and under which policy');
select ok((select decided_at is not null and item_title is not null and learner_name = 'Lerato Mokoena'
           from api.list_my_release_status() where decision_id = :'nyc_decision'),
  'with the date it was decided, the item and the learner');

-- A resubmission, released at once: its own release, while the first decision keeps the release it had
reset role;
select pg_temp.ready_item('competent') as resub \gset
select pg_temp.act_as(:'assessor');
select 1 from api.finalise_decision(:'resub', 1);
reset role;
select pg_temp.decision_of(:'resub') as resub_decision \gset
select results_eq(format($$ select count(*)::int from assessment.decision_releases where result_id = %L $$, :'result'),
  $$ values (2) $$, 'the resubmission''s decision has a release of its own');
select is((select released_at from assessment.results where id = :'result'), :'first_release'::timestamptz,
  'the result''s first release is unchanged: it is written once');

select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select decision_id, stage, released_at is not null, replaced_by from api.list_my_release_status()
            where result_id = %L order by stage desc $$, :'result'),
  format($$ values (%L::uuid, 'replaced'::text, true, 'assessment'::text), (%L::uuid, 'released'::text, true, null::text) $$,
    :'nyc_decision', :'resub_decision'),
  'the first decision reads as replaced by a later assessment, and was released; the resubmission reads as released');

-- Moderated: held, waiting for a cycle; claimed by one; then released
reset role;
update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = :'cohort';
select pg_temp.other_learner('00000000-0000-4000-8000-0000000000d1', 'pgTAP Held Learner') as held \gset
select pg_temp.act_as(:'assessor');
select 1 from api.finalise_decision(:'held', 1);
reset role;
select pg_temp.decision_of(:'held') as held_decision \gset
select result_id as held_result from assessment.decisions where id = :'held_decision' \gset

select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select stage, released_at, moderation_policy from api.list_my_release_status() where decision_id = %L $$,
    :'held_decision'),
  $$ values ('waiting_for_cycle'::text, null::timestamptz, 'moderated'::text) $$,
  'a held decision reads as waiting for a moderation cycle, with no release date');
reset role;
select is((select count(*)::int from assessment.decision_releases where result_id = :'held_result'), 0,
  'and nothing is recorded as released');

-- A cycle claims it at freeze (S4-06 will do this; the column is enough to read it).
update assessment.results set hold_cycle_id = gen_random_uuid() where id = :'held_result';
select pg_temp.act_as(:'assessor');
select results_eq(format($$ select stage from api.list_my_release_status() where decision_id = %L $$, :'held_decision'),
  $$ values ('in_moderation'::text) $$, 'claimed by a cycle, it reads as in moderation');

-- Sign-off releases it (S4-09 will do this through the same guard).
reset role;
update assessment.results set state = 'released' where id = :'held_result';
select results_eq(
  format($$ select dr.decision_id, dr.released_at = r.released_at from assessment.decision_releases dr
            join assessment.results r on r.id = dr.result_id where dr.result_id = %L $$, :'held_result'),
  format($$ values (%L::uuid, true) $$, :'held_decision'),
  'releasing a held result records its decision''s release at the moment of release');
select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select stage, released_at is not null from api.list_my_release_status() where decision_id = %L $$,
    :'held_decision'),
  $$ values ('released'::text, true) $$, 'and the assessor sees it released');

-- Held behind a released result (P-04): the new decision waits; the one the learner has stays released
reset role;
select pg_temp.ready_item('not_yet_competent') as late \gset
select pg_temp.act_as(:'assessor');
select 1 from api.finalise_decision(:'late', 1);
reset role;
select pg_temp.decision_of(:'late') as late_decision \gset
select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select decision_id, stage from api.list_my_release_status() where result_id = %L and stage <> 'replaced'
            order by decided_at, stage $$, :'result'),
  format($$ values (%L::uuid, 'released'::text), (%L::uuid, 'waiting_for_cycle'::text) $$, :'resub_decision', :'late_decision'),
  'a decision held behind a released result waits for a cycle, and the released one still reads as released');
reset role;
select is((select count(*)::int from assessment.decision_releases where decision_id = :'late_decision'), 0,
  'the held decision has no release');

-- The workspace's history carries each decision's own release
select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select (e ->> 'released_at') is not null from api.get_marking_item(%L) m,
            jsonb_array_elements(m.decisions) e where (e ->> 'instance_id')::uuid = %L $$, :'resub', :'resub'),
  $$ values (true) $$, 'the workspace history says when the resubmission''s decision was released');
select results_eq(
  format($$ select e ->> 'released_at' from api.get_marking_item(%L) m,
            jsonb_array_elements(m.decisions) e where (e ->> 'instance_id')::uuid = %L $$, :'late', :'late'),
  $$ values (null::text) $$, 'and that the held one was not');

-- A decision replaced after release (an appeal, here written directly): recorded as released when the pointer moves
reset role;
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
values (:'held_result', 'appeal', 'not_yet_competent', :'staff', 'appeal_reviewer', 'On review, not met.', :'held_decision')
returning id as appeal_decision \gset
update assessment.results set current_decision_id = :'appeal_decision' where id = :'held_result';
select is((select count(*)::int from assessment.decision_releases where decision_id = :'appeal_decision'), 1,
  'moving a released result''s pointer records the new decision''s release');
select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select stage, replaced_by, released_at is not null from api.list_my_release_status() where decision_id = %L $$,
    :'held_decision'),
  $$ values ('replaced'::text, 'appeal'::text, true) $$,
  'the assessor''s decision reads as replaced on appeal, and as having been released');

-- The backfill's derivation agrees with what the trigger recorded, including a decision made before release
reset role;
select pg_temp.other_learner('00000000-0000-4000-8000-0000000000d2', 'pgTAP Backdated Learner') as backdated \gset
select result_id as backdated_result from assessment.assessment_instances where id = :'backdated' \gset
insert into assessment.decisions (result_id, instance_id, type, outcome, actor_id, acting_role, justification, created_at)
values (:'backdated_result', :'backdated', 'assessment', 'competent', :'assessor', 'assessor', 'Met.',
        '2026-09-01 10:00+02')
returning id as backdated_decision \gset
update assessment.assessment_instances set state = 'decided' where id = :'backdated';
update assessment.results set current_decision_id = :'backdated_decision' where id = :'backdated_result';
update assessment.results set state = 'released' where id = :'backdated_result';
select results_eq(
  format($$ select decision_id, result_id, released_at from assessment.derived_decision_releases()
            where result_id in (%L, %L, %L) order by decision_id $$, :'result', :'held_result', :'backdated_result'),
  format($$ select decision_id, result_id, released_at from assessment.decision_releases
            where result_id in (%L, %L, %L) order by decision_id $$, :'result', :'held_result', :'backdated_result'),
  'the history implies exactly the releases the trigger recorded, so the backfill is the same record');
select ok(
  not exists (select 1 from assessment.results r where r.state = 'released'
              and not exists (select 1 from assessment.decision_releases dr where dr.decision_id = r.current_decision_id)),
  'every released result''s current decision has its release recorded');

select pg_temp.act_as(:'assessor');
select results_eq(
  format($$ select (decided_at at time zone 'Africa/Johannesburg')::date, released_at > decided_at, stage
            from api.list_my_release_status() where decision_id = %L $$, :'backdated_decision'),
  $$ values ('2026-09-01'::date, true, 'released'::text) $$,
  'decided and released are two facts with two dates');

-- Append-only, and not readable around the function
reset role;
select throws_ok(format($$ update assessment.decision_releases set released_at = now() where decision_id = %L $$,
    :'nyc_decision'), '42501', null, 'a recorded release cannot be edited');
select throws_ok(format($$ delete from assessment.decision_releases where decision_id = %L $$, :'nyc_decision'),
  '42501', null, 'or deleted');
select pg_temp.act_as(:'assessor');
select throws_ok($$ select * from assessment.decision_releases $$, '42501', null,
  'the release record is not readable directly');

-- Only the assessor's own decisions, only in cohorts they assess
select is((select count(*)::int from api.list_my_release_status()), 5,
  'the assessor sees each of their five decisions, and not the appeal decision');
reset role;
select pg_temp.act_as(:'staff');
select is((select count(*)::int from api.list_my_release_status()), 0,
  'another assessor of the same cohort sees none of them');
reset role;
select pg_temp.act_as(:'learner');
select is((select count(*)::int from api.list_my_release_status()), 0, 'a learner sees nothing');
reset role;
update identity.role_assignments set effective = tstzrange(lower(effective), now())
where profile_id = :'assessor' and role = 'assessor';
select pg_temp.act_as(:'assessor');
select is((select count(*)::int from api.list_my_release_status()), 0,
  'an assessor whose role has ended sees nothing of the cohort');
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select is((select count(*)::int from api.list_my_release_status()), 0, 'without a user, nothing');

select * from finish();
rollback;
