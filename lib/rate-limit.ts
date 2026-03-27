/**
 * Distributed rate limiter — Supabase-backed sliding window (1-minute buckets).
 *
 * Works across ALL Vercel serverless instances because state lives in Supabase,
 * not in-memory. Uses an atomic SQL upsert via the increment_rate_limit RPC.
 *
 * Fail-open policy: if the DB call fails (network, cold start) we log a warning
 * and allow the request rather than hard-blocking legitimate users.
 *
 * Upgrade path for 1000+ users: swap createServiceClient() for an Upstash Redis
 * client and replace the RPC call with INCR + EXPIRE. The interface stays the same.
 */
import { createServiceClient } from "./db";

/**
 * Check whether a request is within the allowed rate.
 *
 * @param key          Unique key for this limit bucket, e.g. `login:1.2.3.4`
 * @param maxPerMinute Maximum allowed requests per 60-second window
 * @returns            true = request allowed, false = rate-limited (return 429)
 */
export async function checkRateLimit(
  key: string,
  maxPerMinute: number
): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / 60_000); // unix minute

  try {
    const db = createServiceClient();
    const { data, error } = await db.rpc("increment_rate_limit", {
      p_key: key,
      p_window_start: windowStart,
    });

    if (error) {
      console.warn("[rate-limit] DB error, failing open:", error.message);
      return true; // fail open — never hard-block on infrastructure error
    }

    const count = data as number;
    return count <= maxPerMinute;
  } catch (err) {
    console.warn("[rate-limit] Unexpected error, failing open:", err);
    return true;
  }
}

/**
 * Extract the client IP from a Next.js request.
 * Vercel sets x-forwarded-for; falls back to x-real-ip.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
