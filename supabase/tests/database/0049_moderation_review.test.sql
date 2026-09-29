-- Sample item review and allocation (S4-07; FR-504, FR-507, FR-508; BR-01): a moderator's cycles and items, the
-- one-route read of an item, findings and observations, allocation notices, and reallocation with the
-- separation-of-duties refusal. Builds on a frozen cycle as 0048 makes it.
create extension if not exists pgtap with schema extensions;

begin;
select plan(30);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A learner's decided, held result with one submitted version and one file, so the review has evidence to read.
create function pg_temp.held_result(p_learner uuid, p_name text, p_item uuid, p_assessor uuid, p_outcome text, p_decided_at timestamptz)
returns uuid language plpgsql as $$
declare
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_result uuid;
  v_decision uuid;
  v_submission uuid;
  v_version uuid;
  v_instance uuid;
  v_intent uuid;
  v_file uuid;
  v_key text;
begin
  if not exists (select 1 from identity.profiles where id = p_learner) then
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', p_learner, 'authenticated', 'authenticated',
            'pgtap.' || p_learner::text || '@takusani.test', now(), now());
    insert into identity.profiles (id, full_name, learner_number) values (p_learner, p_name, 'KSI-' || right(p_learner::text, 4));
    insert into programmes.enrolments (cohort_id, profile_id) values ('10000000-0000-4000-8000-000000000010', p_learner);
  end if;
  v_key := v_task::text || '/' || p_learner::text || '/' || gen_random_uuid()::text || '.pdf';
  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, object_key, original_filename, declared_media_type, declared_bytes,
    max_bytes, allowed_media_types, expires_at, finalised_at)
  values (p_learner, 'task_submission', v_task, v_key, 'portfolio.pdf', 'application/pdf', 2048, 26214400,
    array['application/pdf'], now() + interval '2 hours', now())
  returning id into v_intent;
  insert into submissions.stored_files (intent_id, bucket, object_key, original_filename, bytes, media_type, uploaded_by)
  values (v_intent, 'submissions', v_key, 'portfolio.pdf', 2048, 'application/pdf', p_learner)
  returning id into v_file;
  insert into submissions.submissions (task_id, profile_id) values (v_task, p_learner) returning id into v_submission;
  insert into submissions.submission_versions (submission_id, version_number, submitted_at, is_late, receipt_reference)
  values (v_submission, 1, p_decided_at - interval '1 day', false, 'SUB-' || left(gen_random_uuid()::text, 8))
  returning id into v_version;
  insert into submissions.submission_files (version_id, stored_file_id) values (v_version, v_file);
  insert into assessment.results (assessable_item_id, learner_id, state) values (p_item, p_learner, 'held')
  returning id into v_result;
  insert into assessment.assessment_instances (result_id, submission_version_id, assessor_id, state)
  values (v_result, v_version, p_assessor, 'decided') returning id into v_instance;
  insert into assessment.decisions (result_id, instance_id, type, outcome, actor_id, acting_role, justification, created_at,
                                    scores, feedback, remediation, resubmission_days)
  values (v_result, v_instance, 'assessment', p_outcome, p_assessor, 'assessor', 'Judged against every criterion.', p_decided_at,
          '[{"ordinal": 1, "points": 3, "comment": "Clear index."}]'::jsonb, 'Well organised.',
          case when p_outcome = 'not_yet_competent' then 'Add the retention schedule.' end,
          case when p_outcome = 'not_yet_competent' then 14 end)
  returning id into v_decision;
  update assessment.results set current_decision_id = v_decision where id = v_result;
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

select pg_temp.held_result(:'learner', 'Lerato Mokoena', :'item3', :'assessor', 'competent', now() - interval '3 days') as r1 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000102', 'Naledi Botha', :'item3', :'staff', 'not_yet_competent', now() - interval '2 days') as r2 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000103', 'Kagiso Mahlangu', :'item3', :'assessor', 'competent', now() - interval '1 day') as r0 \gset

-- Plan and freeze: every decision is first-time, so all three results are sampled. Thabo and Zanele are the
-- moderators, in turn: Thabo, Zanele, then Thabo again for r2, because Zanele assessed it.
select pg_temp.act_as(:'coordinator');
select cycle_id as cycle from api.plan_moderation_cycle(:'cohort', 'Term 3 assignments', array[:'item3']::uuid[]) \gset
select results_eq(format($$ select status, population, sample from api.freeze_moderation_cycle(%L, 1) $$, :'cycle'),
  $$ values ('ok'::text, 3, 3) $$, 'the cycle is frozen with all three results sampled');
