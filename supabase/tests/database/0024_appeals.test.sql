-- Lodging an appeal (S3-01; FR-601 to FR-604, FR-613; transaction tests 8 and 24).
-- Uses the local seed: the published task in "2026 Intake B" (not moderated), the enrolled learner, assessor@, and
-- the two coordinators (coordinator@ and staff@).
create extension if not exists pgtap with schema extensions;

begin;
select plan(44);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- The learner hands in a version, and the assessor takes it and saves a "not yet competent" draft. Returns the
-- instance. Runs as postgres, then leaves the caller as postgres.
create function pg_temp.ready_item() returns uuid language plpgsql as $$
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
  perform api.save_marking_draft(v_instance, 0,
    '[{"ordinal": 1, "points": 9, "comment": "Every record is there."}, {"ordinal": 2, "points": 2, "comment": ""}]'::jsonb,
    'Clear filing; the retention schedule is missing.', 'not_yet_competent', 'Judged against every criterion.',
    'Add the retention schedule.', 14);
  perform set_config('role', 'postgres', true);
  return v_instance;
end $$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set grounds '''Criterion 2 asks for the retention rules. Page 4 of my portfolio sets them out, with the schedule.'''

reset role;
select pg_temp.ready_item() as instance \gset
select r.id as result from assessment.results r join assessment.assessment_instances i on i.result_id = r.id
where i.id = :'instance' \gset

-- Held: nothing to appeal yet
reset role;
select pg_temp.act_as(:'learner');
select is(status, 'not_released', 'a result still being assessed cannot be appealed')
from api.lodge_appeal(:'result', 'remark', :grounds, gen_random_uuid());
select is_empty(format($$ select * from api.get_appeal_options(%L) $$, :'result'),
  'and the lodge page has nothing to show for it');

reset role;
select pg_temp.act_as(:'assessor');
select is(status, 'ok', 'the assessor finalises: not yet competent, released at once') from api.finalise_decision(:'instance', 1);

-- The lodge page: the result in one line, the window, and both kinds open
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select outcome, points_scored, points_possible, assessed_version_number, decision_final, remark_standing,
                   open_script_appeal_id, learner_number, turnaround_working_days
            from api.get_appeal_options(%L) $$, :'result'),
  $$ values ('not_yet_competent'::text, 11, 20, 1, false, 'available'::text, null::uuid, 'KSI-2026-0417'::text, 5) $$,
  'the lodge page reads the outcome, the marks, the version, and that both kinds are open');
select is(coordinator_names, array['Ayesha Patel', 'Zanele Khumalo'], 'and names the coordinators who will check it')
from api.get_appeal_options(:'result');

-- Transaction test 8: at the deadline instant the appeal is refused; one second before, it is accepted
reset role;
set local session_replication_role = replica;
update assessment.results set appeal_deadline_at = now() where id = :'result';
set local session_replication_role = origin;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select status, deadline_at = now() from api.lodge_appeal(%L, 'remark', %L, gen_random_uuid()) $$,
         :'result', :grounds),
  $$ values ('window_closed'::text, true) $$, 'at the deadline instant the appeal is refused, with the deadline');

reset role;
set local session_replication_role = replica;
update assessment.results set appeal_deadline_at = now() + interval '1 second' where id = :'result';
set local session_replication_role = origin;
select pg_temp.act_as(:'learner');
select gen_random_uuid() as client \gset
select status, appeal_id as remark, reference as remark_reference
from api.lodge_appeal(:'result', 'remark', :grounds, :'client') \gset
select is(:'status'::text, 'ok', 'one second before the deadline instant the appeal is accepted');

reset role;
select ok(:'remark_reference' ~ '^APL-\d{4}-\d{4,}$', 'it gets a reference like APL-2026-0001');
select results_eq(
  format($$ select a.type, a.state, a.deadline_at = r.appeal_deadline_at, a.decision_id = r.current_decision_id,
                   a.learner_id = %L::uuid, a.admissibility
            from appeals.appeals a join assessment.results r on r.id = a.result_id where a.id = %L $$,
         :'learner', :'remark'),
  $$ values ('remark'::text, 'lodged'::text, true, true, true, null::text) $$,
  'the appeal is lodged against the current decision, with the deadline copied from the result');
select results_eq(format($$ select event, actor_id from appeals.appeal_events where appeal_id = %L $$, :'remark'),
  format($$ values ('lodged'::text, %L::uuid) $$, :'learner'), 'the first step is recorded: lodged, by the learner');
select results_eq(
  format($$ select action, acting_role, scope_type, after ->> 'type' from audit.events
            where object_type = 'appeal' and object_id = %L $$, :'remark'),
  $$ values ('appeals.appeal_lodged'::text, 'learner'::text, 'cohort'::text, 'remark'::text) $$,
  'and audited in the same transaction');

