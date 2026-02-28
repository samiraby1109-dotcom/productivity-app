import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "./constants";
import type { SessionMode } from "./constants";

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-32-chars-replace-in-prod!!"
);

export interface SessionPayload {
  userId: string;
  email: string;
  mode: SessionMode;
  passwordSalt: string; // base64 — stored so client can re-derive vault key
  iat?: number;
  exp?: number;
}

// ─── Sign ─────────────────────────────────────────────────────────────────────
export async function signSession(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SESSION_SECRET);
}

// ─── Verify ───────────────────────────────────────────────────────────────────
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers (used in API routes) ─────────────────────────────────────
export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    name: SESSION_COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
      maxAge,
    },
  };
}
