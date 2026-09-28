-- Learning materials and access logging (S2-14; FR-204, FR-301). Uses the local seed: facilitator@ sets work in
-- "2026 Intake B", learner@ is enrolled in it, and the programme has module M3.
create extension if not exists pgtap with schema extensions;

begin;
select plan(36);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set outsider 00000000-0000-4000-8000-0000000000d1
\set cohort 10000000-0000-4000-8000-000000000010

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :'outsider', 'authenticated', 'authenticated',
        'pgtap.outsider@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values (:'outsider', 'pgTAP Outsider');
insert into identity.role_assignments (profile_id, role) values (:'outsider', 'learner');
select id as module from programmes.modules where code = 'M3' \gset

-- Creating: only whoever sets work in the cohort; the module must be the programme's
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.create_material(%L, 'Filing guide') $$, :'cohort'),
  $$ values ('forbidden'::text) $$, 'a learner cannot add material');
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.create_material(%L, 'Filing guide', '', gen_random_uuid()) $$, :'cohort'),
  $$ values ('module_not_in_programme'::text) $$, 'a module from outside the programme is refused');
select material_id as guide from api.create_material(:'cohort', 'Filing guide', 'How we file records.', :'module') \gset
select results_eq(format($$ select state, kind, module_id from api.get_material(%L) $$, :'guide'),
  format($$ values ('draft'::text, null::text, %L::uuid) $$, :'module'), 'a new material is a draft with no content yet');
select results_eq(format($$ select status from api.publish_material(%L) $$, :'guide'),
  $$ values ('no_content'::text) $$, 'it cannot be published without a file or a link');

-- A link, then a schedule
select results_eq(format($$ select status from api.update_material(%L, 'Filing guide', 'How we file records.', %L, 'http://example.org/guide') $$,
    :'guide', :'module'),
  $$ values ('invalid_link'::text) $$, 'a link must be https');
select results_eq(format($$ select status from api.update_material(%L, 'Filing guide', 'How we file records.', %L, 'https://example.org/guide') $$,
    :'guide', :'module'),
  $$ values ('ok'::text) $$, 'an https link is the content');
select results_eq(format($$ select status from api.publish_material(%L, now() - interval '2 days') $$, :'guide'),
  $$ values ('release_in_past'::text) $$, 'a release time in the past is refused');
select results_eq(format($$ select status, release_at > now() from api.publish_material(%L, now() + interval '1 day') $$, :'guide'),
  $$ values ('ok'::text, true) $$, 'publishing with a later time schedules it');
select results_eq($$ select state, release_at > now() from api.list_materials() $$,
  $$ values ('published'::text, true) $$, 'the facilitator sees it published with a future release time (Scheduled)');

reset role;
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_my_materials() $$, 'a learner does not see scheduled material before its time');
select is_empty(format($$ select * from api.get_my_material(%L) $$, :'guide'), 'nor can open it');
select results_eq(format($$ select status from api.log_material_access(%L) $$, :'guide'),
  $$ values ('not_found'::text) $$, 'nor is an open recorded');

-- The release time passes
reset role;
update learning.materials set release_at = now() - interval '1 minute' where id = :'guide';
select pg_temp.act_as(:'learner');
select results_eq($$ select title, module_code, kind, link_host from api.list_my_materials() $$,
  $$ values ('Filing guide'::text, 'M3'::text, 'link'::text, 'example.org'::text) $$,
  'once its time has passed, the learner sees it under its module, with the site it links to');
select results_eq(format($$ select link_url from api.get_my_material(%L) $$, :'guide'),
  $$ values ('https://example.org/guide'::text) $$, 'and can open the link');
select results_eq($$ select count(*)::int from api.list_my_materials('records file') $$, $$ values (0) $$,
  'search matches the words in the order written');
select results_eq($$ select count(*)::int from api.list_my_materials('FILE records') $$, $$ values (1) $$,
  'search matches the title or description, ignoring case');
select results_eq($$ select count(*)::int from api.list_my_materials('100%') $$, $$ values (0) $$,
  'a % in the search is a character, not a wildcard');
reset role;
select pg_temp.act_as(:'outsider');
select is_empty($$ select * from api.list_my_materials() $$, 'a learner not in the cohort sees none of it');