-- Told: the learner's receipt, and every coordinator of the cohort (FR-604)
select results_eq(
  format($$ select event_type, link, payload ->> 'reference', payload ->> 'turnaround_working_days'
            from notifications.notifications where recipient_id = %L and event_type like 'appeal%%' $$, :'learner'),
  format($$ values ('appeal_received'::text, '/learn/appeals/%s'::text, %L::text, '5'::text) $$,
         :'remark', :'remark_reference'),
  'the learner gets a receipt with the reference and the turnaround');
select results_eq(
  format($$ select recipient_id, link from notifications.notifications
            where event_type = 'appeal_lodged' and event_key = 'appeal_lodged:%s' order by recipient_id $$, :'remark'),
  format($$ values (%L::uuid, '/coordinate/appeals/%s'::text), (%L::uuid, '/coordinate/appeals/%s'::text) $$,
         :'coordinator', :'remark', :'staff', :'remark'),
  'each coordinator of the cohort is told, with a link to the appeal');
select is(notifications.category('appeal_lodged'), 'appeals', 'appeal notifications sit under the Appeals filter');

-- A replay returns the same appeal; nothing is lodged twice
reset role;
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status, appeal_id from api.lodge_appeal(%L, 'remark', %L, %L) $$,
                         :'result', :grounds, :'client'),
  format($$ values ('ok'::text, %L::uuid) $$, :'remark'), 'a retry with the same client id returns the same appeal');
reset role;
select is((select count(*)::int from appeals.appeals where result_id = :'result'), 1, 'and lodges nothing new');

-- What is refused, and why
reset role;
select pg_temp.act_as(:'learner');
select is(status, 'invalid_type', 'an unknown kind of appeal is refused')
from api.lodge_appeal(:'result', 'complaint', :grounds, gen_random_uuid());
select is(status, 'grounds_required', 'grounds are required (FR-602)')
from api.lodge_appeal(:'result', 'view_script', '   ', gen_random_uuid());
select is(status, 'grounds_too_short', 'grounds of 49 characters are too short')
from api.lodge_appeal(:'result', 'view_script', repeat('x', 49), gen_random_uuid());
select is(status, 'grounds_too_long', 'grounds of more than 2000 characters are too long')
from api.lodge_appeal(:'result', 'view_script', repeat('x', 2001), gen_random_uuid());
select results_eq(format($$ select status, appeal_id, reference from api.lodge_appeal(%L, 'remark', %L, %L) $$,
                         :'result', :grounds, gen_random_uuid()),
  format($$ values ('already_open'::text, %L::uuid, %L::text) $$, :'remark', :'remark_reference'),
  'a second remark while the first is open is refused, naming the open one');
reset role;
select pg_temp.act_as(:'assessor');
select is(status, 'not_found', 'nobody else can lodge an appeal on the learner''s result')
from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid());
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select is(status, 'unauthenticated', 'nor can someone not signed in')
from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid());

-- Seeing the marked work is a separate kind, open alongside the remark
reset role;
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select remark_standing, remark_appeal_id from api.get_appeal_options(%L) $$, :'result'),
  format($$ values ('open'::text, %L::uuid) $$, :'remark'), 'the lodge page knows a remark is open');
select status, appeal_id as script from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid()) \gset
select is(:'status'::text, 'ok', 'asking to see the work with the marks is accepted alongside the remark');
select is(status, 'already_open', 'but not twice while the first is open')
from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid());

-- The learner's reads
select results_eq($$ select id, type, state from api.list_my_appeals() order by type $$,
  format($$ values (%L::uuid, 'remark'::text, 'lodged'::text), (%L::uuid, 'view_script', 'lodged') $$,
         :'remark', :'script'),
  'the learner lists their appeals');
select results_eq(
  format($$ select type, grounds, appealed_outcome, points_scored, points_possible, jsonb_array_length(events),
                   events -> 0 ->> 'event', remediation_deadline_at is not null
            from api.get_my_appeal(%L) $$, :'remark'),
  $$ values ('remark'::text, 'Criterion 2 asks for the retention rules. Page 4 of my portfolio sets them out, with the schedule.'::text,
             'not_yet_competent'::text, 11, 20, 1, 'lodged'::text, true) $$,
  'and reads one: the grounds, what was appealed, its steps, and the resubmission date that stays');

reset role;
select pg_temp.act_as(:'assessor');
select is_empty(format($$ select * from api.get_my_appeal(%L) $$, :'remark'), 'nobody else reads it as theirs');
select is_empty($$ select * from api.list_appeals_to_coordinate() $$, 'an assessor has no appeals to coordinate');
select is_empty(format($$ select * from api.get_appeal_to_coordinate(%L) $$, :'remark'),
  'and cannot open one as a coordinator');

