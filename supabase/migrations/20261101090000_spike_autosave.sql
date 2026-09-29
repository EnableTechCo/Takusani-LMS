-- Spike X-3 (S5-01; ADR-023, ADR-027): can a one-function autosave keep p95 at or under 500 ms for 250 clients in
-- South Africa? Throwaway: a later migration drops all of it once the measurement is written up.
--
-- The autosave here has the shape ADR-023 fixes for the real one (S5-06), so the timing is the real timing: one
-- database round trip that locks the attempt, checks its lease, state, acceptance window and cadence, and upserts the
-- batch, keeping an answer only when its client sequence is newer. The tables are in their own schema, reachable
-- only through the functions below, and only by the test accounts (@takusani.test).

create schema spike;
revoke all on schema spike from public, anon, authenticated, service_role;

create table spike.attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references identity.profiles (id),
  lease_id uuid not null default gen_random_uuid(),
  state text not null default 'in_progress' check (state in ('in_progress', 'submitted')),
  expires_at timestamptz not null,
  accept_until timestamptz not null,
  last_save_at timestamptz,
  created_at timestamptz not null default now()
);

create table spike.answers (
  attempt_id uuid not null references spike.attempts (id) on delete cascade,
  question_id integer not null,
  client_seq integer not null check (client_seq >= 1),
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index spike_attempts_owner_idx on spike.attempts (owner_id);

revoke all on table spike.attempts, spike.answers from public, anon, authenticated, service_role;

-- Only the shared test accounts may use the spike.
create function spike.is_test_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'email', '') like '%@takusani.test'
$$;

revoke all on function spike.is_test_account() from public, anon, authenticated, service_role;

-- Attempts for the load test: p_count of them, owned by the caller, open for p_minutes.
create function api.spike_prepare(p_count integer, p_minutes integer default 30)
returns table (attempt_id uuid, lease_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not spike.is_test_account() or p_count not between 1 and 500
     or p_minutes not between 1 and 120 then
    return;
  end if;
  return query
  insert into spike.attempts (owner_id, expires_at, accept_until)
  select auth.uid(), now() + make_interval(mins => p_minutes), now() + make_interval(mins => p_minutes, secs => 30)
  from generate_series(1, p_count)
  returning id, spike.attempts.lease_id;
end
$$;

-- One autosave batch: [{question_id, client_seq, payload}]. One round trip, whatever the size of the batch.
create function api.spike_autosave(p_attempt_id uuid, p_lease_id uuid, p_answers jsonb)
returns table (status text, saved integer)
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_attempt spike.attempts;
  v_saved integer;
begin
  if auth.uid() is null or not spike.is_test_account() then
    return query select 'forbidden'::text, 0; return;
  end if;
  select * into v_attempt from spike.attempts a where a.id = p_attempt_id and a.owner_id = auth.uid() for update;
  if not found then return query select 'not_found'::text, 0; return; end if;
  if v_attempt.lease_id <> p_lease_id then return query select 'lease_lost'::text, 0; return; end if;
  if v_attempt.state <> 'in_progress' then return query select 'not_in_progress'::text, 0; return; end if;
  if now() > v_attempt.accept_until then return query select 'expired'::text, 0; return; end if;
  -- The cadence the client is held to (ADR-023): one batch every few seconds at most.
  if v_attempt.last_save_at is not null and now() - v_attempt.last_save_at < interval '2 seconds' then
    return query select 'too_frequent'::text, 0; return;
  end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 200 then
    return query select 'invalid_batch'::text, 0; return;
  end if;

  -- A question named twice in one batch keeps its newest entry: one upsert cannot touch a row twice.
  with incoming as (
    select distinct on ((e ->> 'question_id')::integer)
           (e ->> 'question_id')::integer as question_id, (e ->> 'client_seq')::integer as client_seq,
           e -> 'payload' as payload
    from jsonb_array_elements(p_answers) e
    order by (e ->> 'question_id')::integer, (e ->> 'client_seq')::integer desc
  ),
  kept as (
    insert into spike.answers as a (attempt_id, question_id, client_seq, payload)
    select p_attempt_id, i.question_id, i.client_seq, i.payload from incoming i
    on conflict (attempt_id, question_id) do update
      set client_seq = excluded.client_seq, payload = excluded.payload, saved_at = now()
      where a.client_seq < excluded.client_seq
    returning 1
  )
  select count(*)::integer into v_saved from kept;

  update spike.attempts a set last_save_at = now() where a.id = p_attempt_id;
  return query select 'ok'::text, v_saved;
end
$$;

-- Removes the caller's spike attempts and answers after a run.
create function api.spike_cleanup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not spike.is_test_account() then return 0; end if;
  delete from spike.attempts a where a.owner_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function api.spike_prepare(integer, integer) from public, anon, authenticated, service_role;
revoke all on function api.spike_autosave(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function api.spike_cleanup() from public, anon, authenticated, service_role;
grant execute on function api.spike_prepare(integer, integer) to authenticated;
grant execute on function api.spike_autosave(uuid, uuid, jsonb) to authenticated;
grant execute on function api.spike_cleanup() to authenticated;
