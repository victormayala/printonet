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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      brand_configs: {
        Row: {
          accent_color: string
          border_radius: number
          created_at: string
          font_family: string
          id: string
          logo_url: string | null
          name: string | null
          primary_color: string
          theme: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accent_color?: string
          border_radius?: number
          created_at?: string
          font_family?: string
          id?: string
          logo_url?: string | null
          name?: string | null
          primary_color?: string
          theme?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accent_color?: string
          border_radius?: number
          created_at?: string
          font_family?: string
          id?: string
          logo_url?: string | null
          name?: string | null
          primary_color?: string
          theme?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      corporate_stores: {
        Row: {
          accent_color: string
          admin_password: string | null
          admin_user_id: string | null
          admin_username: string | null
          contact_email: string
          created_at: string
          custom_domain: string | null
          error_message: string | null
          favicon_url: string | null
          font_family: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string
          provision_request_id: string | null
          secondary_logo_url: string | null
          status: string
          store_admin_url: string | null
          store_login_url: string | null
          tenant_slug: string | null
          updated_at: string
          user_id: string
          wp_admin_url: string | null
          wp_site_id: string | null
          wp_site_url: string | null
        }
        Insert: {
          accent_color?: string
          admin_password?: string | null
          admin_user_id?: string | null
          admin_username?: string | null
          contact_email: string
          created_at?: string
          custom_domain?: string | null
          error_message?: string | null
          favicon_url?: string | null
          font_family?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          provision_request_id?: string | null
          secondary_logo_url?: string | null
          status?: string
          store_admin_url?: string | null
          store_login_url?: string | null
          tenant_slug?: string | null
          updated_at?: string
          user_id: string
          wp_admin_url?: string | null
          wp_site_id?: string | null
          wp_site_url?: string | null
        }
        Update: {
          accent_color?: string
          admin_password?: string | null
          admin_user_id?: string | null
          admin_username?: string | null
          contact_email?: string
          created_at?: string
          custom_domain?: string | null
          error_message?: string | null
          favicon_url?: string | null
          font_family?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          provision_request_id?: string | null
          secondary_logo_url?: string | null
          status?: string
          store_admin_url?: string | null
          store_login_url?: string | null
          tenant_slug?: string | null
          updated_at?: string
          user_id?: string
          wp_admin_url?: string | null
          wp_site_id?: string | null
          wp_site_url?: string | null
        }
        Relationships: []
      }
      customizer_sessions: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          design_output: Json | null
          external_ref: string | null
          id: string
          order_notes: string | null
          product_data: Json
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          design_output?: Json | null
          external_ref?: string | null
          id?: string
          order_notes?: string | null
          product_data: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          design_output?: Json | null
          external_ref?: string | null
          id?: string
          order_notes?: string | null
          product_data?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      design_templates: {
        Row: {
          canvas_data: Json
          category: string
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canvas_data?: Json
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canvas_data?: Json
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_products: {
        Row: {
          base_price: number
          category: string
          created_at: string
          description: string | null
          dimension_unit: string
          height: number | null
          id: string
          image_back: string | null
          image_front: string | null
          image_side1: string | null
          image_side2: string | null
          is_active: boolean
          length: number | null
          name: string
          print_areas: Json | null
          product_type: string
          sale_price: number | null
          status: string
          supplier_source: Json | null
          updated_at: string
          user_id: string | null
          variants: Json | null
          weight: number | null
          weight_unit: string
          width: number | null
        }
        Insert: {
          base_price?: number
          category?: string
          created_at?: string
          description?: string | null
          dimension_unit?: string
          height?: number | null
          id?: string
          image_back?: string | null
          image_front?: string | null
          image_side1?: string | null
          image_side2?: string | null
          is_active?: boolean
          length?: number | null
          name: string
          print_areas?: Json | null
          product_type?: string
          sale_price?: number | null
          status?: string
          supplier_source?: Json | null
          updated_at?: string
          user_id?: string | null
          variants?: Json | null
          weight?: number | null
          weight_unit?: string
          width?: number | null
        }
        Update: {
          base_price?: number
          category?: string
          created_at?: string
          description?: string | null
          dimension_unit?: string
          height?: number | null
          id?: string
          image_back?: string | null
          image_front?: string | null
          image_side1?: string | null
          image_side2?: string | null
          is_active?: boolean
          length?: number | null
          name?: string
          print_areas?: Json | null
          product_type?: string
          sale_price?: number | null
          status?: string
          supplier_source?: Json | null
          updated_at?: string
          user_id?: string | null
          variants?: Json | null
          weight?: number | null
          weight_unit?: string
          width?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_total: number | null
          created_at: string
          currency: string | null
          customer_email: string | null
          environment: string
          id: string
          session_id: string | null
          status: string
          stripe_checkout_id: string | null
          stripe_payment_intent: string | null
          updated_at: string
        }
        Insert: {
          amount_total?: number | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          environment?: string
          id?: string
          session_id?: string | null
          status?: string
          stripe_checkout_id?: string | null
          stripe_payment_intent?: string | null
          updated_at?: string
        }
        Update: {
          amount_total?: number | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          environment?: string
          id?: string
          session_id?: string | null
          status?: string
          stripe_checkout_id?: string | null
          stripe_payment_intent?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customizer_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          store_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          store_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          store_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_integrations: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          last_synced_at: string | null
          platform: string
          script_tag_id: number | null
          store_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          last_synced_at?: string | null
          platform: string
          script_tag_id?: number | null
          store_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          last_synced_at?: string | null
          platform?: string
          script_tag_id?: number | null
          store_url?: string
          updated_at?: string
          user_id?: string
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
