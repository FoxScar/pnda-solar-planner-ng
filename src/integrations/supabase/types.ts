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
      [_ in never]: never
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
