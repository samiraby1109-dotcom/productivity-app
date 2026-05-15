import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import {
  verifyPassword,
  verifyDecoyCode,
  isLockedFromRow,
  recordFailedAttemptDb,
  clearAttemptsDb,
} from "@/lib/auth";
import { signSession, sessionCookieOptions } from "@/lib/session";
import { apiError } from "@/lib/server-session";
import { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS } from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const NEUTRAL_FAIL_MSG = "Check your credentials and try again.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email: string; password: string };

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
    const { data: user } = await db
      .from("users")
      .select("id, email, password_hash, decoy_code_hash, password_salt, failed_attempts, locked_until")
      .eq("email", emailNorm)
      .maybeSingle();

    if (!user) {
      // No user — return the same neutral error as a wrong password and don't
      // record anything (there's no row to record against).
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    // Per-account lockout (silent — same message for locked vs wrong creds)
    if (isLockedFromRow(user)) {
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    const decoySecret = process.env.SESSION_SECRET ?? "dev-secret";

    // Check decoy code first (4-digit PIN entered as password)
    const isDecoy = isDigitsOnly && verifyDecoyCode(password, user.decoy_code_hash, decoySecret);

    // The Supabase client's deep generic types make a direct call to
    // clearAttemptsDb / recordFailedAttemptDb trigger TS2589. We've already
    // proven structural compatibility, so cast through unknown.
    const lockoutDb = db as unknown as Parameters<typeof clearAttemptsDb>[0];

    if (isDecoy) {
      await clearAttemptsDb(lockoutDb, user.id);
      const token = await signSession({
        userId: user.id,
        email: user.email,
        mode: "DECOY",
        passwordSalt: user.password_salt,
      });
      return buildSessionResponse(token, "DECOY");
    }

    // Try real password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
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
