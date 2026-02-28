import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";
import { ARCHIVE_RETENTION_DAYS } from "@/lib/constants";

// ─── GET /api/records/[id] ────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireFullSession(req);
    const { id } = await params;
    const db = createServiceClient();

    const { data, error } = await db
      .from("vault_entries")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.userId)
      .neq("status", "PURGED")
      .single();

    if (error || !data) return apiError(404, "Not found");
    return Response.json({ record: data });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}

// ─── PATCH /api/records/[id] — update metadata / encrypted payload ────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireFullSession(req);
    const { id } = await params;
    const body = await req.json();
    const db = createServiceClient();

    // Verify ownership
    const { data: existing } = await db
      .from("vault_entries")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", session.userId)
      .single();

    if (!existing) return apiError(404, "Not found");
    if (existing.status === "PURGED") return apiError(410, "Gone");

    const updateFields: Record<string, unknown> = {};
    if (body.encryptedPayload !== undefined) updateFields.encrypted_payload = body.encryptedPayload;
    if (body.incidentTypes !== undefined) updateFields.incident_types = body.incidentTypes;
    if (body.flagsPolice !== undefined) updateFields.flags_police = body.flagsPolice;
    if (body.flagsChildren !== undefined) updateFields.flags_children = body.flagsChildren;
    if (body.flagsWitness !== undefined) updateFields.flags_witness = body.flagsWitness;
    if (body.hasAttachments !== undefined) updateFields.has_attachments = body.hasAttachments;

    const { error } = await db
      .from("vault_entries")
      .update(updateFields)
      .eq("id", id)
      .eq("user_id", session.userId);

    if (error) return apiError(500, "Update failed");
    return Response.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}

// ─── DELETE /api/records/[id] — soft delete (archive) ────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireFullSession(req);
    const { id } = await params;
    const db = createServiceClient();

    // Verify ownership + active status
    const { data: existing } = await db
      .from("vault_entries")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", session.userId)
      .single();

    if (!existing) return apiError(404, "Not found");
    if (existing.status !== "ACTIVE") return apiError(409, "Entry is not active");

    const now = new Date();
    const purgeAt = new Date(now.getTime() + ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Move to ARCHIVED
    await db
      .from("vault_entries")
      .update({ status: "ARCHIVED" })
      .eq("id", id)
      .eq("user_id", session.userId);

    // Add to archive queue for auto-purge
    await db.from("archive_queue").upsert({
      entry_id: id,
      user_id: session.userId,
      archived_at: now.toISOString(),
      purge_at: purgeAt.toISOString(),
    });

    // Return ONLY this message — no mention of archive
    return Response.json({ message: "Entry removed." });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}
