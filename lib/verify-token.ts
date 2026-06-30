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

// ─── Recovery-reset confirmation token ────────────────────────────────────────
// A password reset via recovery code is not applied until the user clicks a link
// sent to their account email. The pending change (new password HASH + the VMK
// re-wrapped under the new password — both already non-plaintext) rides inside a
// short-lived signed token, so no pending-state table is needed. An attacker who
// holds a found recovery code cannot complete a reset without also controlling
// the survivor's email inbox.
const RESET_CONFIRM_EXPIRY = "30m";

export interface ResetConfirmPayload {
  userId: string;
  codeId: string;
  newHash: string;
  vmkWrapped: string;
  vmkWrappedIv: string;
  vmkSalt: string;
  purpose: "reset-confirm";
}

export async function signResetConfirmToken(
  data: Omit<ResetConfirmPayload, "purpose">,
): Promise<string> {
  return new SignJWT({ ...data, purpose: "reset-confirm" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(RESET_CONFIRM_EXPIRY)
    .sign(getSessionSecret());
}

export async function verifyResetConfirmToken(token: string): Promise<ResetConfirmPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    if (payload.purpose !== "reset-confirm") return null;
    return payload as unknown as ResetConfirmPayload;
  } catch {
    return null;
  }
}
