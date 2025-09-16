// =============================================================================
// TYPES SUPABASE GÉNÉRÉS - Digit PRESSING
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      articles: {
        Row: {
          id: string
          pressing_id: string
          name: string
          category: string
          default_price: number
          is_active: boolean
          description: string | null
          estimated_days: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pressing_id: string
          name: string
          category: string
          default_price: number
          is_active?: boolean
          description?: string | null
          estimated_days?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pressing_id?: string
          name?: string
          category?: string
          default_price?: number
          is_active?: boolean
          description?: string | null
          estimated_days?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_pressing_id_fkey"
            columns: ["pressing_id"]
            isOneToOne: false
            referencedRelation: "pressings"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: string
          old_values: Json | null
          new_values: Json | null
          user_id: string
          user_name: string
          user_role: string
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          action: string
          old_values?: Json | null
          new_values?: Json | null
          user_id: string
          user_name: string
          user_role: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string
          action?: string
          old_values?: Json | null
          new_values?: Json | null
          user_id?: string
          user_name?: string
          user_role?: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          id: string
          pressing_id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          total_invoices: number
          total_spent: number
          last_visit: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pressing_id: string
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          total_invoices?: number
          total_spent?: number
          last_visit?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pressing_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          total_invoices?: number
          total_spent?: number
          last_visit?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_pressing_id_fkey"
            columns: ["pressing_id"]
            isOneToOne: false
            referencedRelation: "pressings"
            referencedColumns: ["id"]
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          pressing_id: string
          number: string
          client_name: string
          client_phone: string | null
          client_email: string | null
          client_address: string | null
          items: Json
          subtotal: number
          discount: number | null
          discount_type: string | null
          tax: number | null
          total: number
          status: string
          paid: boolean
          withdrawn: boolean
          payment_method: string | null
          deposit_date: string
          payment_date: string | null
          withdrawal_date: string | null
          estimated_ready_date: string | null
          created_by: string
          created_by_name: string
          modified_by: string | null
          modified_by_name: string | null
          modified_at: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          cancelled_at: string | null
          notes: string | null
          urgency: string
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pressing_id: string
          number: string
          client_name: string
          client_phone?: string | null
          client_email?: string | null
          client_address?: string | null
          items: Json
          subtotal: number
          discount?: number | null
          discount_type?: string | null
          tax?: number | null
          total: number
          status?: string
          paid?: boolean
          withdrawn?: boolean
          payment_method?: string | null
          deposit_date: string
          payment_date?: string | null
          withdrawal_date?: string | null
          estimated_ready_date?: string | null
          created_by: string
          created_by_name: string
          modified_by?: string | null
          modified_by_name?: string | null
          modified_at?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          notes?: string | null
          urgency?: string
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pressing_id?: string
          number?: string
          client_name?: string
          client_phone?: string | null
          client_email?: string | null
          client_address?: string | null
          items?: Json
          subtotal?: number
          discount?: number | null
          discount_type?: string | null
          tax?: number | null
          total?: number
          status?: string
          paid?: boolean
          withdrawn?: boolean
          payment_method?: string | null
          deposit_date?: string
          payment_date?: string | null
          withdrawal_date?: string | null
          estimated_ready_date?: string | null
          created_by?: string
          created_by_name?: string
          modified_by?: string | null
          modified_by_name?: string | null
          modified_at?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          notes?: string | null
          urgency?: string
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_pressing_id_fkey"
            columns: ["pressing_id"]
            isOneToOne: false
            referencedRelation: "pressings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_modified_by_fkey"
            columns: ["modified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      offline_queue: {
        Row: {
          id: string
          user_id: string
          type: string
          endpoint: string
          data: Json
          timestamp: string
          retry_count: number
          last_error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          endpoint: string
          data: Json
          timestamp: string
          retry_count?: number
          last_error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          endpoint?: string
          data?: Json
          timestamp?: string
          retry_count?: number
          last_error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      pressings: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          email: string | null
          logo: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      revenue_daily: {
        Row: {
          id: string
          pressing_id: string
          date: string
          deposit_total: number
          withdrawal_total: number
          daily_total: number
          total_transactions: number
          average_ticket: number
          payment_methods: Json
          categories: Json
          employees: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pressing_id: string
          date: string
          deposit_total: number
          withdrawal_total: number
          daily_total: number
          total_transactions: number
          average_ticket: number
          payment_methods?: Json
          categories?: Json
          employees?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pressing_id?: string
          date?: string
          deposit_total?: number
          withdrawal_total?: number
          daily_total?: number
          total_transactions?: number
          average_ticket?: number
          payment_methods?: Json
          categories?: Json
          employees?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_daily_pressing_id_fkey"
            columns: ["pressing_id"]
            isOneToOne: false
            referencedRelation: "pressings"
            referencedColumns: ["id"]
          }
        ]
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          theme: string
          language: string
          currency: string
          timezone: string
          notifications: Json
          dashboard: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme?: string
          language?: string
          currency?: string
          timezone?: string
          notifications?: Json
          dashboard?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          theme?: string
          language?: string
          currency?: string
          timezone?: string
          notifications?: Json
          dashboard?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          id: string
          pressing_id: string
          role: string
          full_name: string
          email: string
          permissions: Json
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          pressing_id: string
          role: string
          full_name: string
          email: string
          permissions?: Json
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pressing_id?: string
          role?: string
          full_name?: string
          email?: string
          permissions?: Json
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_pressing_id_fkey"
            columns: ["pressing_id"]
            isOneToOne: false
            referencedRelation: "pressings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      invoice_stats_view: {
        Row: {
          pressing_id: string | null
          total_invoices: number | null
          total_revenue: number | null
          pending_invoices: number | null
          paid_invoices: number | null
          withdrawn_invoices: number | null
          average_ticket: number | null
          this_month_revenue: number | null
          last_month_revenue: number | null
          growth_rate: number | null
        }
        Relationships: []
      }
      top_articles_view: {
        Row: {
          pressing_id: string | null
          article_name: string | null
          category: string | null
          total_sold: number | null
          total_revenue: number | null
          average_price: number | null
        }
        Relationships: []
      }
      client_stats_view: {
        Row: {
          pressing_id: string | null
          client_name: string | null
          total_invoices: number | null
          total_spent: number | null
          last_visit: string | null
          average_ticket: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_daily_revenue: {
        Args: {
          pressing_id: string
          target_date: string
        }
        Returns: Json
      }
      get_invoice_stats: {
        Args: {
          pressing_id: string
          start_date?: string
          end_date?: string
        }
        Returns: Json
      }
      search_invoices: {
        Args: {
          pressing_id: string
          search_term?: string
          status_filter?: string[]
          date_from?: string
          date_to?: string
          limit_count?: number
          offset_count?: number
        }
        Returns: {
          invoices: Json
          total_count: number
        }
      }
      update_client_stats: {
        Args: {
          client_name: string
          pressing_id: string
        }
        Returns: void
      }
      generate_invoice_number: {
        Args: {
          pressing_id: string
        }
        Returns: string
      }
    }
    Enums: {
      user_role: 'owner' | 'employee'
      invoice_status: 'active' | 'cancelled'
      urgency_level: 'normal' | 'express' | 'urgent'
      payment_method: 'cash' | 'card' | 'check' | 'transfer'
      article_category: 'vetement' | 'accessoire' | 'special' | 'cuir' | 'retouche'
      discount_type: 'amount' | 'percentage'
      audit_action: 'create' | 'update' | 'delete' | 'cancel'
    }
    CompositeTypes: {
      invoice_item: {
        id: string
        article_id: string
        article_name: string
        category: string
        quantity: number
        unit_price: number
        total_price: number
        special_instructions: string | null
        completed: boolean
        completed_at: string | null
      }
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never