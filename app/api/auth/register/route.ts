import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import {
  hashPassword,
  hashDecoyCode,
  generatePasswordSalt,
  getDecoySecret,
} from "@/lib/auth";
import { signSession, sessionCookieOptions } from "@/lib/session";
import { apiError, requireJsonBody } from "@/lib/server-session";
import { emailEnabled, sendVerificationEmail } from "@/lib/email";
import { signVerifyToken } from "@/lib/verify-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * The decoy PIN is the actual coercion defense and only has 10,000 possible
 * values. We reject the most-guessed patterns (all-same digit, ascending or
 * descending runs, and a small blocklist) so the user can't pick a code that
 * an abuser would try first.
 */
function isWeakDecoyCode(code: string): boolean {
  if (/^(\d)\1{3}$/.test(code)) return true; // 0000, 1111, …, 9999
  if (/^0123|1234|2345|3456|4567|5678|6789$/.test(code)) return true;
  if (/^9876|8765|7654|6543|5432|4321|3210$/.test(code)) return true;
  const blocklist = new Set(["1004", "2580", "0852", "1212", "2121", "0007", "6969", "1010"]);
  return blocklist.has(code);
}

export async function POST(req: NextRequest) {
  try {
    const ctError = requireJsonBody(req);
    if (ctError) return ctError;

    const body = await req.json();
    const { email, password, passwordHint, decoyCode, vault } = body as {
      email: string;
      password: string;
      passwordHint?: string;
      decoyCode: string;
      // Client-computed wrapped Vault Master Key + recovery-code material. The
      // server stores only these wrapped/hashed blobs; it never sees the VMK or
      // the plaintext recovery codes.
      vault?: {
        vmkWrapped: string;
        vmkWrappedIv: string;
        vmkSalt: string;
        recoveryCodes: { codeHash: string; wrapped: string; iv: string; salt: string }[];
      };
    };

    // IP-based rate limit: 5 registrations per minute per IP
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`register:${ip}`, 5);
    if (!allowed) return apiError(429, "Too many requests. Please wait a minute.");

    // Validation
    if (!email || !password || !decoyCode) {
      return apiError(400, "Missing required fields");
    }
    if (password.length < 8) {
      return apiError(400, "Password must be at least 8 characters");
    }
    if (!/^\d{4}$/.test(decoyCode)) {
      return apiError(400, "Decoy code must be exactly 4 digits");
    }
    if (isWeakDecoyCode(decoyCode)) {
      return apiError(400, "Please choose a less guessable 4-digit code.");
    }

    const db = createServiceClient();

    // Check if email already exists
    const { data: existing } = await db
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return apiError(409, "Account already exists");
    }

    // Hash credentials
    const [passwordHash, passwordSalt] = await Promise.all([
      hashPassword(password),
      Promise.resolve(generatePasswordSalt()),
    ]);

    const decoySecret = getDecoySecret();
    const decoyCodeHash = await hashDecoyCode(decoyCode, decoySecret);

    // Create user
    const { data: user, error } = await db
      .from("users")
      .insert({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        password_hint: passwordHint?.trim() || null,
        decoy_code_hash: decoyCodeHash,
        password_salt: passwordSalt,
        vmk_wrapped: vault?.vmkWrapped ?? null,
        vmk_wrapped_iv: vault?.vmkWrappedIv ?? null,
        vmk_salt: vault?.vmkSalt ?? null,
      })
      .select("id, email, password_salt")
      .single();

    if (error || !user) {
      console.error("User creation error:", error);
      return apiError(500, "Registration failed");
    }

    // Persist recovery-code material (best-effort — codes can be regenerated
    // later, so a failure here must not abort an otherwise-successful signup).
    if (Array.isArray(vault?.recoveryCodes) && vault.recoveryCodes.length > 0) {
      const rows = vault.recoveryCodes
        .slice(0, 50)
        .filter(
          (c) =>
            c &&
            typeof c.codeHash === "string" &&
            typeof c.wrapped === "string" &&
            typeof c.iv === "string" &&
            typeof c.salt === "string"
        )
        .map((c) => ({
          user_id: user.id,
          code_hash: c.codeHash,
          vmk_wrapped: c.wrapped,
          vmk_wrapped_iv: c.iv,
          rc_salt: c.salt,
        }));
      if (rows.length > 0) {
        const { error: rcError } = await db.from("recovery_codes").insert(rows);
        if (rcError) console.error("Recovery codes insert error:", rcError);
      }
    }

    // Issue FULL session
    const token = await signSession({
      userId: user.id,
      email: user.email,
      mode: "FULL",
      passwordSalt: user.password_salt,
    });

    // Fire-and-forget verification email — never blocks registration.
    // Skipped when RESEND_API_KEY is absent or DEV_MODE=true.
    if (emailEnabled()) {
      const origin = req.nextUrl.origin;
      void signVerifyToken(user.id, user.email).then((verifyToken) => {
        const verifyUrl = `${origin}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`;
        void sendVerificationEmail(user.email, verifyUrl);
      });
    }

    const { options } = sessionCookieOptions();
    const res = Response.json({ ok: true, mode: "FULL" });
    res.headers.set(
      "Set-Cookie",
      `bellemeadow_wellness_session=${token}; Path=${options.path}; HttpOnly; SameSite=Strict; Max-Age=${options.maxAge}${options.secure ? "; Secure" : ""}`
    );
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return apiError(500, "Internal server error");
  }
}
