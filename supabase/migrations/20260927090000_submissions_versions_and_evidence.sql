-- Versioned submissions (S2-04, FR-308 to FR-311, BR-03): a learner hands work in, and every version is kept.
-- LMS-data-model.md "Submissions and files"; UX architecture flow A.
--
-- What this carries:
--   * A version is immutable (FR-310, BR-03). Handing work in again adds version 2 and leaves version 1 on record,
--     linked by supersedes. Nothing is edited or deleted: the append-only triggers enforce that, not good manners.
--   * Lateness is the server's decision (FR-309), from the task's due date and its late policy: either late work is
--     accepted and marked late, or the task closes at the due date and a later attempt is refused.
--   * Evidence is tagged to the requirement it answers, and a task cannot be handed in while a requirement marked
--     mandatory has no file (UX decision Q10). The missing requirement is named, so the screen can say which.
--   * A retry with the same client_submission_id returns the first receipt instead of making a second version, so
--     a lost reply over a bad connection cannot submit twice (UX flow A, E7).

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

-- What a learner must hand in, set on the draft task with its rubric (FR-311).
create table submissions.task_evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references submissions.tasks (id) on delete cascade,
  ordinal integer not null check (ordinal between 1 and 20),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- What good evidence looks like, shown beside the file chooser.
  guidance text check (char_length(btrim(guidance)) <= 1000),
  mandatory boolean not null default true,
  unique (task_id, ordinal)
);

-- One per learner and task. It holds no status of its own: where the work stands is read from the result, so the
-- two can never disagree (LMS-data-model.md).
create table submissions.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references submissions.tasks (id),
  profile_id uuid not null references identity.profiles (id),
  created_at timestamptz not null default now(),
  unique (task_id, profile_id)
);

create table submissions.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions.submissions (id),
  version_number integer not null check (version_number >= 1),
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  -- How late, in seconds, so a late policy that allows a grace period can be added without re-deciding history.
  late_by_seconds integer check (late_by_seconds >= 0),
  supersedes_version_id uuid references submissions.submission_versions (id),
  -- The learner's own identifier for the attempt: a retry returns this version rather than making another.
  client_submission_id uuid,
  -- What the receipt calls it, in the form the prototype shows: SUB-20260904-7K2M.
  receipt_reference text not null unique,
  created_at timestamptz not null default now(),
  unique (submission_id, version_number),
  unique (submission_id, client_submission_id)
);

create table submissions.submission_files (
  version_id uuid not null references submissions.submission_versions (id),
  stored_file_id uuid not null references submissions.stored_files (id),
  requirement_id uuid references submissions.task_evidence_requirements (id),
  primary key (version_id, stored_file_id)
);

create index submissions_profile_idx on submissions.submissions (profile_id);
create index submission_versions_submission_idx on submissions.submission_versions (submission_id, version_number desc);

revoke all on table submissions.task_evidence_requirements, submissions.submissions, submissions.submission_versions,
  submissions.submission_files from public, anon, authenticated, service_role;

-- Append-only: a version and its files are a record of what was handed in and when (BR-03). Both mechanisms are
-- required: revoking does not bind service_role or a SECURITY DEFINER function, and the trigger does.
revoke update, delete, truncate on submissions.submission_versions from public, anon, authenticated, service_role;
revoke update, delete, truncate on submissions.submission_files from public, anon, authenticated, service_role;

create trigger submission_versions_append_only
  before update or delete on submissions.submission_versions
  for each row execute function audit.forbid_mutation();

create trigger submission_versions_append_only_truncate
  before truncate on submissions.submission_versions
  for each statement execute function audit.forbid_mutation();

create trigger submission_files_append_only
  before update or delete on submissions.submission_files
  for each row execute function audit.forbid_mutation();

create trigger submission_files_append_only_truncate
  before truncate on submissions.submission_files
  for each statement execute function audit.forbid_mutation();

-- ---------------------------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------------------------

