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
      agent_runs: {
        Row: {
          drafts_created: number
          error: string | null
          finished_at: string | null
          focus: string | null
          id: string
          log: string | null
          requested_count: number
          started_at: string
          status: string
          trigger: string
          triggered_by: string | null
        }
        Insert: {
          drafts_created?: number
          error?: string | null
          finished_at?: string | null
          focus?: string | null
          id?: string
          log?: string | null
          requested_count?: number
          started_at?: string
          status?: string
          trigger?: string
          triggered_by?: string | null
        }
        Update: {
          drafts_created?: number
          error?: string | null
          finished_at?: string | null
          focus?: string | null
          id?: string
          log?: string | null
          requested_count?: number
          started_at?: string
          status?: string
          trigger?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      agent_seen_sources: {
        Row: {
          article_id: string | null
          created_at: string
          run_id: string | null
          url: string
          url_hash: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          run_id?: string | null
          url: string
          url_hash: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          run_id?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_seen_sources_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_seen_sources_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          created_at: string
          cron_expression: string
          default_count: number
          default_focus: string | null
          enabled: boolean
          id: string
          singleton: boolean
          system_prompt: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cron_expression?: string
          default_count?: number
          default_focus?: string | null
          enabled?: boolean
          id?: string
          singleton?: boolean
          system_prompt?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cron_expression?: string
          default_count?: number
          default_focus?: string | null
          enabled?: boolean
          id?: string
          singleton?: boolean
          system_prompt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_sources: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          agent_run_id: string | null
          author_id: string | null
          author_user_id: string | null
          body: string
          category_id: string | null
          created_at: string
          excerpt: string | null
          hero_image: string | null
          id: string
          is_featured: boolean
          meta_description: string | null
          published_at: string | null
          read_time: number
          seo_title: string | null
          slug: string
          source_urls: string[]
          status: Database["public"]["Enums"]["article_status"]
          tags: string[]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          agent_run_id?: string | null
          author_id?: string | null
          author_user_id?: string | null
          body?: string
          category_id?: string | null
          created_at?: string
          excerpt?: string | null
          hero_image?: string | null
          id?: string
          is_featured?: boolean
          meta_description?: string | null
          published_at?: string | null
          read_time?: number
          seo_title?: string | null
          slug: string
          source_urls?: string[]
          status?: Database["public"]["Enums"]["article_status"]
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          agent_run_id?: string | null
          author_id?: string | null
          author_user_id?: string | null
          body?: string
          category_id?: string | null
          created_at?: string
          excerpt?: string | null
          hero_image?: string | null
          id?: string
          is_featured?: boolean
          meta_description?: string | null
          published_at?: string | null
          read_time?: number
          seo_title?: string | null
          slug?: string
          source_urls?: string[]
          status?: Database["public"]["Enums"]["article_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          linkedin: string | null
          name: string
          photo_url: string | null
          slug: string
          twitter: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          linkedin?: string | null
          name: string
          photo_url?: string | null
          slug: string
          twitter?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          linkedin?: string | null
          name?: string
          photo_url?: string | null
          slug?: string
          twitter?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          facebook: string | null
          id: number
          instagram: string | null
          linkedin: string | null
          logo_url: string | null
          newsletter_api_key: string | null
          newsletter_provider: string | null
          site_name: string
          tagline: string
          twitter: string | null
          updated_at: string
        }
        Insert: {
          facebook?: string | null
          id?: number
          instagram?: string | null
          linkedin?: string | null
          logo_url?: string | null
          newsletter_api_key?: string | null
          newsletter_provider?: string | null
          site_name?: string
          tagline?: string
          twitter?: string | null
          updated_at?: string
        }
        Update: {
          facebook?: string | null
          id?: number
          instagram?: string | null
          linkedin?: string | null
          logo_url?: string | null
          newsletter_api_key?: string | null
          newsletter_provider?: string | null
          site_name?: string
          tagline?: string
          twitter?: string | null
          updated_at?: string
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_article_views: { Args: { _slug: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "editor" | "author"
      article_status: "draft" | "published"
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
      app_role: ["admin", "editor", "author"],
      article_status: ["draft", "published"],
    },
  },
} as const
