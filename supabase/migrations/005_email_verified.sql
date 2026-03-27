-- ─── Optional email verification ──────────────────────────────────────────────
-- Adds email_verified_at to users.
-- Verification is SOFT — the app works regardless of whether this is set.
-- Never gate feature access on this column.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NULL;
