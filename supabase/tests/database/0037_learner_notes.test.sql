-- Private learner notes (S3-14; FR-306, FR-307; risk R-09). The first half is the schema contract: nothing but the
-- owner's own note functions can reach learner_notes, so no assessment, moderation, reporting or external view can
-- ever include a note. The second half is the behaviour. Uses the local seed: learner@ in "2026 Intake B",
-- facilitator@, administrator admin@.
create extension if not exists pgtap with schema extensions;

begin;
select plan(36);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set other 00000000-0000-4000-8000-0000000000e2
\set cohort 10000000-0000-4000-8000-000000000010

-- ---------------------------------------------------------------------------------------------------------------
-- The schema contract (FR-307, R-09)
-- ---------------------------------------------------------------------------------------------------------------

select ok(not has_table_privilege(r, 'learning.learner_notes', p), format('%s has no %s on learner_notes', r, p))
from unnest(array['anon', 'authenticated', 'service_role']) r, unnest(array['SELECT']) p;
select is_empty($$
  select r, p from unnest(array['anon', 'authenticated', 'service_role']) r,
    unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
  where has_table_privilege(r, 'learning.learner_notes', p)
$$, 'and no role may change it directly');
select is_empty($$
  select distinct (v.view_schema || '.' || v.view_name)::text collate "C" from information_schema.view_table_usage v
  where v.table_schema = 'learning' and v.table_name = 'learner_notes'
  union all
  select c.relname::text collate "C" from pg_depend d join pg_rewrite rw on rw.oid = d.objid join pg_class c on c.oid = rw.ev_class
  where d.refobjid = 'learning.learner_notes'::regclass and c.relkind in ('v', 'm')
$$, 'no view or materialised view is built on notes');
select set_eq($$
  select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prosrc ilike '%learner_notes%' and n.nspname not in ('pg_catalog', 'information_schema', 'extensions')
$$, $$ values ('api.create_note'), ('api.update_note'), ('api.delete_note'), ('api.list_my_notes'),
             ('api.list_my_note_folders'), ('api.get_my_note') $$,
  'the only functions that read or write notes are the owner''s own note functions');
select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api' and p.prosrc ilike '%learner_notes%' and p.prosrc not ilike '%auth.uid()%'
$$, 'and each of them is scoped to the caller');
select ok((select relrowsecurity from pg_class where oid = 'learning.learner_notes'::regclass),
  'row security is on as well');
select ok((select count(*) = 1 and bool_and(policyname = 'only the owner' and qual = '(owner_id = auth.uid())')
           from pg_policies where schemaname = 'learning' and tablename = 'learner_notes'),
  'with one policy: only the owner');
select ok(not has_function_privilege('service_role', 'api.list_my_notes(text, text)', 'execute')
      and not has_function_privilege('anon', 'api.list_my_notes(text, text)', 'execute'),
  'server-side and anonymous callers, such as a future external API, cannot list notes');

-- ---------------------------------------------------------------------------------------------------------------
-- Behaviour
-- ---------------------------------------------------------------------------------------------------------------

-- Another learner, in no cohort; a released material and a session in the learner's cohort; a material not released.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :'other', 'authenticated', 'authenticated', 'other.learner@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values (:'other', 'Other Learner');
insert into identity.role_assignments (profile_id, role, scope_type) values (:'other', 'learner', 'global');
insert into learning.materials (id, cohort_id, title, kind, link_url, state, release_at, created_by) values
  ('70000000-0000-4000-8000-000000000001', :'cohort', 'Filing checklist', 'link', 'https://example.org/filing', 'published', now() - interval '1 day', :'facilitator'),
  ('70000000-0000-4000-8000-000000000002', :'cohort', 'Next week''s reading', 'link', 'https://example.org/next', 'published', now() + interval '7 days', :'facilitator');
insert into learning.sessions (id, cohort_id, title, starts_at, duration_minutes, mode, venue, created_by)
values ('70000000-0000-4000-8000-000000000003', :'cohort', 'Session 12: Filing', now() - interval '2 days', 60, 'in_person', 'Room 4', :'facilitator');

select pg_temp.act_as(:'facilitator');
select results_eq($$ select status from api.create_note('Mine') $$, $$ values ('forbidden'::text) $$, 'notes are for learners');
reset role;

select pg_temp.act_as(:'learner');
select results_eq($$ select status from api.create_note('  ') $$, $$ values ('invalid_title'::text) $$, 'a note needs a title');
select results_eq($$ select status from api.create_note('Long', repeat('x', 20001)) $$, $$ values ('body_too_long'::text) $$,
  'and at most 20,000 characters');
select results_eq($$ select status from api.create_note('On the reading', '', null, '70000000-0000-4000-8000-000000000002') $$,
  $$ values ('link_not_found'::text) $$, 'a note links only to material released to the learner');
select results_eq($$ select status from api.create_note('Both', '', null, '70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000003') $$,
  $$ values ('one_link_only'::text) $$, 'and to one thing at most');

