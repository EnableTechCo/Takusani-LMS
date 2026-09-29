export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      act_on_stakeholder_query: {
        Args: { p_action: string; p_note?: string; p_query_id: string }
        Returns: {
          status: string
        }[]
      }
      activate_cohort: {
        Args: { p_cohort_id: string }
        Returns: {
          learners: number
          missing: string[]
          status: string
        }[]
      }
      allocate_appeal_reviewer: {
        Args: {
          p_appeal_id: string
          p_reviewer_id: string
          p_skip_reason?: string
        }
        Returns: {
          conflicts: Json
          status: string
        }[]
      }
      archive_material: {
        Args: { p_material_id: string }
        Returns: {
          status: string
        }[]
      }
      archive_quiz: {
        Args: { p_quiz_id: string }
        Returns: {
          status: string
        }[]
      }
      assign_cohort_role: {
        Args: {
          p_cohort_id: string
          p_email: string
          p_role: string
          p_until?: string
        }
        Returns: {
          advisories: Json
          assignment_id: string
          profile_id: string
          status: string
        }[]
      }
      assign_readiness_item: {
        Args: {
          p_assignee_id: string
          p_cohort_id: string
          p_due_on?: string
          p_item_key: string
          p_note?: string
        }
        Returns: {
          status: string
        }[]
      }
      assign_role: {
        Args: {
          p_profile_id: string
          p_role: string
          p_scope_key?: string
          p_scope_type: string
          p_until?: string
        }
        Returns: {
          advisories: Json
          assignment_id: string
          status: string
        }[]
      }
      attach_material_file: {
        Args: { p_file_id: string; p_material_id: string }
        Returns: {
          status: string
        }[]
      }
      authorise_upload: {
        Args: {
          p_bytes: number
          p_client_upload_id?: string
          p_context_id: string
          p_context_type: string
          p_filename: string
          p_media_type: string
          p_requirement_id?: string
          p_sha256?: string
        }
        Returns: {
          bucket: string
          expires_at: string
          intent_id: string
          max_bytes: number
          object_key: string
          status: string
        }[]
      }
      calendar_feed: {
        Args: { p_client?: string; p_token: string }
        Returns: {
          events: Json
          status: string
        }[]
      }
      cancel_configuration_version: {
        Args: { p_key: string; p_reason: string; p_version: number }
        Returns: {
          status: string
        }[]
      }
      cancel_import_batch: {
        Args: { p_batch_id: string }
        Returns: {
          status: string
        }[]
      }
      cancel_moderation_cycle: {
        Args: {
          p_cycle_id: string
          p_expected_version: number
          p_reason: string
        }
        Returns: {
          status: string
        }[]
      }
      cancel_notice: {
        Args: { p_notice_id: string }
        Returns: {
          status: string
        }[]
      }
      cancel_session: {
        Args: {
          p_reason: string
          p_rest_of_series?: boolean
          p_session_id: string
        }
        Returns: {
          cancelled: number
          notified: number
          status: string
        }[]
      }
      check_request: { Args: never; Returns: undefined }
      claim_file_scans: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_max_attempts?: number
        }
        Returns: {
          allowed_media_types: string[]
          attempt: number
          bucket: string
          bytes: number
          declared_sha256: string
          file_id: string
          object_key: string
        }[]
      }
      claim_import_chunk: {
        Args: { p_batch_id: string; p_size?: number }
        Returns: {
          email: string
          full_name: string
          row_number: number
        }[]
      }
      claim_notification_deliveries: {
        Args: {
          p_limit?: number
          p_max_attempts?: number
          p_visibility_seconds?: number
        }
        Returns: {
          address: string
          attempt: number
          delivery_id: string
          event_type: string
          idempotency_key: string
          link: string
          msg_id: number
          payload: Json
          recipient_name: string
          template_version: number
        }[]
      }
      clear_my_sign_in_lock: {
        Args: never
        Returns: {
          status: string
        }[]
      }
      cohort_audience_size: { Args: { p_cohort_id: string }; Returns: number }
      complete_import_chunk: {
        Args: { p_batch_id: string; p_results: Json }
        Returns: {
          failed: number
          imported: number
          remaining: number
          status: string
        }[]
      }
      conclude_appeal: {
        Args: {
          p_appeal_id: string
          p_command_id?: string
          p_outcome: string
          p_reasons: string
          p_remediation?: string
          p_resubmission_days?: number
          p_scores: Json
        }
        Returns: {
          decision_id: string
          outcome_category: string
          status: string
        }[]
      }
      create_account: {
        Args: {
          p_full_name: string
          p_learner_number?: string
          p_role: string
          p_user_id: string
        }
        Returns: {
          profile_id: string
          status: string
        }[]
      }
      create_cohort: {
        Args: {
          p_ends_on: string
          p_name: string
          p_programme_id: string
          p_starts_on: string
        }
        Returns: {
          cohort_id: string
          status: string
        }[]
      }
      create_import_batch: {
        Args: {
          p_cohort_id: string
          p_file_digest: string
          p_file_name: string
          p_rows: Json
        }
        Returns: {
          batch_id: string
          detail: Json
          status: string
        }[]
      }
      create_material: {
        Args: {
          p_cohort_id: string
          p_description?: string
          p_module_id?: string
          p_title: string
        }
        Returns: {
          material_id: string
          status: string
        }[]
      }
      create_module: {
        Args: {
          p_code: string
          p_programme_id: string
          p_title: string
          p_unit_id?: string
        }
        Returns: {
          module_id: string
          status: string
        }[]
      }
      create_note: {
        Args: {
          p_body?: string
          p_folder?: string
          p_material_id?: string
          p_session_id?: string
          p_title: string
        }
        Returns: {
          note_id: string
          status: string
        }[]
      }
      create_notice: {
        Args: {
          p_audience: string
          p_body: string
          p_cohort_id?: string
          p_role?: string
          p_send_at?: string
          p_title: string
        }
        Returns: {
          notice_id: string
          recipients: number
          scheduled: boolean
          status: string
        }[]
      }
      create_programme: {
        Args: { p_code: string; p_nqf_level?: number; p_title: string }
        Returns: {
          programme_id: string
          status: string
        }[]
      }
      create_qualification: {
        Args: { p_code: string; p_programme_id: string; p_title: string }
        Returns: {
          qualification_id: string
          status: string
        }[]
      }
      create_quiz: {
        Args: {
          p_attempt_limit?: number
          p_cohort_id: string
          p_description?: string
          p_module_id?: string
          p_title: string
        }
        Returns: {
          quiz_id: string
          status: string
        }[]
      }
      create_recording: {
        Args: {
          p_cohort_id: string
          p_description?: string
          p_module_id?: string
          p_title: string
        }
        Returns: {
          material_id: string
          status: string
        }[]
      }
      create_session: {
        Args: {
          p_cohort_id: string
          p_duration_minutes: number
          p_mode: string
          p_starts_at: string
          p_teams_url?: string
          p_title: string
          p_venue?: string
        }
        Returns: {
          notified: number
          session_id: string
          status: string
        }[]
      }
      create_session_series: {
        Args: {
          p_cohort_id: string
          p_count: number
          p_duration_minutes: number
          p_mode: string
          p_repeat: string
          p_starts_at: string
          p_teams_url?: string
          p_title: string
          p_venue?: string
        }
        Returns: {
          notified: number
          session_id: string
          sessions: number
          status: string
        }[]
      }
      create_task: {
        Args: {
          p_brief: string
          p_cohort_id: string
          p_due_at?: string
          p_late_policy?: string
          p_module_id?: string
          p_submission_type?: string
          p_title: string
        }
        Returns: {
          status: string
          task_id: string
        }[]
      }
      create_unit: {
        Args: {
          p_code: string
          p_credits: number
          p_qualification_id: string
          p_title: string
        }
        Returns: {
          status: string
          unit_id: string
        }[]
      }
      deactivate_account: {
        Args: { p_profile_id: string; p_reason?: string }
        Returns: {
          allocations: Json
          status: string
        }[]
      }
      decide_appeal_admissibility: {
        Args: { p_admit: boolean; p_appeal_id: string; p_reason?: string }
        Returns: {
          status: string
        }[]
      }
      delete_note: {
        Args: { p_note_id: string }
        Returns: {
          status: string
        }[]
      }
      discard_upload: {
        Args: { p_file_id: string }
        Returns: {
          status: string
        }[]
      }
      end_role: {
        Args: { p_assignment_id: string }
        Returns: {
          allocations: Json
          status: string
        }[]
      }
      enrol_learner: {
        Args: { p_cohort_id: string; p_email: string }
        Returns: {
          enrolment_id: string
          status: string
        }[]
      }
      finalise_decision: {
        Args: { p_expected_draft_version: number; p_instance_id: string }
        Returns: {
          appeal_deadline_at: string
          decision_id: string
          detail: string
          released_at: string
          remediation_deadline_at: string
          result_state: string
          status: string
        }[]
      }
      finalise_upload: {
        Args: { p_intent_id: string }
        Returns: {
          bytes: number
          file_id: string
          media_type: string
          status: string
        }[]
      }
      freeze_moderation_cycle: {
        Args: {
          p_cycle_id: string
          p_expected_version: number
          p_seed?: string
        }
        Returns: {
          population: number
          sample: number
          status: string
        }[]
      }
      get_account: {
        Args: { p_profile_id: string }
        Returns: {
          email: string
          full_name: string
          learner_number: string
          locked_until: string
          profile_id: string
          status: string
        }[]
      }
      get_appeal_options: {
        Args: { p_result_id: string }
        Returns: {
          appeal_deadline_at: string
          assessed_version_number: number
          cohort_name: string
          coordinator_names: string[]
          decision_final: boolean
          item_title: string
          learner_name: string
          learner_number: string
          open_script_appeal_id: string
          open_script_reference: string
          outcome: string
          points_possible: number
          points_scored: number
          released_at: string
          remark_appeal_id: string
          remark_lodged_at: string
          remark_reference: string
          remark_standing: string
          remediation_deadline_at: string
          result_id: string
          turnaround_working_days: number
        }[]
      }
      get_appeal_to_coordinate: {
        Args: { p_appeal_id: string }
        Returns: {
          admissibility: string
          admissibility_decided_at: string
          admissibility_decided_by_name: string
          admissibility_reason: string
          allocated_at: string
          appealed_outcome: string
          assessor_name: string
          cohort_name: string
          concluded_at: string
          deadline_at: string
          decisions: Json
          events: Json
          grounds: string
          id: string
          item_title: string
          learner_name: string
          learner_number: string
          lodged_at: string
          outcome_category: string
          points_possible: number
          points_scored: number
          reference: string
          released_at: string
          result_id: string
          review_opened_at: string
          reviewer_id: string
          reviewer_name: string
          reviewer_tier: number
          state: string
          turnaround_working_days: number
          type: string
        }[]
      }
      get_cohort_attendance: {
        Args: { p_cohort_id: string }
        Returns: {
          absent: number
          enrolled: boolean
          full_name: string
          last_absent_at: string
          learner_id: string
          learner_number: string
          present: number
          sessions: number
        }[]
      }
      get_cohort_readiness: {
        Args: { p_cohort_id: string }
        Returns: {
          assignee_id: string
          assignee_name: string
          confirmed_at: string
          confirmed_by_name: string
          detail: string
          done: boolean
          due_on: string
          gate: boolean
          item_key: string
          note: string
        }[]
      }
      get_cohort_setup: {
        Args: { p_cohort_id: string }
        Returns: {
          activated_at: string
          activated_by_name: string
          cohort_id: string
          ends_on: string
          held: number
          learners: number
          moderation_policy: string
          name: string
          policy_version: number
          programme_title: string
          starts_on: string
          status: string
          waiting: number
        }[]
      }
      get_configuration_key: {
        Args: { p_key: string }
        Returns: {
          affects: string
          choices: Json
          current_version: number
          description: string
          does_not_affect: string
          group_label: string
          in_use: boolean
          key: string
          label: string
          max_value: number
          min_value: number
          unit_label: string
          value_type: string
          versions: Json
        }[]
      }
      get_import_rows: {
        Args: { p_batch_id: string; p_outcome?: string }
        Returns: {
          email: string
          full_name: string
          invitation_state: string
          learner_number: string
          outcome: string
          problem: string
          row_number: number
        }[]
      }
      get_learner_submission_history: {
        Args: { p_learner_id: string }
        Returns: {
          cohort_name: string
          due_at: string
          full_name: string
          learner_id: string
          learner_number: string
          reminders: Json
          status: string
          task_id: string
          task_title: string
          versions: Json
        }[]
      }
      get_marking_item: {
        Args: { p_instance_id: string }
        Returns: {
          assessor_id: string
          assessor_name: string
          cohort_name: string
          criteria: Json
          decisions: Json
          draft: Json
          instance_id: string
          instance_state: string
          instance_version: number
          is_late: boolean
          learner_name: string
          learner_number: string
          moderation_policy: string
          requirements: Json
          result_appeal_deadline_at: string
          result_id: string
          result_released_at: string
          result_remediation_deadline_at: string
          result_state: string
          returns: Json
          submitted_at: string
          task_brief: string
          task_id: string
          task_title: string
          version_number: number
          versions: Json
        }[]
      }
      get_material: {
        Args: { p_material_id: string }
        Returns: {
          category: string
          cohort_id: string
          cohort_name: string
          description: string
          file_bytes: number
          file_id: string
          file_media_type: string
          file_name: string
          has_captions: boolean
          id: string
          kind: string
          link_url: string
          module_id: string
          opened_by: number
          programme_id: string
          release_at: string
          state: string
          title: string
        }[]
      }
      get_moderation_pool: {
        Args: { p_cohort_id: string }
        Returns: {
          assessors: Json
          held: number
          item_id: string
          kind: string
          oldest_decided_at: string
          open_cycle_id: string
          open_cycle_name: string
          open_cycle_scheduled_start_at: string
          open_cycle_state: string
          released: number
          title: string
          unit_code: string
          unit_id: string
          unit_title: string
          waiting: number
        }[]
      }
      get_moderation_sample: {
        Args: { p_cycle_id: string }
        Returns: {
          algorithm_version: string
          allocations: Json
          cycle_id: string
          digest: string
          frozen_at: string
          frozen_by_name: string
          mandatory_first_time: number
          mandatory_nyc: number
          percentage: number
          population: number
          random_draw: number
          rule_version: number
          sample_size: number
          seed: string
          strata: Json
          unallocated: number
        }[]
      }
      get_moderation_summary: {
        Args: { p_cohort_id: string }
        Returns: {
          frozen_cycles: number
          held: number
          max_hold_days: number
          moderation_policy: string
          oldest_held_at: string
          oldest_waiting_at: string
          planned_cycles: number
          sampling_percentage: number
          sampling_rule: string
          sampling_rule_version: number
          waiting: number
        }[]
      }
      get_my_appeal: {
        Args: { p_appeal_id: string }
        Returns: {
          admissibility_reason: string
          appealed_outcome: string
          cohort_name: string
          concluded_at: string
          coordinator_names: string[]
          deadline_at: string
          decided_outcome: string
          decided_points: number
          decided_remediation: string
          decided_remediation_deadline_at: string
          events: Json
          grounds: string
          id: string
          item_title: string
          learner_name: string
          learner_number: string
          lodged_at: string
          outcome_category: string
          points_possible: number
          points_scored: number
          reasons: string
          reference: string
          remediation_deadline_at: string
          result_id: string
          state: string
          turnaround_working_days: number
          type: string
        }[]
      }
      get_my_material: {
        Args: { p_material_id: string }
        Returns: {
          category: string
          description: string
          file_bucket: string
          file_bytes: number
          file_key: string
          file_media_type: string
          file_name: string
          has_captions: boolean
          id: string
          kind: string
          link_url: string
          module_title: string
          release_at: string
          title: string
        }[]
      }
      get_my_note: {
        Args: { p_note_id: string }
        Returns: {
          body: string
          created_at: string
          folder: string
          id: string
          link_available: boolean
          link_title: string
          material_id: string
          session_id: string
          title: string
          updated_at: string
          version: number
        }[]
      }
      get_my_quiz: {
        Args: { p_quiz_id: string }
        Returns: {
          attempt_limit: number
          attempts: Json
          description: string
          id: string
          questions: Json
          title: string
        }[]
      }
      get_my_quiz_attempt: {
        Args: { p_attempt_id: string }
        Returns: {
          answers_shown: boolean
          attempt_id: string
          attempt_limit: number
          attempt_number: number
          items: Json
          max_score: number
          quiz_id: string
          quiz_title: string
          score: number
          state: string
          submitted_at: string
        }[]
      }
      get_my_result: {
        Args: { p_result_id: string }
        Returns: {
          appeal_deadline_at: string
          assessed_version: Json
          assessor_name: string
          cohort_name: string
          decided_on_appeal: boolean
          feedback: string
          first_viewed_at: string
          item_title: string
          latest_version: Json
          marks: Json
          moderated: boolean
          outcome: string
          released_at: string
          remediation: string
          remediation_deadline_at: string
          result_id: string
          state: string
          task_closed: boolean
          task_id: string
        }[]
      }
      get_my_task: {
        Args: { p_task_id: string }
        Returns: {
          brief: string
          cohort_name: string
          criteria: Json
          due_at: string
          id: string
          late_policy: string
          requirements: Json
          submission_type: string
          title: string
          versions: Json
        }[]
      }
      get_notice: {
        Args: { p_notice_id: string }
        Returns: {
          audience: string
          body: string
          can_cancel: boolean
          cohort_name: string
          id: string
          recipients: number
          role: string
          send_at: string
          sender_name: string
          sent_at: string
          state: string
          title: string
        }[]
      }
      get_quiz: {
        Args: { p_quiz_id: string }
        Returns: {
          attempt_limit: number
          cohort_id: string
          cohort_name: string
          description: string
          id: string
          programme_id: string
          published_at: string
          questions: Json
          state: string
          title: string
        }[]
      }
      get_register: {
        Args: { p_session_id: string }
        Returns: {
          amendments: Json
          captured_at: string
          captured_by_name: string
          cohort_name: string
          duration_minutes: number
          register_version: number
          roster: Json
          session_id: string
          starts_at: string
          state: string
          title: string
        }[]
      }
      get_session_logistics: {
        Args: { p_session_id: string }
        Returns: {
          catering_arranged_at: string
          catering_arranged_by_name: string
          catering_needed: boolean
          cohort_id: string
          cohort_name: string
          default_basis: number
          default_headcount: number
          default_source: string
          dietary: string
          difference: number
          duration_minutes: number
          enrolled: number
          equipment: string
          equipment_arranged_at: string
          equipment_arranged_by_name: string
          headcount: number
          headcount_source: string
          mode: string
          present: number
          reconciled_at: string
          reconciled_by_name: string
          reconciliation_note: string
          register_captured: boolean
          session_id: string
          session_state: string
          starts_at: string
          title: string
          variance_flagged: boolean
          variance_percent: number
          venue: string
          venue_arranged_at: string
          venue_arranged_by_name: string
          venue_note: string
          version: number
        }[]
      }
      get_session_policy: {
        Args: never
        Returns: {
          idle_minutes: number
        }[]
      }
      get_stakeholder_query: {
        Args: { p_query_id: string }
        Returns: {
          closed_at: string
          closed_by_name: string
          cohort_id: string
          cohort_name: string
          contact: string
          details: string
          due_on: string
          events: Json
          id: string
          logged_at: string
          logged_by_name: string
          owner_id: string
          owner_name: string
          owners: Json
          programme_id: string
          programme_title: string
          reference: string
          resolution: string
          source_name: string
          source_type: string
          state: string
          subject: string
        }[]
      }
      get_task: {
        Args: { p_task_id: string }
        Returns: {
          audience: string
          audience_size: number
          brief: string
          cohort_id: string
          cohort_name: string
          criteria: Json
          due_at: string
          id: string
          late_policy: string
          module_id: string
          named_learners: Json
          requirements: Json
          state: string
          submission_type: string
          title: string
        }[]
      }
      get_unit_credit_history: {
        Args: { p_unit_id: string }
        Returns: {
          programme_title: string
          unit_code: string
          unit_title: string
          versions: Json
        }[]
      }
      health_check: { Args: never; Returns: boolean }
      issue_calendar_feed_token: {
        Args: never
        Returns: {
          created_at: string
          status: string
          token: string
        }[]
      }
      list_account_history: {
        Args: { p_profile_id: string }
        Returns: {
          action: string
          actor_name: string
          after: Json
          before: Json
          details: Json
          id: number
          occurred_at: string
        }[]
      }
      list_account_open_allocations: {
        Args: { p_profile_id: string }
        Returns: {
          cohort_name: string
          items: number
          kind: string
          oldest_at: string
        }[]
      }
      list_account_role_assignments: {
        Args: { p_profile_id: string }
        Returns: {
          assigned_by_name: string
          dependent_items: number
          effective_from: string
          effective_until: string
          id: string
          in_force: boolean
          role: string
          scope_label: string
          scope_type: string
        }[]
      }
      list_accounts: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          last_sign_in_at: string
          profile_id: string
          roles: string[]
          status: string
        }[]
      }
      list_appeal_reviewer_candidates: {
        Args: { p_appeal_id: string }
        Returns: {
          excluded_by: Json
          full_name: string
          is_current: boolean
          open_reviews: number
          profile_id: string
          role_label: string
          tier: number
        }[]
      }
      list_appeals_to_coordinate: {
        Args: never
        Returns: {
          cohort_name: string
          deadline_at: string
          id: string
          item_title: string
          learner_name: string
          learner_number: string
          lodged_at: string
          reference: string
          reviewer_name: string
          state: string
          type: string
        }[]
      }
      list_audit_events: {
        Args: {
          p_action?: string
          p_actor_email?: string
          p_before_id?: number
          p_from?: string
          p_limit?: number
          p_object_id?: string
          p_to?: string
        }
        Returns: {
          acting_role: string
          action: string
          actor_email: string
          actor_id: string
          actor_name: string
          after: Json
          before: Json
          details: Json
          id: number
          object_id: string
          object_label: string
          object_type: string
          occurred_at: string
          request_id: string
          scope_key: string
          scope_type: string
        }[]
      }
      list_cohort_modules: {
        Args: { p_cohort_id: string }
        Returns: {
          code: string
          id: string
          title: string
        }[]
      }
      list_cohort_registers: {
        Args: { p_cohort_id: string }
        Returns: {
          absent: number
          audience: number
          checked_in: number
          checkin_state: string
          confirmed_at: string
          confirmed_by_name: string
          duration_minutes: number
          mode: string
          present: number
          register_version: number
          session_id: string
          starts_at: string
          state: string
          title: string
          venue: string
        }[]
      }
      list_cohort_staff: {
        Args: { p_cohort_id: string }
        Returns: {
          assignment_id: string
          email: string
          ends_at: string
          full_name: string
          profile_id: string
          role: string
          scope_type: string
          starts_at: string
        }[]
      }
      list_cohorts: {
        Args: never
        Returns: {
          ends_on: string
          enrolment_count: number
          id: string
          moderation_policy: string
          name: string
          programme_id: string
          programme_title: string
          starts_on: string
          status: string
        }[]
      }
      list_configuration: {
        Args: never
        Returns: {
          choices: Json
          effective_from: string
          group_key: string
          group_label: string
          in_use: boolean
          key: string
          label: string
          recorded_by_name: string
          scheduled_from: string
          scheduled_value: Json
          unit_label: string
          value: Json
          value_type: string
          version: number
        }[]
      }
      list_cycle_sample_items: {
        Args: { p_cycle_id: string }
        Returns: {
          allocated_at: string
          assessor_name: string
          due_on: string
          inclusion_reason: string
          item_id: string
          item_title: string
          last_finding: string
          last_finding_at: string
          learner_name: string
          learner_number: string
          moderator_id: string
          moderator_name: string
          outcome: string
          returned_at: string
          seq: number
          state: string
          stratum: string
        }[]
      }
      list_enrolments: {
        Args: { p_cohort_id: string }
        Returns: {
          email: string
          enrolled_at: string
          enrolment_id: string
          full_name: string
          learner_number: string
          profile_id: string
          status: string
        }[]
      }
      list_import_batches: {
        Args: never
        Returns: {
          cohort_name: string
          created_at: string
          existing: number
          failed: number
          file_name: string
          id: string
          imported: number
          problems: number
          ready: number
          reference: string
          state: string
          total: number
          uploaded_by_name: string
        }[]
      }
      list_import_cohorts: {
        Args: never
        Returns: {
          enrolled: number
          id: string
          name: string
          programme_title: string
        }[]
      }
      list_marking_queue: {
        Args: { p_cohort_id?: string }
        Returns: {
          assessor_id: string
          assessor_name: string
          cohort_id: string
          cohort_name: string
          draft_saved_at: string
          instance_id: string
          instance_state: string
          is_late: boolean
          learner_name: string
          learner_number: string
          submitted_at: string
          task_title: string
          version_number: number
        }[]
      }
      list_materials: {
        Args: never
        Returns: {
          category: string
          cohort_name: string
          has_captions: boolean
          id: string
          kind: string
          module_title: string
          release_at: string
          state: string
          title: string
          updated_at: string
        }[]
      }
      list_moderation_cycles: {
        Args: { p_cohort_id: string }
        Returns: {
          cancel_reason: string
          cancelled_at: string
          cancelled_by_name: string
          frozen_at: string
          held: number
          id: string
          items: Json
          name: string
          period_from: string
          period_to: string
          planned_at: string
          planned_by_name: string
          returned: number
          sampled: number
          scheduled_start_at: string
          state: string
          unit_ids: string[]
          version: number
          waiting: number
        }[]
      }
      list_moderation_observations: {
        Args: { p_cycle_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          mine: boolean
          moderator_name: string
        }[]
      }
      list_moderation_policy_history: {
        Args: { p_cohort_id: string }
        Returns: {
          at: string
          by_name: string
          held: number
          kind: string
          policy: string
          previous_policy: string
          reason: string
          version: number
          waiting: number
        }[]
      }
      list_my_appeals: {
        Args: never
        Returns: {
          deadline_at: string
          id: string
          item_title: string
          lodged_at: string
          outcome_category: string
          reference: string
          result_id: string
          state: string
          type: string
        }[]
      }
      list_my_attendance: {
        Args: never
        Returns: {
          attendance: string
          checked_in_at: string
          checkin_state: string
          cohort_name: string
          confirmed_at: string
          duration_minutes: number
          mode: string
          session_id: string
          starts_at: string
          title: string
          venue: string
        }[]
      }
      list_my_enrolments: {
        Args: never
        Returns: {
          cohort_id: string
          cohort_name: string
          ends_on: string
          nqf_level: number
          programme_title: string
          starts_on: string
        }[]
      }
      list_my_materials: {
        Args: { p_search?: string }
        Returns: {
          category: string
          cohort_name: string
          description: string
          file_bytes: number
          file_media_type: string
          has_captions: boolean
          id: string
          kind: string
          link_host: string
          module_code: string
          module_title: string
          release_at: string
          title: string
        }[]
      }
      list_my_moderation_cycles: {
        Args: never
        Returns: {
          cohort_id: string
          cohort_name: string
          cycle_id: string
          frozen_at: string
          my_concluded: number
          my_items: number
          my_remarked: number
          my_returned: number
          name: string
          state: string
          total_items: number
        }[]
      }
      list_my_note_folders: {
        Args: never
        Returns: {
          folder: string
          notes: number
        }[]
      }
      list_my_notes: {
        Args: { p_folder?: string; p_search?: string }
        Returns: {
          excerpt: string
          folder: string
          id: string
          link_id: string
          link_kind: string
          link_title: string
          title: string
          updated_at: string
        }[]
      }
      list_my_notifications: {
        Args: { p_category?: string; p_page?: number; p_page_size?: number }
        Returns: {
          created_at: string
          email: Json
          event_type: string
          first_opened_at: string
          id: string
          link: string
          payload: Json
          read_at: string
          template_version: number
          total_count: number
          unread_count: number
        }[]
      }
      list_my_quizzes: {
        Args: never
        Returns: {
          attempt_limit: number
          attempts_used: number
          best_max: number
          best_score: number
          description: string
          id: string
          module_code: string
          module_title: string
          questions: number
          title: string
        }[]
      }
      list_my_release_status: {
        Args: never
        Returns: {
          cohort_id: string
          cohort_name: string
          decided_at: string
          decision_id: string
          instance_id: string
          item_id: string
          item_title: string
          learner_name: string
          learner_number: string
          moderation_policy: string
          outcome: string
          released_at: string
          replaced_at: string
          replaced_by: string
          result_id: string
          return_due_on: string
          stage: string
        }[]
      }
      list_my_results: {
        Args: never
        Returns: {
          appeal_deadline_at: string
          cohort_name: string
          decided_on_appeal: boolean
          item_title: string
          outcome: string
          released_at: string
          remediation_deadline_at: string
          result_id: string
          state: string
          task_id: string
        }[]
      }
      list_my_returned_items: {
        Args: never
        Returns: {
          cohort_name: string
          corrections: string
          cycle_name: string
          decided_at: string
          due_on: string
          instance_id: string
          instance_state: string
          item_title: string
          learner_name: string
          learner_number: string
          moderator_name: string
          outcome: string
          overdue: boolean
          result_id: string
          return_id: string
          returned_at: string
        }[]
      }
      list_my_reviews: {
        Args: never
        Returns: {
          allocated_at: string
          cohort_name: string
          concluded_at: string
          id: string
          item_title: string
          learner_name: string
          lodged_at: string
          outcome_category: string
          reference: string
          state: string
        }[]
      }
      list_my_sample_items: {
        Args: { p_cycle_id?: string }
        Returns: {
          cohort_name: string
          cycle_id: string
          cycle_name: string
          due_on: string
          inclusion_reason: string
          item_id: string
          item_title: string
          last_finding_at: string
          learner_name: string
          learner_number: string
          outcome: string
          remarked_at: string
          seq: number
          state: string
          stratum: string
          total: number
        }[]
      }
      list_my_sessions: {
        Args: { p_from?: string }
        Returns: {
          attendance: string
          cancel_reason: string
          checked_in_at: string
          checkin_state: string
          cohort_name: string
          duration_minutes: number
          facilitator_name: string
          id: string
          mode: string
          starts_at: string
          state: string
          teams_url: string
          title: string
          venue: string
        }[]
      }
      list_my_tasks: {
        Args: never
        Returns: {
          cohort_name: string
          due_at: string
          id: string
          late_policy: string
          latest_is_late: boolean
          latest_submitted_at: string
          latest_version: number
          published_at: string
          submission_type: string
          title: string
        }[]
      }
      list_my_uploads: {
        Args: { p_task_id: string }
        Returns: {
          accepted_at: string
          bytes: number
          file_id: string
          intent_id: string
          media_type: string
          original_filename: string
          requirement_id: string
          scan_state: string
        }[]
      }
      list_note_link_targets: {
        Args: never
        Returns: {
          at: string
          id: string
          kind: string
          title: string
        }[]
      }
      list_notice_deliveries: {
        Args: { p_notice_id: string }
        Returns: {
          email_state: string
          learner_number: string
          read_at: string
          recipient_name: string
          told_at: string
        }[]
      }
      list_notices: {
        Args: never
        Returns: {
          audience: string
          cohort_name: string
          id: string
          read_count: number
          recipients: number
          role: string
          send_at: string
          sender_name: string
          sent_at: string
          state: string
          title: string
        }[]
      }
      list_orphan_uploads: {
        Args: { p_limit?: number }
        Returns: {
          bucket: string
          intent_id: string
          object_key: string
          reason: string
        }[]
      }
      list_programmes: {
        Args: never
        Returns: {
          code: string
          id: string
          nqf_level: number
          title: string
        }[]
      }
      list_question_bank: {
        Args: { p_programme_id: string }
        Returns: {
          correct: string[]
          created_by_name: string
          feedback_correct: string
          feedback_incorrect: string
          id: string
          in_use: boolean
          kind: string
          module_title: string
          options: Json
          prompt: string
          updated_at: string
        }[]
      }
      list_quizzes: {
        Args: never
        Returns: {
          attempt_limit: number
          average_best_percent: number
          cohort_name: string
          id: string
          learners_tried: number
          programme_id: string
          questions: number
          state: string
          title: string
          updated_at: string
        }[]
      }
      list_role_scopes: {
        Args: never
        Returns: {
          label: string
          scope_key: string
          scope_type: string
        }[]
      }
      list_sample_moderator_candidates: {
        Args: { p_item_id: string }
        Returns: {
          conflict: boolean
          full_name: string
          holds_now: boolean
          items_in_cycle: number
          profile_id: string
        }[]
      }
      list_session_logistics: {
        Args: never
        Returns: {
          arranged: number
          catering_needed: boolean
          cohort_id: string
          cohort_name: string
          headcount: number
          needed: number
          present: number
          register_captured: boolean
          session_id: string
          session_state: string
          starts_at: string
          title: string
          variance_flagged: boolean
          venue: string
        }[]
      }
      list_sessions: {
        Args: never
        Returns: {
          absent: number
          audience: number
          cancel_reason: string
          checked_in: number
          checkin_state: string
          cohort_id: string
          cohort_name: string
          duration_minutes: number
          id: string
          mode: string
          present: number
          register_version: number
          series_count: number
          series_id: string
          series_repeat: string
          series_seq: number
          starts_at: string
          state: string
          teams_url: string
          title: string
          venue: string
          version: number
        }[]
      }
      list_sign_in_locks: {
        Args: never
        Returns: {
          failures: number
          locked_at: string
          locked_until: string
          profile_id: string
        }[]
      }
      list_stakeholder_queries: {
        Args: { p_show?: string }
        Returns: {
          cohort_name: string
          due_on: string
          id: string
          last_activity_at: string
          logged_at: string
          owner_id: string
          owner_name: string
          programme_title: string
          reference: string
          source_name: string
          source_type: string
          state: string
          subject: string
        }[]
      }
      list_task_submission_counts: {
        Args: { p_cohort_id: string }
        Returns: {
          audience: number
          due_at: string
          late: number
          late_policy: string
          outstanding: number
          submitted: number
          task_id: string
          title: string
        }[]
      }
      list_task_submissions: {
        Args: { p_task_id: string }
        Returns: {
          files_waiting: boolean
          full_name: string
          last_reminder_at: string
          late_by_seconds: number
          latest_version: number
          learner_id: string
          learner_number: string
          status: string
          submitted_at: string
        }[]
      }
      list_tasks: {
        Args: { p_cohort_id?: string }
        Returns: {
          audience: string
          audience_size: number
          cohort_id: string
          cohort_name: string
          criteria_count: number
          due_at: string
          id: string
          late_policy: string
          published_at: string
          state: string
          submission_type: string
          title: string
        }[]
      }
      list_unit_credit_values: {
        Args: never
        Returns: {
          credits: number
          effective_from: string
          programme_title: string
          scheduled_credits: number
          scheduled_from: string
          set_by_name: string
          unit_code: string
          unit_id: string
          unit_title: string
        }[]
      }
      list_work_cohorts: {
        Args: never
        Returns: {
          id: string
          name: string
          programme_title: string
          status: string
        }[]
      }
      lodge_appeal: {
        Args: {
          p_client_appeal_id: string
          p_grounds: string
          p_result_id: string
          p_type: string
        }
        Returns: {
          appeal_id: string
          deadline_at: string
          lodged_at: string
          reference: string
          status: string
        }[]
      }
      log_material_access: {
        Args: { p_material_id: string }
        Returns: {
          status: string
        }[]
      }
      log_stakeholder_query: {
        Args: {
          p_cohort_id: string
          p_contact: string
          p_details: string
          p_due_on?: string
          p_programme_id: string
          p_source_name: string
          p_source_type: string
          p_subject: string
        }
        Returns: {
          query_id: string
          reference: string
          status: string
        }[]
      }
      mark_my_attendance: {
        Args: { p_session_id: string }
        Returns: {
          checked_in_at: string
          status: string
        }[]
      }
      mark_my_notifications_read: {
        Args: { p_category?: string }
        Returns: {
          marked: number
          status: string
        }[]
      }
      my_access: {
        Args: never
        Returns: {
          email: string
          full_name: string
          has_review_allocation: boolean
          profile_id: string
          roles: string[]
          status: string
        }[]
      }
      my_calendar_feed: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          last_used_at: string
        }[]
      }
      my_notice_audiences: {
        Args: never
        Returns: {
          can_send_wide: boolean
          cohort_id: string
          cohort_name: string
          learners: number
          programme_title: string
        }[]
      }
      my_unread_notification_count: { Args: never; Returns: number }
      notification_outbox_health: {
        Args: never
        Returns: {
          failed_last_hour: number
          oldest_pending_at: string
          oldest_queued_seconds: number
          pending: number
          queue_length: number
        }[]
      }
      open_appeal_review: {
        Args: { p_appeal_id: string }
        Returns: {
          allocated_at: string
          appealed_at: string
          appealed_feedback: string
          appealed_outcome: string
          appealed_remediation: string
          assessed_version: Json
          assessor_name: string
          cohort_name: string
          concluded_at: string
          conclusion: Json
          conflict: boolean
          decisions: Json
          files: Json
          grounds: string
          item_title: string
          learner_name: string
          learner_number: string
          lodged_at: string
          marks: Json
          moderation_findings: Json
          outcome_category: string
          reference: string
          remediation_deadline_at: string
          result_changed: boolean
          review_opened_at: string
          state: string
          status: string
          turnaround_working_days: number
        }[]
      }
      open_my_notification: {
        Args: { p_notification_id: string }
        Returns: {
          link: string
          status: string
        }[]
      }
      open_sample_item: {
        Args: { p_item_id: string }
        Returns: {
          assessed_version: Json
          assessor_name: string
          cohort_name: string
          conflict: Json
          cycle_id: string
          cycle_name: string
          cycle_state: string
          decided_at: string
          decisions: Json
          feedback: string
          files: Json
          findings: Json
          inclusion_reason: string
          item_id: string
          item_title: string
          justification: string
          learner_name: string
          learner_number: string
          marks: Json
          my_concluded: number
          my_items: number
          next_item_id: string
          outcome: string
          previous_item_id: string
          remediation: string
          resubmission_days: number
          returns: Json
          seq: number
          state: string
          status: string
          stratum: string
          total: number
        }[]
      }
      plan_moderation_cycle: {
        Args: {
          p_cohort_id: string
          p_item_ids?: string[]
          p_name: string
          p_period_from?: string
          p_period_to?: string
          p_scheduled_start_at?: string
          p_unit_ids?: string[]
        }
        Returns: {
          conflict_cycle_id: string
          conflict_cycle_name: string
          conflict_cycle_state: string
          conflict_item_id: string
          conflict_item_title: string
          cycle_id: string
          status: string
        }[]
      }
      provision_account: {
        Args: {
          p_full_name: string
          p_learner_number?: string
          p_role: string
          p_user_id: string
        }
        Returns: {
          profile_id: string
          status: string
        }[]
      }
      provision_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: string
      }
      public_settings: {
        Args: never
        Returns: {
          appeal_turnaround_working_days: number
          appeal_window_days: number
          late_policy: string
          recording_max_mb: number
          upload_max_mb: number
        }[]
      }
      publish_material: {
        Args: { p_material_id: string; p_release_at?: string }
        Returns: {
          release_at: string
          status: string
        }[]
      }
      publish_quiz: {
        Args: { p_quiz_id: string }
        Returns: {
          status: string
        }[]
      }
      publish_task: {
        Args: { p_task_id: string }
        Returns: {
          notified: number
          status: string
        }[]
      }
      reactivate_account: {
        Args: { p_profile_id: string }
        Returns: {
          status: string
        }[]
      }
      reallocate_sample_item: {
        Args: { p_item_id: string; p_moderator_id: string }
        Returns: {
          conflict: Json
          status: string
        }[]
      }
      reconcile_logistics_variance: {
        Args: { p_note: string; p_session_id: string }
        Returns: {
          status: string
        }[]
      }
      record_configuration_version: {
        Args: {
          p_effective_on: string
          p_key: string
          p_reason: string
          p_value: string
        }
        Returns: {
          effective_from: string
          status: string
          version: number
        }[]
      }
      record_file_scan: {
        Args: {
          p_detected_media_type?: string
          p_file_id: string
          p_max_attempts?: number
          p_outcome: string
          p_reason?: string
          p_scanner?: string
          p_sha256?: string
        }
        Returns: {
          scan_state: string
          status: string
        }[]
      }
      record_moderation_finding: {
        Args: {
          p_corrections?: string
          p_due_on?: string
          p_finding: string
          p_item_id: string
          p_reasons: string
        }
        Returns: {
          finding_id: string
          return_id: string
          status: string
        }[]
      }
      record_moderation_observation: {
        Args: { p_body: string; p_cycle_id: string }
        Returns: {
          observation_id: string
          status: string
        }[]
      }
      record_orphans_removed: {
        Args: { p_intent_ids: string[] }
        Returns: number
      }
      record_password_reset: {
        Args: { p_profile_id: string }
        Returns: {
          email: string
          status: string
        }[]
      }
      record_sign_in_failure: { Args: { p_email: string }; Returns: undefined }
      record_sign_in_success: { Args: { p_email: string }; Returns: undefined }
      revoke_calendar_feed_token: {
        Args: never
        Returns: {
          status: string
        }[]
      }
      route_stakeholder_query: {
        Args: { p_note?: string; p_owner_id: string; p_query_id: string }
        Returns: {
          status: string
        }[]
      }
      save_marking_draft: {
        Args: {
          p_expected_version: number
          p_feedback?: string
          p_instance_id: string
          p_justification?: string
          p_outcome?: string
          p_remediation?: string
          p_resubmission_days?: number
          p_scores: Json
        }
        Returns: {
          draft_version: number
          saved_at: string
          status: string
        }[]
      }
      save_question: {
        Args: {
          p_feedback_correct?: string
          p_feedback_incorrect?: string
          p_kind: string
          p_module_id?: string
          p_options: Json
          p_programme_id: string
          p_prompt: string
          p_question_id: string
        }
        Returns: {
          question_id: string
          status: string
        }[]
      }
      save_register: {
        Args: {
          p_expected_version: number
          p_marks: Json
          p_reason?: string
          p_session_id: string
        }
        Returns: {
          changed: number
          register_version: number
          status: string
        }[]
      }
      save_session_logistics: {
        Args: {
          p_catering_arranged: boolean
          p_catering_needed: boolean
          p_dietary: string
          p_equipment: string
          p_equipment_arranged: boolean
          p_expected_version: number
          p_headcount: number
          p_session_id: string
          p_venue_arranged: boolean
          p_venue_note: string
        }
        Returns: {
          status: string
          version: number
        }[]
      }
      scheduled_job_health: {
        Args: never
        Returns: {
          failures_last_day: number
          heartbeat_within_seconds: number
          job_name: string
          kind: string
          last_run_at: string
          last_status: string
          last_success_at: string
          overdue: boolean
          schedule: string
          scheduled: boolean
        }[]
      }
      send_task_reminder: {
        Args: { p_learner_ids: string[]; p_message: string; p_task_id: string }
        Returns: {
          sent: number
          skipped_recent: number
          skipped_submitted: number
          status: string
        }[]
      }
      set_moderation_policy: {
        Args: {
          p_cohort_id: string
          p_expected_version: number
          p_policy: string
          p_reason?: string
        }
        Returns: {
          held: number
          policy_version: number
          status: string
          waiting: number
        }[]
      }
      set_recording_captions: {
        Args: { p_has_captions: boolean; p_material_id: string }
        Returns: {
          status: string
        }[]
      }
      set_task_audience: {
        Args: { p_audience: string; p_emails?: string[]; p_task_id: string }
        Returns: {
          audience_size: number
          status: string
        }[]
      }
      set_task_criteria: {
        Args: { p_criteria: Json; p_task_id: string }
        Returns: {
          criteria_count: number
          status: string
        }[]
      }
      set_task_requirements: {
        Args: { p_requirements: Json; p_task_id: string }
        Returns: {
          requirement_count: number
          status: string
        }[]
      }
      set_unit_credit_value: {
        Args: {
          p_credits: number
          p_effective_on: string
          p_reason: string
          p_unit_id: string
        }
        Returns: {
          effective_from: string
          status: string
        }[]
      }
      settle_notification_delivery: {
        Args: {
          p_delivery_id: string
          p_error?: string
          p_msg_id: number
          p_outcome: string
          p_provider?: string
          p_provider_message_id?: string
          p_retry_seconds?: number
        }
        Returns: {
          status: string
        }[]
      }
      sign_in_gate: { Args: { p_email: string }; Returns: boolean }
      start_quiz_attempt: {
        Args: { p_quiz_id: string }
        Returns: {
          attempt_id: string
          attempt_number: number
          status: string
        }[]
      }
      start_remark: {
        Args: { p_instance_id: string }
        Returns: {
          draft_version: number
          instance_version: number
          status: string
        }[]
      }
      submit_quiz_attempt: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: {
          max_score: number
          score: number
          status: string
        }[]
      }
      submit_task: {
        Args: {
          p_client_submission_id: string
          p_files: Json
          p_task_id: string
        }
        Returns: {
          detail: string
          is_late: boolean
          receipt_reference: string
          status: string
          submission_id: string
          submitted_at: string
          version_number: number
        }[]
      }
      take_marking: {
        Args: { p_instance_id: string }
        Returns: {
          instance_version: number
          status: string
        }[]
      }
      unlock_account: {
        Args: { p_profile_id: string }
        Returns: {
          status: string
        }[]
      }
      update_account: {
        Args: {
          p_full_name: string
          p_learner_number?: string
          p_profile_id: string
        }
        Returns: {
          status: string
        }[]
      }
      update_material: {
        Args: {
          p_description: string
          p_link_url?: string
          p_material_id: string
          p_module_id?: string
          p_title: string
        }
        Returns: {
          status: string
        }[]
      }
      update_note: {
        Args: {
          p_body: string
          p_expected_version: number
          p_folder?: string
          p_material_id?: string
          p_note_id: string
          p_session_id?: string
          p_title: string
        }
        Returns: {
          status: string
          version: number
        }[]
      }
      update_quiz: {
        Args: {
          p_attempt_limit: number
          p_description: string
          p_questions: Json
          p_quiz_id: string
          p_title: string
        }
        Returns: {
          status: string
        }[]
      }
      update_session: {
        Args: {
          p_duration_minutes: number
          p_expected_version: number
          p_mode: string
          p_rest_of_series?: boolean
          p_session_id: string
          p_starts_at: string
          p_teams_url?: string
          p_title: string
          p_venue?: string
        }
        Returns: {
          changed: number
          notified: number
          status: string
        }[]
      }
      update_task: {
        Args: {
          p_brief: string
          p_due_at?: string
          p_late_policy?: string
          p_module_id?: string
          p_submission_type?: string
          p_task_id: string
          p_title: string
        }
        Returns: {
          status: string
          task_id: string
        }[]
      }
      view_my_marked_work: {
        Args: { p_appeal_id: string }
        Returns: {
          appeal_deadline_at: string
          assessed_version: Json
          assessor_name: string
          cohort_name: string
          decision_final: boolean
          feedback: string
          files: Json
          first_viewed_at: string
          item_title: string
          marks: Json
          outcome: string
          reference: string
          remark_appeal_id: string
          remark_reference: string
          remark_standing: string
          result_id: string
          status: string
          views: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  api: {
    Enums: {},
  },
} as const

