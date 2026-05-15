-- ─── Persistent login lockout ─────────────────────────────────────────────────
-- The in-memory lockoutMap in lib/auth.ts resets on every Vercel cold start
-- and is per-instance, so an attacker rotating through serverless instances
-- never accumulates 5 failed attempts. These columns let lib/auth track the
-- counter and lockout deadline in the DB instead.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until    TIMESTAMPTZ;