select note_id as filing from api.create_note('Filing: what to keep', 'Keep invoices for five years. Ask about the archive room.',
  'Unit 3', '70000000-0000-4000-8000-000000000001') \gset
select note_id as session_note from api.create_note('Questions for Session 12', 'Who signs the register?', 'Unit 3', null,
  '70000000-0000-4000-8000-000000000003') \gset
select note_id as loose from api.create_note('Exam tips', 'Read every question twice.') \gset

select results_eq($$ select title, folder, link_kind, link_title from api.list_my_notes() order by title $$,
  $$ values ('Exam tips'::text, null::text, null::text, null::text),
            ('Filing: what to keep', 'Unit 3', 'material', 'Filing checklist'),
            ('Questions for Session 12', 'Unit 3', 'session', 'Session 12: Filing') $$,
  'the learner lists their notes, with folders and what each is about');
select results_eq($$ select title from api.list_my_notes('archive room') $$, $$ values ('Filing: what to keep'::text) $$,
  'searches the text');
select results_eq($$ select title from api.list_my_notes('100%') $$, $$ select null::text where false $$,
  'treats a search as words, not a pattern');
select results_eq($$ select title from api.list_my_notes(null, 'Unit 3') order by title $$,
  $$ values ('Filing: what to keep'::text), ('Questions for Session 12') $$, 'filters by folder');
select results_eq($$ select folder, notes from api.list_my_note_folders() $$, $$ values ('Unit 3'::text, 2) $$,
  'and lists folders with their counts');
select results_eq($$ select id::text, target.title from api.list_note_link_targets() target order by kind, title $$,
  $$ values ('70000000-0000-4000-8000-000000000001'::text, 'Filing checklist'::text),
            ('70000000-0000-4000-8000-000000000003', 'Session 12: Filing') $$,
  'offers released material and the learner''s sessions to link to, nothing unreleased');

-- Editing
select results_eq(format($$ select status, version from api.update_note(%L, 1, 'Filing: what to keep', 'Keep invoices for five years.', 'Unit 3', '70000000-0000-4000-8000-000000000001', null) $$, :'filing'),
  $$ values ('ok'::text, 2) $$, 'the learner edits a note');
select results_eq(format($$ select status from api.update_note(%L, 1, 'Old tab', '', null, null, null) $$, :'filing'),
  $$ values ('stale'::text) $$, 'an edit from an older copy is refused, not saved over the newer one');
select results_eq(format($$ select body, version from api.get_my_note(%L) $$, :'filing'),
  $$ values ('Keep invoices for five years.'::text, 2) $$, 'the newer text stands');
reset role;
update learning.materials set state = 'archived' where id = '70000000-0000-4000-8000-000000000001';
select pg_temp.act_as(:'learner');
select results_eq(format($$ select link_title, link_available from api.get_my_note(%L) $$, :'filing'),
  $$ values ('Filing checklist'::text, false) $$, 'a note keeps its link when the material is withdrawn, marked unavailable');
select results_eq(format($$ select status from api.update_note(%L, 2, 'Filing', 'Edited.', 'Unit 3', '70000000-0000-4000-8000-000000000001', null) $$, :'filing'),
  $$ values ('ok'::text) $$, 'and can still be edited without losing it');
reset role;

-- Nobody else sees or changes it: another learner, a facilitator, an administrator.
select pg_temp.act_as(:'other');
select is_empty($$ select * from api.list_my_notes() $$, 'another learner sees none of them');
select is_empty(format($$ select * from api.get_my_note(%L) $$, :'loose'), 'even by the note''s identifier');
select results_eq(format($$ select status from api.update_note(%L, 1, 'Hijacked', '', null, null, null) $$, :'loose'),
  $$ values ('not_found'::text) $$, 'or change it');
select results_eq(format($$ select status from api.delete_note(%L) $$, :'loose'), $$ values ('not_found'::text) $$, 'or delete it');
select results_eq($$ select status from api.create_note('Link to their session', '', null, null, '70000000-0000-4000-8000-000000000003') $$,
  $$ values ('link_not_found'::text) $$, 'and cannot link a note to a session of a cohort they are not in');
reset role;
select pg_temp.act_as(:'facilitator');
select is_empty(format($$ select * from api.get_my_note(%L) $$, :'loose'), 'a facilitator cannot read a learner''s note');
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-000000000006');
select is_empty(format($$ select * from api.get_my_note(%L) $$, :'loose'), 'nor can an administrator');
reset role;

-- Deleting
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.delete_note(%L) $$, :'loose'), $$ values ('ok'::text) $$, 'the learner deletes a note');
reset role;
select is((select count(*)::int from learning.learner_notes where id = :'loose'), 0, 'and it is gone');
select is((select count(*)::int from audit.events where object_type ilike '%note%' or details::text ilike '%invoices%'), 0,
  'no note or its text is ever written to the audit log');

select * from finish();
rollback;
