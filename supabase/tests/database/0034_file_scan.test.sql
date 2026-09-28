-- File scan step and orphan clean-up (S3-11, register G3). Uses the local seed: learner@ and the published task
-- "Task 3: Workplace records portfolio".
create extension if not exists pgtap with schema extensions;

begin;
select plan(32);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set task 10000000-0000-4000-8000-000000000020

-- An upload in a given state: an intent, optionally its object in Storage, optionally its stored file.
create function pg_temp.upload(
  p_name text, p_finalised boolean, p_object boolean, p_expired_at timestamptz default null,
  p_discarded_at timestamptz default null, p_declared_sha text default null
) returns uuid language plpgsql as $$
declare
  v_learner uuid := '00000000-0000-4000-8000-000000000001';
  v_task uuid := '10000000-0000-4000-8000-000000000020';
  v_intent uuid;
  v_key text := v_task::text || '/' || v_learner::text || '/' || gen_random_uuid()::text || '.pdf';
begin
  insert into submissions.file_upload_intents (
    profile_id, context_type, context_id, object_key, original_filename, declared_media_type, declared_bytes,
    declared_sha256, max_bytes, allowed_media_types, expires_at, finalised_at, expired_at, discarded_at
  )
  values (v_learner, 'task_submission', v_task, v_key, p_name, 'application/pdf', 2048, p_declared_sha, 26214400,
    array['application/pdf', 'image/png'], coalesce(p_expired_at, now() + interval '2 hours'),
    case when p_finalised then now() - interval '2 days' end, p_expired_at, p_discarded_at)
  returning id into v_intent;
  if p_object then
    insert into storage.objects (bucket_id, name, metadata)
    values ('submissions', v_key, '{"size": 2048, "mimetype": "application/pdf"}'::jsonb);
  end if;
  if p_finalised then
    insert into submissions.stored_files (
      intent_id, bucket, object_key, original_filename, bytes, media_type, declared_sha256, uploaded_by, accepted_at
    )
    values (v_intent, 'submissions', v_key, p_name, 2048, 'application/pdf', p_declared_sha, v_learner,
            now() - interval '2 days' + (random() * interval '1 minute'));
  end if;
  return v_intent;
end $$;

create function pg_temp.file_of(p_intent uuid) returns uuid language sql as $$
  select id from submissions.stored_files where intent_id = p_intent $$;

-- Nothing else waits for a scan in this test.
update submissions.stored_files set scan_state = 'clean', sha256 = repeat('0', 64), detected_media_type = media_type,
  scanner = 'seed', scanned_at = now() where scan_state = 'pending';

-- ---------------------------------------------------------------------------------------------------------------
-- Who may scan
-- ---------------------------------------------------------------------------------------------------------------

select ok(
  (select bool_and(has_function_privilege('service_role', f, 'execute') and not has_function_privilege('authenticated', f, 'execute')
                   and not has_function_privilege('anon', f, 'execute'))
   from unnest(array['api.claim_file_scans(integer, integer, integer)',
                     'api.record_file_scan(uuid, text, text, text, text, text, integer)',
                     'api.list_orphan_uploads(integer)', 'api.record_orphans_removed(uuid[])']) f),
  'only the server with the secret key scans files or cleans up after uploads');

-- ---------------------------------------------------------------------------------------------------------------
-- The scan state machine
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.upload('essay.pdf', true, true) as a \gset
select pg_temp.upload('photo.png', true, true, null, null, repeat('c', 64)) as b \gset
select pg_temp.file_of(:'a') as file_a \gset
select pg_temp.file_of(:'b') as file_b \gset

select throws_ok(format($$ update submissions.stored_files set scan_state = 'infected' where id = %L $$, :'file_a'),
  '23514', null, 'the states are pending, clean, rejected and failed');
select throws_ok(format($$ update submissions.stored_files set scan_state = 'clean' where id = %L $$, :'file_a'),
  '23514', null, 'a clean file must carry its checksum, detected type and scanner');

