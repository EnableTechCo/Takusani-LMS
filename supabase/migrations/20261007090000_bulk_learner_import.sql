-- Bulk learner import (S2-01, FR-103, FR-107; UX flow G; capacity scenario 5). An administrator loads an intake
-- file for one cohort: every row is checked first and nothing is created; then the ready rows are imported in chunks
-- of up to 100, each chunk one transaction, and every account and enrolment is audited with the batch reference.
--
-- Replay safety: a batch is unique by (cohort, SHA-256 digest of the file). The same file again creates no second
-- batch and nothing new. A row whose email already belongs to an account is "already exists" and is skipped, so a
-- file that mixes old and new rows cannot create duplicates.
--
-- Auth users can only be created through the Auth admin API, outside this database transaction, so a chunk runs in
-- three steps: claim (rows marked importing), create the auth users (application), complete (profiles, roles,
-- enrolments and audit in one transaction). Every step can be repeated: a retried chunk finds the auth users it made
-- last time by email, and a chunk abandoned mid-way (browser closed) is claimed again after five minutes.
--
-- Invitations are not sent: email is switched off until go-live. Each row records that its invitation is still to be
-- sent, so the invitation step can be added then without guessing who was told.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create sequence identity.import_batch_seq;

create table identity.import_batches (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default 'IMP-' || lpad(nextval('identity.import_batch_seq')::text, 4, '0'),
  cohort_id uuid not null references programmes.cohorts (id),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_digest text not null check (file_digest ~ '^[0-9a-f]{64}$'),
  state text not null default 'validated' check (state in ('validated', 'importing', 'completed', 'cancelled')),
  uploaded_by uuid not null references identity.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Replay safety (FR-103): one live batch per file and cohort. A cancelled batch frees the file to be loaded again.
create unique index import_batches_one_per_file on identity.import_batches (cohort_id, file_digest)
  where state <> 'cancelled';

create table identity.import_rows (
  batch_id uuid not null references identity.import_batches (id),
  row_number integer not null check (row_number >= 2),
  full_name text,
  email text,
  learner_number text,
  -- The normalised identity key: the email, trimmed and lower-cased.
  identity_key text,
  outcome text not null check (outcome in ('ready', 'problem', 'exists', 'importing', 'imported', 'failed')),
  problem text check (char_length(problem) <= 300),
  attempts integer not null default 0 check (attempts >= 0),
  claimed_at timestamptz,
  profile_id uuid references identity.profiles (id),
  enrolment_id uuid references programmes.enrolments (id),
  invitation_state text not null default 'not_sent' check (invitation_state in ('not_sent', 'sent')),
  imported_at timestamptz,
  primary key (batch_id, row_number),
  constraint problem_has_reason check ((outcome in ('problem', 'failed')) = (problem is not null)),
  constraint imported_has_profile check ((outcome = 'imported') = (profile_id is not null and imported_at is not null))
);

create index import_rows_outcome_idx on identity.import_rows (batch_id, outcome);

revoke all on table identity.import_batches, identity.import_rows from public, anon, authenticated, service_role;
revoke all on sequence identity.import_batch_seq from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Checking a file (nothing is created)
-- ---------------------------------------------------------------------------------------------------------------

-- p_rows: [{ "row": 2, "full_name": "...", "email": "...", "learner_number": "..." }, ...], row numbers as in the file
-- (the header is row 1). Every row is checked here, so the rules live in one place:
--   problem: a name missing or too long; an email missing or not an email; a learner number too long; the same email
--     or learner number twice in the file (naming the other row); a learner number another account already has.
--   exists: the email already belongs to an account (skipped).
--   ready: everything else.
create function api.create_import_batch(p_cohort_id uuid, p_file_name text, p_file_digest text, p_rows jsonb)
returns table (status text, batch_id uuid, detail jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_existing record;
  v_batch uuid;
  v_count integer;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::jsonb; return; end if;
  if not identity.has_role(v_actor, 'administrator') then
    return query select 'forbidden'::text, null::uuid, null::jsonb; return;
  end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status = 'active') then
    return query select 'cohort_not_found'::text, null::uuid, null::jsonb; return;
  end if;
  if coalesce(p_file_digest, '') !~ '^[0-9a-f]{64}$' or char_length(coalesce(p_file_name, '')) not between 1 and 255 then
    return query select 'invalid_file'::text, null::uuid, null::jsonb; return;
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return query select 'no_rows'::text, null::uuid, null::jsonb; return;
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count > 5000 then
    return query select 'too_many_rows'::text, null::uuid, jsonb_build_object('rows', v_count); return;
  end if;

  -- The same file for the same cohort: say which batch has it, and create nothing (flow G, E2).
  select b.id, b.reference, b.created_at, p.full_name into v_existing
  from identity.import_batches b join identity.profiles p on p.id = b.uploaded_by
  where b.cohort_id = p_cohort_id and b.file_digest = p_file_digest and b.state <> 'cancelled';
  if v_existing.id is not null then
    return query select 'duplicate_file'::text, v_existing.id,
      jsonb_build_object('reference', v_existing.reference, 'created_at', v_existing.created_at,
                         'uploaded_by', v_existing.full_name);
    return;
  end if;

  insert into identity.import_batches (cohort_id, file_name, file_digest, uploaded_by)
  values (p_cohort_id, btrim(p_file_name), p_file_digest, v_actor)
  returning id into v_batch;

  with raw as (
    select (r ->> 'row')::integer as row_number,
      nullif(btrim(r ->> 'full_name'), '') as full_name,
      nullif(btrim(r ->> 'email'), '') as email,
      nullif(btrim(r ->> 'learner_number'), '') as learner_number
    from jsonb_array_elements(p_rows) r
  ),
  keyed as (
    select raw.*, lower(raw.email) as identity_key,
      min(raw.row_number) over (partition by lower(raw.email)) as first_email_row,
      min(raw.row_number) over (partition by raw.learner_number) as first_number_row
    from raw
  )
  insert into identity.import_rows (batch_id, row_number, full_name, email, learner_number, identity_key, outcome, problem)
  select v_batch, k.row_number, k.full_name, k.email, k.learner_number, k.identity_key,
    case when x.problem is not null then 'problem' when x.exists_already then 'exists' else 'ready' end,
    x.problem
  from keyed k
  cross join lateral (
    select
      case
        when k.full_name is null then 'Name is missing.'
        when char_length(k.full_name) > 200 then 'Name is longer than 200 characters.'
        when k.email is null then 'Email is missing.'
        when k.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(k.email) > 254 then 'This is not an email address.'
        when k.first_email_row < k.row_number then 'This email appears twice in the file (also row ' || k.first_email_row || ').'
        when k.learner_number is not null and char_length(k.learner_number) > 50 then 'Learner number is longer than 50 characters.'
        when k.learner_number is not null and k.first_number_row < k.row_number
          then 'This learner number appears twice in the file (also row ' || k.first_number_row || ').'
        when k.learner_number is not null and exists (
          select 1 from identity.profiles p
          join auth.users u on u.id = p.id
          where p.learner_number = k.learner_number and lower(u.email) <> k.identity_key
        ) then 'Another account already has this learner number.'
      end as problem,
      exists (select 1 from auth.users u join identity.profiles p on p.id = u.id where lower(u.email) = k.identity_key)
        as exists_already
  ) x;

  perform audit.append('identity.import_checked', 'import_batch', v_batch::text,
    jsonb_build_object('file_name', btrim(p_file_name), 'rows', v_count), 'administrator', null,
    (select jsonb_build_object('reference', b.reference, 'ready', count(*) filter (where r.outcome = 'ready'),
                               'problems', count(*) filter (where r.outcome = 'problem'),
                               'exists', count(*) filter (where r.outcome = 'exists'))
     from identity.import_batches b join identity.import_rows r on r.batch_id = b.id
     where b.id = v_batch group by b.reference),
    'cohort', p_cohort_id);

  return query select 'ok'::text, v_batch, null::jsonb;
end
$$;

revoke all on function api.create_import_batch(uuid, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function api.create_import_batch(uuid, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Importing, a chunk at a time
-- ---------------------------------------------------------------------------------------------------------------

-- Step 1: up to 100 ready rows (or rows left importing for more than five minutes) are marked importing and handed
-- to the application, which creates their auth users. Two tabs cannot take the same rows (skip locked).
create function api.claim_import_chunk(p_batch_id uuid, p_size integer default 100)
returns table (row_number integer, full_name text, email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_state text;
begin
  if v_actor is null or not identity.has_role(v_actor, 'administrator') then return; end if;
  select b.state into v_state from identity.import_batches b where b.id = p_batch_id for update;
  if v_state is null or v_state not in ('validated', 'importing') then return; end if;

  update identity.import_batches b set state = 'importing', updated_at = now()
  where b.id = p_batch_id and b.state = 'validated';

  return query
  with picked as (
    select r.row_number from identity.import_rows r
    where r.batch_id = p_batch_id
      and (r.outcome = 'ready' or (r.outcome = 'importing' and r.claimed_at < now() - interval '5 minutes'))
    order by r.row_number
    limit least(greatest(coalesce(p_size, 100), 1), 100)
    for update skip locked
  )
  update identity.import_rows r
  set outcome = 'importing', claimed_at = now(), attempts = r.attempts + 1
  from picked
  where r.batch_id = p_batch_id and r.row_number = picked.row_number
  returning r.row_number, r.full_name, r.email;
end
$$;

revoke all on function api.claim_import_chunk(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function api.claim_import_chunk(uuid, integer) to authenticated;

-- Step 3: one transaction for the chunk. p_results: [{ "row": 2, "error": null | "...", "retry": false }]. For a row
-- without an error, the auth user is found by the row's email (so a retry finds the user an earlier attempt made);
-- its profile, learner role and enrolment are created and audited with the batch reference. A row that already has a
-- profile (someone else made the account in between) becomes "already exists". A row with a retryable error goes
-- back to ready; any other error fails the row with its reason.
create function api.complete_import_chunk(p_batch_id uuid, p_results jsonb)
returns table (status text, imported integer, failed integer, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_batch identity.import_batches;
  v_result jsonb;
  v_row identity.import_rows;
  v_user uuid;
  v_enrolment uuid;
  v_imported integer := 0;
  v_failed integer := 0;
  v_remaining integer;
begin
  if v_actor is null or not identity.has_role(v_actor, 'administrator') then
    return query select 'forbidden'::text, null::integer, null::integer, null::integer; return;
  end if;
  select * into v_batch from identity.import_batches b where b.id = p_batch_id for update;
  if not found or v_batch.state <> 'importing' then
    return query select 'not_importing'::text, null::integer, null::integer, null::integer; return;
  end if;
  if jsonb_typeof(p_results) <> 'array' then
    return query select 'invalid_results'::text, null::integer, null::integer, null::integer; return;
  end if;

  for v_result in select * from jsonb_array_elements(p_results) loop
    select r.* into v_row from identity.import_rows r
    where r.batch_id = p_batch_id and r.row_number = (v_result ->> 'row')::integer for update;
    if not found or v_row.outcome <> 'importing' then continue; end if;

    if nullif(v_result ->> 'error', '') is not null then
      if coalesce((v_result ->> 'retry')::boolean, false) then
        update identity.import_rows r set outcome = 'ready', claimed_at = null
        where r.batch_id = p_batch_id and r.row_number = v_row.row_number;
      else
        update identity.import_rows r set outcome = 'failed', problem = left(v_result ->> 'error', 300)
        where r.batch_id = p_batch_id and r.row_number = v_row.row_number;
        v_failed := v_failed + 1;
      end if;
      continue;
    end if;

    select u.id into v_user from auth.users u where lower(u.email) = v_row.identity_key;
    if v_user is null then
      update identity.import_rows r set outcome = 'ready', claimed_at = null
      where r.batch_id = p_batch_id and r.row_number = v_row.row_number;
      continue;
    end if;
    if exists (select 1 from identity.profiles p where p.id = v_user) then
      update identity.import_rows r set outcome = 'exists'
      where r.batch_id = p_batch_id and r.row_number = v_row.row_number;
      continue;
    end if;
    if v_row.learner_number is not null
       and exists (select 1 from identity.profiles p where p.learner_number = v_row.learner_number) then
      update identity.import_rows r set outcome = 'failed', problem = 'Another account already has this learner number.'
      where r.batch_id = p_batch_id and r.row_number = v_row.row_number;
      v_failed := v_failed + 1;
      continue;
    end if;

    insert into identity.profiles (id, full_name, learner_number, created_by)
    values (v_user, v_row.full_name, v_row.learner_number, v_actor);
    insert into identity.role_assignments (profile_id, role, assigned_by)
    values (v_user, 'learner', v_actor);
    insert into programmes.enrolments (cohort_id, profile_id, enrolled_by)
    values (v_batch.cohort_id, v_user, v_actor)
    returning id into v_enrolment;

    perform audit.append('identity.account_created', 'profile', v_user::text,
      jsonb_build_object('via', 'import', 'batch', v_batch.reference, 'row', v_row.row_number), 'administrator', null,
      jsonb_build_object('full_name', v_row.full_name, 'learner_number', v_row.learner_number, 'status', 'active'),
      'global', null);
    perform audit.append('identity.role_assigned', 'profile', v_user::text,
      jsonb_build_object('via', 'import', 'batch', v_batch.reference), 'administrator', null,
      jsonb_build_object('role', 'learner', 'scope_type', 'global'), 'global', null);
    perform audit.append('programmes.learner_enrolled', 'profile', v_user::text,
      jsonb_build_object('enrolment_id', v_enrolment, 'via', 'import', 'batch', v_batch.reference), 'administrator',
      null, jsonb_build_object('cohort_id', v_batch.cohort_id, 'status', 'active'), 'cohort', v_batch.cohort_id);

    update identity.import_rows r
    set outcome = 'imported', profile_id = v_user, enrolment_id = v_enrolment, imported_at = now()
    where r.batch_id = p_batch_id and r.row_number = v_row.row_number;
    v_imported := v_imported + 1;
  end loop;

  select count(*)::integer into v_remaining from identity.import_rows r
  where r.batch_id = p_batch_id and r.outcome in ('ready', 'importing');
  if v_remaining = 0 then
    update identity.import_batches b set state = 'completed', updated_at = now() where b.id = p_batch_id;
    perform audit.append('identity.import_completed', 'import_batch', p_batch_id::text,
      jsonb_build_object('reference', v_batch.reference), 'administrator', null,
      (select jsonb_build_object('imported', count(*) filter (where r.outcome = 'imported'),
                                 'failed', count(*) filter (where r.outcome = 'failed'),
                                 'exists', count(*) filter (where r.outcome = 'exists'),
                                 'problems', count(*) filter (where r.outcome = 'problem'))
       from identity.import_rows r where r.batch_id = p_batch_id),
      'cohort', v_batch.cohort_id);
  else
    update identity.import_batches b set updated_at = now() where b.id = p_batch_id;
  end if;

  return query select 'ok'::text, v_imported, v_failed, v_remaining;
end
$$;

revoke all on function api.complete_import_chunk(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function api.complete_import_chunk(uuid, jsonb) to authenticated;

-- "Cancel and fix the file first" (flow G, D1): only before anything is imported. The file can then be loaded again.
create function api.cancel_import_batch(p_batch_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_batch identity.import_batches;
begin
  if v_actor is null or not identity.has_role(v_actor, 'administrator') then
    return query select 'forbidden'::text; return;
  end if;
  select * into v_batch from identity.import_batches b where b.id = p_batch_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_batch.state <> 'validated' then return query select 'already_started'::text; return; end if;
  update identity.import_batches b set state = 'cancelled', updated_at = now() where b.id = p_batch_id;
  perform audit.append('identity.import_cancelled', 'import_batch', p_batch_id::text,
    jsonb_build_object('reference', v_batch.reference), 'administrator', jsonb_build_object('state', 'validated'),
    jsonb_build_object('state', 'cancelled'), 'cohort', v_batch.cohort_id);
  return query select 'ok'::text;
end
$$;

revoke all on function api.cancel_import_batch(uuid) from public, anon, authenticated, service_role;
grant execute on function api.cancel_import_batch(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads (administrators only)
-- ---------------------------------------------------------------------------------------------------------------

create function api.list_import_batches()
returns table (
  id uuid,
  reference text,
  cohort_name text,
  file_name text,
  state text,
  uploaded_by_name text,
  created_at timestamptz,
  total integer,
  ready integer,
  problems integer,
  existing integer,
  imported integer,
  failed integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.reference, c.name, b.file_name, b.state, p.full_name, b.created_at,
    count(r.*)::integer,
    (count(*) filter (where r.outcome in ('ready', 'importing')))::integer,
    (count(*) filter (where r.outcome = 'problem'))::integer,
    (count(*) filter (where r.outcome = 'exists'))::integer,
    (count(*) filter (where r.outcome = 'imported'))::integer,
    (count(*) filter (where r.outcome = 'failed'))::integer
  from identity.import_batches b
  join programmes.cohorts c on c.id = b.cohort_id
  join identity.profiles p on p.id = b.uploaded_by
  left join identity.import_rows r on r.batch_id = b.id
  where identity.has_role(auth.uid(), 'administrator')
  group by b.id, c.name, p.full_name
  order by b.created_at desc
$$;

revoke all on function api.list_import_batches() from public, anon, authenticated, service_role;
grant execute on function api.list_import_batches() to authenticated;

-- One batch's rows, optionally only one outcome ('ready' includes rows being imported).
create function api.get_import_rows(p_batch_id uuid, p_outcome text default null)
returns table (row_number integer, full_name text, email text, learner_number text, outcome text, problem text,
  invitation_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.row_number, r.full_name, r.email, r.learner_number, r.outcome, r.problem, r.invitation_state
  from identity.import_rows r
  where r.batch_id = p_batch_id
    and identity.has_role(auth.uid(), 'administrator')
    and (p_outcome is null or r.outcome = p_outcome or (p_outcome = 'ready' and r.outcome = 'importing'))
  order by r.row_number
$$;

revoke all on function api.get_import_rows(uuid, text) from public, anon, authenticated, service_role;
grant execute on function api.get_import_rows(uuid, text) to authenticated;

-- The cohorts an intake can be loaded into: every active cohort, for administrators (list_cohorts is scoped to
-- coordinators, and the administrator who imports may not coordinate any).
create function api.list_import_cohorts()
returns table (id uuid, name text, programme_title text, enrolled integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, p.title,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = c.id and e.status = 'active')
  from programmes.cohorts c
  join programmes.programmes p on p.id = c.programme_id
  where c.status = 'active' and identity.has_role(auth.uid(), 'administrator')
  order by p.title, c.starts_on desc, c.name
$$;

revoke all on function api.list_import_cohorts() from public, anon, authenticated, service_role;
grant execute on function api.list_import_cohorts() to authenticated;
