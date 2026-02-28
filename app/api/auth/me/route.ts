import { requireAnySession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await requireAnySession(req);
    const db = createServiceClient();
    const { data: user } = await db
      .from("users")
      .select("id, email, password_hint, password_salt")
      .eq("id", session.userId)
      .single();

    return Response.json({
      userId: session.userId,
      email: session.email,
      mode: session.mode,
      passwordSalt: session.passwordSalt,
      passwordHint: user?.password_hint ?? null,
    });
  } catch {
    return apiError(401, "Unauthorized");
  }
}
