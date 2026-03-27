-- ─── Distributed rate limiting ────────────────────────────────────────────────
-- Used by login and register endpoints to enforce per-IP request limits.
-- Works across all Vercel serverless instances (unlike in-memory maps).
-- Rows are cheap — old windows are never queried and cleaned up by cron.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key           TEXT    NOT NULL,
  window_start  BIGINT  NOT NULL,   -- Unix minute: floor(epoch_ms / 60000)
  count         INT     NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key
  ON public.rate_limits (key);

-- Atomic upsert-and-increment (SECURITY DEFINER bypasses RLS so the
-- service-role client can call it without needing table-level grants).
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key         TEXT,
  p_window_start BIGINT
) RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count;
$$;

-- RLS: block all direct table access; only the SECURITY DEFINER RPC is used.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to rate_limits"
  ON public.rate_limits
  FOR ALL
  TO anon, authenticated
  USING (false);

-- ─── Missing index on archive_queue ───────────────────────────────────────────
-- The cron purge and archive list queries filter by user_id; without this
-- index they do a full table scan once the queue grows.

CREATE INDEX IF NOT EXISTS idx_archive_queue_user
  ON public.archive_queue (user_id);
