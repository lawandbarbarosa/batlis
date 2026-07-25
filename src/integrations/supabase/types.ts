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
      books: {
        Row: {
          author: string | null
          content_json: Json
          cover_path: string | null
          created_at: string
          description: string | null
          id: string
          language_code: Database["public"]["Enums"]["target_lang"]
          level_cefr: Database["public"]["Enums"]["cefr_level"]
          title: string
        }
        Insert: {
          author?: string | null
          content_json?: Json
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          language_code: Database["public"]["Enums"]["target_lang"]
          level_cefr: Database["public"]["Enums"]["cefr_level"]
          title: string
        }
        Update: {
          author?: string | null
          content_json?: Json
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          language_code?: Database["public"]["Enums"]["target_lang"]
          level_cefr?: Database["public"]["Enums"]["cefr_level"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      courses: {
        Row: {
          cover_image_path: string | null
          created_at: string
          description_badini: string | null
          description_en: string | null
          description_sorani: string | null
          id: string
          level_id: string
          order_index: number
          title_badini: string
          title_en: string | null
          title_sorani: string
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string
          description_badini?: string | null
          description_en?: string | null
          description_sorani?: string | null
          id?: string
          level_id: string
          order_index?: number
          title_badini: string
          title_en?: string | null
          title_sorani: string
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string
          description_badini?: string | null
          description_en?: string | null
          description_sorani?: string | null
          id?: string
          level_id?: string
          order_index?: number
          title_badini?: string
          title_en?: string | null
          title_sorani?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: Database["public"]["Enums"]["target_lang"]
          flag_emoji: string
          name_badini: string
          name_en: string
          name_sorani: string
        }
        Insert: {
          code: Database["public"]["Enums"]["target_lang"]
          flag_emoji: string
          name_badini: string
          name_en: string
          name_sorani: string
        }
        Update: {
          code?: Database["public"]["Enums"]["target_lang"]
          flag_emoji?: string
          name_badini?: string
          name_en?: string
          name_sorani?: string
        }
        Relationships: []
      }
      lesson_exercises: {
        Row: {
          answer_json: Json
          id: string
          lesson_id: string
          order_index: number
          prompt_json: Json
          type: Database["public"]["Enums"]["exercise_type"]
        }
        Insert: {
          answer_json: Json
          id?: string
          lesson_id: string
          order_index: number
          prompt_json: Json
          type: Database["public"]["Enums"]["exercise_type"]
        }
        Update: {
          answer_json?: Json
          id?: string
          lesson_id?: string
          order_index?: number
          prompt_json?: Json
          type?: Database["public"]["Enums"]["exercise_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lesson_exercises_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_id: string
          created_at: string
          dialogue_json: Json
          grammar_md_badini: string | null
          grammar_md_en: string | null
          grammar_md_sorani: string | null
          id: string
          level_id: string
          order_index: number
          steps_json: Json
          summary_badini: string | null
          summary_en: string | null
          summary_sorani: string | null
          title_badini: string
          title_en: string | null
          title_sorani: string
        }
        Insert: {
          course_id: string
          created_at?: string
          dialogue_json?: Json
          grammar_md_badini?: string | null
          grammar_md_en?: string | null
          grammar_md_sorani?: string | null
          id?: string
          level_id: string
          order_index: number
          steps_json?: Json
          summary_badini?: string | null
          summary_en?: string | null
          summary_sorani?: string | null
          title_badini: string
          title_en?: string | null
          title_sorani: string
        }
        Update: {
          course_id?: string
          created_at?: string
          dialogue_json?: Json
          grammar_md_badini?: string | null
          grammar_md_en?: string | null
          grammar_md_sorani?: string | null
          id?: string
          level_id?: string
          order_index?: number
          steps_json?: Json
          summary_badini?: string | null
          summary_en?: string | null
          summary_sorani?: string | null
          title_badini?: string
          title_en?: string | null
          title_sorani?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          cefr: Database["public"]["Enums"]["cefr_level"]
          id: string
          language_code: Database["public"]["Enums"]["target_lang"]
          order_index: number
        }
        Insert: {
          cefr: Database["public"]["Enums"]["cefr_level"]
          id?: string
          language_code: Database["public"]["Enums"]["target_lang"]
          order_index: number
        }
        Update: {
          cefr?: Database["public"]["Enums"]["cefr_level"]
          id?: string
          language_code?: Database["public"]["Enums"]["target_lang"]
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "levels_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      placement_attempts: {
        Row: {
          answers_json: Json
          assigned_cefr: Database["public"]["Enums"]["cefr_level"] | null
          id: string
          language_code: Database["public"]["Enums"]["target_lang"]
          score: number
          taken_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          answers_json?: Json
          assigned_cefr?: Database["public"]["Enums"]["cefr_level"] | null
          id?: string
          language_code: Database["public"]["Enums"]["target_lang"]
          score?: number
          taken_at?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          answers_json?: Json
          assigned_cefr?: Database["public"]["Enums"]["cefr_level"] | null
          id?: string
          language_code?: Database["public"]["Enums"]["target_lang"]
          score?: number
          taken_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_attempts_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      placement_questions: {
        Row: {
          answer_json: Json
          difficulty_band: Database["public"]["Enums"]["cefr_level"]
          id: string
          language_code: Database["public"]["Enums"]["target_lang"]
          order_index: number
          question_json: Json
        }
        Insert: {
          answer_json: Json
          difficulty_band: Database["public"]["Enums"]["cefr_level"]
          id?: string
          language_code: Database["public"]["Enums"]["target_lang"]
          order_index?: number
          question_json: Json
        }
        Update: {
          answer_json?: Json
          difficulty_band?: Database["public"]["Enums"]["cefr_level"]
          id?: string
          language_code?: Database["public"]["Enums"]["target_lang"]
          order_index?: number
          question_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "placement_questions_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          active_target_lang: Database["public"]["Enums"]["target_lang"] | null
          created_at: string
          daily_goal_minutes: number
          display_name: string | null
          id: string
          last_active_date: string | null
          streak_count: number
          ui_dialect: Database["public"]["Enums"]["ui_dialect"]
          updated_at: string
        }
        Insert: {
          active_target_lang?: Database["public"]["Enums"]["target_lang"] | null
          created_at?: string
          daily_goal_minutes?: number
          display_name?: string | null
          id: string
          last_active_date?: string | null
          streak_count?: number
          ui_dialect?: Database["public"]["Enums"]["ui_dialect"]
          updated_at?: string
        }
        Update: {
          active_target_lang?: Database["public"]["Enums"]["target_lang"] | null
          created_at?: string
          daily_goal_minutes?: number
          display_name?: string | null
          id?: string
          last_active_date?: string | null
          streak_count?: number
          ui_dialect?: Database["public"]["Enums"]["ui_dialect"]
          updated_at?: string
        }
        Relationships: []
      }
      user_language_levels: {
        Row: {
          current_cefr: Database["public"]["Enums"]["cefr_level"]
          id: string
          language_code: Database["public"]["Enums"]["target_lang"]
          updated_at: string
          user_id: string
        }
        Insert: {
          current_cefr?: Database["public"]["Enums"]["cefr_level"]
          id?: string
          language_code: Database["public"]["Enums"]["target_lang"]
          updated_at?: string
          user_id: string
        }
        Update: {
          current_cefr?: Database["public"]["Enums"]["cefr_level"]
          id?: string
          language_code?: Database["public"]["Enums"]["target_lang"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_language_levels_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      user_lesson_progress: {
        Row: {
          attempts: number
          completed_at: string | null
          id: string
          last_attempt_at: string | null
          lesson_id: string
          passed: boolean
          score: number
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          lesson_id: string
          passed?: boolean
          score?: number
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          lesson_id?: string
          passed?: boolean
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
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
      user_vocab_progress: {
        Row: {
          box: number
          correct_count: number
          id: string
          incorrect_count: number
          next_review_at: string
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          box?: number
          correct_count?: number
          id?: string
          incorrect_count?: number
          next_review_at?: string
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          box?: number
          correct_count?: number
          id?: string
          incorrect_count?: number
          next_review_at?: string
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vocab_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "vocab_words"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          banner_path: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          language_code: Database["public"]["Enums"]["target_lang"]
          level_cefr: Database["public"]["Enums"]["cefr_level"]
          title: string
          transcript_json: Json
          video_path: string | null
          youtube_id: string | null
        }
        Insert: {
          banner_path?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          language_code: Database["public"]["Enums"]["target_lang"]
          level_cefr: Database["public"]["Enums"]["cefr_level"]
          title: string
          transcript_json?: Json
          video_path?: string | null
          youtube_id?: string | null
        }
        Update: {
          banner_path?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          language_code?: Database["public"]["Enums"]["target_lang"]
          level_cefr?: Database["public"]["Enums"]["cefr_level"]
          title?: string
          transcript_json?: Json
          video_path?: string | null
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      vocab_words: {
        Row: {
          audio_url: string | null
          example_badini: string | null
          example_sentence: string | null
          example_sorani: string | null
          id: string
          kurdish_badini: string
          kurdish_sorani: string
          language_code: Database["public"]["Enums"]["target_lang"]
          level_cefr: Database["public"]["Enums"]["cefr_level"]
          topic: string
          word: string
        }
        Insert: {
          audio_url?: string | null
          example_badini?: string | null
          example_sentence?: string | null
          example_sorani?: string | null
          id?: string
          kurdish_badini: string
          kurdish_sorani: string
          language_code: Database["public"]["Enums"]["target_lang"]
          level_cefr: Database["public"]["Enums"]["cefr_level"]
          topic: string
          word: string
        }
        Update: {
          audio_url?: string | null
          example_badini?: string | null
          example_sentence?: string | null
          example_sorani?: string | null
          id?: string
          kurdish_badini?: string
          kurdish_sorani?: string
          language_code?: Database["public"]["Enums"]["target_lang"]
          level_cefr?: Database["public"]["Enums"]["cefr_level"]
          topic?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocab_words_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      cefr_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
      exercise_type:
        | "multiple_choice"
        | "fill_blank"
        | "listening"
        | "translate"
      target_lang: "en" | "de" | "ar" | "ko"
      ui_dialect: "sorani" | "badini" | "english"
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
      app_role: ["admin", "user"],
      cefr_level: ["A1", "A2", "B1", "B2", "C1", "C2"],
      exercise_type: [
        "multiple_choice",
        "fill_blank",
        "listening",
        "translate",
      ],
      target_lang: ["en", "de", "ar", "ko"],
      ui_dialect: ["sorani", "badini", "english"],
    },
  },
} as const
