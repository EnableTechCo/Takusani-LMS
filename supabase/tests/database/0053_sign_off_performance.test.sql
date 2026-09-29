-- Performance gate (S4-09; spike X-4, register F7): api.sign_off_moderation_cycle releases a population of 1,000
-- results within two seconds. 1,000 learners with held Competent decisions by one assessor in a moderated cohort;
-- the cycle is planned and frozen through the api (every decision is first-time, so all 1,000 are sampled and
-- allocated), the items are concluded directly, and the sign-off itself is timed, with email on: the heaviest case.
create extension if not exists pgtap with schema extensions;

begin;
select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set cohort 10000000-0000-4000-8000-000000000010
\set assessor 00000000-0000-4000-8000-000000000003
\set moderator 00000000-0000-4000-8000-000000000004
\set coordinator 00000000-0000-4000-8000-000000000005

update notifications.settings set email_enabled = true;
update programmes.cohort_moderation_state set moderation_policy = 'moderated' where cohort_id = :'cohort';
-- Only Thabo moderates, so allocation is one loop over one moderator.
update identity.role_assignments set effective = tstzrange(lower(effective), now(), '[)')
where role = 'moderator' and profile_id <> :'moderator';

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'perf' || n || '@takusani.test', now(), now()
from generate_series(1, 1000) n;
insert into identity.profiles (id, full_name)
select u.id, 'Performance Learner ' || substring(u.email from 'perf(\d+)@')
from auth.users u where u.email like 'perf%@takusani.test';
insert into programmes.enrolments (cohort_id, profile_id)
select :'cohort', p.id from identity.profiles p where p.full_name like 'Performance Learner %';

insert into assessment.assessable_items (id, cohort_id, kind, task_id, title)
values ('80000000-0000-4000-8000-000000000001', :'cohort', 'task', '10000000-0000-4000-8000-000000000020', 'Task 3: Workplace records portfolio');
insert into assessment.results (assessable_item_id, learner_id)
select '80000000-0000-4000-8000-000000000001', p.id from identity.profiles p where p.full_name like 'Performance Learner %';
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
select r.id, 'assessment', 'competent', :'assessor', 'assessor', 'Meets every criterion.'
from assessment.results r where r.assessable_item_id = '80000000-0000-4000-8000-000000000001';
update assessment.results r set current_decision_id = d.id
from assessment.decisions d where d.result_id = r.id and r.assessable_item_id = '80000000-0000-4000-8000-000000000001';

select pg_temp.act_as(:'coordinator');
select cycle_id as cycle from api.plan_moderation_cycle(:'cohort', 'Unit 5 release', array['80000000-0000-4000-8000-000000000001']::uuid[]) \gset
select results_eq(format($$ select status, population, sample from api.freeze_moderation_cycle(%L, 1) $$, :'cycle'),
  $$ values ('ok'::text, 1000, 1000) $$, 'the cycle freezes a population of 1,000, all sampled (first-time assessor)');
reset role;
update moderation.sample_items set state = 'agreed' where cycle_id = :'cycle';

create temp table queue_before as select queue_length from pgmq.metrics('notification_delivery');
create temp table timing (started timestamptz, finished timestamptz);
insert into timing (started) values (clock_timestamp());

select pg_temp.act_as(:'moderator');
select results_eq(format($$ select status, released, notified from api.sign_off_moderation_cycle(%L, 2, 'Reviewed.') $$, :'cycle'),
  $$ values ('ok'::text, 1000, 1000) $$, 'the moderator signs off 1,000 results');
reset role;

update timing set finished = clock_timestamp();
select diag('signed off 1,000 results in ' || round(extract(epoch from finished - started) * 1000) || ' ms') from timing;
select ok((select finished - started < interval '2 seconds' from timing), 'the sign-off of 1,000 results takes under two seconds');

select results_eq($$ select count(*)::int, count(distinct release_seq)::int, count(distinct released_at)::int
                    from assessment.results where assessable_item_id = '80000000-0000-4000-8000-000000000001' and state = 'released' $$,
  $$ values (1000, 1000, 1) $$, 'every result is released, each with its own sequence number, all at one moment');
select is((select count(*)::int from moderation.releases where cycle_id = :'cycle'), 1000, 'the release record lists all 1,000');
select is((select count(*)::int from notifications.outbox_messages o
           join identity.profiles p on p.id = o.recipient_id
           where o.event_type = 'result_released' and p.full_name like 'Performance Learner %'), 1000,
  'with one outbox row each');
-- 1,000 learners, and the two coordinators of the cohort told of the sign-off.
select is((select m.queue_length - b.queue_length from pgmq.metrics('notification_delivery') m, queue_before b)::int, 1002,
  'and one queue message each, in the same transaction, plus the coordinators'' notices');

select * from finish();
rollback;
