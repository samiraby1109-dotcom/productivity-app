import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";

// GET /api/records/[id]/media — list media for an entry
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireFullSession(req);
    const { id } = await params;
    const db = createServiceClient();

    // Verify entry ownership
    const { data: entry } = await db
      .from("vault_entries")
      .select("id")
      .eq("id", id)
      .eq("user_id", session.userId)
      .neq("status", "PURGED")
      .single();

    if (!entry) return apiError(404, "Not found");

    const { data: media, error } = await db
      .from("vault_media")
      .select("id, kind, mime_type, size_bytes, encrypted_media_key, encrypted_media_iv, created_at")
      .eq("entry_id", id)
      .eq("user_id", session.userId)
      .order("created_at", { ascending: true });

    if (error) return apiError(500, "Failed to fetch media");

    return Response.json({ media: media ?? [] });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}
