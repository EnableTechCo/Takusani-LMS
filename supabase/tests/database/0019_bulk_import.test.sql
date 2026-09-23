-- Bulk learner import (S2-01, FR-103, FR-107): checking, chunked import, replay safety, and the test-plan load case
-- of 1,000 rows with 10% invalid followed by a replay. Uses the local seed: admin@, "2026 Intake B".
create extension if not exists pgtap with schema extensions;

begin;
select plan(32);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- What the application does between claim and complete: create an auth user for each claimed row's email.
create function pg_temp.create_auth_users(p_rows jsonb) returns jsonb language plpgsql as $$
declare
  v_row jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  for v_row in select * from jsonb_array_elements(p_rows) loop
    if not exists (select 1 from auth.users where lower(email) = lower(v_row ->> 'email')) then
      insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
              lower(v_row ->> 'email'), now(), now());
    end if;
    v_out := v_out || jsonb_build_object('row', (v_row ->> 'row_number')::integer, 'error', null);
  end loop;
  return v_out;
end $$;

-- A file of p_count rows; every tenth row has no email.
create function pg_temp.intake(p_count integer, p_prefix text) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
           'row', n + 1,
           'full_name', 'Learner ' || n,
           'email', case when n % 10 = 0 then '' else p_prefix || n || '@import.test' end,
           'learner_number', p_prefix || '-' || n) order by n)
  from generate_series(1, p_count) n
$$;

\set admin 00000000-0000-4000-8000-000000000006
\set learner 00000000-0000-4000-8000-000000000001
\set coordinator 00000000-0000-4000-8000-000000000005
\set cohort 10000000-0000-4000-8000-000000000010
\set digest_a aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
\set digest_b bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
\set digest_c cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc

-- Only an administrator imports
select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.create_import_batch(%L, 'intake.csv', %L, '[{"row":2}]') $$,
    :'cohort', :'digest_a'),
  $$ values ('forbidden'::text) $$, 'a coordinator cannot import');

-- Checking: every rule, nothing created
reset role;
select pg_temp.act_as(:'admin');
select batch_id as small from api.create_import_batch(:'cohort', 'small.csv', :'digest_a', $$[
  {"row": 2, "full_name": "Ayanda Zulu", "email": "Ayanda@Import.test", "learner_number": "KSI-9001"},
  {"row": 3, "full_name": "", "email": "nobody@import.test"},
  {"row": 4, "full_name": "No Email", "email": ""},
  {"row": 5, "full_name": "Bad Email", "email": "not-an-email"},
  {"row": 6, "full_name": "Twice", "email": "ayanda@import.test"},
  {"row": 7, "full_name": "Same Number", "email": "same@import.test", "learner_number": "KSI-9001"},
  {"row": 8, "full_name": "Taken Number", "email": "taken@import.test", "learner_number": "KSI-2026-0417"},
  {"row": 9, "full_name": "Lerato Again", "email": "learner@takusani.test"},
  {"row": 10, "full_name": "Bongani Dube", "email": "bongani@import.test"}
]$$::jsonb) \gset
select results_eq(format($$ select row_number, outcome, problem from api.get_import_rows(%L) $$, :'small'),
  $$ values (2, 'ready'::text, null::text),
            (3, 'problem', 'Name is missing.'),
            (4, 'problem', 'Email is missing.'),
            (5, 'problem', 'This is not an email address.'),
            (6, 'problem', 'This email appears twice in the file (also row 2).'),
            (7, 'problem', 'This learner number appears twice in the file (also row 2).'),
            (8, 'problem', 'Another account already has this learner number.'),
            (9, 'exists', null),
            (10, 'ready', null) $$,
  'each row is checked, with a reason a person can act on, and an existing account is skipped');
reset role;
select reference as small_ref from identity.import_batches where id = :'small' \gset
select is((select count(*)::int from auth.users where email like '%@import.test'), 0, 'checking creates no accounts');
select results_eq($$ select action from audit.events where object_type = 'import_batch' $$,
  $$ values ('identity.import_checked'::text) $$, 'the check is audited');

-- Replay safety: the same file for the same cohort creates nothing and names the first batch
select pg_temp.act_as(:'admin');
select results_eq(
  format($$ select status, batch_id::text, detail ->> 'reference', detail ->> 'uploaded_by'
            from api.create_import_batch(%L, 'renamed.csv', %L, '[{"row":2,"full_name":"X","email":"x@import.test"}]') $$,
    :'cohort', :'digest_a'),
  format($$ values ('duplicate_file'::text, %L::text, %L::text, 'Sipho Mahlangu'::text) $$, :'small', :'small_ref'),
  'the same file again is refused, naming the earlier batch and who ran it, whatever it is called');
