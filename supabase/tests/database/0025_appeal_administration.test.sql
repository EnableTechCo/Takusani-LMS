-- Appeals administration (S3-02; FR-605, FR-608; BR-02; AS-02). Uses the local seed: the published task in
-- "2026 Intake B", the enrolled learner, assessor@ (who decides the result), moderator@, staff@ (assessor, moderator
-- and coordinator), coordinator@, and facilitator@, who is made an assessor of another cohort for tier 3.
create extension if not exists pgtap with schema extensions;

begin;
select plan(42);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- The learner hands in a version and the assessor finalises it "not yet competent" (released at once: the cohort is
-- not moderated). Returns the result. Runs as postgres, then leaves the caller as postgres.
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
\set moderator 00000000-0000-4000-8000-000000000004
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set grounds '''Criterion 2 asks for the retention rules. Page 4 of my portfolio sets them out, with the schedule.'''

reset role;
select pg_temp.released_result() as result \gset
-- Tier 3: facilitator@ also assesses in another cohort.
insert into identity.role_assignments (profile_id, role, scope_type, scope_key)
values (:'facilitator', 'assessor', 'cohort', gen_random_uuid());

select pg_temp.act_as(:'learner');
select appeal_id as remark from api.lodge_appeal(:'result', 'remark', :grounds, gen_random_uuid()) \gset
select appeal_id as script from api.lodge_appeal(:'result', 'view_script', :grounds, gen_random_uuid()) \gset

-- Nothing to allocate before the appeal is admitted
reset role;
select pg_temp.act_as(:'coordinator');
select is(status, 'not_admitted', 'a reviewer cannot be allocated before the appeal is accepted')
from api.allocate_appeal_reviewer(:'remark', :'staff');

-- Admissibility (FR-605)
reset role;
select pg_temp.act_as(:'assessor');
select is(status, 'not_found', 'only a coordinator of the cohort decides admissibility')
from api.decide_appeal_admissibility(:'remark', true);
reset role;
select pg_temp.act_as(:'coordinator');
select is(status, 'reason_required', 'an appeal cannot be recorded as inadmissible without a reason')
from api.decide_appeal_admissibility(:'script', false, '  ');
select is(status, 'reason_too_long', 'the reason is at most 1000 characters')
from api.decide_appeal_admissibility(:'script', false, repeat('x', 1001));
select is(status, 'ok', 'the coordinator records the script request as inadmissible, with a reason')
from api.decide_appeal_admissibility(:'script', false, 'This request repeats one already answered in class.');
select is(status, 'ok', 'and admits the re-mark') from api.decide_appeal_admissibility(:'remark', true);
select is(status, 'already_decided', 'admissibility is decided once')
from api.decide_appeal_admissibility(:'remark', false, 'Changed my mind.');

reset role;
select results_eq(
  format($$ select state, admissibility, admissibility_reason, admissibility_decided_by from appeals.appeals
            where id in (%L, %L) order by type $$, :'remark', :'script'),
  format($$ values ('admitted'::text, 'admitted'::text, null::text, %L::uuid),
                   ('inadmissible', 'inadmissible', 'This request repeats one already answered in class.', %L) $$,
         :'coordinator', :'coordinator'),
  'the decisions are recorded with who made them');
select results_eq(
  format($$ select event_type, payload ->> 'reason' from notifications.notifications
            where recipient_id = %L and event_key in ('appeal_admissibility:%s', 'appeal_admissibility:%s')
            order by event_type $$, :'learner', :'remark', :'script'),
  $$ values ('appeal_admitted'::text, null::text),
            ('appeal_inadmissible', 'This request repeats one already answered in class.') $$,
  'the learner is told either way, with the reason when it is not accepted');
select results_eq(
  format($$ select event from appeals.appeal_events where appeal_id = %L order by id $$, :'remark'),
  $$ values ('lodged'::text), ('admitted') $$, 'the admission is a step on the appeal''s record');
