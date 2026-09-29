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
  ('function', 'api', 'list_my_enrolments()', 'authenticated', 'EXECUTE'),
  -- Bulk learner import (20261007090000): administrators only, checked inside each function.
  ('function', 'api', 'create_import_batch(p_cohort_id uuid, p_file_name text, p_file_digest text, p_rows jsonb)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'claim_import_chunk(p_batch_id uuid, p_size integer)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'complete_import_chunk(p_batch_id uuid, p_results jsonb)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'cancel_import_batch(p_batch_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_import_batches()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_import_rows(p_batch_id uuid, p_outcome text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_import_cohorts()', 'authenticated', 'EXECUTE'),
  -- Learning materials (20261008090000): facilitators within their cohorts, learners for released material only,
  -- each checked inside the function. may_read_material is the storage policy's own check, run as the signed-in role.
  ('function', 'api', 'create_material(p_cohort_id uuid, p_title text, p_description text, p_module_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'update_material(p_material_id uuid, p_title text, p_description text, p_module_id uuid, p_link_url text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'attach_material_file(p_material_id uuid, p_file_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'publish_material(p_material_id uuid, p_release_at timestamp with time zone)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'archive_material(p_material_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_materials()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_material(p_material_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_cohort_modules(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_materials(p_search text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_my_material(p_material_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'log_material_access(p_material_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'learning', 'may_read_material(p_profile_id uuid, p_bucket text, p_object_key text)', 'authenticated', 'EXECUTE'),
  -- Sessions (20261009090000): facilitators within their cohorts, learners for their own cohorts, checked inside each.
  ('function', 'api', 'create_session(p_cohort_id uuid, p_title text, p_starts_at timestamp with time zone, p_duration_minutes integer, p_mode text, p_teams_url text, p_venue text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'update_session(p_session_id uuid, p_expected_version integer, p_title text, p_starts_at timestamp with time zone, p_duration_minutes integer, p_mode text, p_teams_url text, p_venue text, p_rest_of_series boolean)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'cancel_session(p_session_id uuid, p_reason text, p_rest_of_series boolean)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'create_session_series(p_cohort_id uuid, p_title text, p_starts_at timestamp with time zone, p_duration_minutes integer, p_mode text, p_repeat text, p_count integer, p_teams_url text, p_venue text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_sessions()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'cohort_audience_size(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_sessions(p_from timestamp with time zone)', 'authenticated', 'EXECUTE'),
  -- Submission dashboard and reminders (20261010090000): facilitators within their cohorts, checked inside each.
  ('function', 'api', 'list_task_submission_counts(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_task_submissions(p_task_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_learner_submission_history(p_learner_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'send_task_reminder(p_task_id uuid, p_learner_ids uuid[], p_message text)', 'authenticated', 'EXECUTE'),
  -- Coordinator notices (20261011090000): coordinators within scope, checked inside each function.
  ('function', 'api', 'create_notice(p_title text, p_body text, p_audience text, p_cohort_id uuid, p_role text, p_send_at timestamp with time zone)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'cancel_notice(p_notice_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_notices()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_notice(p_notice_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_notice_deliveries(p_notice_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'my_notice_audiences()', 'authenticated', 'EXECUTE'),
  -- Lodging an appeal (20261012090000): the learner's own released results; coordinators within scope, checked
  -- inside each function.
  ('function', 'api', 'lodge_appeal(p_result_id uuid, p_type text, p_grounds text, p_client_appeal_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_appeal_options(p_result_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_appeals()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_my_appeal(p_appeal_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_appeals_to_coordinate()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_appeal_to_coordinate(p_appeal_id uuid)', 'authenticated', 'EXECUTE'),
  -- Appeals administration (20261013090000): coordinators of the appeal's cohort, checked inside each function.
  ('function', 'api', 'decide_appeal_admissibility(p_appeal_id uuid, p_admit boolean, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'allocate_appeal_reviewer(p_appeal_id uuid, p_reviewer_id uuid, p_skip_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_appeal_reviewer_candidates(p_appeal_id uuid)', 'authenticated', 'EXECUTE'),
  -- The marked work (20261014090000): the learner's own granted request, checked inside the function.
  ('function', 'api', 'view_my_marked_work(p_appeal_id uuid)', 'authenticated', 'EXECUTE'),
  -- Appeal review (20261015090000): the allocated reviewer, checked inside each function. The storage rule needs the
  -- signed-in role to run its check, as with the assessors' evidence rule.
  ('function', 'api', 'list_my_reviews()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'open_appeal_review(p_appeal_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'conclude_appeal(p_appeal_id uuid, p_outcome text, p_scores jsonb, p_reasons text, p_remediation text, p_resubmission_days integer, p_command_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'appeals', 'may_read_review_evidence(p_profile_id uuid, p_bucket text, p_object_key text)', 'authenticated', 'EXECUTE'),
  -- Sign-in lockout (20261017090000): clearing your own lock after email recovery; administrators unlock and list,
  -- checked inside. The sign-in handler's counting functions are service_role only and so are not listed here.
  ('function', 'api', 'clear_my_sign_in_lock()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'unlock_account(p_profile_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_sign_in_locks()', 'authenticated', 'EXECUTE'),
  -- Role administration (20261018090000): administrators, and coordinators within scope for the teaching roles,
  -- checked inside each function; the account reads are administrators only.
  ('function', 'api', 'assign_role(p_profile_id uuid, p_role text, p_scope_type text, p_scope_key uuid, p_until timestamp with time zone)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'end_role(p_assignment_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_account(p_profile_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_account_role_assignments(p_profile_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_account_open_allocations(p_profile_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_account_history(p_profile_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_role_scopes()', 'authenticated', 'EXECUTE'),
  -- Account administration (20261019090000): administrators, checked inside each function. check_request is the
  -- API's pre-request hook, run as the request's role before every call; it refuses a deactivated account.
  ('function', 'api', 'update_account(p_profile_id uuid, p_full_name text, p_learner_number text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'deactivate_account(p_profile_id uuid, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'reactivate_account(p_profile_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'record_password_reset(p_profile_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'check_request()', 'anon', 'EXECUTE'),
  ('function', 'api', 'check_request()', 'authenticated', 'EXECUTE'),
  -- Versioned configuration (20261020090000): administrators, checked inside each function; public_settings gives any
  -- signed-in person the few non-sensitive values the application states (late work, upload size, appeal window).
  ('function', 'api', 'record_configuration_version(p_key text, p_value text, p_effective_on date, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'cancel_configuration_version(p_key text, p_version integer, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'set_unit_credit_value(p_unit_id uuid, p_credits integer, p_effective_on date, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_configuration()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_configuration_key(p_key text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_unit_credit_values()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_unit_credit_history(p_unit_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'public_settings()', 'authenticated', 'EXECUTE'),
  -- Register and recordings (20261023090000): whoever sets work in the cohort, checked inside each function.
  ('function', 'api', 'save_register(p_session_id uuid, p_marks jsonb, p_expected_version integer, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_register(p_session_id uuid)', 'authenticated', 'EXECUTE'),
  -- Self-marked attendance (20261110090000): the learner's own check-in and record; a cohort's attendance for whoever
  -- sets work in it or coordinates it, checked inside each function (test 0050).
  ('function', 'api', 'mark_my_attendance(p_session_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_attendance()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_cohort_attendance(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_cohort_registers(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'create_recording(p_cohort_id uuid, p_title text, p_description text, p_module_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'set_recording_captions(p_material_id uuid, p_has_captions boolean)', 'authenticated', 'EXECUTE'),
  -- Calendar feed (20261024090000): the learner manages their own token; the feed itself is authenticated by its token,
  -- because a calendar app has no session, so anon may call it.
  ('function', 'api', 'issue_calendar_feed_token()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'revoke_calendar_feed_token()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'my_calendar_feed()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'calendar_feed(p_token text, p_client text)', 'anon', 'EXECUTE'),
  ('function', 'api', 'calendar_feed(p_token text, p_client text)', 'authenticated', 'EXECUTE'),
  -- Learner notes (20261025090000): each acts on the caller's own notes only (FR-307; test 0037 is the contract).
  ('function', 'api', 'create_note(p_title text, p_body text, p_folder text, p_material_id uuid, p_session_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'update_note(p_note_id uuid, p_expected_version integer, p_title text, p_body text, p_folder text, p_material_id uuid, p_session_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'delete_note(p_note_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_notes(p_search text, p_folder text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_note_folders()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_my_note(p_note_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_note_link_targets()', 'authenticated', 'EXECUTE'),
  -- Cohort setup (20261026090000): coordinators of the cohort, checked inside each function.
  ('function', 'api', 'set_moderation_policy(p_cohort_id uuid, p_policy text, p_expected_version integer, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_cohort_setup(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_moderation_policy_history(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'activate_cohort(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_cohort_readiness(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'assign_readiness_item(p_cohort_id uuid, p_item_key text, p_assignee_id uuid, p_due_on date, p_note text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_cohort_staff(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'assign_cohort_role(p_cohort_id uuid, p_email text, p_role text, p_until timestamp with time zone)', 'authenticated', 'EXECUTE'),
  -- Formative quizzes (20261028090000): facilitators for the bank and quizzes, learners for their own attempts;
  -- each checked inside. Answer keys are read only inside these functions (test 0040).
  ('function', 'api', 'save_question(p_question_id uuid, p_programme_id uuid, p_prompt text, p_kind text, p_options jsonb, p_feedback_correct text, p_feedback_incorrect text, p_module_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_question_bank(p_programme_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'create_quiz(p_cohort_id uuid, p_title text, p_description text, p_attempt_limit integer, p_module_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'update_quiz(p_quiz_id uuid, p_title text, p_description text, p_attempt_limit integer, p_questions jsonb)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'publish_quiz(p_quiz_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'archive_quiz(p_quiz_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_quizzes()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_quiz(p_quiz_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_quizzes()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_my_quiz(p_quiz_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'start_quiz_attempt(p_quiz_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_my_quiz_attempt(p_attempt_id uuid)', 'authenticated', 'EXECUTE'),
  -- Assessor release status (20261029090000): the caller's own decisions in cohorts they assess (test 0041).
  ('function', 'api', 'list_my_release_status()', 'authenticated', 'EXECUTE'),
  -- Inactivity sign-out (20261031090000): the limit that applies to the caller; nothing without a user (test 0042).
  ('function', 'api', 'get_session_policy()', 'authenticated', 'EXECUTE'),
  -- Stakeholder queries and session logistics (20261103090000): coordinators in scope, checked inside (test 0043).
  ('function', 'api', 'log_stakeholder_query(p_programme_id uuid, p_cohort_id uuid, p_source_type text, p_source_name text, p_contact text, p_subject text, p_details text, p_due_on date)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'route_stakeholder_query(p_query_id uuid, p_owner_id uuid, p_note text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'act_on_stakeholder_query(p_query_id uuid, p_action text, p_note text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_stakeholder_queries(p_show text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_stakeholder_query(p_query_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_session_logistics()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_session_logistics(p_session_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'save_session_logistics(p_session_id uuid, p_expected_version integer, p_venue_note text, p_venue_arranged boolean, p_catering_needed boolean, p_headcount integer, p_dietary text, p_catering_arranged boolean, p_equipment text, p_equipment_arranged boolean)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'reconcile_logistics_variance(p_session_id uuid, p_note text)', 'authenticated', 'EXECUTE'),
  -- Moderation cycles (20261107090000): coordinators in scope, checked inside (test 0047).
  ('function', 'api', 'plan_moderation_cycle(p_cohort_id uuid, p_name text, p_item_ids uuid[], p_unit_ids uuid[], p_period_from date, p_period_to date, p_scheduled_start_at timestamp with time zone)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'cancel_moderation_cycle(p_cycle_id uuid, p_expected_version integer, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_moderation_cycles(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_moderation_pool(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_moderation_summary(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  -- Freeze and sample (20261108090000): coordinators in scope, checked inside (test 0048).
  ('function', 'api', 'freeze_moderation_cycle(p_cycle_id uuid, p_expected_version integer, p_seed text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_moderation_sample(p_cycle_id uuid)', 'authenticated', 'EXECUTE'),
  -- Sample item review and allocation (20261109090000): moderators on their items, coordinators in scope (test 0049).
  ('function', 'api', 'list_my_moderation_cycles()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_sample_items(p_cycle_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'open_sample_item(p_item_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_moderation_observations(p_cycle_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'record_moderation_finding(p_item_id uuid, p_finding text, p_reasons text, p_corrections text, p_due_on date)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'record_moderation_observation(p_cycle_id uuid, p_body text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_cycle_sample_items(p_cycle_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_sample_moderator_candidates(p_item_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'reallocate_sample_item(p_item_id uuid, p_moderator_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'moderation', 'may_read_sample_evidence(p_profile_id uuid, p_bucket text, p_object_key text)', 'authenticated', 'EXECUTE'),
  -- Return for re-marking (20261111090000): the assessor's own returned items and re-mark, checked inside (test 0051).
  ('function', 'api', 'start_remark(p_instance_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_returned_items()', 'authenticated', 'EXECUTE'),
  -- Sign-off and release (20261112090000): a moderator of the cohort who assessed none of the population, checked
  -- inside (test 0052).
  ('function', 'api', 'get_sign_off(p_cycle_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'sign_off_moderation_cycle(p_cycle_id uuid, p_expected_version integer, p_statement text)', 'authenticated', 'EXECUTE'),
  -- Moderation planning (20261113090000): coordinators of the cohort, checked inside (test 0054).
  ('function', 'api', 'list_moderation_moderators(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  -- Result corrections (20261114090000): coordinators of the cohort or administrators, under dual control, checked
  -- inside; the learner reads only whether their own result was corrected (test 0055).
  ('function', 'api', 'list_correctable_results(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_corrections()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_correction(p_correction_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_my_result_correction(p_result_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'propose_correction(p_result_id uuid, p_outcome text, p_justification text, p_reason text, p_remediation text, p_resubmission_days integer)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'conclude_correction(p_correction_id uuid, p_approve boolean, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'withdraw_correction(p_correction_id uuid)', 'authenticated', 'EXECUTE'),
  -- Unit credit requirements (20261115090000): coordinators of the cohort, checked inside each function; the
  -- reconciliation read is administrators only.
  ('function', 'api', 'save_requirement_draft(p_cohort_id uuid, p_requirements jsonb)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'discard_requirement_draft(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'freeze_requirement_set(p_cohort_id uuid, p_requirement_set_id uuid, p_reason text)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_cohort_credit_requirements(p_cohort_id uuid)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'get_credit_reconciliation()', 'authenticated', 'EXECUTE'),
  -- The learner's credits record (20261116090000): their own units and ledger only.
  ('function', 'api', 'get_my_credits()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_credit_history()', 'authenticated', 'EXECUTE'),
  -- Reports and exports (20261117090000): coordinators, scoped to the cohorts they coordinate; an export is the
  -- requester's own.
  ('function', 'api', 'list_report_types()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'run_report(p_type text, p_programme_id uuid, p_cohort_id uuid, p_from date, p_to date)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'request_report_export(p_type text, p_programme_id uuid, p_cohort_id uuid, p_from date, p_to date)', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'list_my_report_exports()', 'authenticated', 'EXECUTE'),
  ('function', 'api', 'download_report_export(p_export_id uuid)', 'authenticated', 'EXECUTE');

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