-- The evidence requirements of a draft task, replaced as a set, like its rubric.
create function api.set_task_requirements(p_task_id uuid, p_requirements jsonb)
returns table (status text, requirement_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_row jsonb;
  v_ordinal integer := 0;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_task from submissions.tasks where id = p_task_id for update;
  if not found then return query select 'task_not_found'::text, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_task.cohort_id) then
    return query select 'forbidden'::text, null::integer; return;
  end if;
  if v_task.state <> 'draft' then return query select 'not_a_draft'::text, null::integer; return; end if;
  if jsonb_typeof(coalesce(p_requirements, 'null'::jsonb)) <> 'array' then
    return query select 'invalid_requirements'::text, null::integer; return;
  end if;
  if jsonb_array_length(p_requirements) > 20 then
    return query select 'too_many_requirements'::text, null::integer; return;
  end if;

  for v_row in select * from jsonb_array_elements(p_requirements) loop
    if char_length(btrim(coalesce(v_row ->> 'title', ''))) not between 1 and 200 then
      return query select 'invalid_requirement_title'::text, null::integer; return;
    end if;
  end loop;

  delete from submissions.task_evidence_requirements where task_id = p_task_id;
  for v_row in select * from jsonb_array_elements(p_requirements) loop
    v_ordinal := v_ordinal + 1;
    insert into submissions.task_evidence_requirements (task_id, ordinal, title, guidance, mandatory)
    values (p_task_id, v_ordinal, btrim(v_row ->> 'title'),
      nullif(btrim(coalesce(v_row ->> 'guidance', '')), ''),
      coalesce((v_row ->> 'mandatory')::boolean, true));
  end loop;

  update submissions.tasks set updated_at = now() where id = p_task_id;
  perform audit.append('submissions.task_requirements_set', 'task', p_task_id::text,
    jsonb_build_object('cohort_id', v_task.cohort_id), 'facilitator', null,
    jsonb_build_object('requirement_count', v_ordinal), 'cohort', v_task.cohort_id);
  return query select 'ok'::text, v_ordinal;
end
$$;

-- Hand work in. p_files is [{file_id, requirement_id}]: each finalised file, against the requirement it answers.
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

  -- One submission row per learner and task; lock it so two devices cannot both take the next version number.
  -- Aliases throughout: submission_id, version_number, is_late and submitted_at are also this function's OUT names.
  insert into submissions.submissions (task_id, profile_id)
  values (p_task_id, v_actor)
  on conflict (task_id, profile_id) do nothing;
  select s.id into v_submission from submissions.submissions s
  where s.task_id = p_task_id and s.profile_id = v_actor for update;

  -- A retry of the same attempt returns the first receipt (UX flow A, E7): never a second version.
  select sv.* into v_existing from submissions.submission_versions sv
  where sv.submission_id = v_submission and sv.client_submission_id = p_client_submission_id;
  if found then
    return query select 'ok'::text, v_submission, v_existing.version_number, v_existing.receipt_reference,
      v_existing.submitted_at, v_existing.is_late, 'retry'::text;
    return;
  end if;

  -- Lateness, and whether late work is taken at all, are the task's decision (FR-309).
  if v_task.due_at is not null and v_now > v_task.due_at then
    if v_task.late_policy = 'closed_at_due' then
      return query select 'closed'::text, null::uuid, null::integer, null::text, null::timestamptz, null::boolean,
        null::text;
      return;
    end if;
    v_late := true;
    v_late_by := extract(epoch from (v_now - v_task.due_at))::integer;
  end if;

  -- Every mandatory requirement needs a file in this version (UX decision Q10). Name the first one missing.
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

  -- Consume the files: each must be this learner's, finalised, for this task, and not already in a version.
  for v_row in select * from jsonb_array_elements(p_files) loop
    v_file := (v_row ->> 'file_id')::uuid;
    v_requirement := nullif(v_row ->> 'requirement_id', '')::uuid;

    if v_requirement is not null and not exists (
      select 1 from submissions.task_evidence_requirements r where r.id = v_requirement and r.task_id = p_task_id
    ) then
      raise exception using errcode = 'P0001', message = 'requirement_not_on_task';
    end if;

    if not exists (
      select 1
      from submissions.stored_files sf
      join submissions.file_upload_intents i on i.id = sf.intent_id
      where sf.id = v_file
        and i.profile_id = v_actor
        and i.context_type = 'task_submission'
        and i.context_id = p_task_id
        and i.consumed_at is null
    ) then
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

  -- S2-10 writes the outbox row for the receipt notification here, in this transaction (ADR-025).
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

