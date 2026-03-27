import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import {
  hashPassword,
  hashDecoyCode,
  generatePasswordSalt,
} from "@/lib/auth";
import { signSession, sessionCookieOptions } from "@/lib/session";
import { apiError } from "@/lib/server-session";
import { emailEnabled, sendVerificationEmail } from "@/lib/email";
import { signVerifyToken } from "@/lib/verify-token";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, passwordHint, decoyCode } = body as {
      email: string;
      password: string;
      passwordHint?: string;
      decoyCode: string;
    };

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

    const decoySecret = process.env.SESSION_SECRET ?? "dev-secret";
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
      })
      .select("id, email, password_salt")
      .single();

    if (error || !user) {
      console.error("User creation error:", error);
      return apiError(500, "Registration failed");
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