-- The coordinator's reads
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq($$ select reference, learner_number, state from api.list_appeals_to_coordinate() where type = 'remark' $$,
  format($$ values (%L::text, 'KSI-2026-0417'::text, 'lodged'::text) $$, :'remark_reference'),
  'a coordinator of the cohort sees the appeal in the queue');
select results_eq(
  format($$ select learner_name, grounds, appealed_outcome, assessor_name, events -> 0 ->> 'actor_name'
            from api.get_appeal_to_coordinate(%L) $$, :'remark'),
  $$ values ('Lerato Mokoena'::text, 'Criterion 2 asks for the retention rules. Page 4 of my portfolio sets them out, with the schedule.'::text,
             'not_yet_competent'::text, 'Nomsa Dlamini'::text, 'Lerato Mokoena'::text) $$,
  'and opens it: the learner, the grounds, the outcome appealed and who marked it');

-- The records cannot be reached or rewritten directly
reset role;
select pg_temp.act_as(:'learner');
select throws_ok('select * from appeals.appeals', '42501', null, 'the learner cannot read the appeals table directly');
reset role;
select throws_ok(format($$ update appeals.appeal_events set at = now() where appeal_id = %L $$, :'remark'),
  '42501', null, 'an appeal''s steps cannot be rewritten');

-- Transaction test 24: once a remark is admitted, no second remark on this result, ever
reset role;
update appeals.appeals
set admissibility = 'admitted', admissibility_decided_at = now(), admissibility_decided_by = :'coordinator',
    state = 'concluded'
where id = :'remark';
select pg_temp.act_as(:'learner');
select results_eq(
  format($$ select remark_standing, remark_appeal_id from api.get_appeal_options(%L) $$, :'result'),
  format($$ values ('used'::text, %L::uuid) $$, :'remark'), 'the lodge page shows the remark as used');
select results_eq(format($$ select status, appeal_id from api.lodge_appeal(%L, 'remark', %L, gen_random_uuid()) $$,
                         :'result', :grounds),
  format($$ values ('remark_used'::text, %L::uuid) $$, :'remark'),
  'a second remark after the first concluded, inside the window, is refused');
reset role;
select throws_ok(
  format($$ insert into appeals.appeals (reference, result_id, learner_id, decision_id, type, grounds, deadline_at,
                                          client_appeal_id, admissibility, admissibility_decided_at, admissibility_decided_by)
            select 'APL-TEST-1', r.id, r.learner_id, r.current_decision_id, 'remark', %L, r.appeal_deadline_at,
                   gen_random_uuid(), 'admitted', now(), %L
            from assessment.results r where r.id = %L $$, :grounds, :'coordinator', :'result'),
  '23505', null, 'and the database itself holds one admitted remark per result');

-- At most 10 appeals a day
reset role;
update appeals.appeals set state = 'inadmissible', admissibility = 'inadmissible', admissibility_decided_at = now(),
  admissibility_decided_by = :'coordinator', admissibility_reason = 'Test'
where id = :'script';
insert into appeals.appeals (reference, result_id, learner_id, decision_id, type, grounds, deadline_at, client_appeal_id,
                             state, admissibility, admissibility_decided_at, admissibility_decided_by, admissibility_reason)
select 'APL-TEST-R' || g, r.id, r.learner_id, r.current_decision_id, 'view_script', :grounds, r.appeal_deadline_at,
  gen_random_uuid(), 'inadmissible', 'inadmissible', now(), :'coordinator', 'Test'
from assessment.results r, generate_series(1, 8) g where r.id = :'result';
select pg_temp.act_as(:'learner');
select is(status, 'rate_limited', 'the eleventh appeal in a day is refused')
from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid());

-- FR-613: a result whose current decision came from an appeal is final
reset role;
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification, supersedes_decision_id)
select r.id, 'appeal', 'competent', :'staff', 'appeal_reviewer', 'The retention schedule is on page 4.', r.current_decision_id
from assessment.results r where r.id = :'result'
returning id as appeal_decision \gset
update assessment.results set current_decision_id = :'appeal_decision' where id = :'result';
select pg_temp.act_as(:'learner');
select is(decision_final, true, 'the lodge page knows the decision is final') from api.get_appeal_options(:'result');
select is(status, 'decision_final', 'and an appeal decision cannot be appealed')
from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid());

-- Somebody else's appeals stay theirs
reset role;
select pg_temp.act_as(:'staff');
select is_empty($$ select * from api.list_my_appeals() $$, 'staff have no appeals of their own in the list');
select isnt_empty($$ select * from api.list_appeals_to_coordinate() $$, 'but staff@ coordinates the cohort');

reset role;
select results_eq(
  $$ select count(*)::int from appeals.appeals a where not exists (
       select 1 from appeals.appeal_events e where e.appeal_id = a.id) and a.reference not like 'APL-TEST%' $$,
  $$ values (0) $$, 'every appeal lodged through the command has its first step');

select * from finish();
rollback;
