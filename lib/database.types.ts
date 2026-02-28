// Manual type definitions for Supabase tables.
// Uses flat, explicit Insert/Update types — avoids self-referential
// Database[...]["Row"] cycles that TypeScript resolves as `never`.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          password_hint?: string | null;
          decoy_code_hash: string;
          password_salt: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          password_hint?: string | null;
          decoy_code_hash?: string;
          password_salt?: string;
          created_at?: string;
        };
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
      };
    };
  };
}
