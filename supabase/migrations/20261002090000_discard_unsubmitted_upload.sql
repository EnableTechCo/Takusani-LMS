-- A learner can remove a file they uploaded but have not handed in (bug fix to S2-05).
--
-- Before this, "Remove" on the submit page only hid the file on screen. The server still listed it as ready, so
-- after a reload it came back and would be handed in with the next submission. Discarding records the choice on
-- the intent: the file stops being listed and cannot be submitted. The object stays in Storage until a clean-up job
-- removes discarded and expired uploads; a learner never deletes from the evidence bucket (ADR-016).

alter table submissions.file_upload_intents
  add column discarded_at timestamptz,
  add constraint handed_in_or_discarded check (consumed_at is null or discarded_at is null);

create function api.discard_upload(p_file_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_intent submissions.file_upload_intents;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;

  select i.* into v_intent
  from submissions.stored_files sf
  join submissions.file_upload_intents i on i.id = sf.intent_id
  where sf.id = p_file_id
  for update of i;
  if not found or v_intent.profile_id <> v_actor then return query select 'not_found'::text; return; end if;
  if v_intent.consumed_at is not null then return query select 'already_handed_in'::text; return; end if;
  if v_intent.discarded_at is not null then return query select 'ok'::text; return; end if;

  update submissions.file_upload_intents set discarded_at = now() where id = v_intent.id;
  return query select 'ok'::text;
end
$$;

revoke all on function api.discard_upload(uuid) from public, anon, authenticated, service_role;
grant execute on function api.discard_upload(uuid) to authenticated;

-- A discarded file is no longer listed. Same columns as 20260928100000, so replacing it keeps the signature.
create or replace function api.list_my_uploads(p_task_id uuid)
returns table (
  file_id uuid,
  intent_id uuid,
  requirement_id uuid,
  original_filename text,
  bytes bigint,
  media_type text,
  scan_state text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sf.id, sf.intent_id, i.requirement_id, sf.original_filename, sf.bytes, sf.media_type, sf.scan_state,
         sf.accepted_at
  from submissions.stored_files sf
  join submissions.file_upload_intents i on i.id = sf.intent_id
  where i.profile_id = auth.uid()
    and i.context_type = 'task_submission'
    and i.context_id = p_task_id
    and i.consumed_at is null
    and i.discarded_at is null
  order by sf.accepted_at
$$;

-- A discarded file cannot be handed in. The rule for "this file may go into a submission" now lives in one
-- function, so the next change to it is one place rather than another copy of the submit command.
create function submissions.file_available_for(p_profile_id uuid, p_task_id uuid, p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from submissions.stored_files sf
    join submissions.file_upload_intents i on i.id = sf.intent_id
    where sf.id = p_file_id
      and i.profile_id = p_profile_id
      and i.context_type = 'task_submission'
      and i.context_id = p_task_id
      and i.consumed_at is null
      and i.discarded_at is null
  )
$$;

revoke all on function submissions.file_available_for(uuid, uuid, uuid) from public, anon, authenticated, service_role;

-- The submit command, replaced with that rule swapped in and the intent row locked first, so a discard and a submit
-- of the same file take turns on it. Everything else is unchanged from 20260929090000.
drop function api.submit_task(uuid, jsonb, uuid);

create function api.submit_task(p_task_id uuid, p_files jsonb, p_client_submission_id uuid)
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

revoke all on function api.submit_task(uuid, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function api.submit_task(uuid, jsonb, uuid) to authenticated;
