-- Session series (F-06; FR-206, FR-207): a session repeating weekly or fortnightly, told once, cancelled together.
-- Uses the local seed: facilitator@ sets work in "2026 Intake B", where learner@ is enrolled.
create extension if not exists pgtap with schema extensions;

begin;
select plan(23);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set cohort 10000000-0000-4000-8000-000000000010
\set teams 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d'

select is(learning.series_interval('weekly'), interval '7 days', 'weekly is seven days apart');
select is(learning.series_interval('fortnightly'), interval '14 days', 'fortnightly is fourteen');

-- Refusals, in words
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.create_session_series(%L, 'Weekly class', now() + interval '1 day', 120, 'online', 'weekly', 6, %L) $$,
    :'cohort', :'teams'),
  $$ values ('forbidden'::text) $$, 'a learner cannot schedule a series');
reset role;

select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.create_session_series(%L, 'Weekly class', now() + interval '1 day', 120, 'online', 'daily', 6, %L) $$,
    :'cohort', :'teams'),
  $$ values ('invalid_repeat'::text) $$, 'only weekly or fortnightly');
select results_eq(format($$ select status from api.create_session_series(%L, 'Weekly class', now() + interval '1 day', 120, 'online', 'weekly', 1, %L) $$,
    :'cohort', :'teams'),
  $$ values ('invalid_count'::text) $$, 'a series is at least two sessions');
select results_eq(format($$ select status from api.create_session_series(%L, 'Weekly class', now() + interval '1 day', 120, 'online', 'weekly', 27, %L) $$,
    :'cohort', :'teams'),
  $$ values ('invalid_count'::text) $$, 'and at most twenty-six');
select results_eq(format($$ select status from api.create_session_series(%L, 'Weekly class', now() - interval '1 day', 120, 'online', 'weekly', 6, %L) $$,
    :'cohort', :'teams'),
  $$ values ('start_in_past'::text) $$, 'the session rules apply to the first session');

-- A weekly series of six, and a fortnightly one of three
select session_id as first from api.create_session_series(:'cohort', 'Weekly class', '2027-02-02 09:00+02', 120, 'online', 'weekly', 6, :'teams') \gset
select results_eq(format($$ select sessions, notified from api.create_session_series(%L, 'Fortnightly class', '2027-03-01 14:00+02', 60, 'in_person', 'fortnightly', 3, null, 'Room 4') $$, :'cohort'),
  $$ values (3, 1) $$, 'a series says how many sessions it made and how many learners were told');
select results_eq(
  format($$ select series_seq, series_count from api.list_sessions() where id = %L $$, :'first'),
  $$ values (1, 6) $$, 'the facilitator sees the number in the series');
reset role;

select is((select count(*) from learning.sessions where title = 'Weekly class'), 6::bigint, 'the refusals made no sessions; the series made six');
select results_eq(
  $$ select series_seq, starts_at from learning.sessions where title = 'Weekly class' order by series_seq $$,
  $$ values (1, '2027-02-02 09:00+02'::timestamptz), (2, '2027-02-09 09:00+02'::timestamptz),
            (3, '2027-02-16 09:00+02'::timestamptz), (4, '2027-02-23 09:00+02'::timestamptz),
            (5, '2027-03-02 09:00+02'::timestamptz), (6, '2027-03-09 09:00+02'::timestamptz) $$,
  'six sessions a week apart at the same time of day, numbered');
select results_eq(
  $$ select count(distinct series_id), max(series_count) from learning.sessions where title = 'Weekly class' $$,
  $$ values (1::bigint, 6) $$, 'all in one series that knows its size');
select results_eq(
  $$ select starts_at from learning.sessions where title = 'Fortnightly class' order by series_seq $$,
  $$ values ('2027-03-01 14:00+02'::timestamptz), ('2027-03-15 14:00+02'::timestamptz), ('2027-03-29 14:00+02'::timestamptz) $$,
  'a fortnightly series is two weeks apart');

-- Told once about the series, not six times
select results_eq(
  $$ select count(*) from notifications.notifications where event_type = 'session_series_scheduled' $$,
  $$ values (2::bigint) $$, 'one notification per series per learner');
select results_eq(
  $$ select count(*) from notifications.notifications where event_type = 'session_scheduled' $$,
  $$ values (0::bigint) $$, 'and none per session');
select results_eq(
  format($$ select payload ->> 'count', payload ->> 'repeat', (payload ->> 'last_starts_at')::timestamptz from notifications.notifications
            where event_type = 'session_series_scheduled' and payload ->> 'session_id' = %L $$, :'first'),
  $$ values ('6'::text, 'weekly'::text, '2027-03-09 09:00+02'::timestamptz) $$,
  'the message carries the count, the rhythm and the last date');
select results_eq(
  $$ select count(*) from audit.events where action = 'learning.session_series_scheduled' $$,
  $$ values (2::bigint) $$, 'each series is one audit event');

-- Cancelling one session leaves the rest; cancelling the rest of the series takes the later ones with it
select id as third from learning.sessions where title = 'Weekly class' and series_seq = 3 \gset
select id as fourth from learning.sessions where title = 'Weekly class' and series_seq = 4 \gset
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status, cancelled from api.cancel_session(%L, 'Public holiday') $$, :'third'),
  $$ values ('ok'::text, 1) $$, 'one session cancelled on its own');
select results_eq(format($$ select status, cancelled, notified from api.cancel_session(%L, 'The venue closed', true) $$, :'fourth'),
  $$ values ('ok'::text, 3, 1) $$, 'the fourth and the two after it are cancelled, and the learner told once');
reset role;

select results_eq(
  $$ select series_seq, state, cancel_reason from learning.sessions where title = 'Weekly class' order by series_seq $$,
  $$ values (1, 'scheduled'::text, null::text), (2, 'scheduled'::text, null::text), (3, 'cancelled'::text, 'Public holiday'::text),
            (4, 'cancelled'::text, 'The venue closed'::text), (5, 'cancelled'::text, 'The venue closed'::text),
            (6, 'cancelled'::text, 'The venue closed'::text) $$,
  'earlier sessions are untouched; the later ones carry the same reason');
select results_eq(
  $$ select count(*) from notifications.notifications where event_type = 'session_series_cancelled' $$,
  $$ values (1::bigint) $$, 'the series cancellation is one notification per learner');
select results_eq(
  $$ select count(*) from notifications.notifications where event_type = 'session_cancelled' $$,
  $$ values (1::bigint) $$, 'the single cancellation was its own message');
select results_eq(
  $$ select count(*) from audit.events where action = 'learning.session_cancelled' $$,
  $$ values (4::bigint) $$, 'every cancelled session has its own audit event');

select * from finish();
rollback;
