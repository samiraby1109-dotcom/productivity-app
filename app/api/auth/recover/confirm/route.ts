import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import { verifyResetConfirmToken } from "@/lib/verify-token";

/**
 * GET /api/auth/recover/confirm?token=...
 *
 * Completes a recovery-code password reset that was started at /recover. The
 * reset is applied ONLY here, when the link sent to the account email is opened
 * — so a found recovery code can't finish a takeover without inbox access.
 *
 * Returns a small, self-contained neutral page (no app chrome, no DV language).
 */
function page(title: string, body: string, showSignIn: boolean): Response {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BelleMeadow Wellness</title></head>
<body style="margin:0;background:#f9fafb;font-family:system-ui,sans-serif">
  <div style="max-width:420px;margin:48px auto;padding:0 16px;text-align:center">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
      <p style="font-size:18px;font-weight:600;color:#111827;margin:0 0 8px">${title}</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0">${body}</p>
      ${showSignIn ? `<a href="/login" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#4f6b54;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">Sign in</a>` : ""}
    </div>
  </div>
</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return page("Link not valid", "This confirmation link is missing or malformed. Please start again.", true);
  }

  const payload = await verifyResetConfirmToken(token);
  if (!payload) {
    return page("Link expired", "This confirmation link has expired or is no longer valid. Please start the reset again.", true);
  }

  const db = createServiceClient();

  // The recovery code must still be unused — guards against replay after the
  // reset already completed once.
  const { data: code } = await db
    .from("recovery_codes")
    .select("id, used_at")
    .eq("id", payload.codeId)
    .maybeSingle();

  if (!code || code.used_at) {
    return page("Already done", "This password change has already been completed. You can sign in with your new password.", true);
  }

  const { error: updErr } = await db
    .from("users")
    .update({
      password_hash: payload.newHash,
      vmk_wrapped: payload.vmkWrapped,
      vmk_wrapped_iv: payload.vmkWrappedIv,
      vmk_salt: payload.vmkSalt,
      failed_attempts: 0,
      locked_until: null,
    })
    .eq("id", payload.userId);

  if (updErr) {
    console.error("[recover/confirm] user update failed:", updErr);
    return page("Something went wrong", "We couldn't complete the change. Please start the reset again.", true);
  }

  // Single-use: consume the redeemed code now that the change is applied.
  await db.from("recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", payload.codeId);

  return page("Password updated", "Your password has been changed and that recovery code is now used up. You can sign in with your new password.", true);
}
