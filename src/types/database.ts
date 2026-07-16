export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          owner_id: string
          size_bytes: number | null
          storage_path: string
          tenant_id: string | null
          unit_id: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          id?: string
          owner_id?: string
          size_bytes?: number | null
          storage_path: string
          tenant_id?: string | null
          unit_id?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          id?: string
          owner_id?: string
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_tenant_id_owner_id_fkey"
            columns: ["tenant_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "attachments_unit_id_owner_id_fkey"
            columns: ["unit_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      billing_schedule_occurrences: {
        Row: {
          calendar_label: string
          created_at: string
          due_date: string
          id: string
          owner_id: string
          period_key: string
          sequence_no: number
          tenancy_id: string
        }
        Insert: {
          calendar_label: string
          created_at?: string
          due_date: string
          id?: string
          owner_id?: string
          period_key: string
          sequence_no: number
          tenancy_id: string
        }
        Update: {
          calendar_label?: string
          created_at?: string
          due_date?: string
          id?: string
          owner_id?: string
          period_key?: string
          sequence_no?: number
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_schedule_occurrences_tenancy_owner_fkey"
            columns: ["tenancy_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      charges: {
        Row: {
          amount_due: number
          created_at: string
          due_date: string
          id: string
          label: string
          meter_current: number | null
          meter_previous: number | null
          meter_rate: number | null
          note: string | null
          owner_id: string
          payment_type: string
          period_key: string
          tenancy_id: string
        }
        Insert: {
          amount_due: number
          created_at?: string
          due_date: string
          id?: string
          label: string
          meter_current?: number | null
          meter_previous?: number | null
          meter_rate?: number | null
          note?: string | null
          owner_id?: string
          payment_type?: string
          period_key: string
          tenancy_id: string
        }
        Update: {
          amount_due?: number
          created_at?: string
          due_date?: string
          id?: string
          label?: string
          meter_current?: number | null
          meter_previous?: number | null
          meter_rate?: number | null
          note?: string | null
          owner_id?: string
          payment_type?: string
          period_key?: string
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_tenancy_id_owner_id_fkey"
            columns: ["tenancy_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          id: string
          owner_id: string
          unit_id: string
          meter_kind: string
          reading_date: string
          value: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id?: string
          unit_id: string
          meter_kind: string
          reading_date?: string
          value: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          unit_id?: string
          meter_kind?: string
          reading_date?: string
          value?: number
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          charge_id: string
          created_at: string
          id: string
          owner_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          charge_id: string
          created_at?: string
          id?: string
          owner_id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          charge_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_charge_id_owner_id_fkey"
            columns: ["charge_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_owner_id_fkey"
            columns: ["payment_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          owner_id: string
          paid_at: string
          tenancy_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          paid_at?: string
          tenancy_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          paid_at?: string
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_tenancy_id_owner_id_fkey"
            columns: ["tenancy_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      tenancies: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          monthly_rent: number
          owner_id: string
          start_date: string
          tenant_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_rent?: number
          owner_id?: string
          start_date?: string
          tenant_id: string
          unit_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_rent?: number
          owner_id?: string
          start_date?: string
          tenant_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_tenant_id_owner_id_fkey"
            columns: ["tenant_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "tenancies_unit_id_owner_id_fkey"
            columns: ["unit_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      tenancy_billing_settings: {
        Row: {
          calendar_type: string
          created_at: string
          due_day: number
          owner_id: string
          schedule_start_date: string
          tenancy_id: string
          updated_at: string
        }
        Insert: {
          calendar_type?: string
          created_at?: string
          due_day?: number
          owner_id?: string
          schedule_start_date?: string
          tenancy_id: string
          updated_at?: string
        }
        Update: {
          calendar_type?: string
          created_at?: string
          due_day?: number
          owner_id?: string
          schedule_start_date?: string
          tenancy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_billing_settings_tenancy_owner_fkey"
            columns: ["tenancy_id", "owner_id"]
            isOneToOne: true
            referencedRelation: "tenancies"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      tenancy_payment_terms: {
        Row: {
          archived_at: string | null
          calculation_type: string
          created_at: string
          fixed_amount: number | null
          frequency_months: number
          id: string
          label: string
          owner_id: string
          payment_type: string
          starts_on_sequence: number
          tenancy_id: string
          unit_rate: number | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          calculation_type?: string
          created_at?: string
          fixed_amount?: number | null
          frequency_months?: number
          id?: string
          label: string
          owner_id?: string
          payment_type: string
          starts_on_sequence?: number
          tenancy_id: string
          unit_rate?: number | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          calculation_type?: string
          created_at?: string
          fixed_amount?: number | null
          frequency_months?: number
          id?: string
          label?: string
          owner_id?: string
          payment_type?: string
          starts_on_sequence?: number
          tenancy_id?: string
          unit_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_payment_terms_tenancy_owner_fkey"
            columns: ["tenancy_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      tenants: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          air_conditioned: boolean | null
          archived_at: string | null
          area_sqm: number | null
          condition: string | null
          created_at: string
          default_rent: number | null
          description: string | null
          furnishing: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          rooms: number | null
          year_built_or_renovated: number | null
        }
        Insert: {
          air_conditioned?: boolean | null
          archived_at?: string | null
          area_sqm?: number | null
          condition?: string | null
          created_at?: string
          default_rent?: number | null
          description?: string | null
          furnishing?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          rooms?: number | null
          year_built_or_renovated?: number | null
        }
        Update: {
          air_conditioned?: boolean | null
          archived_at?: string | null
          area_sqm?: number | null
          condition?: string | null
          created_at?: string
          default_rent?: number | null
          description?: string | null
          furnishing?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          rooms?: number | null
          year_built_or_renovated?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_added_payment_term: {
        Args: {
          p_term_id: string
        }
        Returns: undefined
      }
      materialize_due_charges: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      save_tenancy_billing_schedule: {
        Args: {
          p_calendar_type: string
          p_due_day: number
          p_occurrences: Json
          p_schedule_start_date: string
          p_tenancy_id: string
        }
        Returns: undefined
      }
      set_charge_payment_state: {
        Args: {
          p_amount_due: number
          p_charge_id: string
          p_paid_amount: number
          p_paid_at?: string
        }
        Returns: undefined
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
