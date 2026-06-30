import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { createServiceClient } from "@/lib/db";
import {
  verifyPassword,
  verifyDecoyCode,
  isLockedFromRow,
  recordFailedAttemptDb,
  clearAttemptsDb,
  getDecoySecret,
  emailFingerprint,
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

// Best-effort sign-in activity log. Wrapped so it can NEVER affect the login
// outcome: if the login_events table hasn't been created yet, the insert simply
// no-ops. IPs are stored only as a keyed hash, never in the clear.
async function recordLoginEvent(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  outcome: "full" | "decoy" | "failed",
  req: NextRequest,
): Promise<void> {
  try {
    const ipHash = createHmac("sha256", getDecoySecret()).update(getClientIp(req)).digest("hex").slice(0, 24);
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
    await db.from("login_events").insert({ user_id: userId, outcome, ip_hash: ipHash, user_agent: ua });
  } catch {
    /* table may not exist yet — never affect login */
  }
}

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
    const emailFp = emailFingerprint(emailNorm);
    type LoginUser = {
      id: string; email: string; password_hash: string; decoy_code_hash: string;
      password_salt: string; failed_attempts: number | null; locked_until: string | null;
    };
    let user: LoginUser | null = null;

    const primary = await db
      .from("users")
      .select("id, email, password_hash, decoy_code_hash, password_salt, failed_attempts, locked_until")
      .eq("email", emailNorm)
      .maybeSingle();

    if (primary.error) {
      // The lockout columns (migration 008) may be absent on this database.
      // A schema gap must NOT take down login: log loudly, then retry with the
      // guaranteed-present columns and proceed with per-account lockout disabled
      // (per-IP rate limiting still applies). Never let a missing column
      // masquerade as "wrong credentials".
      console.error("[login] lockout_columns_unavailable; degrading", {
        emailFp, code: (primary.error as { code?: string }).code, message: primary.error.message,
      });
      const fallback = await db
        .from("users")
        .select("id, email, password_hash, decoy_code_hash, password_salt")
        .eq("email", emailNorm)
        .maybeSingle();
      if (fallback.error) {
        console.error("[login] outcome=db_error", {
          emailFp, code: (fallback.error as { code?: string }).code, message: fallback.error.message,
        });
        return apiError(500, "Something went wrong on our end. Please try again.");
      }
      user = fallback.data ? ({ ...fallback.data, failed_attempts: 0, locked_until: null } as LoginUser) : null;
    } else {
      user = primary.data as LoginUser | null;
    }

    if (!user) {
      // No user — return the same neutral error as a wrong password. Burn an
      // equivalent PBKDF2 cycle first so timing doesn't reveal account
      // existence. Don't record anything (there's no row to record against).
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      console.warn("[login] outcome=no_user", { emailFp, isDigitsOnly });
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
    if (isDigitsOnly && (await verifyDecoyCode(password, user.decoy_code_hash, decoySecret))) {
      // Neutral outcome label: do NOT distinguish decoy vs full in logs, or
      // anyone with log access learns the dual-mode design exists (weakening
      // plausible deniability if logs are leaked/subpoenaed).
      console.info("[login] outcome=ok", { userId: user.id });
      const token = await signSession({
        userId: user.id,
        email: user.email,
        mode: "DECOY",
        passwordSalt: user.password_salt,
      });
      await recordLoginEvent(db, user.id, "decoy", req);
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
      console.warn("[login] outcome=bad_password", { userId: user.id, emailFp, attempts, isDigitsOnly });
      await recordFailedAttemptDb(
        lockoutDb,
        user.id,
        user.failed_attempts ?? 0,
        MAX_LOGIN_ATTEMPTS,
        LOCKOUT_DURATION_MS,
      );
      await recordLoginEvent(db, user.id, "failed", req);
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    await clearAttemptsDb(lockoutDb, user.id);
    console.info("[login] outcome=ok", { userId: user.id });
    const token = await signSession({
      userId: user.id,
      email: user.email,
      mode: "FULL",
      passwordSalt: user.password_salt,
    });
    await recordLoginEvent(db, user.id, "full", req);
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
