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
  ('function', 'api', 'create_account(p_user_id uuid, p_full_name text, p_role text, p_learner_number text)', 'authenticated', 'EXECUTE'),
  -- Audit log (20260923090000): administrators only, checked inside the function.
  ('function', 'api', 'list_audit_events(p_action text, p_actor_email text, p_object_id text, p_from timestamp with time zone, p_to timestamp with time zone, p_before_id bigint, p_limit integer)', 'authenticated', 'EXECUTE'),
  -- Programmes and cohorts (20260923120000): coordinators within scope, checked inside each function.
  ('function', 'api', 'create_programme(p_code text, p_title text, p_nqf_level smallint)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'create_qualification(p_programme_id uuid, p_code text, p_title text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'create_unit(p_qualification_id uuid, p_code text, p_title text, p_credits integer)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'create_module(p_programme_id uuid, p_code text, p_title text, p_unit_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'create_cohort(p_programme_id uuid, p_name text, p_starts_on date, p_ends_on date)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'enrol_learner(p_cohort_id uuid, p_email text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_programmes()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_cohorts()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_enrolments(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  -- Tasks (20260925090000): facilitators and coordinators within scope; list_my_tasks is the learner's own
  -- published work. Every function checks the caller inside itself.
  ('function', 'api', 'create_task(p_cohort_id uuid, p_title text, p_brief text, p_submission_type text, p_due_at timestamp with time zone, p_late_policy text, p_module_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'update_task(p_task_id uuid, p_title text, p_brief text, p_submission_type text, p_due_at timestamp with time zone, p_late_policy text, p_module_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'set_task_criteria(p_task_id uuid, p_criteria jsonb)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'set_task_audience(p_task_id uuid, p_audience text, p_emails text[])', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'publish_task(p_task_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_tasks(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_task(p_task_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_tasks()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_work_cohorts()', 'authenticated', 'EXECUTE'),
  -- Uploads (20260926090000): the learner authorises and finalises their own uploads. may_upload_object is the
  -- storage policy's own check, which Postgres runs as the signed-in role, so that role needs EXECUTE on it.
  ('function', 'api', 'authorise_upload(p_context_type text, p_context_id uuid, p_filename text, p_media_type text, p_bytes bigint, p_sha256 text, p_client_upload_id uuid, p_requirement_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'finalise_upload(p_intent_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_uploads(p_task_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'submissions', 'may_upload_object(p_profile_id uuid, p_bucket text, p_object_key text)', 'authenticated', 'EXECUTE'),
  -- Submissions (20260927090000): the learner hands their own work in; requirements are set by whoever sets the work.
  ('function', 'api', 'set_task_requirements(p_task_id uuid, p_requirements jsonb)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'submit_task(p_task_id uuid, p_files jsonb, p_client_submission_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_my_task(p_task_id uuid)', 'authenticated', 'EXECUTE'),
  -- Marking (20260930090000): assessors within scope, checked inside each function. may_read_evidence is the storage
  -- policy's own check, which runs as the signed-in role.
  ('function', 'api', 'list_marking_queue(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_marking_item(p_instance_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'take_marking(p_instance_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'save_marking_draft(p_instance_id uuid, p_expected_version integer, p_scores jsonb, p_feedback text, p_outcome text, p_justification text, p_remediation text, p_resubmission_days integer)', 'authenticated', 'EXECUTE'),
  ('function', 'assessment', 'may_read_evidence(p_profile_id uuid, p_bucket text, p_object_key text)', 'authenticated', 'EXECUTE'),
  ('function', 'submissions', 'owns_upload(p_profile_id uuid, p_bucket text, p_object_key text)', 'authenticated', 'EXECUTE'),
  -- Finalising (20261001090000): the allocated assessor only, checked inside the function.
  ('function', 'api', 'finalise_decision(p_instance_id uuid, p_expected_draft_version integer)', 'authenticated', 'EXECUTE'),
  -- Discarding an unsubmitted upload (20261002090000): the uploader only, checked inside the function.
  ('function', 'api', 'discard_upload(p_file_id uuid)', 'authenticated', 'EXECUTE'),
  -- The learner's results (20261003090000): the learner's own only, checked inside each function.
  ('function', 'api', 'get_my_result(p_result_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_results()', 'authenticated', 'EXECUTE'),
  -- The notification centre (20261005090000): the signed-in person's own notifications only.
  ('function', 'api', 'list_my_notifications(p_category text, p_page integer, p_page_size integer)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'my_unread_notification_count()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'open_my_notification(p_notification_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'mark_my_notifications_read(p_category text)', 'authenticated', 'EXECUTE'),
  -- Learner home (20261006090000): the signed-in learner's own enrolments.
  ('function', 'api', 'list_my_enrolments()', 'authenticated', 'EXECUTE');

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
