// Auto-generated type definitions for Supabase tables.
// Keep in sync with supabase/migrations.

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
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["vault_entries"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vault_entries"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["vault_media"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vault_media"]["Insert"]>;
      };
      archive_queue: {
        Row: {
          entry_id: string;
          user_id: string;
          archived_at: string;
          purge_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["archive_queue"]["Row"], "archived_at"> & {
          archived_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["archive_queue"]["Insert"]>;
      };
    };
  };
}
