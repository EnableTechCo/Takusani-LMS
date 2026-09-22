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
      list_programmes: {
        Args: never
        Returns: {
          code: string
          id: string
          nqf_level: number
          title: string
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

