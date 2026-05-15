import { NextRequest } from "next/server";
import { requireFullSession, apiError, requireJsonBody } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";

// POST /api/media/signed-url — get a short-lived signed download URL for a media file
export async function POST(req: NextRequest) {
  try {
    const ctError = requireJsonBody(req);
    if (ctError) return ctError;
    const session = await requireFullSession(req);
    const { mediaId } = await req.json() as { mediaId: string };
    if (!mediaId) return apiError(400, "Missing mediaId");

    const db = createServiceClient();

    // Verify ownership
    const { data: media } = await db
      .from("vault_media")
      .select("storage_path, encrypted_media_key, encrypted_media_iv")
      .eq("id", mediaId)
      .eq("user_id", session.userId)
      .single();

    if (!media) return apiError(404, "Not found");

    const { data: signed, error } = await db.storage
      .from("vault-media")
      .createSignedUrl(media.storage_path, 300); // 5 min expiry

    if (error || !signed) return apiError(500, "Failed to generate signed URL");

    return Response.json({
      signedUrl: signed.signedUrl,
      wrappedKey: media.encrypted_media_key,
      wrappedKeyIv: media.encrypted_media_iv,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}
