-- ADR-024 point 10: enumerate every table, sequence and function privilege held by anon and authenticated
-- in the application schemas, and fail on anything not in the allow-list below. Adding a grant means adding
-- a row here in the same pull request, so every exposure is reviewed.
create extension if not exists pgtap with schema extensions;

begin;
select plan(8);

create temporary table expected_grants (kind text, schema_name text, object_name text, grantee text, privilege text) on commit drop;
insert into expected_grants values
  ('function', 'api', 'health_check()', 'anon', 'EXECUTE'),
  ('function', 'api', 'health_check()', 'authenticated', 'EXECUTE'),
  -- Identity (20260922130000): the signed-in person's access; administrator-only reads and commands check the
  -- caller inside the function.
  ('function', 'api', 'my_access()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_accounts()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'create_account(p_user_id uuid, p_full_name text, p_role text, p_learner_number text)', 'authenticated', 'EXECUTE');

create temporary view actual_grants as
with app_schemas(schema_name) as (
  values ('public'), ('api'), ('identity'), ('programmes'), ('learning'), ('submissions'), ('exams'),
         ('assessment'), ('moderation'), ('appeals'), ('credits'), ('notifications'), ('reporting'),
         ('department'), ('audit')
),
roles(grantee) as (values ('anon'), ('authenticated')),
extension_owned as (
  select objid from pg_catalog.pg_depend where deptype = 'e'
)
select 'table' as kind, n.nspname::text as schema_name, c.relname::text as object_name, r.grantee, p.privilege
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join roles r
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege)
where n.nspname in (select schema_name from app_schemas)
  and c.relkind in ('r', 'v', 'm', 'p', 'f')
  and c.oid not in (select objid from extension_owned)
  and has_table_privilege(r.grantee, c.oid, p.privilege)
union all
select 'sequence', n.nspname::text, c.relname::text, r.grantee, p.privilege
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join roles r
cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) p(privilege)
where n.nspname in (select schema_name from app_schemas)
  and c.relkind = 'S'
  and c.oid not in (select objid from extension_owned)
  and has_sequence_privilege(r.grantee, c.oid, p.privilege)
union all
select 'function', n.nspname::text, (f.proname || '(' || pg_catalog.pg_get_function_identity_arguments(f.oid) || ')')::text, r.grantee, 'EXECUTE'
from pg_catalog.pg_proc f
join pg_catalog.pg_namespace n on n.oid = f.pronamespace
cross join roles r
where n.nspname in (select schema_name from app_schemas)
  and f.oid not in (select objid from extension_owned)
  and has_function_privilege(r.grantee, f.oid, 'EXECUTE');

select is_empty(
  $$ select * from actual_grants except select * from expected_grants $$,
  'anon and authenticated hold no privilege outside the allow-list'
);

select is_empty(
  $$ select * from expected_grants except select * from actual_grants $$,
  'every allow-listed grant actually exists (the allow-list is not stale)'
);

-- Default privileges: objects created later must start with no access for anon or authenticated.
create function api.zz_probe() returns integer language sql as $$ select 1 $$;
create table api.zz_probe_table (id integer);
create function identity.zz_probe() returns integer language sql as $$ select 1 $$;
create table identity.zz_probe_table (id integer);
create function public.zz_probe() returns integer language sql as $$ select 1 $$;
create table public.zz_probe_table (id integer);

select ok(not has_function_privilege('anon', 'api.zz_probe()', 'EXECUTE'), 'a new function in api is not executable by anon');
select ok(not has_function_privilege('authenticated', 'api.zz_probe()', 'EXECUTE'), 'a new function in api is not executable by authenticated');
select ok(not has_table_privilege('anon', 'api.zz_probe_table', 'SELECT'), 'a new table in api is not readable by anon');
select ok(not has_table_privilege('authenticated', 'identity.zz_probe_table', 'SELECT'), 'a new table in a module schema is not readable by authenticated');
select ok(not has_table_privilege('authenticated', 'public.zz_probe_table', 'SELECT'), 'a new table in public is not readable by authenticated');
select ok(not has_function_privilege('anon', 'public.zz_probe()', 'EXECUTE'), 'a new function in public is not executable by anon');

select * from finish();
rollback;
