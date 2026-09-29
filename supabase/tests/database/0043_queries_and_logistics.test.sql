-- Stakeholder queries and session logistics (S6-03; FR-704 to FR-707).
-- Uses the local seed: coordinator@ and staff@ coordinate everything; facilitator@ and learner@ do not coordinate.
create extension if not exists pgtap with schema extensions;

begin;
select plan(41);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set coordinator 00000000-0000-4000-8000-000000000005
\set staff 00000000-0000-4000-8000-000000000007
\set programme 10000000-0000-4000-8000-000000000001
\set cohort 10000000-0000-4000-8000-000000000010

-- ---------------------------------------------------------------------------------------------------------------
-- Queries (FR-704)
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.log_stakeholder_query(%L, null, 'employer', 'Acme Logistics', null,
    'Placement dates', 'When do learners start their placement?') $$, :'programme'),
  $$ values ('forbidden'::text) $$, 'only a coordinator who covers the programme logs a query');
reset role;

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.log_stakeholder_query(%L, null, 'rumour', 'Acme', null, 'x', 'y') $$, :'programme'),
  $$ values ('invalid_source_type'::text) $$, 'the source is one of the known kinds');
select results_eq(format($$ select status from api.log_stakeholder_query(%L, gen_random_uuid(), 'employer', 'Acme', null, 'x', 'y') $$, :'programme'),
  $$ values ('cohort_not_in_programme'::text) $$, 'a cohort must belong to the programme');
select results_eq(format($$ select status from api.log_stakeholder_query(%L, %L, 'employer', 'Acme', null, 'x', 'y', current_date - 1) $$,
    :'programme', :'cohort'),
  $$ values ('due_in_past'::text) $$, 'a due date is today or later');
select status, query_id as query, reference as ref from api.log_stakeholder_query(:'programme', :'cohort', 'employer',
  'Acme Logistics', 'hr@acme.example', 'Placement dates', 'When do learners in Intake B start their placement?',
  current_date + 5) \gset
select is(:'status'::text, 'ok', 'the coordinator logs a query against the programme and a cohort');
select ok(:'ref'::text ~ '^QRY-[0-9]{4}-[0-9]{4}$', 'it gets a reference that is never reused');
select results_eq(format($$ select state, owner_id, source_name, due_on = current_date + 5 from api.list_stakeholder_queries('open') where id = %L $$, :'query'),
  $$ values ('open'::text, null::uuid, 'Acme Logistics'::text, true) $$, 'it is open, with no owner yet, in the list');

-- Routing
select results_eq(format($$ select status from api.route_stakeholder_query(%L, %L) $$, :'query', :'facilitator'),
  $$ values ('owner_not_eligible'::text) $$, 'it can be routed only to a coordinator who covers it');
select results_eq(format($$ select status from api.route_stakeholder_query(%L, %L, 'You know the employer.') $$, :'query', :'staff'),
  $$ values ('ok'::text) $$, 'the coordinator routes it to a colleague');
select results_eq(format($$ select status from api.route_stakeholder_query(%L, %L) $$, :'query', :'staff'),
  $$ values ('unchanged'::text) $$, 'routing it again to the same person changes nothing');
reset role;
select results_eq(format($$ select event_type, link, payload ->> 'reference', payload ->> 'note' from notifications.notifications
                          where recipient_id = %L and event_type = 'query_assigned' $$, :'staff'),
  format($$ values ('query_assigned'::text, %L::text, %L::text, 'You know the employer.'::text) $$,
    '/coordinate/queries/' || :'query', :'ref'),
  'the new owner is told, with the reference, the note and a link to the query');

-- Working it to closure
select pg_temp.act_as(:'staff');
select results_eq(format($$ select id from api.list_stakeholder_queries('mine') $$), format($$ values (%L::uuid) $$, :'query'),
  'the owner finds it under their own queries');
