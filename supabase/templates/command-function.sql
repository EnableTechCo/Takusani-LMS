-- Template: a user-initiated command. Replace <module>, <command>, and the body.
-- The caller's session runs it; the actor is auth.uid(); the result is typed; the audit row is written in the
-- same transaction. Delete this comment block in the real migration.

create type <module>.<command>_result as (
  status text,          -- 'ok', or a documented refusal such as 'state_conflict'
  resource_id uuid,
  version integer
);

create function <module>.<command>(p_resource_id uuid, p_expected_version integer, p_command_id uuid)
returns <module>.<command>_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result <module>.<command>_result;
begin
  if v_actor is null then
    return row('unauthenticated', null, null)::<module>.<command>_result;
  end if;

  -- 1. Authorise with the shared predicate (written once, also used by RLS and the application).
  -- 2. Lock rows in the documented order, e.g. select ... for update.
  -- 3. Check expected version and state; return a typed refusal instead of raising.
  -- 4. Make the change.
  -- 5. Append the audit event (and outbox row) in this transaction.

  return v_result;
end
$$;

revoke all on function <module>.<command>(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function <module>.<command>(uuid, integer, uuid) to authenticated;
-- Then add ('function', '<module>', '<command>(p_resource_id uuid, p_expected_version integer, p_command_id uuid)',
-- 'authenticated', 'EXECUTE') to supabase/tests/database/0002_privilege_allowlist.test.sql, with a pgTAP test for the command.
