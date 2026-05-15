import { NextRequest } from "next/server";
import { requireFullSession, apiError, requireJsonBody } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { MediaKind } from "@/lib/constants";

const ALLOWED_MIME: Record<string, MediaKind> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/heic": "IMAGE",
  "image/heif": "IMAGE",
  "video/mp4": "VIDEO",
  "video/quicktime": "VIDEO",
  "audio/mpeg": "AUDIO",
  "audio/mp4": "AUDIO",
  "audio/wav": "AUDIO",
  "audio/x-m4a": "AUDIO",
  // encrypted blobs arrive as octet-stream; kind is provided by client
  "application/octet-stream": "IMAGE",
};

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

// POST /api/media/upload
export async function POST(req: NextRequest) {
  try {
    const ctError = requireJsonBody(req, ["multipart/form-data"]);
    if (ctError) return ctError;
    const session = await requireFullSession(req);
    const formData = await req.formData();

    const entryId = formData.get("entryId") as string;
    const kind = formData.get("kind") as MediaKind;
    const mimeType = formData.get("mimeType") as string | null;
    const wrappedKey = formData.get("wrappedKey") as string;
    const wrappedKeyIv = formData.get("wrappedKeyIv") as string;
    const file = formData.get("file") as File;

    if (!entryId || !kind || !wrappedKey || !wrappedKeyIv || !file) {
      return apiError(400, "Missing required fields");
    }

    if (!["IMAGE", "VIDEO", "AUDIO"].includes(kind)) {
      return apiError(400, "Invalid kind");
    }

    if (file.size > MAX_SIZE) {
      return apiError(413, "File too large");
    }

    const db = createServiceClient();

    // Verify the entry belongs to this user
    const { data: entry } = await db
      .from("vault_entries")
      .select("id")
      .eq("id", entryId)
      .eq("user_id", session.userId)
      .eq("status", "ACTIVE")
      .single();

    if (!entry) return apiError(404, "Entry not found");

    // Upload encrypted blob to Supabase Storage.
    //
    // Storage path is fully random — earlier versions used
    // `${userId}/${entryId}/${fileId}` which leaked the user's UUID and the
    // record-to-attachment relationship into every short-lived signed URL.
    // The mapping back to user/entry is preserved in vault_media so signed-URL
    // generation still verifies ownership server-side.
    const fileId = uuidv4();
    const bucket = uuidv4();
    const storagePath = `${bucket.slice(0, 2)}/${bucket}/${fileId}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: storageError } = await db.storage
      .from("vault-media")
      .upload(storagePath, arrayBuffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return apiError(500, "Upload failed");
    }

    // Record metadata in vault_media
    const { data: media, error: dbError } = await db
      .from("vault_media")
      .insert({
        entry_id: entryId,
        user_id: session.userId,
        kind,
        mime_type: mimeType || file.type || "application/octet-stream",
        size_bytes: file.size,
        storage_path: storagePath,
        encrypted_media_key: wrappedKey,
        encrypted_media_iv: wrappedKeyIv,
      })
      .select("id")
      .single();

    if (dbError || !media) {
      console.error("Media record error:", dbError);
      // Try to clean up storage
      await db.storage.from("vault-media").remove([storagePath]);
      return apiError(500, "Failed to save media record");
    }

    // Mark entry as having attachments
    await db
      .from("vault_entries")
      .update({ has_attachments: true })
      .eq("id", entryId)
      .eq("user_id", session.userId);

    return Response.json({ id: media.id, storagePath }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}
