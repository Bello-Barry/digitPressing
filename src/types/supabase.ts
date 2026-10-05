export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = any; /*
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_closings: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          counted_cash: number | null
          created_at: string
          date: string
          discrepancy: number | null
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_balance: number
          organization_id: string
          status: Database["public"]["Enums"]["cash_register_status"]
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          counted_cash?: number | null
          created_at?: string
          date: string
          discrepancy?: number | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_balance?: number
          organization_id: string
          status?: Database["public"]["Enums"]["cash_register_status"]
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          counted_cash?: number | null
          created_at?: string
          date?: string
          discrepancy?: number | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          organization_id?: string
          status?: Database["public"]["Enums"]["cash_register_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_closings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          full_name: string
          id: string
          last_order_at: string | null
          notes: string | null
          organization_id: string
          phone_display: string | null
          phone_normalized: string
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          full_name: string
          id?: string
          last_order_at?: string | null
          notes?: string | null
          organization_id: string
          phone_display?: string | null
          phone_normalized: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          full_name?: string
          id?: string
          last_order_at?: string | null
          notes?: string | null
          organization_id?: string
          phone_display?: string | null
          phone_normalized?: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          notes: string | null
          order_id: string
          organization_id: string
          quantity: number
          service_id: string | null
          service_name: string
          unit_price: number
          item_type: string | null
          color: string | null
          pattern: string | null
          brand: string | null
          size: string | null
          item_notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          notes?: string | null
          order_id: string
          organization_id: string
          quantity?: number
          service_id?: string | null
          service_name: string
          unit_price: number
          item_type?: string | null
          color?: string | null
          pattern?: string | null
          brand?: string | null
          size?: string | null
          item_notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          notes?: string | null
          order_id?: string
          organization_id?: string
          quantity?: number
          service_id?: string | null
          service_name?: string
          unit_price?: number
          item_type?: string | null
          color?: string | null
          pattern?: string | null
          brand?: string | null
          size?: string | null
          item_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_by: string | null
          client_name: string
          client_phone: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivered_by: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_override_at: string | null
          delivery_override_by: string | null
          delivery_override_note: string | null
          discount_amount: number
          discount_reason: string | null
          id: string
          invoice_token: string | null
          ip_hash: string | null
          items_count_in: number | null
          items_count_out: number | null
          items_discrepancy: string | null
          items_verified: boolean
          mode: Database["public"]["Enums"]["order_mode"]
          notes: string | null
          organization_id: string
          pickup_address: string | null
          received_by: string | null
          rejection_reason: string | null
          request_code: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          ticket_number: string | null
          total_amount: number
          updated_at: string
          validated_by: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_by?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_by?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_override_at?: string | null
          delivery_override_by?: string | null
          delivery_override_note?: string | null
          discount_amount?: number
          discount_reason?: string | null
          id?: string
          invoice_token?: string | null
          ip_hash?: string | null
          items_count_in?: number | null
          items_count_out?: number | null
          items_discrepancy?: string | null
          items_verified?: boolean
          mode?: Database["public"]["Enums"]["order_mode"]
          notes?: string | null
          organization_id: string
          pickup_address?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          request_code?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          ticket_number?: string | null
          total_amount?: number
          updated_at?: string
          validated_by?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_by?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_by?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_override_at?: string | null
          delivery_override_by?: string | null
          delivery_override_note?: string | null
          discount_amount?: number
          discount_reason?: string | null
          id?: string
          invoice_token?: string | null
          ip_hash?: string | null
          items_count_in?: number | null
          items_count_out?: number | null
          items_discrepancy?: string | null
          items_verified?: boolean
          mode?: Database["public"]["Enums"]["order_mode"]
          notes?: string | null
          organization_id?: string
          pickup_address?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          request_code?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          ticket_number?: string | null
          total_amount?: number
          updated_at?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          country_code: string
          created_at: string
          currency: string
          email: string | null
          footer_text: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone_1: string | null
          phone_2: string | null
          plan: string
          settings: Json
          slogan: string | null
          slug: string
          ticket_prefix: string
          trial_until: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          country_code?: string
          created_at?: string
          currency?: string
          email?: string | null
          footer_text?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone_1?: string | null
          phone_2?: string | null
          plan?: string
          settings?: Json
          slogan?: string | null
          slug: string
          ticket_prefix?: string
          trial_until?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          country_code?: string
          created_at?: string
          currency?: string
          email?: string | null
          footer_text?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone_1?: string | null
          phone_2?: string | null
          plan?: string
          settings?: Json
          slogan?: string | null
          slug?: string
          ticket_prefix?: string
          trial_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          collected_at: string
          collected_by: string
          created_at: string
          id: string
          is_reversal: boolean
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          order_id: string
          organization_id: string
          reference: string | null
          reversal_reason: string | null
        }
        Insert: {
          amount: number
          collected_at?: string
          collected_by: string
          created_at?: string
          id?: string
          is_reversal?: boolean
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id: string
          organization_id: string
          reference?: string | null
          reversal_reason?: string | null
        }
        Update: {
          amount?: number
          collected_at?: string
          collected_by?: string
          created_at?: string
          id?: string
          is_reversal?: boolean
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string
          organization_id?: string
          reference?: string | null
          reversal_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_payment_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          created_at: string
          expires_at: string
          id: string
          key: string
          window_start: string
        }
        Insert: {
          action?: string
          count?: number
          created_at?: string
          expires_at?: string
          id?: string
          key: string
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      request_sequences: {
        Row: {
          last_value: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          last_value?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          last_value?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          estimated_days: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          estimated_days?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          price: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          estimated_days?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sequences: {
        Row: {
          last_value: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          last_value?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          last_value?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      order_payment_summary: {
        Row: {
          balance_due: number | null
          order_id: string | null
          organization_id: string | null
          paid_amount: number | null
          payment_count: number | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_request_code: { Args: { p_org_id: string }; Returns: string }
      create_order_request: {
        Args: {
          p_address?: string
          p_client_name: string
          p_client_phone: string
          p_honeypot?: string
          p_ip_hash?: string
          p_items: Json
          p_mode?: string
          p_notes?: string
          p_org_id: string
        }
        Returns: Json
      }
      get_order_tracking: {
        Args: { p_org_id: string; p_phone: string; p_request_code: string }
        Returns: Json
      }
      get_user_org_id: { Args: never; Returns: string }
      get_user_role_in_org: { Args: { p_org_id: string }; Returns: string }
      has_role_in_org: {
        Args: { p_org_id: string; p_roles: string[] }
        Returns: boolean
      }
      is_member_of_org: { Args: { p_org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      receive_order_and_assign_ticket: {
        Args: {
          p_items_count?: number
          p_order_id: string
          p_org_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      cash_register_status: "OPEN" | "CLOSED"
      member_role: "OWNER" | "MANAGER" | "CASHIER" | "DELIVERY"
      order_mode: "DROP_OFF" | "PICKUP" | "DELIVERY"
      order_status:
        | "REQUEST"
        | "VALIDATED"
        | "RECEIVED"
        | "PROCESSING"
        | "READY"
        | "DELIVERED"
        | "REJECTED"
        | "CANCELLED"
      payment_method: "CASH" | "MTN_MOMO" | "AIRTEL_MONEY" | "OTHER"
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
      cash_register_status: ["OPEN", "CLOSED"],
      member_role: ["OWNER", "MANAGER", "CASHIER", "DELIVERY"],
      order_mode: ["DROP_OFF", "PICKUP", "DELIVERY"],
      order_status: [
        "REQUEST",
        "VALIDATED",
        "RECEIVED",
        "PROCESSING",
        "READY",
        "DELIVERED",
        "REJECTED",
        "CANCELLED",
      ],
      payment_method: ["CASH", "MTN_MOMO", "AIRTEL_MONEY", "OTHER"],
    },
  },
} as const
*/
