-- Spike X-2 as a standing test (ADR-025; design register F1): a queue message sent inside a domain transaction
-- disappears when that transaction rolls back, and read count, visibility timeout and archive are reachable.
-- The queue and the outbox table here are throwaway probes; everything is rolled back at the end.
create extension if not exists pgtap with schema extensions;

begin;
select plan(11);

create extension if not exists pgmq;
select pgmq.create('x2_probe');

-- A stand-in for a domain function: records its outbox row, sends the queue message, then refuses.
create temporary table outbox_probe (id serial primary key, event text not null);

create function pg_temp.commit_then_refuse(p_event text) returns void language plpgsql as $$
begin
  insert into pg_temp.outbox_probe (event) values (p_event);
  perform pgmq.send('x2_probe', jsonb_build_object('event', p_event));
  raise exception 'refused after enqueue' using errcode = 'P0001';
end
$$;

create function pg_temp.queued() returns bigint language sql as $$ select count(*) from pgmq.q_x2_probe $$;

-- 1. Rollback removes the message together with the outbox row
select throws_ok(
  $$ select pg_temp.commit_then_refuse('result.released') $$,
  'P0001', 'refused after enqueue',
  'the domain function fails after sending'
);
select is(pg_temp.queued(), 0::bigint, 'the message sent before the failure is gone');
select is((select count(*) from pg_temp.outbox_probe), 0::bigint, 'and so is the outbox row written with it');

savepoint before_send;
select pgmq.send('x2_probe', '{"event": "task.published"}');
rollback to savepoint before_send;
select is(pg_temp.queued(), 0::bigint, 'a message sent and then rolled back to a savepoint is gone');

-- 2. A committed send is delivered, and the worker's controls are reachable
select pgmq.send('x2_probe', '{"event": "result.released"}') as msg_id \gset
select is(pg_temp.queued(), 1::bigint, 'a message sent in a transaction that continues is queued');

select results_eq(
  $$ select read_ct, message ->> 'event' from pgmq.read('x2_probe', 30, 1) $$,
  $$ values (1, 'result.released'::text) $$,
  'the first read returns the message with read count 1'
);
select is_empty(
  $$ select * from pgmq.read('x2_probe', 30, 1) $$,
  'while its visibility timeout runs, a second worker does not see it (overlapping runs are harmless)'
);

select isnt_empty(
  format($$ select * from pgmq.set_vt('x2_probe', %s, 0) $$, :'msg_id'),
  'the visibility timeout can be reset, as a failed delivery does'
);
select results_eq(
  $$ select read_ct from pgmq.read('x2_probe', 30, 1) $$,
  $$ values (2) $$,
  'the read count rises on each delivery attempt, so poison messages can be retired by read count'
);

select ok(pgmq.archive('x2_probe', :'msg_id'::bigint), 'a delivered message is archived');
select results_eq(
  format($$ select (select count(*) from pgmq.q_x2_probe), (select count(*) from pgmq.a_x2_probe where msg_id = %s) $$, :'msg_id'),
  $$ values (0::bigint, 1::bigint) $$,
  'archiving moves it from the queue to the archive'
);

select * from finish();
rollback;
