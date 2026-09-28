-- The learner's calendar feed (S3-13; FR-304; ADR-020). Transaction test 19: a revoked, rotated, or deactivated-profile
-- token returns not found, and the payload holds schedule fields only. Uses the local seed: learner@ (enrolled in
-- "2026 Intake B", in the audience of Task 3), facilitator@.
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

-- An online session with a Teams link, and a cancelled one.
insert into learning.sessions (id, cohort_id, title, starts_at, duration_minutes, mode, teams_url, created_by) values
  ('60000000-0000-4000-8000-000000000001', :'cohort', 'Session 14: Minutes', now() + interval '2 days', 60, 'online',
   'https://teams.microsoft.com/l/meetup-join/secret-meeting', :'facilitator');
insert into learning.sessions (id, cohort_id, title, starts_at, duration_minutes, mode, venue, created_by, state, cancel_reason) values
  ('60000000-0000-4000-8000-000000000002', :'cohort', 'Session 15', now() + interval '3 days', 60, 'in_person', 'Room 4',
   :'facilitator', 'cancelled', 'Unwell.');

-- ---------------------------------------------------------------------------------------------------------------
-- Issuing a token
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'facilitator');
select results_eq($$ select status from api.issue_calendar_feed_token() $$, $$ values ('forbidden'::text) $$,
  'the feed is for learners');
reset role;

select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.my_calendar_feed() $$, 'a learner starts with no feed');
select status as issued, token as first_token from api.issue_calendar_feed_token() \gset
select is(:'issued'::text, 'ok', 'a learner creates their feed link');
select ok(:'first_token' ~ '^[A-Za-z0-9_-]{43}$', 'the token is 256 random bits, URL-safe');
select results_eq($$ select active, last_used_at from api.my_calendar_feed() $$, $$ values (true, null::timestamptz) $$,
  'the learner sees that the feed is on and not yet used');
reset role;

select is((select count(*)::int from learning.calendar_feed_tokens where token_hash = extensions.digest(:'first_token', 'sha256')), 1,
  'only the hash is stored');
select is((select count(*)::int from learning.calendar_feed_tokens t
           where convert_from(t.token_hash, 'LATIN1') like '%' || :'first_token' || '%'), 0, 'never the token itself');

-- ---------------------------------------------------------------------------------------------------------------
-- The feed: schedule fields only
-- ---------------------------------------------------------------------------------------------------------------

set local role anon;
select results_eq(format($$ select status from api.calendar_feed(%L, '10.0.0.1') $$, :'first_token'),
  $$ values ('ok'::text) $$, 'the feed answers without a session: the token is the credential');
reset role;
select is((select array_agg(k order by k) from api.calendar_feed(:'first_token', '10.0.0.1'),
             jsonb_array_elements(events) e, jsonb_object_keys(e) k where e ->> 'kind' = 'session' and e ->> 'id' like '60000000-%0001'),
  array['cancelled', 'ends_at', 'id', 'kind', 'location', 'starts_at', 'title', 'updated_at'],
  'test 19: each event carries schedule fields only');
select is((select count(*)::int from api.calendar_feed(:'first_token', '10.0.0.1'), jsonb_array_elements(events) e
           where e::text ilike '%teams.microsoft.com%' or e::text ilike '%secret-meeting%'), 0,
  'never the Teams join link');
select results_eq(format($$ select e ->> 'location', (e ->> 'ends_at')::timestamptz - (e ->> 'starts_at')::timestamptz
                            from api.calendar_feed(%L, '10.0.0.1'), jsonb_array_elements(events) e
                            where e ->> 'id' = '60000000-0000-4000-8000-000000000001' $$, :'first_token'),
  $$ values ('Online'::text, interval '1 hour') $$, 'an online session says Online, with its end time');
select results_eq(format($$ select (e ->> 'cancelled')::boolean from api.calendar_feed(%L, '10.0.0.1'), jsonb_array_elements(events) e
                            where e ->> 'id' = '60000000-0000-4000-8000-000000000002' $$, :'first_token'),
  $$ values (true) $$, 'a cancelled session stays in the feed, marked cancelled');
