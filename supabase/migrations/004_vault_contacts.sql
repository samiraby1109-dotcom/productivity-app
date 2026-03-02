-- ─── Vault contacts ───────────────────────────────────────────────────────────
-- Stores encrypted emergency/trusted contacts (DV advocates, attorneys, etc.)
-- All PII (name, phone, email, notes) is encrypted client-side via AES-GCM.
-- Only the relationship label is stored in cleartext for display ordering.

CREATE TABLE IF NOT EXISTS public.vault_contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Cleartext relationship category (e.g. "DV Advocate", "Attorney")
  relationship      TEXT NOT NULL DEFAULT '',
  encrypted_payload TEXT NOT NULL,
  payload_version   INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_vault_contacts_user_created
  ON public.vault_contacts (user_id, created_at DESC);

ALTER TABLE public.vault_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No anon access vault_contacts" ON public.vault_contacts FOR ALL TO anon USING (FALSE);

CREATE TRIGGER vault_contacts_updated_at
  BEFORE UPDATE ON public.vault_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
