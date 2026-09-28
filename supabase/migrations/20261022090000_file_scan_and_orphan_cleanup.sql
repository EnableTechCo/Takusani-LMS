-- File scan step and orphan clean-up (S3-11; data model "Submissions and files"; register G3, spike X-5).
--
-- Storage exposes no content hash, and the media type it records is whatever the browser said. So every accepted file
-- is scanned after upload: the scan reads the object, computes the authoritative SHA-256 and detects the media type
-- from the file's own bytes, and records both in stored_files. The learner's checksum stays as declared, beside it.
--
-- The scan needs the object's bytes, which the database cannot read, so it runs in the application with the secret
-- key (straight after an upload is finalised, and on a schedule as the backstop), as the email worker does. These
-- functions are its side of the work, callable by the service role only:
--   * claim_file_scans: a bounded batch of pending files, each leased for five minutes so overlapping runs do not
--     scan the same file twice; a file whose attempts are used up is marked failed instead;
--   * record_file_scan: the outcome. Only a pending file changes, so a late or repeated result changes nothing.
--
-- Scan states, ready for a future malware scanner (which adds its own reasons under its own scanner name):
--   pending  -> clean     the bytes are what the file claims to be
--   pending  -> rejected  they are not: another type than allowed ('type_mismatch'), not the declared checksum
--                         ('checksum_mismatch'), or not the size Storage recorded ('size_mismatch')
--   pending  -> failed    the object could not be read after three attempts ('unreadable')
-- A rejected file cannot be handed in. Nothing else is blocked on the scan: a file waiting for it can be submitted,
-- as the scan normally finishes within seconds and must not become a single point of failure.
--
-- Orphans: an intent that expired without being finalised more than 24 hours ago, or a file the learner discarded
-- more than 24 hours ago, may still have an object in Storage. The same application job lists them, removes the
-- objects through the Storage API (SQL cannot), and the database records the removal only once the object is gone.
-- A file that was handed in, or is used as learning material, is never listed.

-- ---------------------------------------------------------------------------------------------------------------
-- Scan state on stored files
-- ---------------------------------------------------------------------------------------------------------------

alter table submissions.stored_files drop constraint stored_files_scan_state_check;

alter table submissions.stored_files
  add column detected_media_type text,
  add column scan_reason text,
  add column scanner text,
  add column scanned_at timestamptz,
  add column scan_attempts integer not null default 0 check (scan_attempts >= 0),
  add column scan_lease_until timestamptz,
  add constraint stored_files_scan_state_check check (scan_state in ('pending', 'clean', 'rejected', 'failed')),
  add constraint sha256_is_hex check (sha256 ~ '^[a-f0-9]{64}$'),
  add constraint scan_reason_is_known check (
    scan_reason in ('type_mismatch', 'checksum_mismatch', 'size_mismatch', 'unreadable')
  ),
  add constraint scan_outcome_is_recorded check (
    (scan_state = 'pending') = (scanned_at is null)
    and (scan_state not in ('clean', 'rejected')
         or (sha256 is not null and detected_media_type is not null and scanner is not null))
    and ((scan_state in ('rejected', 'failed')) = (scan_reason is not null))
  );

create index stored_files_scan_queue_idx on submissions.stored_files (accepted_at) where scan_state = 'pending';

-- ---------------------------------------------------------------------------------------------------------------
-- The scan worker's functions
-- ---------------------------------------------------------------------------------------------------------------

