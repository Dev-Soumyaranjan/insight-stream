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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_complete: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_complete?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_complete?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_videos: {
        Row: {
          channel_title: string
          created_at: string
          duration_seconds: number
          final_intent: Database["public"]["Enums"]["zen_intent"]
          id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          youtube_video_id: string
        }
        Insert: {
          channel_title: string
          created_at?: string
          duration_seconds?: number
          final_intent?: Database["public"]["Enums"]["zen_intent"]
          id?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          youtube_video_id: string
        }
        Update: {
          channel_title?: string
          created_at?: string
          duration_seconds?: number
          final_intent?: Database["public"]["Enums"]["zen_intent"]
          id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          youtube_video_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          daily_limit_minutes: number
          id: string
          preferred_intent: Database["public"]["Enums"]["zen_intent"] | null
          privacy_mode: boolean
          session_reminders: boolean
          tracking_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_limit_minutes?: number
          id?: string
          preferred_intent?: Database["public"]["Enums"]["zen_intent"] | null
          privacy_mode?: boolean
          session_reminders?: boolean
          tracking_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_limit_minutes?: number
          id?: string
          preferred_intent?: Database["public"]["Enums"]["zen_intent"] | null
          privacy_mode?: boolean
          session_reminders?: boolean
          tracking_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_history: {
        Row: {
          channel_id: string | null
          channel_title: string
          created_at: string
          final_intent: Database["public"]["Enums"]["zen_intent"]
          id: string
          inferred_intent: Database["public"]["Enums"]["zen_intent"]
          skip_count: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          user_override_intent: Database["public"]["Enums"]["zen_intent"] | null
          watched_at: string
          watched_duration: number
          youtube_video_id: string
        }
        Insert: {
          channel_id?: string | null
          channel_title: string
          created_at?: string
          final_intent?: Database["public"]["Enums"]["zen_intent"]
          id?: string
          inferred_intent?: Database["public"]["Enums"]["zen_intent"]
          skip_count?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          user_override_intent?:
            | Database["public"]["Enums"]["zen_intent"]
            | null
          watched_at?: string
          watched_duration?: number
          youtube_video_id: string
        }
        Update: {
          channel_id?: string | null
          channel_title?: string
          created_at?: string
          final_intent?: Database["public"]["Enums"]["zen_intent"]
          id?: string
          inferred_intent?: Database["public"]["Enums"]["zen_intent"]
          skip_count?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          user_override_intent?:
            | Database["public"]["Enums"]["zen_intent"]
            | null
          watched_at?: string
          watched_duration?: number
          youtube_video_id?: string
        }
        Relationships: []
      }
      video_notes: {
        Row: {
          channel_title: string | null
          content: string
          created_at: string
          id: string
          timestamp_seconds: number
          title: string
          topic: string | null
          updated_at: string
          user_id: string
          youtube_video_id: string
        }
        Insert: {
          channel_title?: string | null
          content: string
          created_at?: string
          id?: string
          timestamp_seconds?: number
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
          youtube_video_id: string
        }
        Update: {
          channel_title?: string | null
          content?: string
          created_at?: string
          id?: string
          timestamp_seconds?: number
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
          youtube_video_id?: string
        }
        Relationships: []
      }
      video_reactions: {
        Row: {
          created_at: string
          id: string
          reaction: Database["public"]["Enums"]["video_reaction_type"]
          updated_at: string
          user_id: string
          youtube_video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction: Database["public"]["Enums"]["video_reaction_type"]
          updated_at?: string
          user_id: string
          youtube_video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: Database["public"]["Enums"]["video_reaction_type"]
          updated_at?: string
          user_id?: string
          youtube_video_id?: string
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
      video_reaction_type: "like" | "dislike"
      zen_intent: "Learning" | "Entertainment" | "Other"
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
      video_reaction_type: ["like", "dislike"],
      zen_intent: ["Learning", "Entertainment", "Other"],
    },
  },
} as const