select results_eq($$ select file_id, allowed_media_types, attempt from api.claim_file_scans(10) order by file_id $$,
  format($$ values (%L::uuid, array['application/pdf', 'image/png'], 1), (%L::uuid, array['application/pdf', 'image/png'], 1) $$,
         least(:'file_a', :'file_b'), greatest(:'file_a', :'file_b')),
  'the scan claims pending files, with the types their upload allowed');
select is_empty($$ select * from api.claim_file_scans(10) $$, 'a claimed file is leased, so no other run scans it');

select results_eq(format($$ select status, scan_state from api.record_file_scan(%L, 'clean', %L, 'application/pdf', null, 'integrity-v1') $$,
                         :'file_a', repeat('a', 64)),
  $$ values ('ok'::text, 'clean'::text) $$, 'a clean result is recorded');
select results_eq(format($$ select sha256, detected_media_type, scanner, scanned_at is not null, scan_lease_until,
                                   declared_sha256 from submissions.stored_files where id = %L $$, :'file_a'),
  $$ values (repeat('a', 64), 'application/pdf'::text, 'integrity-v1'::text, true, null::timestamptz, null::text) $$,
  'with the authoritative checksum, the detected type and the scanner');
select results_eq(format($$ select status, scan_state from api.record_file_scan(%L, 'rejected', %L, 'application/zip', 'type_mismatch', 'integrity-v1') $$,
                         :'file_a', repeat('b', 64)),
  $$ values ('already_scanned'::text, 'clean'::text) $$, 'a later or repeated result changes nothing');
select is((select after ->> 'sha256' from audit.events where action = 'submissions.file_scanned' and object_id = :'file_a'),
  repeat('a', 64), 'the outcome is audited');

select results_eq(format($$ select status from api.record_file_scan(%L, 'clean', 'not-a-hash', 'image/png', null, 'integrity-v1') $$, :'file_b'),
  $$ values ('invalid'::text) $$, 'a malformed checksum is refused');
select results_eq(format($$ select status from api.record_file_scan(%L, 'rejected', %L, 'image/png', null, 'integrity-v1') $$, :'file_b', repeat('d', 64)),
  $$ values ('invalid'::text) $$, 'a rejection needs its reason');
select results_eq(format($$ select status from api.record_file_scan(%L, 'rejected', %L, 'image/png', 'looks_odd', 'integrity-v1') $$, :'file_b', repeat('d', 64)),
  $$ values ('invalid'::text) $$, 'and only a known one');
select results_eq(format($$ select status, scan_state from api.record_file_scan(%L, 'rejected', %L, 'image/png', 'checksum_mismatch', 'integrity-v1') $$,
                         :'file_b', repeat('d', 64)),
  $$ values ('ok'::text, 'rejected'::text) $$, 'a file that is not what was declared is rejected');
select results_eq(format($$ select scan_reason, declared_sha256, sha256 from submissions.stored_files where id = %L $$, :'file_b'),
  format($$ values ('checksum_mismatch'::text, %L::text, %L::text) $$, repeat('c', 64), repeat('d', 64)),
  'the declared checksum is kept beside the real one');

-- Reading fails: retried with a wait, then failed once the attempts are used up.
select pg_temp.upload('unreadable.pdf', true, true) as c \gset
select pg_temp.file_of(:'c') as file_c \gset
select is((select count(*)::int from api.claim_file_scans(10) where file_id = :'file_c'), 1, 'a new file is claimed');
select results_eq(format($$ select status, scan_state from api.record_file_scan(%L, 'retry') $$, :'file_c'),
  $$ values ('ok'::text, 'pending'::text) $$, 'an unreadable object is tried again later');
select ok((select scan_lease_until > now() from submissions.stored_files where id = :'file_c'), 'after a wait');
update submissions.stored_files set scan_attempts = 3 where id = :'file_c';
select results_eq(format($$ select status, scan_state from api.record_file_scan(%L, 'retry') $$, :'file_c'),
  $$ values ('ok'::text, 'failed'::text) $$, 'and fails once its attempts are used up');
select is((select scan_reason from submissions.stored_files where id = :'file_c'), 'unreadable', 'as unreadable');

