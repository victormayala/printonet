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
      _one_shot_reveal: {
        Row: {
          consumed_at: string | null
          key_name: string
        }
        Insert: {
          consumed_at?: string | null
          key_name: string
        }
        Update: {
          consumed_at?: string | null
          key_name?: string
        }
        Relationships: []
      }
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
      corporate_store_product_logos: {
        Row: {
          created_at: string
          id: string
          logo_url: string
          position: Json
          product_id: string
          store_id: string
          updated_at: string
          user_id: string
          view: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url: string
          position?: Json
          product_id: string
          store_id: string
          updated_at?: string
          user_id: string
          view: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string
          position?: Json
          product_id?: string
          store_id?: string
          updated_at?: string
          user_id?: string
          view?: string
        }
        Relationships: []
      }
      corporate_store_products: {
        Row: {
          created_at: string
          customizable: boolean
          id: string
          is_active: boolean
          product_id: string
          sort_order: number
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customizable?: boolean
          id?: string
          is_active?: boolean
          product_id: string
          sort_order?: number
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customizable?: boolean
          id?: string
          is_active?: boolean
          product_id?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
          user_id?: string
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
          customizer_border_radius: number
          customizer_theme: string
          dns_checked_at: string | null
          dns_verified: boolean
          error_message: string | null
          favicon_url: string | null
          font_family: string
          free_shipping_threshold: number | null
          id: string
          logo_url: string | null
          name: string
          platform_fee_bps: number
          primary_color: string
          provision_request_id: string | null
          secondary_logo_url: string | null
          shipping_flat_amount: number
          shipping_label: string
          status: string
          store_admin_url: string | null
          store_login_url: string | null
          store_type: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_connected_at: string | null
          stripe_details_submitted: boolean
          stripe_payouts_enabled: boolean
          tax_enabled: boolean
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
          customizer_border_radius?: number
          customizer_theme?: string
          dns_checked_at?: string | null
          dns_verified?: boolean
          error_message?: string | null
          favicon_url?: string | null
          font_family?: string
          free_shipping_threshold?: number | null
          id?: string
          logo_url?: string | null
          name: string
          platform_fee_bps?: number
          primary_color?: string
          provision_request_id?: string | null
          secondary_logo_url?: string | null
          shipping_flat_amount?: number
          shipping_label?: string
          status?: string
          store_admin_url?: string | null
          store_login_url?: string | null
          store_type?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_connected_at?: string | null
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          tax_enabled?: boolean
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
          customizer_border_radius?: number
          customizer_theme?: string
          dns_checked_at?: string | null
          dns_verified?: boolean
          error_message?: string | null
          favicon_url?: string | null
          font_family?: string
          free_shipping_threshold?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          platform_fee_bps?: number
          primary_color?: string
          provision_request_id?: string | null
          secondary_logo_url?: string | null
          shipping_flat_amount?: number
          shipping_label?: string
          status?: string
          store_admin_url?: string | null
          store_login_url?: string | null
          store_type?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_connected_at?: string | null
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          tax_enabled?: boolean
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          category_id: string | null
          created_at: string
          decoration_methods: string[]
          description: string | null
          dimension_unit: string
          height: number | null
          id: string
          image_back: string | null
          image_front: string | null
          image_side1: string | null
          image_side2: string | null
          inventory: Json
          is_active: boolean
          length: number | null
          name: string
          print_areas: Json | null
          product_type: string
          sale_price: number | null
          status: string
          subcategory_id: string | null
          supplier_source: Json | null
          updated_at: string
          user_id: string
          variants: Json | null
          weight: number | null
          weight_unit: string
          width: number | null
        }
        Insert: {
          base_price?: number
          category?: string
          category_id?: string | null
          created_at?: string
          decoration_methods?: string[]
          description?: string | null
          dimension_unit?: string
          height?: number | null
          id?: string
          image_back?: string | null
          image_front?: string | null
          image_side1?: string | null
          image_side2?: string | null
          inventory?: Json
          is_active?: boolean
          length?: number | null
          name: string
          print_areas?: Json | null
          product_type?: string
          sale_price?: number | null
          status?: string
          subcategory_id?: string | null
          supplier_source?: Json | null
          updated_at?: string
          user_id: string
          variants?: Json | null
          weight?: number | null
          weight_unit?: string
          width?: number | null
        }
        Update: {
          base_price?: number
          category?: string
          category_id?: string | null
          created_at?: string
          decoration_methods?: string[]
          description?: string | null
          dimension_unit?: string
          height?: number | null
          id?: string
          image_back?: string | null
          image_front?: string | null
          image_side1?: string | null
          image_side2?: string | null
          inventory?: Json
          is_active?: boolean
          length?: number | null
          name?: string
          print_areas?: Json | null
          product_type?: string
          sale_price?: number | null
          status?: string
          subcategory_id?: string | null
          supplier_source?: Json | null
          updated_at?: string
          user_id?: string
          variants?: Json | null
          weight?: number | null
          weight_unit?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          currency: string
          id: string
          image_url: string | null
          inventory_product_id: string | null
          metadata: Json
          name: string
          order_id: string
          quantity: number
          sku: string | null
          store_product_id: string | null
          unit_amount: number
          variant_color: string | null
          variant_size: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          image_url?: string | null
          inventory_product_id?: string | null
          metadata?: Json
          name: string
          order_id: string
          quantity: number
          sku?: string | null
          store_product_id?: string | null
          unit_amount: number
          variant_color?: string | null
          variant_size?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          image_url?: string | null
          inventory_product_id?: string | null
          metadata?: Json
          name?: string
          order_id?: string
          quantity?: number
          sku?: string | null
          store_product_id?: string | null
          unit_amount?: number
          variant_color?: string | null
          variant_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_total: number | null
          application_fee_amount: number | null
          created_at: string
          currency: string | null
          customer_email: string | null
          environment: string
          id: string
          session_id: string | null
          status: string
          store_id: string | null
          stripe_account_id: string | null
          stripe_checkout_id: string | null
          stripe_payment_intent: string | null
          updated_at: string
        }
        Insert: {
          amount_total?: number | null
          application_fee_amount?: number | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          environment?: string
          id?: string
          session_id?: string | null
          status?: string
          store_id?: string | null
          stripe_account_id?: string | null
          stripe_checkout_id?: string | null
          stripe_payment_intent?: string | null
          updated_at?: string
        }
        Update: {
          amount_total?: number | null
          application_fee_amount?: number | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          environment?: string
          id?: string
          session_id?: string | null
          status?: string
          store_id?: string | null
          stripe_account_id?: string | null
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
      printonet_woo_order_files: {
        Row: {
          created_at: string
          currency: string | null
          date_paid: string | null
          id: string
          line_items: Json
          order_id: number
          order_number: string | null
          order_status: string | null
          payload: Json
          store_url: string
          tenant_slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          date_paid?: string | null
          id?: string
          line_items?: Json
          order_id: number
          order_number?: string | null
          order_status?: string | null
          payload?: Json
          store_url: string
          tenant_slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          date_paid?: string | null
          id?: string
          line_items?: Json
          order_id?: number
          order_number?: string | null
          order_status?: string | null
          payload?: Json
          store_url?: string
          tenant_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_category_links: {
        Row: {
          category_id: string
          created_at: string
          id: string
          sort_order: number
          subcategory_id: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          sort_order?: number
          subcategory_id: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          subcategory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_links_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
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
      stripe_webhook_events: {
        Row: {
          event_id: string
          received_at: string
          type: string
        }
        Insert: {
          event_id: string
          received_at?: string
          type: string
        }
        Update: {
          event_id?: string
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          extra_store_quantity: number
          id: string
          price_id: string
          product_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          extra_store_quantity?: number
          id?: string
          price_id: string
          product_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          extra_store_quantity?: number
          id?: string
          price_id?: string
          product_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
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
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      printonet_apply_plan_fee_to_user_stores: {
        Args: { p_bps: number; p_user_id: string }
        Returns: undefined
      }
      printonet_plan_fee_bps: { Args: { p_price_id: string }; Returns: number }
      printonet_plan_included_stores: {
        Args: { p_price_id: string }
        Returns: number
      }
      printonet_purge_unlinked_customizer_sessions: {
        Args: { p_days?: number }
        Returns: number
      }
      printonet_set_user_stores_status: {
        Args: { p_status: string; p_user_id: string }
        Returns: undefined
      }
      printonet_user_store_limit: {
        Args: { p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "super_admin"
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
      app_role: ["super_admin"],
    },
  },
} as const
