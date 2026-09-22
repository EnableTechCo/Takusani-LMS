-- S1-17, ADR-028: remove Supabase's auto-RLS option from every environment.
--
-- The staging project was created with "enable RLS on new tables" ticked, which installed the event trigger
-- `ensure_rls` and its function `public.rls_auto_enable()`. They were never in our migrations, so local and CI
-- databases lacked them and staging differed from both. The function only acts on tables created in `public`,
-- a schema we never put tables in and do not expose (ADR-024, confirmed by the X-1 check), so it protected
-- nothing. It was also a SECURITY DEFINER function executable by anon and authenticated.
--
-- Nothing replaces it: domain tables live in unexposed module schemas and are reached only through `api`
-- functions. supabase/tests/database/0008_public_schema_empty.test.sql keeps `public` empty and checks the
-- trigger stays gone. `if exists` makes this a no-op locally and in CI.
drop event trigger if exists ensure_rls;
drop function if exists public.rls_auto_enable();
