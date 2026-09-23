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
          submitted_at: string
          task_brief: string
          task_id: string
          task_title: string
          version_number: number
          versions: Json
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
      health_check: { Args: never; Returns: boolean }
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
      list_programmes: {
        Args: never
        Returns: {
          code: string
          id: string
          nqf_level: number
          title: string
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
      list_work_cohorts: {
        Args: never
        Returns: {
          id: string
          name: string
          programme_title: string
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
      publish_task: {
        Args: { p_task_id: string }
        Returns: {
          notified: number
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