create function api.claim_file_scans(
  p_limit integer default 5,
  p_lease_seconds integer default 300,
  p_max_attempts integer default 3
)
returns table (
  file_id uuid,
  bucket text,
  object_key text,
  bytes bigint,
  declared_sha256 text,
  allowed_media_types text[],
  attempt integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A file whose lease ran out on its last attempt: the worker never came back with a result.
  update submissions.stored_files sf
  set scan_state = 'failed', scan_reason = 'unreadable', scanned_at = now(), scan_lease_until = null
  where sf.scan_state = 'pending' and sf.scan_attempts >= p_max_attempts and sf.scan_lease_until < now();

  return query
  with claimable as (
    select sf.id
    from submissions.stored_files sf
    where sf.scan_state = 'pending'
      and sf.scan_attempts < p_max_attempts
      and (sf.scan_lease_until is null or sf.scan_lease_until < now())
    order by sf.accepted_at
    limit greatest(1, least(coalesce(p_limit, 5), 20))
    for update skip locked
  ),
  claimed as (
    update submissions.stored_files sf
    set scan_lease_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 900))),
        scan_attempts = sf.scan_attempts + 1
    from claimable c
    where sf.id = c.id
    returning sf.id, sf.bucket, sf.object_key, sf.bytes, sf.declared_sha256, sf.intent_id, sf.scan_attempts,
              sf.accepted_at
  )
  select c.id, c.bucket, c.object_key, c.bytes, c.declared_sha256, i.allowed_media_types, c.scan_attempts
  from claimed c
  join submissions.file_upload_intents i on i.id = c.intent_id
  order by c.accepted_at;
end
$$;

