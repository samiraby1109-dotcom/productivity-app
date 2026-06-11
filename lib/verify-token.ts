/**
 * Email verification tokens.
 * Uses signed JWTs (HS256) — no DB table required.
 * Token payload: { userId, email, purpose: "verify-email" }
 */
import { SignJWT, jwtVerify } from "jose";
import { getSessionSecret } from "./session";

// Share the session signing key (same env var, same production guard) instead
// of re-reading SESSION_SECRET with a separate dev fallback.
const EXPIRY = "24h";

export interface VerifyTokenPayload {
  userId: string;
  email: string;
  purpose: "verify-email";
}

export async function signVerifyToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ userId, email, purpose: "verify-email" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSessionSecret());
}

export async function verifyVerifyToken(token: string): Promise<VerifyTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    if (payload.purpose !== "verify-email") return null;
    return payload as unknown as VerifyTokenPayload;
  } catch {
    return null;
  }
}