-- A worker that never came back: the lease on its last attempt runs out, and the next claim marks it failed.
select pg_temp.upload('abandoned.pdf', true, true) as d \gset
select pg_temp.file_of(:'d') as file_d \gset
update submissions.stored_files set scan_attempts = 3, scan_lease_until = now() - interval '1 second' where id = :'file_d';
select is_empty(format($$ select * from api.claim_file_scans(10) where file_id = %L $$, :'file_d'),
  'a file out of attempts is not claimed again');
select is((select scan_state from submissions.stored_files where id = :'file_d'), 'failed', 'it is marked failed instead');

-- ---------------------------------------------------------------------------------------------------------------
-- A rejected file cannot be handed in; one waiting for the scan can
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.upload('waiting.pdf', true, true) as e \gset
select pg_temp.file_of(:'e') as file_e \gset
select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.submit_task(%L, jsonb_build_array(jsonb_build_object('file_id', %L)), gen_random_uuid()) $$,
                         :'task', :'file_b'),
  $$ values ('file_rejected'::text) $$, 'a rejected file is refused with its own reason');
select results_eq($$ select file_id::text, scan_state from api.list_my_uploads('10000000-0000-4000-8000-000000000020') order by original_filename $$,
  format($$ values (%L::text, 'failed'::text), (%L, 'clean'), (%L, 'rejected'), (%L, 'failed'), (%L, 'pending') $$,
         :'file_d', :'file_a', :'file_b', :'file_c', :'file_e'),
  'the learner''s upload list says which files the scan rejected');
select results_eq(format($$ select status from api.submit_task(%L, jsonb_build_array(jsonb_build_object('file_id', %L)), gen_random_uuid()) $$,
                         :'task', :'file_e'),
  $$ values ('ok'::text) $$, 'a file still waiting for its scan is not held up');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Orphaned objects
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.upload('expired-old.pdf', false, true, now() - interval '25 hours') as o1 \gset
select pg_temp.upload('expired-recent.pdf', false, true, now() - interval '23 hours') as o2 \gset
select pg_temp.upload('expired-empty.pdf', false, false, now() - interval '25 hours') as o3 \gset
select pg_temp.upload('discarded-old.pdf', true, true, null, now() - interval '25 hours') as o4 \gset
select pg_temp.upload('discarded-recent.pdf', true, true, null, now() - interval '1 hour') as o5 \gset
-- The file handed in above keeps its object, even if its intent were ever marked discarded.
update submissions.file_upload_intents set discarded_at = null where id = :'e';

select set_eq($$ select intent_id, reason from api.list_orphan_uploads(100) where object_key like '10000000-%' $$,
  format($$ values (%L::uuid, 'expired'::text), (%L::uuid, 'discarded'::text) $$, :'o1', :'o4'),
  'objects of uploads expired or discarded more than 24 hours ago are listed, and nothing else');
select is_empty(format($$ select 1 from api.list_orphan_uploads(100) where intent_id in (%L, %L, %L) $$, :'o2', :'o3', :'o5'),
  'not a recent one, and not one with no object');

select is(api.record_orphans_removed(array[:'o1', :'o4']::uuid[]), 0,
  'a removal is not recorded while the object is still in Storage');
set local storage.allow_delete_query = 'true';
delete from storage.objects where name in (select object_key from submissions.file_upload_intents where id in (:'o1', :'o4'));
reset storage.allow_delete_query;
select is(api.record_orphans_removed(array[:'o1', :'o4']::uuid[]), 2, 'once the Storage API has removed them, it is');
select ok((select bool_and(object_removed_at is not null) from submissions.file_upload_intents where id in (:'o1', :'o4')),
  'the intents say their objects are gone');
select is_empty(format($$ select 1 from api.list_orphan_uploads(100) where intent_id in (%L, %L) $$, :'o1', :'o4'),
  'so they are not listed again');
select is(api.record_orphans_removed(array[:'o1']::uuid[]), 0, 'recording twice changes nothing');
select is((select (details ->> 'count')::int from audit.events where action = 'submissions.orphan_uploads_removed'
           order by occurred_at desc limit 1), 2, 'the clean-up is audited');

select * from finish();
rollback;
