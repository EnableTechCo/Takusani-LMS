-- Sprint 1 alignment with ADR-024 (Data API exposure) and the append-only rule in LMS-data-model.md.
--
-- 1. Objects created by mistake in `public` must not be granted to anon or authenticated by default.
--    Supabase grants them in `public` out of the box; `public` is not exposed, but a default grant is still
--    one dashboard setting away from exposure.
-- 2. `api` default privileges: revoke from anon and authenticated explicitly, not only from PUBLIC, so every
--    grant in the exposed schema is deliberate and appears in the privilege allow-list test.
-- 3. `api.health_check()`: the one function the readiness probe calls with the publishable key.
-- 4. `audit.forbid_mutation()`: the trigger every append-only table attaches (see supabase/templates).
--
-- Why a global revoke: PostgreSQL grants EXECUTE on new functions to PUBLIC by a *global* default, and a
-- per-schema ALTER DEFAULT PRIVILEGES cannot remove a global default (only add to it). The per-schema revokes
-- in 20260921000000_module_boundaries.sql therefore left new functions in `api` executable by anon through
-- PUBLIC. Revoking globally for objects created by `postgres` closes that, so every function grant is explicit.

alter default privileges for role postgres revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema api revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema api revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema api revoke all on sequences from anon, authenticated;

create function api.health_check()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true
$$;

comment on function api.health_check() is
  'Readiness probe for /api/health/ready. Returns true. Granted to anon on purpose; listed in the privilege allow-list.';

revoke all on function api.health_check() from public;
grant execute on function api.health_check() to anon, authenticated;

create function audit.forbid_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% on %.% is not allowed: the table is append-only', tg_op, tg_table_schema, tg_table_name
    using errcode = 'insufficient_privilege',
          hint = 'Correct history by inserting a new record that supersedes the old one.';
end
$$;

comment on function audit.forbid_mutation() is
  'Attach BEFORE UPDATE OR DELETE (row) and BEFORE TRUNCATE (statement) to every append-only table. Revoking UPDATE and DELETE is not enough on its own: it does not bind service_role or SECURITY DEFINER functions.';

revoke all on function audit.forbid_mutation() from public, anon, authenticated;