select results_eq(format($$ select e ->> 'kind', e ->> 'title' from api.calendar_feed(%L, '10.0.0.1'), jsonb_array_elements(events) e
                            where e ->> 'id' = '10000000-0000-4000-8000-000000000020' $$, :'first_token'),
  $$ values ('due'::text, 'Task 3: Workplace records portfolio'::text) $$, 'task due dates are in it');
select ok((select last_used_at is not null from learning.calendar_feed_tokens where token_hash = extensions.digest(:'first_token', 'sha256')),
  'a fetch records when the feed was last used');

-- last_used_at is written at most hourly, so polling is reads.
update learning.calendar_feed_tokens set last_used_at = now() - interval '10 minutes'
where token_hash = extensions.digest(:'first_token', 'sha256');
select api.calendar_feed(:'first_token', '10.0.0.1');
select ok((select last_used_at = now() - interval '10 minutes' from learning.calendar_feed_tokens
           where token_hash = extensions.digest(:'first_token', 'sha256')), 'and not on every poll');

-- ---------------------------------------------------------------------------------------------------------------
-- Rotation, revocation, deactivation (test 19)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select token as second_token from api.issue_calendar_feed_token() \gset
reset role;
select results_eq(format($$ select status from api.calendar_feed(%L, '10.0.0.1') $$, :'first_token'),
  $$ values ('not_found'::text) $$, 'test 19: a rotated token finds nothing');
select results_eq(format($$ select status from api.calendar_feed(%L, '10.0.0.1') $$, :'second_token'),
  $$ values ('ok'::text) $$, 'the new one works');
select is((select count(*)::int from learning.calendar_feed_tokens where profile_id = :'learner' and revoked_at is null), 1,
  'there is only ever one active token');

select pg_temp.act_as(:'learner');
select results_eq($$ select status from api.revoke_calendar_feed_token() $$, $$ values ('ok'::text) $$, 'the learner revokes it');
select is_empty($$ select * from api.my_calendar_feed() $$, 'and has no feed');
select results_eq($$ select status from api.revoke_calendar_feed_token() $$, $$ values ('no_feed'::text) $$,
  'revoking again says there is nothing to revoke');
reset role;
select results_eq(format($$ select status from api.calendar_feed(%L, '10.0.0.1') $$, :'second_token'),
  $$ values ('not_found'::text) $$, 'test 19: a revoked token finds nothing');

select pg_temp.act_as(:'learner');
select token as third_token from api.issue_calendar_feed_token() \gset
reset role;
update identity.profiles set status = 'deactivated', deactivated_at = now() where id = :'learner';
select results_eq(format($$ select status from api.calendar_feed(%L, '10.0.0.1') $$, :'third_token'),
  $$ values ('not_found'::text) $$, 'test 19: a deactivated learner''s token finds nothing');
select is((select revoked_reason from learning.calendar_feed_tokens where token_hash = extensions.digest(:'third_token', 'sha256')),
  'deactivated', 'deactivation revokes the token');
update identity.profiles set status = 'active', deactivated_at = null where id = :'learner';
select results_eq(format($$ select status from api.calendar_feed(%L, '10.0.0.1') $$, :'third_token'),
  $$ values ('not_found'::text) $$, 'and reactivation does not bring it back');

-- ---------------------------------------------------------------------------------------------------------------
-- Limits
-- ---------------------------------------------------------------------------------------------------------------

-- Unknown tokens count against the caller's address; known revoked ones do not.
select api.calendar_feed(:'first_token', '10.0.0.9') from generate_series(1, 40);
select is((select count(*)::int from audit.rate_buckets where surface = 'calendar_feed_unknown' and subject = '10.0.0.9'), 0,
  'a known but revoked token is not counted against the address');
select api.calendar_feed(repeat('z', 43), '10.0.0.9') from generate_series(1, 30);
select results_eq($$ select status from api.calendar_feed(repeat('y', 43), '10.0.0.9') $$, $$ values ('rate_limited'::text) $$,
  'the 31st unknown token in an hour from one address is refused');

select pg_temp.act_as(:'learner');
select token as live_token from api.issue_calendar_feed_token() \gset
reset role;
select api.calendar_feed(:'live_token', '10.0.0.2') from generate_series(1, 60);
select results_eq(format($$ select status from api.calendar_feed(%L, '10.0.0.3') $$, :'live_token'),
  $$ values ('rate_limited'::text) $$, 'a token is limited to 60 fetches an hour, from any address');

select * from finish();
rollback;