select is((select count(*)::int from audit.events where action = 'appeals.admissibility_decided'), 2,
  'both decisions are audited');

reset role;
select pg_temp.act_as(:'learner');
select is(admissibility_reason, 'This request repeats one already answered in class.',
  'the learner reads the reason word for word') from api.get_my_appeal(:'script');
select is(admissibility_reason, null, 'an admitted appeal carries no reason') from api.get_my_appeal(:'remark');

-- The reviewer list (AS-02): tier 1 covering assessors, tier 2 the cohort moderator, tier 3 assessors elsewhere, and
-- everyone who assessed the work shown as excluded
reset role;
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select full_name, tier, jsonb_array_length(coalesce(excluded_by, '[]')) from api.list_appeal_reviewer_candidates(%L) $$,
         :'remark'),
  $$ values ('Zanele Khumalo'::text, 1::smallint, 0), ('Thabo Nkosi', 2::smallint, 0), ('Pieter van Wyk', 3::smallint, 0),
            ('Nomsa Dlamini', null::smallint, 1) $$,
  'the list is in AS-02 order, and the assessor who decided the result is excluded');
select is(role_label, 'Assessor, a cohort', 'a tier 3 reviewer is labelled with the role that qualifies them')
from api.list_appeal_reviewer_candidates(:'remark') where tier = 3;
select is(excluded_by -> 0 ->> 'outcome', 'not_yet_competent', 'the exclusion names the decision')
from api.list_appeal_reviewer_candidates(:'remark') where tier is null;
reset role;
select pg_temp.act_as(:'assessor');
select is_empty(format($$ select * from api.list_appeal_reviewer_candidates(%L) $$, :'remark'),
  'someone who does not coordinate the cohort sees no list');

-- Allocation: refused with the named conflict (FR-608, BR-02)
reset role;
select pg_temp.act_as(:'coordinator');
select is(status, 'not_a_remark', 'a request to see the marked work has no reviewer')
from api.allocate_appeal_reviewer(:'script', :'staff');
select results_eq(
  format($$ select status, conflicts -> 0 ->> 'role', jsonb_array_length(conflicts)
            from api.allocate_appeal_reviewer(%L, %L) $$, :'remark', :'assessor'),
  $$ values ('separation_of_duties_conflict'::text, 'assessor'::text, 1) $$,
  'the assessor who decided the result is refused, with the decision named');
reset role;
select is((select reviewer_id from appeals.appeals where id = :'remark'), null, 'and nothing was allocated');
select results_eq(
  format($$ select event, details ->> 'reviewer_id' from appeals.appeal_events where appeal_id = %L and event = 'allocation_refused' $$,
         :'remark'),
  format($$ values ('allocation_refused'::text, %L::text) $$, :'assessor'), 'the refusal is on the appeal''s record');
select pg_temp.act_as(:'coordinator');
select is(status, 'not_eligible', 'someone with no assessor or moderator role cannot review')
from api.allocate_appeal_reviewer(:'remark', :'coordinator');
select is(status, 'not_eligible', 'nor can the learner') from api.allocate_appeal_reviewer(:'remark', :'learner');
select is(status, 'skip_reason_required', 'passing over tier 1 for tier 2 needs a reason')
from api.allocate_appeal_reviewer(:'remark', :'moderator');
select is(status, 'skip_reason_required', 'and so does passing over to tier 3')
from api.allocate_appeal_reviewer(:'remark', :'facilitator');

select is(status, 'ok', 'a tier 1 reviewer is allocated') from api.allocate_appeal_reviewer(:'remark', :'staff');
reset role;
select results_eq(
  format($$ select state, reviewer_id, reviewer_tier, allocated_by from appeals.appeals where id = %L $$, :'remark'),
  format($$ values ('allocated'::text, %L::uuid, 1::smallint, %L::uuid) $$, :'staff', :'coordinator'),
  'the appeal is with the reviewer, recorded with the tier and who allocated it');