-- Access log: one event per learner, material and 30 minutes (FR-301)
reset role;
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.log_material_access(%L) $$, :'guide'), $$ values ('ok'::text) $$,
  'opening it is recorded');
select results_eq(format($$ select status from api.log_material_access(%L) $$, :'guide'), $$ values ('coalesced'::text) $$,
  'opening it again at once is folded into the same event');
reset role;
select throws_ok(format($$ update learning.material_access_events set opened_at = now() where material_id = %L $$, :'guide'),
  '42501', null, 'the access log is append-only');
select results_eq(format($$ select count(*)::int from learning.material_access_events where material_id = %L and learner_id = %L $$,
    :'guide', :'learner'),
  $$ values (1) $$, 'there is one event for the two opens');
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select opened_by from api.get_material(%L) $$, :'guide'), $$ values (1) $$,
  'the facilitator sees how many learners opened it');

-- A file: upload for the material, finalise, attach, and read it through the storage policy
select material_id as slides from api.create_material(:'cohort', 'Records slides') \gset
reset role;
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.authorise_upload('material', %L, 'slides.pdf', 'application/pdf', 2048) $$, :'slides'),
  $$ values ('forbidden'::text) $$, 'a learner cannot upload material');
reset role;
select pg_temp.act_as(:'facilitator');
select intent_id as intent, object_key as slides_key from api.authorise_upload('material', :'slides', 'slides.pdf', 'application/pdf', 2048) \gset
reset role;
select results_eq(format($$ select bucket from submissions.file_upload_intents where id = %L $$, :'intent'),
  $$ values ('materials'::text) $$, 'a material upload goes to the materials bucket');
insert into storage.objects (bucket_id, name, owner, metadata)
values ('materials', :'slides_key', :'facilitator', '{"size": 2048, "mimetype": "application/pdf"}');
select pg_temp.act_as(:'facilitator');
select file_id as slides_file from api.finalise_upload(:'intent') \gset
select results_eq(format($$ select status from api.attach_material_file(%L, %L) $$, :'guide', :'slides_file'),
  $$ values ('file_not_available'::text) $$, 'a file uploaded for one material cannot be attached to another');
select results_eq(format($$ select status from api.attach_material_file(%L, %L) $$, :'slides', :'slides_file'),
  $$ values ('ok'::text) $$, 'it is attached to the material it was uploaded for');
select results_eq(format($$ select kind, file_name, file_bytes from api.get_material(%L) $$, :'slides'),
  $$ values ('file'::text, 'slides.pdf'::text, 2048::bigint) $$, 'the material is now that file');
select results_eq($$ select count(*)::int from storage.objects where bucket_id = 'materials' $$, $$ values (1) $$,
  'the facilitator can read the file (to check it)');
select is(status, 'ok', 'publishing it now releases it at once') from api.publish_material(:'slides');
reset role;
select pg_temp.act_as(:'learner');
select results_eq(format($$ select kind, file_bucket, file_key from api.get_my_material(%L) $$, :'slides'),
  format($$ values ('file'::text, 'materials'::text, %L::text) $$, :'slides_key'), 'the learner gets the file to download');
select results_eq($$ select count(*)::int from storage.objects where bucket_id = 'materials' $$, $$ values (1) $$,
  'and the storage policy lets them read it, so a download link can be signed as them');
reset role;
select pg_temp.act_as(:'outsider');
select results_eq($$ select count(*)::int from storage.objects where bucket_id = 'materials' $$, $$ values (0) $$,
  'a learner it is not released to cannot read the file');

-- Archive
reset role;
select pg_temp.act_as(:'facilitator');
select is(status, 'ok', 'the facilitator archives the guide') from api.archive_material(:'guide');
select results_eq(format($$ select status from api.update_material(%L, 'Changed', '') $$, :'guide'),
  $$ values ('archived'::text) $$, 'an archived material is not changed');
reset role;
select pg_temp.act_as(:'learner');
select results_eq($$ select title from api.list_my_materials() $$, $$ values ('Records slides'::text) $$,
  'learners no longer see an archived material');

select * from finish();
rollback;