select results_eq(format($$ select status from api.act_on_stakeholder_query(%L, 'start') $$, :'query'), $$ values ('ok'::text) $$,
  'the owner starts on it');
select results_eq(format($$ select status from api.act_on_stakeholder_query(%L, 'start') $$, :'query'), $$ values ('not_open'::text) $$,
  'it cannot be started twice');
select results_eq(format($$ select status from api.act_on_stakeholder_query(%L, 'note', '  ') $$, :'query'), $$ values ('note_required'::text) $$,
  'a note has words in it');
select results_eq(format($$ select status from api.act_on_stakeholder_query(%L, 'note', 'Asked the facilitator for the dates.') $$, :'query'),
  $$ values ('ok'::text) $$, 'the owner adds a note');
select results_eq(format($$ select status from api.act_on_stakeholder_query(%L, 'close') $$, :'query'), $$ values ('resolution_required'::text) $$,
  'closing needs the resolution');
select results_eq(format($$ select status from api.act_on_stakeholder_query(%L, 'close', 'Placement starts 2 November; HR told by email.') $$, :'query'),
  $$ values ('ok'::text) $$, 'the owner closes it with the resolution');
select results_eq(format($$ select status from api.route_stakeholder_query(%L, %L) $$, :'query', :'coordinator'),
  $$ values ('closed'::text) $$, 'a closed query is not routed');
select results_eq(format($$ select status from api.act_on_stakeholder_query(%L, 'reopen', 'HR asked about the end date too.') $$, :'query'),
  $$ values ('ok'::text) $$, 'it is reopened with the reason');
select results_eq(
  format($$ select state, resolution, (select array_agg(e ->> 'event' order by ord) from jsonb_array_elements(events) with ordinality x(e, ord))
            from api.get_stakeholder_query(%L) $$, :'query'),
  $$ values ('open'::text, null::text, array['logged', 'routed', 'started', 'noted', 'closed', 'reopened']) $$,
  'the history keeps every step, including the closure the reopening undid');
reset role;

select pg_temp.act_as(:'facilitator');
select is_empty(format($$ select * from api.get_stakeholder_query(%L) $$, :'query'), 'someone who does not coordinate sees nothing');
select results_eq(format($$ select status from api.act_on_stakeholder_query(%L, 'note', 'x') $$, :'query'), $$ values ('not_found'::text) $$,
  'and cannot act on it');
reset role;
select throws_ok(format($$ delete from programmes.stakeholder_query_events where query_id = %L $$, :'query'), '42501', null,
  'the history is append-only');

-- ---------------------------------------------------------------------------------------------------------------
-- Session logistics (FR-705 to FR-707)
-- ---------------------------------------------------------------------------------------------------------------

insert into learning.sessions (cohort_id, title, starts_at, duration_minutes, mode, venue, created_by)
values (:'cohort', 'Workshop: filing', now() + interval '1 day', 120, 'in_person', 'Room 4', :'facilitator')
returning id as workshop \gset
insert into learning.sessions (cohort_id, title, starts_at, duration_minutes, mode, teams_url, created_by)
values (:'cohort', 'Online check-in', now() + interval '2 days', 60, 'online',
        'https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0', :'facilitator')
returning id as online \gset

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select version, default_headcount, default_source from api.get_session_logistics(%L) $$, :'workshop'),
  $$ values (0, 1, 'enrolment'::text) $$, 'before any register, the default headcount is the learners enrolled (FR-706)');
select results_eq(format($$ select status from api.save_session_logistics(%L, 0, null, false, true, null, null, false, null, false) $$, :'workshop'),
  $$ values ('invalid_headcount'::text) $$, 'catering needs a headcount');
select results_eq(format($$ select status from api.save_session_logistics(%L, 0, null, true, false, null, null, false, null, false) $$, :'online'),
  $$ values ('not_in_person'::text) $$, 'an online session has no logistics');
