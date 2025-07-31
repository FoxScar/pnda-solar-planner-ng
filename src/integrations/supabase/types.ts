export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          assigned_by: string | null
          created_at: string
          id: string
          ip_address: unknown | null
          role_assigned: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          role_assigned: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          role_assigned?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      appliances: {
        Row: {
          category: string
          created_at: string
          id: string
          is_energy_efficient: boolean | null
          name: string
          power_rating: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_energy_efficient?: boolean | null
          name: string
          power_rating: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_energy_efficient?: boolean | null
          name?: string
          power_rating?: number
        }
        Relationships: []
      }
      batteries: {
        Row: {
          available: boolean | null
          capacity_kwh: number
          chemistry: string
          created_at: string
          dod: number
          efficiency: number
          id: string
          unit_cost: number
          voltage: number
        }
        Insert: {
          available?: boolean | null
          capacity_kwh: number
          chemistry: string
          created_at?: string
          dod: number
          efficiency: number
          id?: string
          unit_cost: number
          voltage: number
        }
        Update: {
          available?: boolean | null
          capacity_kwh?: number
          chemistry?: string
          created_at?: string
          dod?: number
          efficiency?: number
          id?: string
          unit_cost?: number
          voltage?: number
        }
        Relationships: []
      }
      inverters: {
        Row: {
          available: boolean | null
          created_at: string
          id: string
          kva_rating: number
          model_name: string
          power_factor: number | null
          surge_capacity: string | null
          unit_cost: number
          voltage_bus: number
        }
        Insert: {
          available?: boolean | null
          created_at?: string
          id?: string
          kva_rating: number
          model_name: string
          power_factor?: number | null
          surge_capacity?: string | null
          unit_cost: number
          voltage_bus: number
        }
        Update: {
          available?: boolean | null
          created_at?: string
          id?: string
          kva_rating?: number
          model_name?: string
          power_factor?: number | null
          surge_capacity?: string | null
          unit_cost?: number
          voltage_bus?: number
        }
        Relationships: []
      }
      panels: {
        Row: {
          available: boolean | null
          created_at: string
          derating_factor: number
          id: string
          model_name: string
          rated_power: number
          unit_cost: number
        }
        Insert: {
          available?: boolean | null
          created_at?: string
          derating_factor: number
          id?: string
          model_name: string
          rated_power: number
          unit_cost: number
        }
        Update: {
          available?: boolean | null
          created_at?: string
          derating_factor?: number
          id?: string
          model_name?: string
          rated_power?: number
          unit_cost?: number
        }
        Relationships: []
      }
      quotes: {
        Row: {
          appliances_data: Json
          battery_data: Json
          created_at: string
          id: string
          inverter_data: Json
          panel_data: Json
          quote_data: Json
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          appliances_data: Json
          battery_data: Json
          created_at?: string
          id?: string
          inverter_data: Json
          panel_data: Json
          quote_data: Json
          total_cost: number
          updated_at?: string
          user_id: string
        }
        Update: {
          appliances_data?: Json
          battery_data?: Json
          created_at?: string
          id?: string
          inverter_data?: Json
          panel_data?: Json
          quote_data?: Json
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sun_hours: {
        Row: {
          created_at: string
          hours: number
          id: string
          state: string
        }
        Insert: {
          created_at?: string
          hours: number
          id?: string
          state: string
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          state?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_admin_role: {
        Args: { target_user_id: string }
        Returns: Json
      }
      bootstrap_initial_admin: {
        Args: { target_user_id: string; bootstrap_key?: string }
        Returns: Json
      }
      calculate_complete_system: {
        Args: { appliances_data: Json; state_name: string; preferences?: Json }
        Returns: {
          daily_energy_kwh: number
          peak_load_watts: number
          recommended_inverter: Json
          recommended_battery: Json
          recommended_panels: Json
          total_system_cost: number
        }[]
      }
      calculate_inverter_with_merging: {
        Args: {
          peak_load_watts: number
          power_factor?: number
          safety_margin?: number
        }
        Returns: {
          inverter_id: string
          model_name: string
          kva_rating: number
          voltage_bus: number
          surge_capacity: string
          unit_cost: number
          va_requirement: number
          recommended: boolean
          is_merged: boolean
          merge_configuration: string
          quantity: number
        }[]
      }
      calculate_lithium_battery_options: {
        Args:
          | { night_energy_kwh: number; night_duration_hours?: number }
          | {
              night_energy_kwh: number
              system_voltage?: number
              night_duration_hours?: number
            }
        Returns: {
          battery_id: string
          chemistry: string
          voltage: number
          capacity_kwh: number
          recommended_quantity: number
          total_capacity_kwh: number
          total_cost: number
          configuration: string
          pros: string[]
          is_optimal: boolean
        }[]
      }
      calculate_panel_system: {
        Args: {
          daytime_load_watts: number
          night_energy_kwh: number
          state_name: string
          sun_hours_per_day?: number
          preferred_panel_model?: string
        }
        Returns: {
          panel_id: string
          model_name: string
          rated_power: number
          recommended_quantity: number
          total_watts: number
          total_cost: number
          daily_generation_kwh: number
          derating_factor: number
          calculation_breakdown: Json
        }[]
      }
      calculate_traditional_battery_system: {
        Args:
          | {
              night_energy_kwh: number
              preferred_chemistry: string
              night_duration_hours?: number
            }
          | {
              night_energy_kwh: number
              preferred_chemistry: string
              system_voltage?: number
              night_duration_hours?: number
            }
        Returns: {
          battery_id: string
          chemistry: string
          voltage: number
          capacity_kwh: number
          recommended_quantity: number
          total_capacity_kwh: number
          total_cost: number
          configuration: string
          pros: string[]
        }[]
      }
      generate_quote_data: {
        Args: { selected_components: Json }
        Returns: {
          inverter_cost: number
          battery_cost: number
          panel_cost: number
          subtotal: number
          installation_cost: number
          total_cost: number
          quote_details: Json
        }[]
      }
      get_appliances_by_category: {
        Args: { category_filter: string }
        Returns: {
          id: string
          name: string
          power_rating: number
          category: string
          is_energy_efficient: boolean
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      needs_initial_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
