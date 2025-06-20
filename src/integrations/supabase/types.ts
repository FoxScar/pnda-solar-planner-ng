export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_battery_system: {
        Args: {
          daily_energy_kwh: number
          preferred_chemistry?: string
          backup_hours?: number
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
      calculate_panel_system: {
        Args: {
          daily_energy_kwh: number
          state_name: string
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
