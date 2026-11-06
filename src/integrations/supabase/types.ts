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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived_at: string | null
          avatar_enabled: boolean
          avatar_identity: string | null
          avatar_image_path: string | null
          avatar_name: string | null
          avatar_path: string | null
          brand_color: string
          created_at: string
          external_id: string | null
          followers: number
          handle: string | null
          id: string
          last_synced_at: string | null
          name: string
          niche: string | null
          notes: string | null
          other_socials: Json
          platform: string
          posting_goal_count: number
          posting_goal_period: string
          similar_creators: Json
          sort_order: number
          started_on: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          avatar_enabled?: boolean
          avatar_identity?: string | null
          avatar_image_path?: string | null
          avatar_name?: string | null
          avatar_path?: string | null
          brand_color?: string
          created_at?: string
          external_id?: string | null
          followers?: number
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          niche?: string | null
          notes?: string | null
          other_socials?: Json
          platform?: string
          posting_goal_count?: number
          posting_goal_period?: string
          similar_creators?: Json
          sort_order?: number
          started_on?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          avatar_enabled?: boolean
          avatar_identity?: string | null
          avatar_image_path?: string | null
          avatar_name?: string | null
          avatar_path?: string | null
          brand_color?: string
          created_at?: string
          external_id?: string | null
          followers?: number
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          niche?: string | null
          notes?: string | null
          other_socials?: Json
          platform?: string
          posting_goal_count?: number
          posting_goal_period?: string
          similar_creators?: Json
          sort_order?: number
          started_on?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_preferences: {
        Row: {
          base_url: string
          model: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url?: string
          model?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          base_url?: string
          model?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_deals: {
        Row: {
          account_id: string | null
          brand: string
          contact_email: string | null
          contact_name: string | null
          content_item_id: string | null
          created_at: string
          currency: string
          deadline: string | null
          deliverables: string | null
          group_id: string | null
          id: string
          invoice_due: string | null
          notes: string | null
          paid_on: string | null
          revenue_entry_id: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
          usage_rights: string | null
          user_id: string
          value: number
        }
        Insert: {
          account_id?: string | null
          brand?: string
          contact_email?: string | null
          contact_name?: string | null
          content_item_id?: string | null
          created_at?: string
          currency?: string
          deadline?: string | null
          deliverables?: string | null
          group_id?: string | null
          id?: string
          invoice_due?: string | null
          notes?: string | null
          paid_on?: string | null
          revenue_entry_id?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          usage_rights?: string | null
          user_id?: string
          value?: number
        }
        Update: {
          account_id?: string | null
          brand?: string
          contact_email?: string | null
          contact_name?: string | null
          content_item_id?: string | null
          created_at?: string
          currency?: string
          deadline?: string | null
          deliverables?: string | null
          group_id?: string | null
          id?: string
          invoice_due?: string | null
          notes?: string | null
          paid_on?: string | null
          revenue_entry_id?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          usage_rights?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_deals_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_deals_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "deal_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_deals_revenue_entry_id_fkey"
            columns: ["revenue_entry_id"]
            isOneToOne: true
            referencedRelation: "revenue_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          account_id: string | null
          archived_at: string | null
          created_at: string
          format: string | null
          id: string
          kind: string
          period: string
          progress: number
          progress_period: string | null
          target: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          archived_at?: string | null
          created_at?: string
          format?: string | null
          id?: string
          kind?: string
          period?: string
          progress?: number
          progress_period?: string | null
          target?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          archived_at?: string | null
          created_at?: string
          format?: string | null
          id?: string
          kind?: string
          period?: string
          progress?: number
          progress_period?: string | null
          target?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_checklist_items: {
        Row: {
          content_item_id: string
          created_at: string
          done: boolean
          id: string
          label: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content_item_id: string
          created_at?: string
          done?: boolean
          id?: string
          label: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          content_item_id?: string
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_checklist_items_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          account_id: string | null
          created_at: string
          creation_finished_at: string | null
          creation_started_at: string | null
          due_date: string | null
          format: string
          id: string
          minutes_logged: number
          notes: string | null
          parent_id: string | null
          platforms: string[]
          position: number
          priority: string
          publish_at: string | null
          ref_url: string | null
          resources: Json
          script_url: string | null
          stage: string
          tags: string[]
          thumbnail_concepts: string | null
          thumbnail_path: string | null
          thumbnail_url: string | null
          title: string
          title_options: string[]
          updated_at: string
          user_id: string
          workflow_done: string[]
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          creation_finished_at?: string | null
          creation_started_at?: string | null
          due_date?: string | null
          format?: string
          id?: string
          minutes_logged?: number
          notes?: string | null
          parent_id?: string | null
          platforms?: string[]
          position?: number
          priority?: string
          publish_at?: string | null
          ref_url?: string | null
          resources?: Json
          script_url?: string | null
          stage?: string
          tags?: string[]
          thumbnail_concepts?: string | null
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          title?: string
          title_options?: string[]
          updated_at?: string
          user_id?: string
          workflow_done?: string[]
        }
        Update: {
          account_id?: string | null
          created_at?: string
          creation_finished_at?: string | null
          creation_started_at?: string | null
          due_date?: string | null
          format?: string
          id?: string
          minutes_logged?: number
          notes?: string | null
          parent_id?: string | null
          platforms?: string[]
          position?: number
          priority?: string
          publish_at?: string | null
          ref_url?: string | null
          resources?: Json
          script_url?: string | null
          stage?: string
          tags?: string[]
          thumbnail_concepts?: string | null
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          title?: string
          title_options?: string[]
          updated_at?: string
          user_id?: string
          workflow_done?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "content_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_groups: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_tasks: {
        Row: {
          created_at: string
          deal_id: string
          done_at: string | null
          due_at: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          done_at?: string | null
          due_at?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          done_at?: string | null
          due_at?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "brand_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          account_id: string | null
          created_at: string
          current_value: number
          display: string
          due_date: string | null
          id: string
          kind: string
          measure: string
          notes: string
          start_date: string | null
          start_value: number
          status: string
          steps: Json
          target_value: number
          title: string
          unit: string
          updated_at: string
          user_id: string
          video_format: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          current_value?: number
          display?: string
          due_date?: string | null
          id?: string
          kind?: string
          measure?: string
          notes?: string
          start_date?: string | null
          start_value?: number
          status?: string
          steps?: Json
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
          user_id?: string
          video_format?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          current_value?: number
          display?: string
          due_date?: string | null
          id?: string
          kind?: string
          measure?: string
          notes?: string
          start_date?: string | null
          start_value?: number
          status?: string
          steps?: Json
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
          user_id?: string
          video_format?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_groups: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          name: string
          pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          name?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          name?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_groups_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          account_id: string | null
          content_item_id: string | null
          created_at: string
          ease: number
          group_id: string | null
          id: string
          note: string | null
          reach: number
          ref_url: string | null
          relevance: number
          source: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          content_item_id?: string | null
          created_at?: string
          ease?: number
          group_id?: string | null
          id?: string
          note?: string | null
          reach?: number
          ref_url?: string | null
          relevance?: number
          source?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          content_item_id?: string | null
          created_at?: string
          ease?: number
          group_id?: string | null
          id?: string
          note?: string | null
          reach?: number
          ref_url?: string | null
          relevance?: number
          source?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "idea_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          account_id: string | null
          body: string
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          kind: string
          mime_type: string | null
          pinned: boolean
          project_id: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          body?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          pinned?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Update: {
          account_id?: string | null
          body?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          pinned?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "library_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      library_projects: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          name: string
          pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          name?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          name?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_projects_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_links: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          url: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      revenue_entries: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          currency: string
          entry_date: string
          id: string
          kind: string
          note: string | null
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string
          currency?: string
          entry_date?: string
          id?: string
          kind?: string
          note?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          currency?: string
          entry_date?: string
          id?: string
          kind?: string
          note?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          created_at: string
          id: string
          stages: Json
          steps: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stages?: Json
          steps?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          stages?: Json
          steps?: Json
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
      delete_creator_profile: {
        Args: { _account_id: string; _delete_linked: boolean }
        Returns: undefined
      }
      promote_idea: { Args: { _idea_id: string }; Returns: string }
      seed_demo_data: { Args: { _uid: string }; Returns: undefined }
      seed_demo_deals: { Args: { _uid: string }; Returns: undefined }
      seed_demo_revenue: { Args: { _uid: string }; Returns: undefined }
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
  public: {
    Enums: {},
  },
} as const
