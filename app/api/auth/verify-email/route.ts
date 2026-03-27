import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";
import { verifyVerifyToken } from "@/lib/verify-token";

/**
 * GET /api/auth/verify-email?token=<jwt>
 *
 * Validates the email verification token and marks the user as verified.
 * Redirects to /dashboard on success, /login?verified=error on failure.
 *
 * Verification is soft — the account already works before this is clicked.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?verified=error", req.url));
  }

  const payload = await verifyVerifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?verified=error", req.url));
  }

  const db = createServiceClient();
  const { error } = await db
    .from("users")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", payload.userId)
    .eq("email", payload.email);

  if (error) {
    console.error("[verify-email] DB update failed:", error);
    return NextResponse.redirect(new URL("/login?verified=error", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard?verified=1", req.url));
}