-- ---------------------------------------------------------------------------------------------------------------
-- Queries
-- ---------------------------------------------------------------------------------------------------------------

-- Everything the learner's task page needs: the brief, what to hand in, and every version they have submitted.
create function api.get_my_task(p_task_id uuid)
returns table (
  id uuid,
  title text,
  brief text,
  cohort_name text,
  submission_type text,
  due_at timestamptz,
  late_policy text,
  criteria jsonb,
  requirements jsonb,
  versions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, t.brief, c.name, t.submission_type, t.due_at, t.late_policy,
    coalesce((
      select jsonb_agg(jsonb_build_object('ordinal', tc.ordinal, 'title', tc.title, 'descriptor', tc.descriptor,
                                          'points', tc.points) order by tc.ordinal)
      from submissions.task_criteria tc where tc.task_id = t.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'ordinal', r.ordinal, 'title', r.title,
                                          'guidance', r.guidance, 'mandatory', r.mandatory) order by r.ordinal)
      from submissions.task_evidence_requirements r where r.task_id = t.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'version_number', v.version_number, 'submitted_at', v.submitted_at, 'is_late', v.is_late,
               'receipt_reference', v.receipt_reference,
               'files', (
                 select coalesce(jsonb_agg(jsonb_build_object('filename', sf.original_filename, 'bytes', sf.bytes,
                                                              'requirement_id', vf.requirement_id)), '[]'::jsonb)
                 from submissions.submission_files vf
                 join submissions.stored_files sf on sf.id = vf.stored_file_id
                 where vf.version_id = v.id
               )) order by v.version_number desc)
      from submissions.submission_versions v
      join submissions.submissions s on s.id = v.submission_id
      where s.task_id = t.id and s.profile_id = auth.uid()
    ), '[]'::jsonb)
  from submissions.tasks t
  join programmes.cohorts c on c.id = t.cohort_id
  where t.id = p_task_id
    and submissions.is_audience(auth.uid(), t.id)
$$;

-- The task editor now also shows what the learner must hand in. Adding an output column means replacing the
-- function outright, which drops its grants, so they are given again below.
drop function api.get_task(uuid);

create function api.get_task(p_task_id uuid)
returns table (
  id uuid,
  cohort_id uuid,
  cohort_name text,
  module_id uuid,
  title text,
  brief text,
  state text,
  submission_type text,
  due_at timestamptz,
  late_policy text,
  audience text,
  audience_size integer,
  criteria jsonb,
  requirements jsonb,
  named_learners jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.cohort_id, c.name, t.module_id, t.title, t.brief, t.state, t.submission_type, t.due_at,
         t.late_policy, t.audience, submissions.audience_size(t.id),
         coalesce((
           select jsonb_agg(jsonb_build_object('ordinal', tc.ordinal, 'title', tc.title, 'descriptor', tc.descriptor,
                                               'points', tc.points) order by tc.ordinal)
           from submissions.task_criteria tc where tc.task_id = t.id
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', r.id, 'ordinal', r.ordinal, 'title', r.title,
                                               'guidance', r.guidance, 'mandatory', r.mandatory) order by r.ordinal)
           from submissions.task_evidence_requirements r where r.task_id = t.id
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(jsonb_build_object('full_name', p.full_name, 'email', u.email) order by p.full_name)
           from submissions.task_targets tt
           join identity.profiles p on p.id = tt.profile_id
           join auth.users u on u.id = p.id
           where tt.task_id = t.id
         ), '[]'::jsonb)
  from submissions.tasks t
  join programmes.cohorts c on c.id = t.cohort_id
  where t.id = p_task_id
    and submissions.can_set_work(auth.uid(), t.cohort_id)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.set_task_requirements(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function api.submit_task(uuid, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function api.get_my_task(uuid) from public, anon, authenticated, service_role;

grant execute on function api.set_task_requirements(uuid, jsonb) to authenticated;
grant execute on function api.submit_task(uuid, jsonb, uuid) to authenticated;
grant execute on function api.get_my_task(uuid) to authenticated;

revoke all on function api.get_task(uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_task(uuid) to authenticated;
