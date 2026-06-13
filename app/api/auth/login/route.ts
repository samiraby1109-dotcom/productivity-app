import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import {
  verifyPassword,
  verifyDecoyCode,
  isLockedFromRow,
  recordFailedAttemptDb,
  clearAttemptsDb,
  getDecoySecret,
} from "@/lib/auth";
import { signSession, sessionCookieOptions } from "@/lib/session";
import { apiError, requireJsonBody } from "@/lib/server-session";
import { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS } from "@/lib/constants";
import { normalizePassword } from "@/lib/password";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const NEUTRAL_FAIL_MSG = "Check your credentials and try again.";

// A well-formed but unused hash (200k iterations, matching real users) so the
// "no such user" path spends the same PBKDF2 time as a real wrong-password
// check. Without this, response latency reveals whether an email is registered
// — a meaningful leak for a survivor whose mere use of the app is sensitive.
const DUMMY_PASSWORD_HASH = `200000:${"0".repeat(32)}:${"0".repeat(128)}`;

export async function POST(req: NextRequest) {
  try {
    const ctError = requireJsonBody(req);
    if (ctError) return ctError;

    const body = await req.json();
    const { email, password: rawPassword } = body as { email: string; password: string };
    // Trim leading/trailing whitespace before anything else — a stray space
    // from copy/paste must not make a correct password (or PIN) fail.
    const password = normalizePassword(rawPassword ?? "");

    if (!email || !password) {
      return apiError(400, "Missing credentials");
    }

    // IP-based rate limit: 10 attempts/min for full-password shaped tries;
    // 4-digit decoy-shaped tries are limited tighter to keep the 10,000-code
    // space from being brute-forced.
    const ip = getClientIp(req);
    const isDigitsOnly = /^\d{4}$/.test(password);
    const limitKey = isDigitsOnly ? `login-pin:${ip}` : `login:${ip}`;
    const maxPerMinute = isDigitsOnly ? 3 : 10;
    const allowed = await checkRateLimit(limitKey, maxPerMinute);
    if (!allowed) return apiError(429, "Too many requests. Please wait a minute.");

    const emailNorm = email.toLowerCase().trim();

    const db = createServiceClient();
    const { data: user, error: userErr } = await db
      .from("users")
      .select("id, email, password_hash, decoy_code_hash, password_salt, failed_attempts, locked_until")
      .eq("email", emailNorm)
      .maybeSingle();

    if (userErr) {
      // A query error (e.g. a column missing because a migration was never
      // applied to this database, or an RLS/credentials problem) must NOT
      // masquerade as "no such user". Surface it loudly and return a server
      // error so the cause is visible instead of looking like bad creds.
      console.error("[login] outcome=db_error", { email: emailNorm, code: (userErr as { code?: string }).code, message: userErr.message });
      return apiError(500, "Something went wrong on our end. Please try again.");
    }

    if (!user) {
      // No user — return the same neutral error as a wrong password. Burn an
      // equivalent PBKDF2 cycle first so timing doesn't reveal account
      // existence. Don't record anything (there's no row to record against).
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      console.warn("[login] outcome=no_user", { email: emailNorm, isDigitsOnly });
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    const decoySecret = getDecoySecret();
    // The Supabase client's deep generic types make a direct call to
    // clearAttemptsDb / recordFailedAttemptDb trigger TS2589. We've already
    // proven structural compatibility, so cast through unknown.
    const lockoutDb = db as unknown as Parameters<typeof clearAttemptsDb>[0];

    // The decoy PIN is checked BEFORE the lockout gate. It is the survivor's
    // coercion-safety path and opens only the fake dashboard (no vault access),
    // so it must keep working even when the real password is locked out by
    // failed attempts. Brute force is still bounded by the per-IP PIN rate
    // limit (3/min) applied above. The decoy stays independent of the password
    // lockout counters and never reads or clears them.
    if (isDigitsOnly && verifyDecoyCode(password, user.decoy_code_hash, decoySecret)) {
      console.warn("[login] outcome=decoy_ok", { userId: user.id });
      const token = await signSession({
        userId: user.id,
        email: user.email,
        mode: "DECOY",
        passwordSalt: user.password_salt,
      });
      return buildSessionResponse(token, "DECOY");
    }

    // Real-password path is gated by the per-account lockout.
    if (isLockedFromRow(user)) {
      console.warn("[login] outcome=locked", { userId: user.id, lockedUntil: user.locked_until });
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      const attempts = (user.failed_attempts ?? 0) + 1;
      console.warn("[login] outcome=bad_password", { userId: user.id, email: emailNorm, attempts, isDigitsOnly });
      await recordFailedAttemptDb(
        lockoutDb,
        user.id,
        user.failed_attempts ?? 0,
        MAX_LOGIN_ATTEMPTS,
        LOCKOUT_DURATION_MS,
      );
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    await clearAttemptsDb(lockoutDb, user.id);
    console.info("[login] outcome=full_ok", { userId: user.id });
    const token = await signSession({
      userId: user.id,
      email: user.email,
      mode: "FULL",
      passwordSalt: user.password_salt,
    });
    return buildSessionResponse(token, "FULL");
  } catch (err) {
    console.error("Login error:", err);
    return apiError(500, "Internal server error");
  }
}

function buildSessionResponse(token: string, mode: "FULL" | "DECOY") {
  const { options } = sessionCookieOptions();
  const res = Response.json({ ok: true, mode });
  res.headers.set(
    "Set-Cookie",
    `bellemeadow_wellness_session=${token}; Path=${options.path}; HttpOnly; SameSite=Strict; Max-Age=${options.maxAge}${options.secure ? "; Secure" : ""}`
  );
  return res;
}
