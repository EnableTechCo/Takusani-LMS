-- Template: an append-only table (decisions, ledger entries, audit events, submission versions ...).
-- Both mechanisms are required: revocation does not bind service_role or SECURITY DEFINER functions,
-- and the trigger does. Replace <module> and <table>. Delete this comment block in the real migration.

create table <module>.<table> (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
  -- columns ...
);

revoke update, delete, truncate on <module>.<table> from public, anon, authenticated, service_role;

create trigger <table>_append_only
  before update or delete on <module>.<table>
  for each row execute function audit.forbid_mutation();

create trigger <table>_append_only_truncate
  before truncate on <module>.<table>
  for each statement execute function audit.forbid_mutation();
