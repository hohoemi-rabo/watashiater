/**
 * Supabase スキーマから自動生成した型（チケット02）。手で編集しない。
 * スキーマ変更（supabase/migrations/ に SQL を追加して適用）のたびに、
 * supabase MCP の generate_typescript_types で再生成してこのファイルを上書きする。
 * 生成元プロジェクト: watashiater (shqkwdxpjnfnctatukqn) / 2026-08-12
 */
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          body_text: string
          created_at: string
          custom_title: string | null
          id: string
          prompt_id: number | null
          subject_id: string
          updated_at: string
        }
        Insert: {
          body_text?: string
          created_at?: string
          custom_title?: string | null
          id?: string
          prompt_id?: number | null
          subject_id: string
          updated_at?: string
        }
        Update: {
          body_text?: string
          created_at?: string
          custom_title?: string | null
          id?: string
          prompt_id?: number | null
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          display_name: string
          id: string
          joined_at: string
          member_user_id: string
          subject_id: string
        }
        Insert: {
          display_name: string
          id?: string
          joined_at?: string
          member_user_id: string
          subject_id: string
        }
        Update: {
          display_name?: string
          id?: string
          joined_at?: string
          member_user_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          subject_id: string
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          subject_id: string
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          subject_id?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      life_story: {
        Row: {
          body_text: string
          edited_by_user: boolean
          generated_at: string
          id: string
          subject_id: string
        }
        Insert: {
          body_text: string
          edited_by_user?: boolean
          generated_at?: string
          id?: string
          subject_id: string
        }
        Update: {
          body_text?: string
          edited_by_user?: boolean
          generated_at?: string
          id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "life_story_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: true
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          answer_id: string
          board_rotation: number | null
          board_x: number | null
          board_y: number | null
          board_z: number | null
          created_at: string
          id: string
          r2_key: string
        }
        Insert: {
          answer_id: string
          board_rotation?: number | null
          board_x?: number | null
          board_y?: number | null
          board_z?: number | null
          created_at?: string
          id?: string
          r2_key: string
        }
        Update: {
          answer_id?: string
          board_rotation?: number | null
          board_x?: number | null
          board_y?: number | null
          board_z?: number | null
          created_at?: string
          id?: string
          r2_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          id: number
          is_photo_prompt: boolean
          sort_order: number
          title: string
        }
        Insert: {
          id: number
          is_photo_prompt?: boolean
          sort_order: number
          title: string
        }
        Update: {
          id?: number
          is_photo_prompt?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          id: string
          member_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          answer_id: string
          created_at: string
          duration_sec: number
          id: string
          r2_key: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          duration_sec: number
          id?: string
          r2_key: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          duration_sec?: number
          id?: string
          r2_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          board_seed: number
          cover_photo_id: string | null
          created_at: string
          id: string
          nickname: string
          owner_user_id: string
          subject_type: string
        }
        Insert: {
          board_seed?: number
          cover_photo_id?: string | null
          created_at?: string
          id?: string
          nickname: string
          owner_user_id: string
          subject_type?: string
        }
        Update: {
          board_seed?: number
          cover_photo_id?: string | null
          created_at?: string
          id?: string
          nickname?: string
          owner_user_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_cover_photo_id_fkey"
            columns: ["cover_photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      view_links: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          slug: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          slug: string
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          slug?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "view_links_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      redeem_invite_code: {
        Args: { p_code: string; p_display_name: string }
        Returns: Json
      }
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
