-- Establish only the module boundaries and least-privilege defaults.
-- Workflow tables and functions belong in later vertical-slice migrations.

create schema if not exists api;

do $migration$
declare
  module_schema text;
begin
  foreach module_schema in array array[
    'identity',
    'programmes',
    'learning',
    'submissions',
    'exams',
    'assessment',
    'moderation',
    'appeals',
    'credits',
    'notifications',
    'reporting',
    'department',
    'audit'
  ]
  loop
    execute format('create schema if not exists %I', module_schema);
    execute format('revoke all on schema %I from public, anon, authenticated', module_schema);
    execute format(
      'alter default privileges for role postgres in schema %I revoke execute on functions from public, anon, authenticated',
      module_schema
    );
    execute format(
      'alter default privileges for role postgres in schema %I revoke all on tables from anon, authenticated',
      module_schema
    );
    execute format(
      'alter default privileges for role postgres in schema %I revoke all on sequences from anon, authenticated',
      module_schema
    );
  end loop;
end
$migration$;

revoke all on schema api from public;
grant usage on schema api to anon, authenticated, service_role;

alter default privileges for role postgres in schema api
  revoke execute on functions from public;
