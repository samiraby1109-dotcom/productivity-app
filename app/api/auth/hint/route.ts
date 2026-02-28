import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import { apiError } from "@/lib/server-session";

// POST /api/auth/hint — returns password hint only (not reset link)
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email: string };
    if (!email) return apiError(400, "Email required");

    const db = createServiceClient();
    const { data } = await db
      .from("users")
      .select("password_hint")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    // Return null hint if user not found — don't leak user existence
    return Response.json({ hint: data?.password_hint ?? null });
  } catch {
    return apiError(500, "Internal server error");
  }
}
