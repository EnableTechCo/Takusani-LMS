-- ADR-028 (S1-17): no automatic RLS event trigger, and nothing of ours in `public`.
-- Domain tables live in module schemas that the Data API does not expose (ADR-024); `public` stays empty, so
-- there is nothing for an auto-RLS trigger to protect. Objects owned by extensions are Supabase's, not ours.
create extension if not exists pgtap with schema extensions;

begin;
select plan(4);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e') $$,
  'no tables or views in public: put them in their module schema'
);

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') $$,
  'no functions in public: put them in their module schema, or in api if the browser may call them'
);

select is_empty(
  $$ select evtname from pg_event_trigger where evtname = 'ensure_rls' $$,
  'the auto-RLS event trigger is not installed'
);

select hasnt_function('public', 'rls_auto_enable', 'the auto-RLS function is not installed');

select * from finish();
rollback;