select results_eq(
  format($$ select event_type, link from notifications.notifications where recipient_id = %L and event_type = 'appeal_review_allocated' $$,
         :'staff'),
  format($$ values ('appeal_review_allocated'::text, '/review/appeals/%s'::text) $$, :'remark'),
  'the reviewer is told, with a link to the review');
select pg_temp.act_as(:'staff');
select is(has_review_allocation, true, 'and the Appeal reviews workspace appears for them') from api.my_access();
reset role;
select pg_temp.act_as(:'moderator');
select is(has_review_allocation, false, 'but not for anyone without an allocation') from api.my_access();

reset role;
select pg_temp.act_as(:'coordinator');
select is(status, 'already_allocated', 'allocating the same reviewer again changes nothing')
from api.allocate_appeal_reviewer(:'remark', :'staff');
select is(status, 'skip_reason_required', 'reallocating to tier 3 while tier 2 is available needs a reason')
from api.allocate_appeal_reviewer(:'remark', :'facilitator');
select is(status, 'ok', 'reallocating to the next available tier needs no reason')
from api.allocate_appeal_reviewer(:'remark', :'moderator');
reset role;
select results_eq(
  format($$ select event, details ->> 'previous_reviewer_id', (details ->> 'tier')::int from appeals.appeal_events
            where appeal_id = %L and event in ('allocated', 'reallocated') order by id $$, :'remark'),
  format($$ values ('allocated'::text, null::text, 1), ('reallocated', %L, 2) $$, :'staff'),
  'each allocation is a step on the record, the reallocation naming who it replaced');
select pg_temp.act_as(:'coordinator');
select is(open_reviews, 1, 'the new reviewer''s open reviews are counted')
from api.list_appeal_reviewer_candidates(:'remark') where full_name = 'Thabo Nkosi';
select is(status, 'ok', 'a later tier can be chosen with a reason')
from api.allocate_appeal_reviewer(:'remark', :'facilitator', 'Thabo Nkosi is on leave until November.');
reset role;
select is((select details ->> 'skip_reason' from appeals.appeal_events where appeal_id = :'remark' order by id desc limit 1),
  'Thabo Nkosi is on leave until November.', 'and the reason is kept on the record');

-- The coordinator's and the learner's views of the record
select pg_temp.act_as(:'coordinator');
select results_eq(
  format($$ select reviewer_name, reviewer_tier, jsonb_array_length(decisions), decisions -> 0 ->> 'actor_name',
                   jsonb_array_length(events) from api.get_appeal_to_coordinate(%L) $$, :'remark'),
  $$ values ('Pieter van Wyk'::text, 3::smallint, 1, 'Nomsa Dlamini'::text, 6) $$,
  'the coordinator sees the reviewer, the decision chain, and every step including the refused allocation');
select is(reviewer_name, 'Pieter van Wyk', 'the queue names the reviewer')
from api.list_appeals_to_coordinate() where id = :'remark';
reset role;
select pg_temp.act_as(:'learner');
select is(jsonb_array_length(events), 5, 'the learner sees their steps, but not the refused allocation')
from api.get_my_appeal(:'remark');

-- Closed appeals take no reviewer, and only a re-mark ever has one
reset role;
update appeals.appeals set state = 'concluded' where id = :'remark';
select pg_temp.act_as(:'coordinator');
select is(status, 'closed', 'a concluded appeal cannot be reallocated')
from api.allocate_appeal_reviewer(:'remark', :'staff');
reset role;
select throws_ok(
  format($$ update appeals.appeals set reviewer_id = %L, reviewer_tier = 1, allocated_at = now(), allocated_by = %L
            where id = %L $$, :'staff', :'coordinator', :'script'),
  '23514', null, 'the database refuses a reviewer on a request to see the marked work');

select * from finish();
rollback;
