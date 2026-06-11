import { NextRequest } from "next/server";
import { requireFullSession, apiError, requireJsonBody } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/recovery-codes — enrol (or regenerate) recovery codes for the
 * signed-in account.
 *
 * The client re-wraps the in-memory vault key under the current password (so the
 * VMK is established for accounts created before recovery codes existed) and
 * under each freshly generated code, then sends only the wrapped/hashed blobs.
 * Password re-entry is required and re-verified here so a stolen session can't
 * silently rewrite the key wrapping.
 *
 * New codes replace any previous ones. We insert the new set first and only then
 * delete the old rows, so a failure never leaves the account with no codes.
 */
export async function POST(req: NextRequest) {
  try {
    const ctError = requireJsonBody(req);
    if (ctError) return ctError;
    const session = await requireFullSession(req);

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`recovery-codes:${session.userId}:${ip}`, 5);
    if (!allowed) return apiError(429, "Too many requests. Please wait a minute.");

    const body = await req.json();
    const { password, vmkWrapped, vmkWrappedIv, vmkSalt, recoveryCodes } = body as {
      password: string;
      vmkWrapped: string;
      vmkWrappedIv: string;
      vmkSalt: string;
      recoveryCodes: { codeHash: string; wrapped: string; iv: string; salt: string }[];
    };

    if (!password) return apiError(400, "Password required");
    if (
      typeof vmkWrapped !== "string" ||
      typeof vmkWrappedIv !== "string" ||
      typeof vmkSalt !== "string" ||
      !Array.isArray(recoveryCodes) ||
      recoveryCodes.length === 0
    ) {
      return apiError(400, "Missing recovery material");
    }

    const db = createServiceClient();

    // Re-verify the password before rewriting any key material.
    const { data: user } = await db
      .from("users")
      .select("password_hash")
      .eq("id", session.userId)
      .single();
    if (!user) return apiError(404, "User not found");
    if (!(await verifyPassword(password, user.password_hash))) {
      return apiError(401, "Incorrect password");
    }

    const rows = recoveryCodes
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
        user_id: session.userId,
        code_hash: c.codeHash,
        vmk_wrapped: c.wrapped,
        vmk_wrapped_iv: c.iv,
        rc_salt: c.salt,
      }));
    if (rows.length === 0) return apiError(400, "No valid codes");

    // Store the password-wrapped VMK.
    const { error: updErr } = await db
      .from("users")
      .update({ vmk_wrapped: vmkWrapped, vmk_wrapped_iv: vmkWrappedIv, vmk_salt: vmkSalt })
      .eq("id", session.userId);
    if (updErr) {
      console.error("Recovery enrol: user update failed:", updErr);
      return apiError(500, "Could not save. Try again.");
    }

    // Insert the new codes, then drop the previous set.
    const { data: existing } = await db
      .from("recovery_codes")
      .select("id")
      .eq("user_id", session.userId);
    const oldIds = (existing ?? []).map((r) => r.id);

    const { error: insErr } = await db.from("recovery_codes").insert(rows);
    if (insErr) {
      console.error("Recovery enrol: code insert failed:", insErr);
      return apiError(500, "Could not save codes. Try again.");
    }
    if (oldIds.length > 0) {
      await db.from("recovery_codes").delete().in("id", oldIds);
    }

    return Response.json({ ok: true, count: rows.length });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    if (err instanceof Error && err.message === "Forbidden") return apiError(403, "Forbidden");
    console.error("Recovery enrol error:", err);
    return apiError(500, "Internal server error");
  }
}