-- p_outcome: 'clean' or 'rejected' with the hash and detected type (and, for rejected, the reason); or 'retry' when
-- the object could not be read, which waits 1, 4 or 9 minutes and becomes 'failed' once attempts are used up.
create function api.record_file_scan(
  p_file_id uuid,
  p_outcome text,
  p_sha256 text default null,
  p_detected_media_type text default null,
  p_reason text default null,
  p_scanner text default null,
  p_max_attempts integer default 3
)
returns table (status text, scan_state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file submissions.stored_files;
begin
  select * into v_file from submissions.stored_files sf where sf.id = p_file_id for update;
  if not found then return query select 'not_found'::text, null::text; return; end if;
  if v_file.scan_state <> 'pending' then return query select 'already_scanned'::text, v_file.scan_state; return; end if;

  if p_outcome = 'retry' then
    if v_file.scan_attempts >= p_max_attempts then
      update submissions.stored_files sf
      set scan_state = 'failed', scan_reason = 'unreadable', scanned_at = now(), scan_lease_until = null,
          scanner = coalesce(p_scanner, sf.scanner)
      where sf.id = p_file_id;
      perform audit.append('submissions.file_scanned', 'stored_file', p_file_id::text,
        jsonb_build_object('outcome', 'failed', 'reason', 'unreadable', 'attempts', v_file.scan_attempts), null, null,
        jsonb_build_object('scan_state', 'failed'), null, null);
      return query select 'ok'::text, 'failed'::text; return;
    end if;
    update submissions.stored_files sf
    set scan_lease_until = now() + make_interval(mins => v_file.scan_attempts * v_file.scan_attempts)
    where sf.id = p_file_id;
    return query select 'ok'::text, 'pending'::text; return;
  end if;

  if p_outcome not in ('clean', 'rejected')
     or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
     or nullif(btrim(p_detected_media_type), '') is null or char_length(p_detected_media_type) > 255
     or nullif(btrim(p_scanner), '') is null or char_length(p_scanner) > 60
     or (p_outcome = 'rejected') <> (p_reason is not null)
     or (p_reason is not null and p_reason not in ('type_mismatch', 'checksum_mismatch', 'size_mismatch')) then
    return query select 'invalid'::text, v_file.scan_state; return;
  end if;

  update submissions.stored_files sf
  set scan_state = p_outcome, sha256 = p_sha256, detected_media_type = p_detected_media_type, scan_reason = p_reason,
      scanner = p_scanner, scanned_at = now(), scan_lease_until = null
  where sf.id = p_file_id;

  perform audit.append('submissions.file_scanned', 'stored_file', p_file_id::text,
    jsonb_build_object('outcome', p_outcome, 'reason', p_reason, 'scanner', p_scanner), null, null,
    jsonb_build_object('scan_state', p_outcome, 'sha256', p_sha256, 'detected_media_type', p_detected_media_type,
                       'declared_sha256', v_file.declared_sha256, 'media_type', v_file.media_type),
    null, null);
  return query select 'ok'::text, p_outcome;
end
$$;

revoke all on function api.claim_file_scans(integer, integer, integer) from public, anon, authenticated, service_role;
revoke all on function api.record_file_scan(uuid, text, text, text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function api.claim_file_scans(integer, integer, integer) to service_role;
grant execute on function api.record_file_scan(uuid, text, text, text, text, text, integer) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Orphaned objects
-- ---------------------------------------------------------------------------------------------------------------

alter table submissions.file_upload_intents add column object_removed_at timestamptz;

create index file_upload_intents_discarded_idx on submissions.file_upload_intents (discarded_at)
  where discarded_at is not null and object_removed_at is null;

-- Objects to remove: an intent expired unfinalised, or a file discarded, more than 24 hours ago, whose object is still
-- in Storage. Never one that was handed in or is used as learning material.
create function api.list_orphan_uploads(p_limit integer default 100)
returns table (intent_id uuid, bucket text, object_key text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.bucket, i.object_key, case when i.discarded_at is not null then 'discarded' else 'expired' end
  from submissions.file_upload_intents i
  where i.object_removed_at is null
    and i.consumed_at is null
    and (
      (i.finalised_at is null and i.expired_at < now() - interval '24 hours')
      or i.discarded_at < now() - interval '24 hours'
    )
    and exists (select 1 from storage.objects o where o.bucket_id = i.bucket and o.name = i.object_key)
    and not exists (
      select 1 from submissions.stored_files sf
      where sf.intent_id = i.id
        and (exists (select 1 from submissions.submission_files f where f.stored_file_id = sf.id)
             or exists (select 1 from learning.materials m where m.stored_file_id = sf.id))
    )
  order by coalesce(i.discarded_at, i.expired_at)
  limit greatest(1, least(coalesce(p_limit, 100), 500))
$$;

-- Records the removal of each listed object that is really gone from Storage. Returns how many were recorded.
create function api.record_orphans_removed(p_intent_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update submissions.file_upload_intents i
  set object_removed_at = now()
  where i.id = any (p_intent_ids)
    and i.object_removed_at is null
    and not exists (select 1 from storage.objects o where o.bucket_id = i.bucket and o.name = i.object_key);
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform audit.append('submissions.orphan_uploads_removed', 'scheduled_job', 'upload-cleanup',
      jsonb_build_object('count', v_count), null, null, null, null, null);
  end if;
  return v_count;
end
$$;

revoke all on function api.list_orphan_uploads(integer) from public, anon, authenticated, service_role;
revoke all on function api.record_orphans_removed(uuid[]) from public, anon, authenticated, service_role;
grant execute on function api.list_orphan_uploads(integer) to service_role;
grant execute on function api.record_orphans_removed(uuid[]) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- A rejected file cannot be handed in
-- ---------------------------------------------------------------------------------------------------------------

-- The submit command from 20261002090000, with one check added before the file's availability: a file the scan
-- rejected is refused with 'file_rejected'. Everything else is unchanged.

create or replace function api.submit_task(p_task_id uuid, p_files jsonb, p_client_submission_id uuid)
returns table (
  status text,
  submission_id uuid,
  version_number integer,
  receipt_reference text,
  submitted_at timestamptz,
  is_late boolean,
  detail text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_submission uuid;
  v_previous submissions.submission_versions;
  v_existing submissions.submission_versions;
  v_version integer;
  v_late boolean := false;
  v_late_by integer;
  v_receipt text;
  v_version_id uuid;
  v_now timestamptz := now();
  v_row jsonb;
  v_file uuid;
  v_requirement uuid;
  v_missing text;
  v_count integer := 0;
begin
  if v_actor is null then
    return query select 'unauthenticated'::text, null::uuid, null::integer, null::text, null::timestamptz,
      null::boolean, null::text;
    return;
  end if;
  if p_client_submission_id is null then
    return query select 'client_submission_id_required'::text, null::uuid, null::integer, null::text,
      null::timestamptz, null::boolean, null::text;
    return;
  end if;

  select * into v_task from submissions.tasks where id = p_task_id;
  if not found or v_task.state <> 'published' then
    return query select 'task_not_found'::text, null::uuid, null::integer, null::text, null::timestamptz,
      null::boolean, null::text;
    return;
  end if;
  if not submissions.is_audience(v_actor, p_task_id) then
    return query select 'forbidden'::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
      null::text;
    return;
  end if;

  -- Aliases throughout: submission_id, version_number, is_late and submitted_at are also this function's OUT names.
  insert into submissions.submissions (task_id, profile_id)
  values (p_task_id, v_actor)
  on conflict (task_id, profile_id) do nothing;
  select s.id into v_submission from submissions.submissions s
  where s.task_id = p_task_id and s.profile_id = v_actor for update;

  select sv.* into v_existing from submissions.submission_versions sv
  where sv.submission_id = v_submission and sv.client_submission_id = p_client_submission_id;
  if found then
    return query select 'ok'::text, v_submission, v_existing.version_number, v_existing.receipt_reference,
      v_existing.submitted_at, v_existing.is_late, 'retry'::text;
    return;
  end if;

  if v_task.due_at is not null and v_now > v_task.due_at then
    if v_task.late_policy = 'closed_at_due' then
      return query select 'closed'::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
        null::text;
      return;
    end if;
    v_late := true;
    v_late_by := extract(epoch from (v_now - v_task.due_at))::integer;
  end if;

  select r.title into v_missing
  from submissions.task_evidence_requirements r
  where r.task_id = p_task_id
    and r.mandatory
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) f
      where (f ->> 'requirement_id')::uuid = r.id
    )
  order by r.ordinal
  limit 1;
  if v_missing is not null then
    return query select 'missing_evidence'::text, null::uuid, null::integer, null::text, null::timestamptz,
      null::boolean, v_missing;
    return;
  end if;

  if jsonb_typeof(coalesce(p_files, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_files) = 0 then
    return query select 'no_files'::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
      null::text;
    return;
  end if;

  select count(*) + 1 into v_version
  from submissions.submission_versions sv where sv.submission_id = v_submission;
  select sv.* into v_previous from submissions.submission_versions sv
  where sv.submission_id = v_submission order by sv.version_number desc limit 1;

  v_receipt := 'SUB-' || to_char(v_now at time zone 'Africa/Johannesburg', 'YYYYMMDD') || '-'
    || upper(encode(extensions.gen_random_bytes(2), 'hex'));

  insert into submissions.submission_versions (
    submission_id, version_number, submitted_at, is_late, late_by_seconds, supersedes_version_id,
    client_submission_id, receipt_reference
  )
  values (v_submission, v_version, v_now, v_late, v_late_by, v_previous.id, p_client_submission_id, v_receipt)
  returning id into v_version_id;

  for v_row in select * from jsonb_array_elements(p_files) loop
    v_file := (v_row ->> 'file_id')::uuid;
    v_requirement := nullif(v_row ->> 'requirement_id', '')::uuid;

    if v_requirement is not null and not exists (
      select 1 from submissions.task_evidence_requirements r where r.id = v_requirement and r.task_id = p_task_id
    ) then
      raise exception using errcode = 'P0001', message = 'requirement_not_on_task';
    end if;

    -- Lock the intent, so a discard of the same file waits for this submission or is refused after it.
    perform 1 from submissions.file_upload_intents i
    join submissions.stored_files sf on sf.intent_id = i.id
    where sf.id = v_file for update of i;
    if exists (select 1 from submissions.stored_files sf where sf.id = v_file and sf.scan_state = 'rejected') then
      raise exception using errcode = 'P0001', message = 'file_rejected';
    end if;
    if not submissions.file_available_for(v_actor, p_task_id, v_file) then
      raise exception using errcode = 'P0001', message = 'file_not_available';
    end if;

    insert into submissions.submission_files (version_id, stored_file_id, requirement_id)
    values (v_version_id, v_file, v_requirement);
    update submissions.file_upload_intents i
    set consumed_at = v_now
    from submissions.stored_files sf
    where sf.id = v_file and i.id = sf.intent_id;
    v_count := v_count + 1;
  end loop;

  perform assessment.open_instance(p_task_id, v_actor, v_version_id);

  perform audit.append('submissions.version_submitted', 'submission_version', v_version_id::text,
    jsonb_build_object('task_id', p_task_id, 'cohort_id', v_task.cohort_id), 'learner', null,
    jsonb_build_object('version', v_version, 'files', v_count, 'is_late', v_late, 'receipt', v_receipt),
    'cohort', v_task.cohort_id);

  return query select 'ok'::text, v_submission, v_version, v_receipt, v_now, v_late, null::text;
exception
  when sqlstate 'P0001' then
    return query select sqlerrm::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
      null::text;
end
$$;
