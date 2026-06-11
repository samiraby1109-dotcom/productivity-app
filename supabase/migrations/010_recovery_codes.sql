-- ─── Content-preserving recovery codes ───────────────────────────────────────
-- The vault content key (VMK) is wrapped under the password AND under each
-- recovery code. These columns/table store only the *wrapped* copies plus an
-- opaque per-code lookup hash. The server never sees the VMK, the password, or
-- a recovery code in plaintext.

-- VMK wrapped under the password-derived key. Nullable: legacy accounts created
-- before this migration have no VMK and keep using the password-derived key
-- directly until they re-establish one.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS vmk_wrapped     TEXT,
  ADD COLUMN IF NOT EXISTS vmk_wrapped_iv  TEXT,
  ADD COLUMN IF NOT EXISTS vmk_salt        TEXT;

CREATE TABLE IF NOT EXISTS public.recovery_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Slow PBKDF2 hash of the code, computed client-side (server never sees the
  -- plaintext code). Used only to locate the matching wrapped-VMK row.
  code_hash       TEXT NOT NULL,
  -- VMK wrapped under a key derived from this recovery code.
  vmk_wrapped     TEXT NOT NULL,
  vmk_wrapped_iv  TEXT NOT NULL,
  rc_salt         TEXT NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_lookup
  ON public.recovery_codes (user_id, code_hash);

-- Defence-in-depth: no anon/public access; server uses the service role.
ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No anon access recovery_codes"
  ON public.recovery_codes FOR ALL TO anon USING (FALSE);
