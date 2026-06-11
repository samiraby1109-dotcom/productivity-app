-- ─── Lock down the rate-limit RPC ─────────────────────────────────────────────
-- increment_rate_limit() is SECURITY DEFINER, so it bypasses the RLS on
-- public.rate_limits. PostgREST exposes public-schema functions to the `anon`
-- role (the NEXT_PUBLIC_ anon key), which means anyone holding that public key
-- could call this RPC directly to insert unbounded (key, window_start) rows
-- (storage-exhaustion DoS) and pre-inflate arbitrary rate-limit buckets.
--
-- Only the server (service role) ever needs to call it, so revoke the default
-- PUBLIC grant and hand execute to service_role explicitly.

REVOKE EXECUTE ON FUNCTION public.increment_rate_limit(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_rate_limit(text, bigint) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_rate_limit(text, bigint) TO service_role;