reset role;
select results_eq(
  $$ select recipient_id, (payload ->> 'count')::int from notifications.notifications where event_type = 'moderation_items_allocated' order by recipient_id $$,
  format($$ values (%L::uuid, 2), (%L::uuid, 1) $$, :'moderator', :'staff'),
  'each moderator is told once how many items are theirs');
select id as thabo_item from moderation.sample_items where cycle_id = :'cycle' and result_id = :'r2' \gset
select id as zanele_item from moderation.sample_items where cycle_id = :'cycle' and moderator_id = :'staff' \gset
select results_eq(format($$ select moderator_id from moderation.sample_items where id = %L $$, :'thabo_item'),
  format($$ values (%L::uuid) $$, :'moderator'), 'Thabo holds the result Zanele assessed');

-- The moderator's reads
select pg_temp.act_as(:'moderator');
select results_eq($$ select name, cohort_name, state, my_items, my_concluded, total_items from api.list_my_moderation_cycles() $$,
  $$ values ('Term 3 assignments'::text, '2026 Intake B'::text, 'frozen'::text, 2, 0, 3) $$,
  'a moderator sees the cycles they hold items in, with their progress');
select results_eq(format($$ select seq, total, learner_name, item_title, inclusion_reason, state, outcome from api.list_my_sample_items(%L) where item_id = %L $$, :'cycle', :'thabo_item'),
  $$ values (2, 2, 'Naledi Botha'::text, 'Task 3: Workplace records portfolio'::text, 'nyc'::text, 'allocated'::text, 'not_yet_competent'::text) $$,
  'and their items in a cycle, numbered');
select results_eq(
  format($$ select status, learner_name, learner_number, assessor_name, outcome, justification, remediation, jsonb_array_length(files), jsonb_array_length(marks),
            marks -> 0 ->> 'points', assessed_version ->> 'version_number', jsonb_array_length(decisions), jsonb_array_length(findings), seq, total
            from api.open_sample_item(%L) $$, :'thabo_item'),
  $$ values ('ok'::text, 'Naledi Botha'::text, 'KSI-0102'::text, 'Zanele Khumalo'::text, 'not_yet_competent'::text, 'Judged against every criterion.'::text,
             'Add the retention schedule.'::text, 1, 3, '3'::text, '1'::text, 1, 0, 2, 2) $$,
  'opening an item gives the learner, the assessor, the decision, the marks, the version and its files on one read (FR-507)');
select is_empty(format($$ select status from api.open_sample_item(%L) $$, :'zanele_item'),
  'an item held by someone else is not found');
reset role;
select ok(moderation.may_read_sample_evidence(:'moderator', 'submissions',
  (select sf.object_key from moderation.sample_items si join assessment.results r on r.id = si.result_id
   join assessment.assessment_instances i on i.result_id = r.id join submissions.submission_files vf on vf.version_id = i.submission_version_id
   join submissions.stored_files sf on sf.id = vf.stored_file_id where si.id = :'thabo_item')),
  'the storage policy lets the moderator read the file of the work they hold');
select ok(not moderation.may_read_sample_evidence(:'moderator', 'submissions',
  (select sf.object_key from moderation.sample_items si join assessment.results r on r.id = si.result_id
   join assessment.assessment_instances i on i.result_id = r.id join submissions.submission_files vf on vf.version_id = i.submission_version_id
   join submissions.stored_files sf on sf.id = vf.stored_file_id where si.id = :'zanele_item')),
  'and not the file of work held by someone else');
select pg_temp.act_as(:'moderator');

-- Findings (FR-508)
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'maybe', 'x') $$, :'thabo_item'),
  $$ values ('invalid_finding'::text) $$, 'a finding is agree or disagree');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'agree', ' ') $$, :'thabo_item'),
  $$ values ('reasons_required'::text) $$, 'and always has reasons');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'agree', 'Fine') $$, :'zanele_item'),
  $$ values ('not_found'::text) $$, 'only on an item the moderator holds');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'disagree', 'AC 3.1 is met by the test sheet.') $$, :'thabo_item'),
  $$ values ('corrections_required'::text) $$, 'a disagreement returns the item, so it needs the corrections (S4-08, test 0051)');
select results_eq(format($$ select status, finding_id is not null from api.record_moderation_finding(%L, 'agree', 'The index suffices.') $$, :'thabo_item'),
  $$ values ('ok'::text, true) $$, 'an agreement is recorded');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'agree', 'On reflection, still so.') $$, :'thabo_item'),
  $$ values ('ok'::text) $$, 'a later finding is added, never edited');
