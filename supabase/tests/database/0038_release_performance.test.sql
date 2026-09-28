-- Performance gate: a set-based release of 1,000 results finishes within two seconds (spike X-4, register F7; S4-01).
--
-- Moderation sign-off (S4-09) releases a cycle's whole population in one transaction. This builds 1,000 held
-- results in one cohort, then releases them the way sign-off will: lock the population in identifier order, then one
-- set-based UPDATE. The release guard writes each result's release time, sequence number and appeal deadline (reading
-- the configured window), and the release trigger tells each learner: an in-app notification and, with email on, as
-- here, an outbox row, a delivery row and a queue message. Only the lock and the release are timed, not the set-up.
create extension if not exists pgtap with schema extensions;

begin;
select plan(8);

\set cohort 10000000-0000-4000-8000-000000000010
\set assessor 00000000-0000-4000-8000-000000000003

-- Email on, so each release also writes the outbox, the delivery and the queue message: the heaviest case.
update notifications.settings set email_enabled = true;

-- 1,000 learners, each with a held result on one assessable item, decided Competent.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'perf' || n || '@takusani.test', now(), now()
from generate_series(1, 1000) n;
insert into identity.profiles (id, full_name)
select u.id, 'Performance Learner ' || substring(u.email from 'perf(\d+)@')
from auth.users u where u.email like 'perf%@takusani.test';

insert into assessment.assessable_items (id, cohort_id, kind, title)
values ('80000000-0000-4000-8000-000000000001', :'cohort', 'exam', 'Unit 5 summative exam');
insert into assessment.results (assessable_item_id, learner_id)
select '80000000-0000-4000-8000-000000000001', p.id from identity.profiles p where p.full_name like 'Performance Learner %';
insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
select r.id, 'assessment', 'competent', :'assessor', 'assessor', 'Meets every criterion.'
from assessment.results r where r.assessable_item_id = '80000000-0000-4000-8000-000000000001';
update assessment.results r set current_decision_id = d.id
from assessment.decisions d where d.result_id = r.id and r.assessable_item_id = '80000000-0000-4000-8000-000000000001';

select is((select count(*)::int from assessment.results
           where assessable_item_id = '80000000-0000-4000-8000-000000000001' and state = 'held'), 1000,
  '1,000 held results to release');

create temp table queue_before as select queue_length from pgmq.metrics('notification_delivery');
create temp table timing (started timestamptz, finished timestamptz);
insert into timing (started) values (clock_timestamp());

-- The release, as sign-off will do it: lock the population in identifier order, then one set-based statement.
select count(*) from (
  select r.id from assessment.results r
  where r.assessable_item_id = '80000000-0000-4000-8000-000000000001'
  order by r.id
  for update
) locked;
update assessment.results r set state = 'released'
where r.assessable_item_id = '80000000-0000-4000-8000-000000000001' and r.state = 'held';

update timing set finished = clock_timestamp();

select diag('released 1,000 results in ' || round(extract(epoch from finished - started) * 1000) || ' ms') from timing;
select ok((select finished - started < interval '2 seconds' from timing), 'the release of 1,000 results takes under two seconds');

select results_eq($$ select count(*)::int, count(distinct release_seq)::int, count(appeal_deadline_at)::int
                    from assessment.results where assessable_item_id = '80000000-0000-4000-8000-000000000001' and state = 'released' $$,
  $$ values (1000, 1000, 1000) $$, 'every result is released, each with its own sequence number and appeal deadline');
select is((select count(distinct released_at)::int from assessment.results
           where assessable_item_id = '80000000-0000-4000-8000-000000000001'), 1,
  'all at the same release time: one transaction');
select is((select count(*)::int from notifications.notifications n
           join identity.profiles p on p.id = n.recipient_id
           where n.event_type = 'result_released' and p.full_name like 'Performance Learner %'), 1000,
  'each learner is told once in the LMS');
select is((select count(*)::int from notifications.outbox_messages o
           join identity.profiles p on p.id = o.recipient_id
           where o.event_type = 'result_released' and p.full_name like 'Performance Learner %'), 1000,
  'with one outbox row each');
select is((select count(*)::int from notifications.notification_deliveries dl
           join notifications.outbox_messages o on o.id = dl.outbox_message_id
           join identity.profiles p on p.id = o.recipient_id
           where o.event_type = 'result_released' and p.full_name like 'Performance Learner %'), 1000,
  'and one email delivery each');
select is((select m.queue_length - b.queue_length from pgmq.metrics('notification_delivery') m, queue_before b)::int, 1000,
  'with one queue message each, in the same transaction');

select * from finish();
rollback;
