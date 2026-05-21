// Placeholder Supabase generated types.
// Replace by running:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
// once the project is created and the schema in supabase/schema.sql has been applied.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          plan: 'free' | 'student' | 'team' | 'enterprise';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          plan?: 'free' | 'student' | 'team' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          default_format: string;
          default_depth: string;
          auto_scan_page: boolean;
          cache_outputs: boolean;
          spaced_repetition: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_format?: string;
          default_depth?: string;
          auto_scan_page?: boolean;
          cache_outputs?: boolean;
          spaced_repetition?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>;
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          user_id: string;
          code: string | null;
          name: string;
          color: string;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code?: string | null;
          name: string;
          color?: string;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['courses']['Insert']>;
        Relationships: [];
      };
      source_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: 'google_drive' | 'notion' | 'canvas' | 'moodle' | 'obsidian';
          connected: boolean;
          display_name: string | null;
          detail_label: string | null;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          metadata: Json;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: 'google_drive' | 'notion' | 'canvas' | 'moodle' | 'obsidian';
          connected?: boolean;
          display_name?: string | null;
          detail_label?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          metadata?: Json;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['source_connections']['Insert']>;
        Relationships: [];
      };
      source_cache: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          source_key: string;
          content_hash: string;
          content: string;
          source_name: string;
          source_url: string | null;
          embedding: number[] | null;
          fetched_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          source_key: string;
          content_hash: string;
          content: string;
          source_name: string;
          source_url?: string | null;
          embedding?: number[] | null;
          fetched_at?: string;
          expires_at?: string;
        };
        Update: Partial<Database['public']['Tables']['source_cache']['Insert']>;
        Relationships: [];
      };
      generated_outputs: {
        Row: {
          id: string;
          user_id: string;
          course_id: string | null;
          cache_key: string;
          output_format:
            | 'flashcards'
            | 'study_guide'
            | 'notes'
            | 'practice_questions'
            | 'summary'
            | 'mind_map';
          depth: 'quick' | 'standard' | 'deep';
          output: Json;
          sources_read: Json;
          sources_used_count: number;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          model_used: string | null;
          cache_hit: boolean;
          public_share: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id?: string | null;
          cache_key: string;
          output_format:
            | 'flashcards'
            | 'study_guide'
            | 'notes'
            | 'practice_questions'
            | 'summary'
            | 'mind_map';
          depth?: 'quick' | 'standard' | 'deep';
          output: Json;
          sources_read?: Json;
          sources_used_count?: number;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          model_used?: string | null;
          cache_hit?: boolean;
          public_share?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['generated_outputs']['Insert']>;
        Relationships: [];
      };
      token_usage: {
        Row: {
          user_id: string;
          date: string;
          tokens_used: number;
          requests: number;
        };
        Insert: {
          user_id: string;
          date?: string;
          tokens_used?: number;
          requests?: number;
        };
        Update: Partial<Database['public']['Tables']['token_usage']['Insert']>;
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          key_hash: string;
          key_prefix: string;
          plan: string;
          usage_count: number;
          last_used_at: string | null;
          expires_at: string | null;
          revoked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          key_hash: string;
          key_prefix: string;
          plan?: string;
          usage_count?: number;
          last_used_at?: string | null;
          expires_at?: string | null;
          revoked?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['api_keys']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_token_usage: {
        Args: { p_user_id: string; p_date: string; p_tokens: number };
        Returns: void;
      };
      increment_api_key_usage: {
        Args: { p_id: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
