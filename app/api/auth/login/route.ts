import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import { verifyPassword, verifyDecoyCode, checkLockout, recordFailedAttempt, clearAttempts } from "@/lib/auth";
import { signSession, sessionCookieOptions } from "@/lib/session";
import { apiError } from "@/lib/server-session";
import { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS } from "@/lib/constants";

const NEUTRAL_FAIL_MSG = "Check your credentials and try again.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return apiError(400, "Missing credentials");
    }

    const emailNorm = email.toLowerCase().trim();

    // Lockout check (silent — same message for locked vs wrong creds)
    const lockout = checkLockout(emailNorm);
    if (lockout.locked) {
      // Return same error as failed auth — no lockout signal to attacker
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    const db = createServiceClient();
    const { data: user } = await db
      .from("users")
      .select("id, email, password_hash, decoy_code_hash, password_salt")
      .eq("email", emailNorm)
      .maybeSingle();

    if (!user) {
      // Still record attempt and return neutral error
      recordFailedAttempt(emailNorm, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    const decoySecret = process.env.SESSION_SECRET ?? "dev-secret";

    // Check decoy code first (4-digit PIN entered as password)
    const isDecoy =
      /^\d{4}$/.test(password) &&
      verifyDecoyCode(password, user.decoy_code_hash, decoySecret);

    if (isDecoy) {
      clearAttempts(emailNorm);
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
      recordFailedAttempt(emailNorm, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS);
      return apiError(401, NEUTRAL_FAIL_MSG);
    }

    clearAttempts(emailNorm);
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