reset role;
select is((select count(*)::int from identity.import_batches), 1, 'and no second batch exists');

-- Import: claim, create auth users, complete
select pg_temp.act_as(:'admin');
select jsonb_agg(to_jsonb(c)) as claimed from api.claim_import_chunk(:'small', 100) c \gset
select is(jsonb_array_length(:'claimed'::jsonb), 2, 'the two ready rows are claimed');
select is_empty(format($$ select * from api.claim_import_chunk(%L, 100) $$, :'small'),
  'a second tab gets nothing while they are being imported');
reset role;
select pg_temp.create_auth_users(:'claimed'::jsonb) as results \gset
select pg_temp.act_as(:'admin');
select results_eq(format($$ select status, imported, failed, remaining from api.complete_import_chunk(%L, %L) $$,
    :'small', :'results'),
  $$ values ('ok'::text, 2, 0, 0) $$, 'completing the chunk imports both, and nothing remains');
reset role;
select results_eq(
  $$ select p.full_name, p.learner_number, ra.role, e.cohort_id::text
     from auth.users u join identity.profiles p on p.id = u.id
     join identity.role_assignments ra on ra.profile_id = p.id
     join programmes.enrolments e on e.profile_id = p.id
     where u.email in ('ayanda@import.test', 'bongani@import.test') order by p.full_name $$,
  format($$ values ('Ayanda Zulu'::text, 'KSI-9001'::text, 'learner'::text, %L::text),
                   ('Bongani Dube', null, 'learner', %L) $$, :'cohort', :'cohort'),
  'each is a learner with a profile, the learner number from the file, and an enrolment in the cohort');
select results_eq(
  format($$ select state from identity.import_batches where id = %L $$, :'small'),
  $$ values ('completed'::text) $$, 'the batch is completed');
select is(
  (select count(*)::int from audit.events where details ->> 'batch' = (select reference from identity.import_batches where id = :'small')),
  6, 'every account, role and enrolment is audited with the batch reference (FR-107)');
select results_eq(
  format($$ select distinct invitation_state from identity.import_rows where batch_id = %L and outcome = 'imported' $$, :'small'),
  $$ values ('not_sent'::text) $$, 'no invitation is sent while email is off, and each row says so');

-- A retried chunk finds the users it made; a retryable error goes back to ready; a lost chunk is claimed again
select pg_temp.act_as(:'admin');
select batch_id as retry from api.create_import_batch(:'cohort', 'retry.csv', :'digest_b', $$[
  {"row": 2, "full_name": "Chipo Moyo", "email": "chipo@import.test"},
  {"row": 3, "full_name": "Dineo Sithole", "email": "dineo@import.test"},
  {"row": 4, "full_name": "Emeka Obi", "email": "emeka@import.test"}
]$$::jsonb) \gset
select jsonb_agg(to_jsonb(c)) as claimed from api.claim_import_chunk(:'retry', 100) c \gset
reset role;
select pg_temp.create_auth_users(:'claimed'::jsonb) as results \gset
-- The first completion is lost (a network fault after the auth users were made); five minutes pass.
update identity.import_rows set claimed_at = now() - interval '6 minutes' where batch_id = :'retry';
select pg_temp.act_as(:'admin');
select is((select count(*)::int from api.claim_import_chunk(:'retry', 100)), 3, 'the abandoned rows are claimed again');
select results_eq(
  format($$ select imported, failed, remaining from api.complete_import_chunk(%L,
    '[{"row":2,"error":null},{"row":3,"error":"Auth rate limit","retry":true},{"row":4,"error":"Email address is invalid","retry":false}]') $$,
    :'retry'),
  $$ values (1, 1, 1) $$, 'the retry finds the user made last time; a rate limit goes back to ready; a refusal fails');
select results_eq(format($$ select row_number, outcome, problem from api.get_import_rows(%L) $$, :'retry'),
  $$ values (2, 'imported'::text, null::text), (3, 'ready', null), (4, 'failed', 'Email address is invalid') $$,
  'and each row says so');
reset role;
select is((select count(*)::int from identity.profiles p join auth.users u on u.id = p.id where u.email = 'chipo@import.test'), 1,
  'the retried row made exactly one account');
select pg_temp.act_as(:'admin');
select results_eq(format($$ select status from api.cancel_import_batch(%L) $$, :'retry'),
  $$ values ('already_started'::text) $$, 'a batch cannot be cancelled once importing has started');

-- Cancelling before import frees the file to be loaded again
select batch_id as cancelled from api.create_import_batch(:'cohort', 'fixme.csv', :'digest_c',
  '[{"row":2,"full_name":"Fikile Nkosi","email":"fikile@import.test"}]') \gset
