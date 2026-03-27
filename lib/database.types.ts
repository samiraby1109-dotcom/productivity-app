// Manual type definitions for Supabase tables.
//
// IMPORTANT: Every table must include a `Relationships` field and the public
// schema must include `Views` and `Functions` — these are required by
// GenericTable / GenericSchema in @supabase/supabase-js v2.47+.
// Without them, `Database extends GenericSchema` is false and every
// TablesUpdate<> / TablesInsert<> utility collapses to `never`.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Inline the shape from @supabase/supabase-js src/lib/rest/types/common/common.ts
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          password_hint: string | null;
          decoy_code_hash: string;
          password_salt: string;
          created_at: string;
          email_verified_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          password_hint?: string | null;
          decoy_code_hash: string;
          password_salt: string;
          created_at?: string;
          email_verified_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          password_hint?: string | null;
          decoy_code_hash?: string;
          password_salt?: string;
          created_at?: string;
          email_verified_at?: string | null;
        };
        Relationships: Relationship[];
      };
      vault_entries: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
          status: "ACTIVE" | "ARCHIVED" | "PURGED";
          incident_types: string[];
          flags_police: boolean;
          flags_children: boolean;
          flags_witness: boolean;
          has_attachments: boolean;
          encrypted_payload: string;
          payload_version: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
          status?: "ACTIVE" | "ARCHIVED" | "PURGED";
          incident_types?: string[];
          flags_police?: boolean;
          flags_children?: boolean;
          flags_witness?: boolean;
          has_attachments?: boolean;
          encrypted_payload: string;
          payload_version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
          status?: "ACTIVE" | "ARCHIVED" | "PURGED";
          incident_types?: string[];
          flags_police?: boolean;
          flags_children?: boolean;
          flags_witness?: boolean;
          has_attachments?: boolean;
          encrypted_payload?: string;
          payload_version?: number;
        };
        Relationships: Relationship[];
      };
      vault_media: {
        Row: {
          id: string;
          entry_id: string;
          user_id: string;
          created_at: string;
          kind: "IMAGE" | "VIDEO" | "AUDIO";
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          encrypted_media_key: string;
          encrypted_media_iv: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          user_id: string;
          created_at?: string;
          kind: "IMAGE" | "VIDEO" | "AUDIO";
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          encrypted_media_key: string;
          encrypted_media_iv: string;
        };
        Update: {
          id?: string;
          entry_id?: string;
          user_id?: string;
          created_at?: string;
          kind?: "IMAGE" | "VIDEO" | "AUDIO";
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
          encrypted_media_key?: string;
          encrypted_media_iv?: string;
        };
        Relationships: Relationship[];
      };
      vault_contacts: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
          relationship: string;
          encrypted_payload: string;
          payload_version: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
          relationship?: string;
          encrypted_payload: string;
          payload_version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
          relationship?: string;
          encrypted_payload?: string;
          payload_version?: number;
        };
        Relationships: Relationship[];
      };
      archive_queue: {
        Row: {
          entry_id: string;
          user_id: string;
          archived_at: string;
          purge_at: string;
        };
        Insert: {
          entry_id: string;
          user_id: string;
          archived_at?: string;
          purge_at: string;
        };
        Update: {
          entry_id?: string;
          user_id?: string;
          archived_at?: string;
          purge_at?: string;
        };
        Relationships: Relationship[];
      };
    };
    // Required by GenericSchema — empty since we have no views
    Views: Record<string, never>;
    Functions: {
      increment_rate_limit: {
        Args: { p_key: string; p_window_start: number };
        Returns: number;
      };
    };
  };
}