select results_eq(format($$ select status, version from api.save_session_logistics(%L, 0, 'Booked with reception', true, true, 1, 'One vegetarian', false, 'Projector', false) $$, :'workshop'),
  $$ values ('ok'::text, 1) $$, 'the coordinator records the venue, catering and equipment (FR-705)');
select results_eq(format($$ select status from api.save_session_logistics(%L, 0, null, true, false, null, null, false, null, false) $$, :'workshop'),
  $$ values ('stale_version'::text) $$, 'a save over a newer version is refused');
select results_eq(format($$ select headcount_source, venue_arranged_by_name, catering_arranged_at is null from api.get_session_logistics(%L) $$, :'workshop'),
  $$ values ('enrolment'::text, 'Ayesha Patel'::text, true) $$, 'the headcount keeps its source, and each arranged item says who arranged it');
select results_eq(format($$ select done, detail from api.get_cohort_readiness(%L) where item_key = 'logistics' $$, :'cohort'),
  $$ values (false, '0/1'::text) $$, 'readiness waits until every upcoming in-person session is arranged');
select is((select status from api.save_session_logistics(:'workshop', 1, 'Booked with reception', true, true, 20, 'One vegetarian', true, 'Projector', true)),
  'ok', 'the coordinator confirms a headcount of 20 and marks everything arranged');
select results_eq(format($$ select done, detail from api.get_cohort_readiness(%L) where item_key = 'logistics' $$, :'cohort'),
  $$ values (true, '1/1'::text) $$, 'and readiness follows');
reset role;

-- The register is captured: 1 learner present against a headcount of 20.
update learning.sessions set register_version = 1, register_captured_at = now(), register_captured_by = :'facilitator'
where id = :'workshop';
insert into learning.attendance (session_id, learner_id, status, marked_by, marked_at)
values (:'workshop', :'learner', 'present', :'facilitator', now());

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select present, difference, variance_flagged, headcount_source from api.get_session_logistics(%L) $$, :'workshop'),
  $$ values (1, -19, true, 'manual'::text) $$, 'attendance far from the confirmed headcount is flagged (FR-707)');
select results_eq(format($$ select status from api.reconcile_logistics_variance(%L, 'Most learners joined online; caterer paid for 20.') $$, :'workshop'),
  $$ values ('ok'::text) $$, 'a coordinator reconciles it with a note');
select results_eq(format($$ select variance_flagged, reconciled_by_name from api.get_session_logistics(%L) $$, :'workshop'),
  $$ values (false, 'Ayesha Patel'::text) $$, 'and it is no longer flagged');
select is((select status from api.save_session_logistics(:'workshop', 3, 'Booked with reception', true, true, 25, 'One vegetarian', true, 'Projector', true)),
  'ok', 'the coordinator changes the confirmed headcount afterwards');
select results_eq(format($$ select variance_flagged, reconciled_at from api.get_session_logistics(%L) $$, :'workshop'),
  $$ values (true, null::timestamptz) $$, 'which undoes the reconciliation of the old number');
reset role;

insert into learning.sessions (cohort_id, title, starts_at, duration_minutes, mode, venue, created_by)
values (:'cohort', 'Workshop: retention', now() + interval '8 days', 120, 'in_person', 'Room 4', :'facilitator')
returning id as next_workshop \gset
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select default_headcount, default_source, default_basis from api.get_session_logistics(%L) $$, :'next_workshop'),
  $$ values (1, 'expected_attendance'::text, 1) $$, 'once registers are captured, the default follows attendance so far (FR-706)');
select results_eq($$ select title from api.list_session_logistics() order by variance_flagged desc, starts_at $$,
  $$ values ('Workshop: filing'::text), ('Workshop: retention') $$,
  'the logistics list has the in-person sessions, a flagged difference first, and no online session');
reset role;
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_session_logistics() $$, 'a learner sees no logistics');
reset role;

select * from finish();
rollback;
