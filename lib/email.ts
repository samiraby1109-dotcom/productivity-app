/**
 * Email utility via Resend.
 *
 * SAFETY RULES (DV survivor context — do not remove):
 *  1. Email is ALWAYS optional — never block registration or app access on it.
 *  2. Subject lines and sender name must be completely neutral.
 *     Never reference "vault", "evidence", "safety", "incident", or "domestic".
 *  3. Email body must not reveal the app's true purpose.
 *  4. Sending is skipped silently when RESEND_API_KEY is absent or DEV_MODE=true.
 *  5. Errors are caught and logged — they must never surface to the user.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

// Neutral sender — change to your verified Resend domain before launch
const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ?? "BelleMeadow Wellness <noreply@bellemeadowwellness.com>";

/** Returns true if email sending is configured and enabled. */
export function emailEnabled(): boolean {
  const isProd = process.env.NODE_ENV === "production";
  const hasKey = !!process.env.RESEND_API_KEY;
  // DEV_MODE only suppresses email OUTSIDE production. A stray DEV_MODE=true left
  // in a production deploy must never silently disable verification emails — in
  // production the only switch is whether RESEND_API_KEY is configured.
  const devMode = process.env.DEV_MODE === "true" && !isProd;

  if (!hasKey) {
    // In production a missing key is a misconfiguration, not an expected dev state.
    if (isProd) console.error("[email] RESEND_API_KEY is not set in production — verification emails are DISABLED. Configure it to enable email.");
    else console.warn("[email] Skipping — RESEND_API_KEY is not set");
  }
  if (process.env.DEV_MODE === "true" && isProd) {
    console.error("[email] DEV_MODE=true is ignored in production; email stays enabled. Remove DEV_MODE from the production environment.");
  }
  if (devMode) console.warn("[email] Skipping — DEV_MODE=true (non-production)");

  return hasKey && !devMode;
}

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Low-level send via Resend REST API.
 * Returns true on success, false on any failure (never throws).
 */
export async function sendEmail(opts: SendOptions): Promise<boolean> {
  if (!emailEnabled()) return false;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend API error", res.status, body);
      return false;
    }

    const result = await res.json().catch(() => ({}));
    console.log("[email] Sent successfully. Resend id:", result?.id);
    return true;
  } catch (err) {
    console.error("[email] Send failed:", err);
    return false;
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────
// All templates use neutral language. No DV-related terms.

/**
 * Welcome email sent after successful registration.
 * Neutral subject and body — safe to appear in any email client.
 */
export async function sendWelcomeEmail(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Welcome to BelleMeadow Wellness",
    text: [
      "Hi,",
      "",
      "Your BelleMeadow Wellness account has been created successfully.",
      "",
      "You can sign in at any time to access your personal wellness tracker.",
      "",
      "If you did not create this account, you can safely ignore this email.",
      "",
      "— The BelleMeadow Wellness Team",
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
        <tr><td>
          <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827">BelleMeadow Wellness</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          <p style="color:#374151;font-size:15px;line-height:1.6">
            Your account has been created successfully.
            You can sign in at any time to access your personal wellness tracker.
          </p>
          <p style="color:#6b7280;font-size:13px;margin-top:24px">
            If you did not create this account, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

/**
 * Recovery password-change confirmation — sends a neutral link that must be
 * clicked to finish a password reset started with a recovery code. This ties the
 * reset to control of the account email, so a found recovery code alone cannot
 * complete a takeover. Neutral subject/body — never references the true purpose.
 */
export async function sendRecoveryConfirmEmail(to: string, confirmUrl: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Confirm a change to your BelleMeadow Wellness account",
    text: [
      "Hi,",
      "",
      "We received a request to update the password on your BelleMeadow Wellness account.",
      "To confirm it, visit the link below. This link expires in 30 minutes.",
      "",
      confirmUrl,
      "",
      "If you did not request this, you can safely ignore this email — nothing will change.",
      "",
      "— The BelleMeadow Wellness Team",
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
        <tr><td>
          <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827">BelleMeadow Wellness</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          <p style="color:#374151;font-size:15px;line-height:1.6">
            We received a request to update your account password. Confirm it below. This link expires in 30 minutes.
          </p>
          <a href="${confirmUrl}"
             style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
            Confirm password change
          </a>
          <p style="color:#6b7280;font-size:13px;margin-top:8px">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${confirmUrl}" style="color:#0ea5e9;word-break:break-all">${confirmUrl}</a>
          </p>
          <p style="color:#6b7280;font-size:13px;margin-top:16px">
            If you did not request this, you can safely ignore this email — nothing will change.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

/**
 * Email verification — sends a tokenised link the user can click to confirm
 * their email address. Verification is soft (non-blocking): the account works
 * regardless of whether the link is clicked.
 *
 * The token is a signed JWT containing { userId, email, purpose: "verify-email" }
 * with a 24-hour expiry, signed with SESSION_SECRET. No DB storage required.
 */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Confirm your BelleMeadow Wellness email",
    text: [
      "Hi,",
      "",
      "Please confirm your email address by visiting the link below.",
      "This link expires in 24 hours.",
      "",
      verifyUrl,
      "",
      "If you did not request this, you can safely ignore this email.",
      "",
      "— The BelleMeadow Wellness Team",
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
        <tr><td>
          <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827">BelleMeadow Wellness</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          <p style="color:#374151;font-size:15px;line-height:1.6">
            Please confirm your email address. This link expires in 24 hours.
          </p>
          <a href="${verifyUrl}"
             style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
            Confirm email address
          </a>
          <p style="color:#6b7280;font-size:13px;margin-top:8px">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${verifyUrl}" style="color:#0ea5e9;word-break:break-all">${verifyUrl}</a>
          </p>
          <p style="color:#6b7280;font-size:13px;margin-top:16px">
            If you did not request this, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
