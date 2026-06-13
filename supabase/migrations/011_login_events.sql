-- ─── Sign-in activity log ─────────────────────────────────────────────────────
-- Lets a survivor review recent sign-ins (full + decoy) and failed password
-- attempts, so an unfamiliar access can be noticed. Writes are best-effort in
-- the login route and reads degrade gracefully, so authentication works whether
-- or not this migration has been applied.

CREATE TABLE IF NOT EXISTS public.login_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  outcome     TEXT NOT NULL,            -- 'full' | 'decoy' | 'failed'
  ip_hash     TEXT,                     -- HMAC of the IP (no raw addresses stored)
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_events_user_time
  ON public.login_events (user_id, created_at DESC);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No anon access login_events" ON public.login_events;
CREATE POLICY "No anon access login_events" ON public.login_events FOR ALL TO anon USING (FALSE);
