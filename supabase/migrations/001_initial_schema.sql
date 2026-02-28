-- ─── Enable extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  password_hint   TEXT,
  decoy_code_hash TEXT NOT NULL,
  -- base64 salt used by client to derive vault encryption key via PBKDF2
  password_salt   TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Vault entries ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vault_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'ARCHIVED', 'PURGED')),
  incident_types    TEXT[] NOT NULL DEFAULT '{}',
  flags_police      BOOLEAN NOT NULL DEFAULT FALSE,
  flags_children    BOOLEAN NOT NULL DEFAULT FALSE,
  flags_witness     BOOLEAN NOT NULL DEFAULT FALSE,
  has_attachments   BOOLEAN NOT NULL DEFAULT FALSE,
  encrypted_payload TEXT NOT NULL,
  payload_version   INT NOT NULL DEFAULT 1
);

-- ─── Vault media ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vault_media (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id             UUID NOT NULL REFERENCES public.vault_entries(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind                 TEXT NOT NULL CHECK (kind IN ('IMAGE', 'VIDEO', 'AUDIO')),
  mime_type            TEXT NOT NULL,
  size_bytes           BIGINT NOT NULL,
  storage_path         TEXT NOT NULL,
  encrypted_media_key  TEXT NOT NULL,
  encrypted_media_iv   TEXT NOT NULL
);

-- ─── Archive queue ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archive_queue (
  entry_id     UUID PRIMARY KEY REFERENCES public.vault_entries(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  archived_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purge_at     TIMESTAMPTZ NOT NULL
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vault_entries_user_status_created
  ON public.vault_entries (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_entries_incident_types
  ON public.vault_entries USING GIN (incident_types);

CREATE INDEX IF NOT EXISTS idx_vault_entries_flags_police
  ON public.vault_entries (user_id, flags_police) WHERE flags_police = TRUE;

CREATE INDEX IF NOT EXISTS idx_vault_entries_flags_children
  ON public.vault_entries (user_id, flags_children) WHERE flags_children = TRUE;

CREATE INDEX IF NOT EXISTS idx_vault_entries_flags_witness
  ON public.vault_entries (user_id, flags_witness) WHERE flags_witness = TRUE;

CREATE INDEX IF NOT EXISTS idx_vault_entries_has_attachments
  ON public.vault_entries (user_id, has_attachments) WHERE has_attachments = TRUE;

CREATE INDEX IF NOT EXISTS idx_vault_media_entry
  ON public.vault_media (entry_id);

CREATE INDEX IF NOT EXISTS idx_archive_queue_purge
  ON public.archive_queue (purge_at);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- NOTE: Our server routes use the service role key and enforce user_id manually.
-- RLS below is a defence-in-depth layer.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_queue ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so policies only affect anon/authenticated roles.
-- No anon/public access allowed to any table.
CREATE POLICY "No anon access users" ON public.users FOR ALL TO anon USING (FALSE);
CREATE POLICY "No anon access vault_entries" ON public.vault_entries FOR ALL TO anon USING (FALSE);
CREATE POLICY "No anon access vault_media" ON public.vault_media FOR ALL TO anon USING (FALSE);
CREATE POLICY "No anon access archive_queue" ON public.archive_queue FOR ALL TO anon USING (FALSE);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vault_entries_updated_at
  BEFORE UPDATE ON public.vault_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
