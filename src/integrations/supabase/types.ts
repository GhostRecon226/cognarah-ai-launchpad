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
          auto_published_count: number
          drafts_created: number
          error: string | null
          finished_at: string | null
          focus: string | null
          id: string
          last_heartbeat_at: string | null
          log: string | null
          manual_review_count: number
          requested_count: number
          started_at: string
          status: string
          trigger: string
          triggered_by: string | null
        }
        Insert: {
          auto_published_count?: number
          drafts_created?: number
          error?: string | null
          finished_at?: string | null
          focus?: string | null
          id?: string
          last_heartbeat_at?: string | null
          log?: string | null
          manual_review_count?: number
          requested_count?: number
          started_at?: string
          status?: string
          trigger?: string
          triggered_by?: string | null
        }
        Update: {
          auto_published_count?: number
          drafts_created?: number
          error?: string | null
          finished_at?: string | null
          focus?: string | null
          id?: string
          last_heartbeat_at?: string | null
          log?: string | null
          manual_review_count?: number
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
          auto_publish_paused: boolean
          created_at: string
          cron_expression: string
          default_count: number
          default_focus: string | null
          enabled: boolean
          id: string
          query_presets: string[]
          search_time_window: string
          singleton: boolean
          system_prompt: string | null
          updated_at: string
        }
        Insert: {
          auto_publish_paused?: boolean
          created_at?: string
          cron_expression?: string
          default_count?: number
          default_focus?: string | null
          enabled?: boolean
          id?: string
          query_presets?: string[]
          search_time_window?: string
          singleton?: boolean
          system_prompt?: string | null
          updated_at?: string
        }
        Update: {
          auto_publish_paused?: boolean
          created_at?: string
          cron_expression?: string
          default_count?: number
          default_focus?: string | null
          enabled?: boolean
          id?: string
          query_presets?: string[]
          search_time_window?: string
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
          africa_angle_type: string | null
          africa_angle_used: boolean | null
          africa_evidence: string[]
          africa_relevance_reason: string | null
          africa_relevance_score: number | null
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
          is_news: boolean
          key_takeaways: string[]
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
          africa_angle_type?: string | null
          africa_angle_used?: boolean | null
          africa_evidence?: string[]
          africa_relevance_reason?: string | null
          africa_relevance_score?: number | null
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
          is_news?: boolean
          key_takeaways?: string[]
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
          africa_angle_type?: string | null
          africa_angle_used?: boolean | null
          africa_evidence?: string[]
          africa_relevance_reason?: string | null
          africa_relevance_score?: number | null
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
          is_news?: boolean
          key_takeaways?: string[]
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
          long_intro: string | null
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
          long_intro?: string | null
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
          long_intro?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
          newsletter_provider?: string | null
          site_name?: string
          tagline?: string
          twitter?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      skill_audit_log: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          created_at: string
          event: string
          id: string
          matched_criteria: Json | null
          note: string | null
          run_id: string | null
          skill_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          event: string
          id?: string
          matched_criteria?: Json | null
          note?: string | null
          run_id?: string | null
          skill_id: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          event?: string
          id?: string
          matched_criteria?: Json | null
          note?: string | null
          run_id?: string | null
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_audit_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_audit_log_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          author: string
          bundled_files: string[] | null
          category: Database["public"]["Enums"]["skill_category"]
          content: string
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["skill_difficulty"]
          entry_type: string
          file_url: string | null
          id: string
          last_updated: string | null
          license_terms: string | null
          published: boolean
          slug: string
          source_attribution: string | null
          source_url: string | null
          stars_count: number | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          bundled_files?: string[] | null
          category: Database["public"]["Enums"]["skill_category"]
          content: string
          created_at?: string
          description: string
          difficulty: Database["public"]["Enums"]["skill_difficulty"]
          entry_type?: string
          file_url?: string | null
          id?: string
          last_updated?: string | null
          license_terms?: string | null
          published?: boolean
          slug: string
          source_attribution?: string | null
          source_url?: string | null
          stars_count?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          bundled_files?: string[] | null
          category?: Database["public"]["Enums"]["skill_category"]
          content?: string
          created_at?: string
          description?: string
          difficulty?: Database["public"]["Enums"]["skill_difficulty"]
          entry_type?: string
          file_url?: string | null
          id?: string
          last_updated?: string | null
          license_terms?: string | null
          published?: boolean
          slug?: string
          source_attribution?: string | null
          source_url?: string | null
          stars_count?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      startup_submissions: {
        Row: {
          admin_notes: string | null
          ai_technologies: string[]
          article_id: string | null
          awards: string | null
          business_model: string | null
          city: string
          cofounders: Json | null
          company_linkedin: string | null
          company_name: string
          company_stage: string
          competitors: string | null
          consent: boolean
          contact_method: string
          country: string
          differentiator: string | null
          founder_email: string
          founder_linkedin: string | null
          founder_name: string
          funding_raised: string | null
          id: string
          key_team_members: string | null
          logo_url: string
          markets_served: string[] | null
          milestones: string | null
          mission: string | null
          notable_investors: string | null
          partnerships: string | null
          pitch_video_url: string | null
          press_links: string | null
          pricing_model: string | null
          problem_solved: string
          product_demo: string | null
          product_description: string
          revenue_stage: string
          roadmap: string | null
          screenshot_urls: string[] | null
          status: Database["public"]["Enums"]["startup_submission_status"]
          submitted_at: string
          tagline: string | null
          target_audience: string
          team_size: string
          twitter_handle: string | null
          updated_at: string
          user_count: string | null
          website_url: string
          whatsapp_number: string | null
          year_founded: number
          youtube_url: string | null
        }
        Insert: {
          admin_notes?: string | null
          ai_technologies?: string[]
          article_id?: string | null
          awards?: string | null
          business_model?: string | null
          city: string
          cofounders?: Json | null
          company_linkedin?: string | null
          company_name: string
          company_stage: string
          competitors?: string | null
          consent?: boolean
          contact_method: string
          country: string
          differentiator?: string | null
          founder_email: string
          founder_linkedin?: string | null
          founder_name: string
          funding_raised?: string | null
          id?: string
          key_team_members?: string | null
          logo_url: string
          markets_served?: string[] | null
          milestones?: string | null
          mission?: string | null
          notable_investors?: string | null
          partnerships?: string | null
          pitch_video_url?: string | null
          press_links?: string | null
          pricing_model?: string | null
          problem_solved: string
          product_demo?: string | null
          product_description: string
          revenue_stage: string
          roadmap?: string | null
          screenshot_urls?: string[] | null
          status?: Database["public"]["Enums"]["startup_submission_status"]
          submitted_at?: string
          tagline?: string | null
          target_audience: string
          team_size: string
          twitter_handle?: string | null
          updated_at?: string
          user_count?: string | null
          website_url: string
          whatsapp_number?: string | null
          year_founded: number
          youtube_url?: string | null
        }
        Update: {
          admin_notes?: string | null
          ai_technologies?: string[]
          article_id?: string | null
          awards?: string | null
          business_model?: string | null
          city?: string
          cofounders?: Json | null
          company_linkedin?: string | null
          company_name?: string
          company_stage?: string
          competitors?: string | null
          consent?: boolean
          contact_method?: string
          country?: string
          differentiator?: string | null
          founder_email?: string
          founder_linkedin?: string | null
          founder_name?: string
          funding_raised?: string | null
          id?: string
          key_team_members?: string | null
          logo_url?: string
          markets_served?: string[] | null
          milestones?: string | null
          mission?: string | null
          notable_investors?: string | null
          partnerships?: string | null
          pitch_video_url?: string | null
          press_links?: string | null
          pricing_model?: string | null
          problem_solved?: string
          product_demo?: string | null
          product_description?: string
          revenue_stage?: string
          roadmap?: string | null
          screenshot_urls?: string[] | null
          status?: Database["public"]["Enums"]["startup_submission_status"]
          submitted_at?: string
          tagline?: string | null
          target_audience?: string
          team_size?: string
          twitter_handle?: string | null
          updated_at?: string
          user_count?: string | null
          website_url?: string
          whatsapp_number?: string | null
          year_founded?: number
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_submissions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "author"
      article_status: "draft" | "published"
      skill_category:
        | "Claude Code"
        | "Prompt Engineering"
        | "Automation"
        | "Workflow"
        | "Other"
      skill_difficulty: "Beginner" | "Intermediate" | "Advanced"
      startup_submission_status:
        | "pending"
        | "approved"
        | "rejected"
        | "published"
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
      skill_category: [
        "Claude Code",
        "Prompt Engineering",
        "Automation",
        "Workflow",
        "Other",
      ],
      skill_difficulty: ["Beginner", "Intermediate", "Advanced"],
      startup_submission_status: [
        "pending",
        "approved",
        "rejected",
        "published",
      ],
    },
  },
} as const
