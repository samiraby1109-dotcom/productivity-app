import { NextRequest } from "next/server";
import { requireFullSession, apiError, requireJsonBody } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { normalizePassword } from "@/lib/password";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

/**
 * POST /api/auth/delete-account
 * Permanently deletes the account and ALL of its data. Requires a FULL session,
 * password re-verification, and a typed "DELETE" confirmation.
 *
 * Cascading foreign keys remove vault_entries, vault_media (rows), vault_contacts,
 * recovery_codes, and archive_queue when the users row is deleted. The encrypted
 * media OBJECTS live in storage (not cascaded), so they're removed explicitly.
 */
export async function POST(req: NextRequest) {
  try {
    const ctError = requireJsonBody(req);
    if (ctError) return ctError;
    const session = await requireFullSession(req);

    const { password, confirm } = (await req.json()) as { password?: string; confirm?: string };
    if (!password) return apiError(400, "Password required");
    if (confirm !== "DELETE") return apiError(400, "Type DELETE to confirm");

    const db = createServiceClient();

    const { data: user } = await db
      .from("users")
      .select("password_hash")
      .eq("id", session.userId)
      .single();
    if (!user) return apiError(404, "User not found");

    const valid = await verifyPassword(normalizePassword(password), user.password_hash);
    if (!valid) return apiError(401, "Incorrect password");

    // 1) Remove stored media objects (FK cascade only covers DB rows).
    const { data: media } = await db
      .from("vault_media")
      .select("storage_path")
      .eq("user_id", session.userId);
    const paths = (media ?? []).map((m) => m.storage_path).filter((p): p is string => !!p);
    for (let i = 0; i < paths.length; i += 100) {
      await db.storage.from("vault-media").remove(paths.slice(i, i + 100));
    }

    // 2) Delete the user row → cascades to all user-owned tables.
    const { error: delErr } = await db.from("users").delete().eq("id", session.userId);
    if (delErr) {
      console.error("[delete-account] failed", { userId: session.userId, message: delErr.message });
      return apiError(500, "Could not delete account. Please try again.");
    }
    console.info("[delete-account] purged", { userId: session.userId });

    // 3) Clear the session cookie.
    const res = Response.json({ ok: true });
    res.headers.set(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
    return res;
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    console.error("[delete-account] error", err);
    return apiError(500, "Internal server error");
  }
}
