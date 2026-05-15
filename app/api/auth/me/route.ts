import { requireAnySession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await requireAnySession(req);

    // DECOY sessions must not learn the password hint (which can reveal the
    // real password) or the vault key salt (which is only needed in FULL
    // mode to re-derive the encryption key client-side).
    if (session.mode === "DECOY") {
      return Response.json({
        userId: session.userId,
        email: session.email,
        mode: session.mode,
      });
    }

    const db = createServiceClient();
    const { data: user } = await db
      .from("users")
      .select("password_hint")
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
