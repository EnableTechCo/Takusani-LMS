-- Moderation planning on real data (S4-10; BR-01): the moderators available to a cohort, with what they assessed,
-- and the waiting results nobody could be allocated. Uses the local seed: Nomsa (assessor@) and Zanele (staff@)
-- assess "2026 Intake B"; Thabo (moderator@) and Zanele moderate it.
create extension if not exists pgtap with schema extensions;

begin;
select plan(8);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

create function pg_temp.held_result(p_learner uuid, p_name text, p_item uuid, p_assessor uuid)
returns uuid language plpgsql as $$
declare v_result uuid; v_decision uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_learner, 'authenticated', 'authenticated', 'pgtap.' || p_learner::text || '@takusani.test', now(), now());
  insert into identity.profiles (id, full_name) values (p_learner, p_name);
  insert into programmes.enrolments (cohort_id, profile_id) values ('10000000-0000-4000-8000-000000000010', p_learner);
  insert into assessment.results (assessable_item_id, learner_id, state) values (p_item, p_learner, 'held') returning id into v_result;
  insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
  values (v_result, 'assessment', 'competent', p_assessor, 'assessor', 'Judged.') returning id into v_decision;
  update assessment.results set current_decision_id = v_decision where id = v_result;
  return v_result;
end $$;

\set assessor 00000000-0000-4000-8000-000000000003
\set moderator 00000000-0000-4000-8000-000000000004
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set cohort 10000000-0000-4000-8000-000000000010

update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = :'cohort';
insert into assessment.assessable_items (cohort_id, kind, task_id, title)
values (:'cohort', 'task', '10000000-0000-4000-8000-000000000020', 'Task 3: Workplace records portfolio');
select id as item3 from assessment.assessable_items where task_id = '10000000-0000-4000-8000-000000000020' \gset

-- Two waiting results by Nomsa, one by Zanele (who also moderates).
select pg_temp.held_result('00000000-0000-4000-8000-000000000201', 'Learner One', :'item3', :'assessor') as r1 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000202', 'Learner Two', :'item3', :'assessor') as r2 \gset
select pg_temp.held_result('00000000-0000-4000-8000-000000000203', 'Learner Three', :'item3', :'staff') as r3 \gset

select pg_temp.act_as(:'assessor');
select is_empty(format($$ select * from api.list_moderation_moderators(%L) $$, :'cohort'), 'only a coordinator of the cohort lists its moderators');
reset role;

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select full_name, assessed_waiting, holds_open from api.list_moderation_moderators(%L) $$, :'cohort'),
  $$ values ('Thabo Nkosi'::text, 0, 0), ('Zanele Khumalo', 1, 0) $$,
  'each eligible moderator is listed with the waiting results they assessed (BR-01)');
select results_eq(format($$ select waiting, unmoderatable from api.get_moderation_pool(%L) where item_id = %L $$, :'cohort', :'item3'),
  $$ values (3, 0) $$, 'with Thabo available, every waiting result can be allocated');
reset role;

-- Thabo's moderator role ends: Zanele is the only moderator, and she assessed one of the results.
update identity.role_assignments set effective = tstzrange(lower(effective), now(), '[)') where profile_id = :'moderator' and role = 'moderator';
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select full_name from api.list_moderation_moderators(%L) $$, :'cohort'),
  $$ values ('Zanele Khumalo'::text) $$, 'a moderator whose role ended is no longer listed');
select results_eq(format($$ select waiting, unmoderatable from api.get_moderation_pool(%L) where item_id = %L $$, :'cohort', :'item3'),
  $$ values (3, 1) $$, 'the result she assessed has nobody who could moderate it');

-- The cycle list counts concluded items once frozen.
select cycle_id as cycle from api.plan_moderation_cycle(:'cohort', 'Term 3', array[:'item3']::uuid[]) \gset
select results_eq(format($$ select status, sample from api.freeze_moderation_cycle(%L, 1) $$, :'cycle'),
  $$ values ('ok'::text, 3) $$, 'the cycle freezes');
select results_eq(format($$ select sampled, concluded from api.list_moderation_cycles(%L) where id = %L $$, :'cohort', :'cycle'),
  $$ values (3, 0) $$, 'nothing is concluded yet');
reset role;
update moderation.sample_items set state = 'agreed' where cycle_id = :'cycle' and moderator_id is not null;
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select sampled, concluded from api.list_moderation_cycles(%L) where id = %L $$, :'cohort', :'cycle'),
  $$ values (3, 2) $$, 'and the list counts the concluded items; the unallocated one stays open');
reset role;

select * from finish();
rollback;
