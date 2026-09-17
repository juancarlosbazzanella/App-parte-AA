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
      clients: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_user_id: string
          email: string
          id: string
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id: string
          email: string
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string
          email?: string
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_created_by_user_id_fkey"
            columns: ["organization_id", "created_by_user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          archived_at: string | null
          brand: string
          client_id: string
          created_at: string
          created_by_user_id: string
          id: string
          installation_address: string
          model: string
          organization_id: string
          serial_number: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          brand: string
          client_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          installation_address: string
          model: string
          organization_id: string
          serial_number: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          brand?: string
          client_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          installation_address?: string
          model?: string
          organization_id?: string
          serial_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_organization_id_client_id_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "machines_organization_id_created_by_user_id_fkey"
            columns: ["organization_id", "created_by_user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          is_active: boolean
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          is_active?: boolean
          joined_at?: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          is_active?: boolean
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          next_work_order_number: number
          timezone: string
          updated_at: string
          work_order_prefix: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          next_work_order_number?: number
          timezone?: string
          updated_at?: string
          work_order_prefix?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          next_work_order_number?: number
          timezone?: string
          updated_at?: string
          work_order_prefix?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_order_corrections: {
        Row: {
          changed_fields: string[]
          corrected_by_user_id: string
          created_at: string
          id: string
          organization_id: string
          summary: string
          version_after: number
          version_before: number
          work_order_id: string
        }
        Insert: {
          changed_fields: string[]
          corrected_by_user_id: string
          created_at?: string
          id?: string
          organization_id: string
          summary: string
          version_after: number
          version_before: number
          work_order_id: string
        }
        Update: {
          changed_fields?: string[]
          corrected_by_user_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          summary?: string
          version_after?: number
          version_before?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_corrections_organization_id_corrected_by_user_i_fkey"
            columns: ["organization_id", "corrected_by_user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "work_order_corrections_organization_id_work_order_id_fkey"
            columns: ["organization_id", "work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      work_order_photos: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          organization_id: string
          original_filename: string
          size_bytes: number
          sort_order: number
          storage_path: string
          uploaded_by_user_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          organization_id: string
          original_filename: string
          size_bytes: number
          sort_order?: number
          storage_path: string
          uploaded_by_user_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          organization_id?: string
          original_filename?: string
          size_bytes?: number
          sort_order?: number
          storage_path?: string
          uploaded_by_user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_photos_organization_id_uploaded_by_user_id_fkey"
            columns: ["organization_id", "uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "work_order_photos_organization_id_work_order_id_fkey"
            columns: ["organization_id", "work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      work_orders: {
        Row: {
          client_id: string
          closed_at: string | null
          closed_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          hours: number | null
          id: string
          machine_id: string
          materials: string | null
          no_signature_reason: string | null
          observations: string | null
          organization_id: string
          reference: string
          request: string | null
          scheduled_date: string
          scheduled_time: string | null
          sequence_number: number
          signature_storage_path: string | null
          signer_name: string | null
          source: Database["public"]["Enums"]["work_order_source"]
          status: Database["public"]["Enums"]["work_order_status"]
          technician_user_id: string
          type: Database["public"]["Enums"]["work_order_type"]
          updated_at: string
          version: number
          work_done: string | null
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          hours?: number | null
          id?: string
          machine_id: string
          materials?: string | null
          no_signature_reason?: string | null
          observations?: string | null
          organization_id: string
          reference: string
          request?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          sequence_number: number
          signature_storage_path?: string | null
          signer_name?: string | null
          source: Database["public"]["Enums"]["work_order_source"]
          status?: Database["public"]["Enums"]["work_order_status"]
          technician_user_id: string
          type: Database["public"]["Enums"]["work_order_type"]
          updated_at?: string
          version?: number
          work_done?: string | null
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          hours?: number | null
          id?: string
          machine_id?: string
          materials?: string | null
          no_signature_reason?: string | null
          observations?: string | null
          organization_id?: string
          reference?: string
          request?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          sequence_number?: number
          signature_storage_path?: string | null
          signer_name?: string | null
          source?: Database["public"]["Enums"]["work_order_source"]
          status?: Database["public"]["Enums"]["work_order_status"]
          technician_user_id?: string
          type?: Database["public"]["Enums"]["work_order_type"]
          updated_at?: string
          version?: number
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_organization_id_client_id_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "work_orders_organization_id_closed_by_user_id_fkey"
            columns: ["organization_id", "closed_by_user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "work_orders_organization_id_created_by_user_id_fkey"
            columns: ["organization_id", "created_by_user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "work_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_organization_id_machine_id_client_id_fkey"
            columns: ["organization_id", "machine_id", "client_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["organization_id", "id", "client_id"]
          },
          {
            foreignKeyName: "work_orders_organization_id_technician_user_id_fkey"
            columns: ["organization_id", "technician_user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      close_work_order: {
        Args: {
          p_expected_version: number
          p_hours: number
          p_materials: string
          p_no_signature_reason: string
          p_observations: string
          p_request: string
          p_signature_storage_path: string
          p_signer_name: string
          p_type: Database["public"]["Enums"]["work_order_type"]
          p_work_done: string
          p_work_order_id: string
        }
        Returns: {
          client_id: string
          closed_at: string | null
          closed_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          hours: number | null
          id: string
          machine_id: string
          materials: string | null
          no_signature_reason: string | null
          observations: string | null
          organization_id: string
          reference: string
          request: string | null
          scheduled_date: string
          scheduled_time: string | null
          sequence_number: number
          signature_storage_path: string | null
          signer_name: string | null
          source: Database["public"]["Enums"]["work_order_source"]
          status: Database["public"]["Enums"]["work_order_status"]
          technician_user_id: string
          type: Database["public"]["Enums"]["work_order_type"]
          updated_at: string
          version: number
          work_done: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      correct_closed_work_order: {
        Args: {
          p_client_id: string
          p_expected_version: number
          p_hours: number
          p_machine_id: string
          p_materials: string
          p_observations: string
          p_request: string
          p_scheduled_date: string
          p_scheduled_time: string
          p_summary: string
          p_technician_user_id: string
          p_type: Database["public"]["Enums"]["work_order_type"]
          p_work_done: string
          p_work_order_id: string
        }
        Returns: {
          client_id: string
          closed_at: string | null
          closed_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          hours: number | null
          id: string
          machine_id: string
          materials: string | null
          no_signature_reason: string | null
          observations: string | null
          organization_id: string
          reference: string
          request: string | null
          scheduled_date: string
          scheduled_time: string | null
          sequence_number: number
          signature_storage_path: string | null
          signer_name: string | null
          source: Database["public"]["Enums"]["work_order_source"]
          status: Database["public"]["Enums"]["work_order_status"]
          technician_user_id: string
          type: Database["public"]["Enums"]["work_order_type"]
          updated_at: string
          version: number
          work_done: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_work_order: {
        Args: {
          p_client_id: string
          p_hours: number
          p_machine_id: string
          p_materials: string
          p_observations: string
          p_organization_id: string
          p_request: string
          p_scheduled_date: string
          p_scheduled_time: string
          p_source: Database["public"]["Enums"]["work_order_source"]
          p_technician_user_id: string
          p_type: Database["public"]["Enums"]["work_order_type"]
          p_work_done: string
        }
        Returns: {
          client_id: string
          closed_at: string | null
          closed_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          hours: number | null
          id: string
          machine_id: string
          materials: string | null
          no_signature_reason: string | null
          observations: string | null
          organization_id: string
          reference: string
          request: string | null
          scheduled_date: string
          scheduled_time: string | null
          sequence_number: number
          signature_storage_path: string | null
          signer_name: string | null
          source: Database["public"]["Enums"]["work_order_source"]
          status: Database["public"]["Enums"]["work_order_status"]
          technician_user_id: string
          type: Database["public"]["Enums"]["work_order_type"]
          updated_at: string
          version: number
          work_done: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_open_work_order: {
        Args: {
          p_client_id: string
          p_expected_version: number
          p_hours: number
          p_machine_id: string
          p_materials: string
          p_observations: string
          p_request: string
          p_scheduled_date: string
          p_scheduled_time: string
          p_technician_user_id: string
          p_type: Database["public"]["Enums"]["work_order_type"]
          p_work_done: string
          p_work_order_id: string
        }
        Returns: {
          client_id: string
          closed_at: string | null
          closed_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          hours: number | null
          id: string
          machine_id: string
          materials: string | null
          no_signature_reason: string | null
          observations: string | null
          organization_id: string
          reference: string
          request: string | null
          scheduled_date: string
          scheduled_time: string | null
          sequence_number: number
          signature_storage_path: string | null
          signer_name: string | null
          source: Database["public"]["Enums"]["work_order_source"]
          status: Database["public"]["Enums"]["work_order_status"]
          technician_user_id: string
          type: Database["public"]["Enums"]["work_order_type"]
          updated_at: string
          version: number
          work_done: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      member_role: "office" | "technician"
      work_order_source: "office" | "urgent"
      work_order_status: "open" | "closed"
      work_order_type:
        | "installation"
        | "maintenance"
        | "breakdown"
        | "inspection"
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
  public: {
    Enums: {
      member_role: ["office", "technician"],
      work_order_source: ["office", "urgent"],
      work_order_status: ["open", "closed"],
      work_order_type: [
        "installation",
        "maintenance",
        "breakdown",
        "inspection",
      ],
    },
  },
} as const
