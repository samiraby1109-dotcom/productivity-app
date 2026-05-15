import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import { apiError, requireJsonBody } from "@/lib/server-session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// POST /api/auth/hint — returns password hint only (not reset link)
//
// Rate-limited per IP because the endpoint was unauthenticated and
// distinguishable: a stored hint returned a non-null string and a missing
// user returned null. An abuser knowing a survivor's email could scrape the
// hint at will and use it (hints frequently encode the actual password).
export async function POST(req: NextRequest) {
  try {
    const ctError = requireJsonBody(req);
    if (ctError) return ctError;

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`hint:${ip}`, 5);
    if (!allowed) return apiError(429, "Too many requests. Please wait a minute.");

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