select results_eq(
  format($$ select jsonb_array_length(findings), findings -> 0 ->> 'finding', findings -> 1 ->> 'finding', state, my_concluded from api.open_sample_item(%L) $$, :'thabo_item'),
  $$ values (2, 'agree'::text, 'agree'::text, 'agreed'::text, 1) $$, 'the item shows every finding, newest first, and counts as concluded');
select results_eq(format($$ select status from api.record_moderation_observation(%L, 'Assessors apply AC 3.2 inconsistently.') $$, :'cycle'),
  $$ values ('ok'::text) $$, 'a cohort-level observation is recorded');
select results_eq(format($$ select moderator_name, body, mine from api.list_moderation_observations(%L) $$, :'cycle'),
  $$ values ('Thabo Nkosi'::text, 'Assessors apply AC 3.2 inconsistently.'::text, true) $$, 'and read back');
reset role;

-- Separation of duties on the read (BR-01): Zanele assessed r2; were it hers, the page would show no evidence
update moderation.sample_items set moderator_id = :'staff' where id = :'thabo_item';
select pg_temp.act_as(:'staff');
select results_eq(
  format($$ select status, files, assessor_name, jsonb_array_length(conflict) from api.open_sample_item(%L) $$, :'thabo_item'),
  $$ values ('separation_of_duties_conflict'::text, '[]'::jsonb, null::text, 1) $$,
  'a moderator who assessed the result is refused with the conflict named, and sees no evidence');
select results_eq(format($$ select status from api.record_moderation_finding(%L, 'agree', 'Fine') $$, :'thabo_item'),
  $$ values ('separation_of_duties_conflict'::text) $$, 'and cannot record a finding on it');
reset role;
update moderation.sample_items set moderator_id = :'moderator' where id = :'thabo_item';

-- Reallocation by the coordinator (FR-504)
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select full_name, conflict, holds_now, items_in_cycle from api.list_sample_moderator_candidates(%L) order by full_name $$, :'zanele_item'),
  $$ values ('Thabo Nkosi'::text, false, false, 2), ('Zanele Khumalo'::text, false, true, 1) $$,
  'the candidates for an item say who holds it and who is excluded');
select results_eq(format($$ select status, jsonb_array_length(conflict) from api.reallocate_sample_item(%L, %L) $$, :'thabo_item', :'staff'),
  $$ values ('concluded'::text, null::integer) $$, 'a concluded item is not reallocated');
select results_eq(format($$ select status from api.reallocate_sample_item(%L, %L) $$, :'zanele_item', :'staff'),
  $$ values ('unchanged'::text) $$, 'nor to the moderator who holds it');
select results_eq(format($$ select status from api.reallocate_sample_item(%L, %L) $$, :'zanele_item', :'moderator'),
  $$ values ('ok'::text) $$, 'an open item goes to another moderator');
reset role;
select results_eq(format($$ select moderator_id, state from moderation.sample_items where id = %L $$, :'zanele_item'),
  format($$ values (%L::uuid, 'allocated'::text) $$, :'moderator'), 'and is theirs');
select results_eq(
  format($$ select recipient_id, payload ->> 'cycle_name' from notifications.notifications where event_type = 'moderation_item_reallocated' $$),
  format($$ values (%L::uuid, 'Term 3 assignments'::text) $$, :'moderator'), 'who is told');
-- Reallocating r2 (assessed by Zanele) to Zanele is refused with the conflict named
update moderation.sample_items set state = 'allocated' where id = :'thabo_item';
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select status, conflict -> 0 ->> 'actor_name', conflict -> 0 ->> 'outcome' from api.reallocate_sample_item(%L, %L) $$, :'thabo_item', :'staff'),
  $$ values ('separation_of_duties_conflict'::text, 'Zanele Khumalo'::text, 'not_yet_competent'::text) $$,
  'allocating the assessor of a result as its moderator is refused with the decision named (BR-01)');
select results_eq(format($$ select count(*), count(*) filter (where moderator_name = 'Thabo Nkosi') from api.list_cycle_sample_items(%L) $$, :'cycle'),
  $$ values (3::bigint, 3::bigint) $$, 'the coordinator sees every item of the cycle with who holds it');
reset role;
select results_eq(
  $$ select action, count(*) from audit.events where action in ('moderation.finding_recorded', 'moderation.observation_recorded', 'moderation.sample_item_reallocated') group by action order by action $$,
  $$ values ('moderation.finding_recorded'::text, 2::bigint), ('moderation.observation_recorded'::text, 1::bigint), ('moderation.sample_item_reallocated'::text, 1::bigint) $$,
  'findings, observations and reallocations are audit events');
select throws_like(
  format($$ update moderation.findings set reasons = 'changed' where sample_item_id = %L $$, :'thabo_item'),
  '%append-only%', 'a finding is never edited');

select * from finish();
rollback;