select results_eq(format($$ select status from api.cancel_import_batch(%L) $$, :'cancelled'),
  $$ values ('ok'::text) $$, '"Cancel and fix the file first" before anything is imported');
select results_eq(format($$ select status from api.create_import_batch(%L, 'fixme.csv', %L,
    '[{"row":2,"full_name":"Fikile Nkosi","email":"fikile@import.test"}]') $$, :'cohort', :'digest_c'),
  $$ values ('ok'::text) $$, 'after a cancel, the same file can be loaded again');

-- The load case: 1,000 rows, 10% invalid, in chunks of 100, then a replay (test plan; capacity scenario 5)
reset role;
select pg_temp.intake(1000, 'load') as load_rows \gset
select pg_temp.act_as(:'admin');
select batch_id as big from api.create_import_batch(:'cohort', 'intake-b-2026.csv', repeat('d', 64), :'load_rows') \gset
select results_eq(format($$ select count(*) filter (where outcome = 'ready')::int, count(*) filter (where outcome = 'problem')::int
                            from api.get_import_rows(%L) $$, :'big'),
  $$ values (900, 100) $$, '1,000 rows are checked: 900 ready, 100 with a problem');
reset role;
select set_config('pgtap.big', :'big', true);
create temporary table chunks (n integer, claimed integer, imported integer);
do $$
declare
  v_batch uuid := current_setting('pgtap.big')::uuid;
  v_rows jsonb;
  v_results jsonb;
  v_imported integer;
  i integer := 0;
begin
  loop
    i := i + 1;
    perform set_config('role', 'authenticated', true);
    select jsonb_agg(to_jsonb(c)) into v_rows from api.claim_import_chunk(v_batch, 100) c;
    exit when v_rows is null;
    perform set_config('role', 'postgres', true);
    v_results := pg_temp.create_auth_users(v_rows);
    perform set_config('role', 'authenticated', true);
    select c.imported into v_imported from api.complete_import_chunk(v_batch, v_results) c;
    perform set_config('role', 'postgres', true);
    insert into pg_temp.chunks values (i, jsonb_array_length(v_rows), v_imported);
    exit when i > 20;
  end loop;
end $$;
reset role;
select results_eq($$ select count(*)::int, max(claimed), sum(imported)::int from chunks $$,
  $$ values (9, 100, 900) $$, 'the 900 ready rows are imported in nine chunks of 100');
select results_eq(
  format($$ select count(*)::int from programmes.enrolments e join identity.import_rows r on r.enrolment_id = e.id
            where r.batch_id = %L $$, :'big'),
  $$ values (900) $$, 'and 900 learners are enrolled');
select pg_temp.act_as(:'admin');
select results_eq(format($$ select status, batch_id::text from api.create_import_batch(%L, 'intake-b-2026.csv', %L, %L) $$,
    :'cohort', repeat('d', 64), :'load_rows'),
  format($$ values ('duplicate_file'::text, %L::text) $$, :'big'), 'replaying the file is refused');
select batch_id as again from api.create_import_batch(:'cohort', 'intake-b-2026-again.csv', repeat('e', 64), :'load_rows') \gset
select results_eq(
  format($$ select count(*) filter (where outcome = 'exists')::int, count(*) filter (where outcome = 'ready')::int
            from api.get_import_rows(%L) $$, :'again'),
  $$ values (900, 0) $$, 'and the same rows in a different file are all "already exists": nothing can be duplicated');
reset role;
select is((select count(*)::int from identity.profiles p join auth.users u on u.id = p.id where u.email like 'load%@import.test'), 900,
  'after both, there are exactly 900 imported accounts');

-- The cohorts an administrator can load into
select pg_temp.act_as(:'admin');
select results_eq($$ select name from api.list_import_cohorts() $$, $$ values ('2026 Intake B'::text) $$,
  'an administrator sees the active cohorts to import into');

-- Nobody else reads or drives an import
reset role;
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_import_cohorts() $$, 'a learner sees no cohorts to import into');
select is_empty($$ select * from api.list_import_batches() $$, 'a learner sees no imports');
select is_empty(format($$ select * from api.get_import_rows(%L) $$, :'big'), 'nor their rows');
select is_empty(format($$ select * from api.claim_import_chunk(%L, 100) $$, :'retry'), 'nor can claim rows');
select results_eq(format($$ select status from api.complete_import_chunk(%L, '[]') $$, :'retry'),
  $$ values ('forbidden'::text) $$, 'nor complete a chunk');

select * from finish();
rollback;
