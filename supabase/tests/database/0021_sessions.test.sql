-- Sessions with Teams links (S2-15; FR-206, FR-207, FR-305). Uses the local seed: facilitator@ sets work in
-- "2026 Intake B", where learner@ is enrolled.
create extension if not exists pgtap with schema extensions;

begin;
select plan(28);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set cohort 10000000-0000-4000-8000-000000000010
\set teams 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d'

-- The link check (FR-206)
select ok(learning.is_teams_link(:'teams'), 'a work Teams meeting link is accepted');
select ok(learning.is_teams_link('https://teams.live.com/meet/9876543210'), 'a personal Teams meeting link is accepted');
select ok(not learning.is_teams_link('http://teams.microsoft.com/l/meetup-join/x'), 'not over plain http');
select ok(not learning.is_teams_link('https://zoom.us/j/123'), 'not another service');
select ok(not learning.is_teams_link('https://teams.microsoft.com.evil.example/l/meetup-join/x'),
  'not a look-alike domain');

-- Scheduling: only whoever sets work in the cohort; every rule refuses in words
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.create_session(%L, 'Session 15', now() + interval '1 day', 120, 'online', %L) $$,
    :'cohort', :'teams'),
  $$ values ('forbidden'::text) $$, 'a learner cannot schedule a session');
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.create_session(%L, 'Session 15', now() + interval '1 day', 120, 'online', 'https://zoom.us/j/1') $$,
    :'cohort'),
  $$ values ('invalid_teams_link'::text) $$, 'an online session needs a Teams join link');
select results_eq(format($$ select status from api.create_session(%L, 'Session 15', now() - interval '1 hour', 120, 'online', %L) $$,
    :'cohort', :'teams'),
  $$ values ('start_in_past'::text) $$, 'a session cannot start in the past');
select results_eq(format($$ select status from api.create_session(%L, 'Session 15', now() + interval '1 day', 5, 'online', %L) $$,
    :'cohort', :'teams'),
  $$ values ('invalid_duration'::text) $$, 'a session lasts between 15 minutes and 10 hours');
select results_eq(format($$ select status from api.create_session(%L, 'Contact day', now() + interval '2 days', 360, 'in_person') $$,
    :'cohort'),
  $$ values ('invalid_venue'::text) $$, 'an in-person session needs a venue');
select session_id as online, notified as told from api.create_session(:'cohort', 'Session 15: Office administration',
  now() + interval '1 day', 120, 'online', :'teams') \gset
select is(:'told'::integer, 1, 'scheduling tells the one enrolled learner');
select session_id as contact from api.create_session(:'cohort', 'Contact day', now() + interval '2 days', 360,
  'in_person', null, 'Training Room 2') \gset

-- The learner's calendar (FR-305)
reset role;
select pg_temp.act_as(:'learner');
select results_eq($$ select title, mode, teams_url is not null, venue from api.list_my_sessions() $$,
  format($$ values ('Session 15: Office administration'::text, 'online'::text, true, null::text),
                   ('Contact day', 'in_person', false, 'Training Room 2') $$),
  'the learner sees both sessions, soonest first, with the join link or the venue');
select results_eq($$ select n.event_type, n.link from api.list_my_notifications('sessions') n order by n.created_at $$,
  $$ values ('session_scheduled'::text, '/learn/calendar'::text), ('session_scheduled', '/learn/calendar') $$,
  'and was told about each, under the Sessions filter');

-- Changing: a new time tells people again; a new title alone does not; a stale edit is refused (FR-207)
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status, notified from api.update_session(%L, 1, 'Session 15: Office admin', now() + interval '1 day', 120, 'online', %L) $$,
    :'online', :'teams'),
  $$ values ('ok'::text, 0) $$, 'a new title alone is saved without telling anyone');
select results_eq(format($$ select status from api.update_session(%L, 1, 'Session 15', now() + interval '3 days', 120, 'online', %L) $$,
    :'online', :'teams'),
  $$ values ('stale_version'::text) $$, 'an edit made from an old copy is refused');
select results_eq(format($$ select status, notified from api.update_session(%L, 2, 'Session 15: Office admin', now() + interval '3 days', 90, 'online', %L) $$,
    :'online', :'teams'),
  $$ values ('ok'::text, 1) $$, 'moving it tells the audience');
select results_eq(format($$ select status, notified from api.update_session(%L, 1, 'Contact day', now() + interval '2 days', 360, 'in_person', null, 'Training Room 3') $$,
    :'contact'),
  $$ values ('ok'::text, 1) $$, 'a new venue tells the audience');
reset role;
select results_eq(
  format($$ select payload ->> 'duration_minutes' from notifications.notifications where event_key = 'session_changed:' || %L || ':3' $$, :'online'),
  $$ values ('90'::text) $$, 'the notice carries the new details');

-- Cancelling
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.cancel_session(%L, '  ') $$, :'contact'),
  $$ values ('reason_required'::text) $$, 'cancelling needs a reason the learners will read');
select results_eq(format($$ select status, notified from api.cancel_session(%L, 'The venue is closed for repairs.') $$, :'contact'),
  $$ values ('ok'::text, 1) $$, 'cancelling tells the audience');
select results_eq(format($$ select status from api.update_session(%L, 3, 'Contact day', now() + interval '2 days', 360, 'in_person', null, 'Hall') $$,
    :'contact'),
  $$ values ('cancelled'::text) $$, 'a cancelled session cannot be changed');
select results_eq(format($$ select status from api.cancel_session(%L, 'Again') $$, :'contact'),
  $$ values ('already_cancelled'::text) $$, 'cancelling twice tells nobody twice');
reset role;
select pg_temp.act_as(:'learner');
select results_eq(format($$ select state, cancel_reason, teams_url from api.list_my_sessions() where id = %L $$, :'contact'),
  $$ values ('cancelled'::text, 'The venue is closed for repairs.'::text, null::text) $$,
  'the learner still sees it, marked cancelled, with the reason');
select results_eq($$ select count(*)::int from api.list_my_notifications('sessions') $$, $$ values (5) $$,
  'five notices in all: two scheduled, two changes, one cancellation');

-- A session that has been held is not changed or cancelled; nobody else sees any of it
reset role;
update learning.sessions set starts_at = now() - interval '3 hours', duration_minutes = 60 where id = :'online';
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.cancel_session(%L, 'Too late') $$, :'online'),
  $$ values ('already_held'::text) $$, 'a session that has ended cannot be cancelled');
reset role;
select pg_temp.act_as(:'learner');
select is_empty(format($$ select * from api.list_my_sessions() where id = %L $$, :'online'),
  'a session that has ended drops off the upcoming calendar');
select is_empty($$ select * from api.list_sessions() $$, 'a learner sees no facilitator list');
select is(api.cohort_audience_size(:'cohort'), null, 'nor the size of the audience');

select * from finish();
rollback;
