import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { normalizePassword } from "@/lib/password";
import { apiError, requireJsonBody } from "@/lib/server-session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/recover — regain access with a recovery code.
 *
 * Two actions, both keyed off a client-computed `lookupHash` (a slow PBKDF2 of
 * the recovery code; the server never receives the plaintext code):
 *
 *   action: "fetch"  → returns the VMK wrapped under this recovery code so the
 *                      client can unwrap it locally with the real code.
 *   action: "reset"  → sets a new password and stores the VMK re-wrapped under
 *                      that new password, then consumes (single-uses) the code.
 *
 * Content is preserved across recovery because the VMK itself never changes.
 * Errors are neutral so neither account existence nor code validity leaks.
 */
const NEUTRAL = "That email and recovery code don't match.";

export async function POST(req: NextRequest) {
  try {
    const ctError = requireJsonBody(req);
    if (ctError) return ctError;

    // Recovery is rare and high-value; keep brute force slow.
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`recover:${ip}`, 5);
    if (!allowed) return apiError(429, "Too many requests. Please wait a minute.");

    const body = await req.json();
    const { action, email, lookupHash, newPassword, vault } = body as {
      action: "fetch" | "reset";
      email: string;
      lookupHash: string;
      newPassword?: string;
      vault?: { wrapped: string; iv: string; salt: string };
    };

    if (!email || !lookupHash || (action !== "fetch" && action !== "reset")) {
      return apiError(400, "Missing fields");
    }

    const emailNorm = email.toLowerCase().trim();
    const db = createServiceClient();

    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();

    // Locate the matching, unused recovery code. The same neutral error covers
    // "no such user" and "wrong/used code", so neither can be probed.
    let code: { id: string; vmk_wrapped: string; vmk_wrapped_iv: string; rc_salt: string } | null = null;
    if (user) {
      const { data } = await db
        .from("recovery_codes")
        .select("id, vmk_wrapped, vmk_wrapped_iv, rc_salt")
        .eq("user_id", user.id)
        .eq("code_hash", lookupHash)
        .is("used_at", null)
        .maybeSingle();
      code = data ?? null;
    }

    if (!user || !code) return apiError(401, NEUTRAL);

    if (action === "fetch") {
      return Response.json({
        vmkWrapped: code.vmk_wrapped,
        vmkWrappedIv: code.vmk_wrapped_iv,
        rcSalt: code.rc_salt,
      });
    }

    // action === "reset"
    const npw = normalizePassword(newPassword ?? "");
    if (!npw || npw.length < 8) {
      return apiError(400, "Password must be at least 8 characters");
    }
    if (
      !vault ||
      typeof vault.wrapped !== "string" ||
      typeof vault.iv !== "string" ||
      typeof vault.salt !== "string"
    ) {
      return apiError(400, "Missing re-wrapped key");
    }

    const newHash = await hashPassword(npw);

    const { error: updErr } = await db
      .from("users")
      .update({
        password_hash: newHash,
        vmk_wrapped: vault.wrapped,
        vmk_wrapped_iv: vault.iv,
        vmk_salt: vault.salt,
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("id", user.id);

    if (updErr) {
      console.error("Recover: user update failed:", updErr);
      return apiError(500, "Could not reset password. Try again.");
    }

    // Single-use: consume the code that was just redeemed.
    await db
      .from("recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", code.id);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Recover error:", err);
    return apiError(500, "Internal server error");
  }
}
