-- Spike X-3 (S5-01, throwaway): the autosave function has the semantics of ADR-023, and only test accounts reach it.
create extension if not exists pgtap with schema extensions;

begin;
select plan(10);

create function pg_temp.act_as(p_user uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', p_user, 'role', 'authenticated', 'email', p_email)::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001

-- An account outside the test domain gets nothing.
select pg_temp.act_as(:'learner', 'someone@example.org');
select is_empty($$ select * from api.spike_prepare(3) $$, 'only test accounts can prepare spike attempts');
reset role;

select pg_temp.act_as(:'learner', 'learner@takusani.test');
select is((select count(*)::int from api.spike_prepare(2)), 2, 'a test account prepares attempts for the load test');
reset role;
select id as attempt, lease_id as lease from spike.attempts where owner_id = :'learner' order by id limit 1 \gset

select pg_temp.act_as(:'learner', 'learner@takusani.test');
select results_eq(
  format($$ select status, saved from api.spike_autosave(%L, %L,
    '[{"question_id": 1, "client_seq": 2, "payload": {"text": "b"}}, {"question_id": 2, "client_seq": 1, "payload": {"choice": "a"}}]') $$,
    :'attempt', :'lease'),
  $$ values ('ok'::text, 2) $$, 'a batch of answers is saved in one call');
select results_eq(
  format($$ select status from api.spike_autosave(%L, %L, '[]') $$, :'attempt', :'lease'),
  $$ values ('too_frequent'::text) $$, 'the cadence is held: a second batch at once is refused');
reset role;
update spike.attempts set last_save_at = now() - interval '10 seconds' where id = :'attempt';
select pg_temp.act_as(:'learner', 'learner@takusani.test');
select results_eq(
  format($$ select status, saved from api.spike_autosave(%L, %L,
    '[{"question_id": 1, "client_seq": 1, "payload": {"text": "older"}}, {"question_id": 2, "client_seq": 3, "payload": {"choice": "c"}}]') $$,
    :'attempt', :'lease'),
  $$ values ('ok'::text, 1) $$, 'only the newer sequence is kept');
reset role;
select results_eq(format($$ select question_id, payload from spike.answers where attempt_id = %L order by 1 $$, :'attempt'),
  $$ values (1, '{"text": "b"}'::jsonb), (2, '{"choice": "c"}'::jsonb) $$,
  'an older answer never overwrites a newer one');
update spike.attempts set last_save_at = now() - interval '10 seconds' where id = :'attempt';

select pg_temp.act_as(:'learner', 'learner@takusani.test');
select results_eq(
  format($$ select status, saved from api.spike_autosave(%L, %L,
    '[{"question_id": 5, "client_seq": 1, "payload": {"text": "x"}}, {"question_id": 5, "client_seq": 2, "payload": {"text": "y"}}]') $$,
    :'attempt', :'lease'),
  $$ values ('ok'::text, 1) $$, 'a question named twice in one batch keeps its newest entry, without an error');
reset role;
update spike.attempts set last_save_at = now() - interval '10 seconds' where id = :'attempt';

select pg_temp.act_as(:'learner', 'learner@takusani.test');
select results_eq(format($$ select status from api.spike_autosave(%L, gen_random_uuid(), '[]') $$, :'attempt'),
  $$ values ('lease_lost'::text) $$, 'a stale lease is refused');
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-000000000003', 'assessor@takusani.test');
select results_eq(format($$ select status from api.spike_autosave(%L, %L, '[]') $$, :'attempt', :'lease'),
  $$ values ('not_found'::text) $$, 'another account cannot write to the attempt');
reset role;

select pg_temp.act_as(:'learner', 'learner@takusani.test');
select is(api.spike_cleanup(), 2, 'cleanup removes the caller''s attempts and their answers');

select * from finish();
rollback;
