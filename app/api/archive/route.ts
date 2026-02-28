import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

// ─── GET /api/archive — list archived entries ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await requireFullSession(req);
    const db = createServiceClient();

    const { data, error } = await db
      .from("vault_entries")
      .select("id, created_at, updated_at, incident_types, flags_police, flags_children, flags_witness, has_attachments, encrypted_payload")
      .eq("user_id", session.userId)
      .eq("status", "ARCHIVED")
      .order("created_at", { ascending: false });

    if (error) return apiError(500, "Failed to fetch archive");

    // Include purge_at from archive_queue
    type EntryRow = { id: string };
    const rows = (data ?? []) as EntryRow[];
    const entryIds = rows.map((e) => e.id);
    let queueMap: Record<string, string> = {};
    if (entryIds.length > 0) {
      const { data: queue } = await db
        .from("archive_queue")
        .select("entry_id, purge_at")
        .in("entry_id", entryIds);
      type QueueRow = { entry_id: string; purge_at: string };
      const queueRows = (queue ?? []) as QueueRow[];
      queueMap = Object.fromEntries(queueRows.map((q) => [q.entry_id, q.purge_at]));
    }

    const enriched = (data ?? []).map((e) => ({
      ...e,
      purge_at: queueMap[e.id] ?? null,
    }));

    return Response.json({ records: enriched });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}

// ─── POST /api/archive/restore — restore entry to active ─────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await requireFullSession(req);
    const body = await req.json();
    const { entryId, action, password } = body as {
      entryId: string;
      action: "restore" | "purge";
      password?: string;
    };

    if (!entryId || !action) return apiError(400, "Missing fields");

    const db = createServiceClient();

    // Verify ownership
    const { data: entry } = await db
      .from("vault_entries")
      .select("id, status")
      .eq("id", entryId)
      .eq("user_id", session.userId)
      .eq("status", "ARCHIVED")
      .single();

    if (!entry) return apiError(404, "Not found");

    if (action === "restore") {
      await db.from("vault_entries").update({ status: "ACTIVE" }).eq("id", entryId);
      await db.from("archive_queue").delete().eq("entry_id", entryId);
      return Response.json({ ok: true });
    }

    if (action === "purge") {
      // Permanent delete — requires password re-entry
      if (!password) return apiError(400, "Password required");

      const { data: user } = await db
        .from("users")
        .select("password_hash")
        .eq("id", session.userId)
        .single();

      if (!user) return apiError(404, "User not found");

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) return apiError(401, "Incorrect password");

      // Permanently delete entry (cascade deletes media + queue)
      await db.from("vault_entries").update({ status: "PURGED" }).eq("id", entryId);
      await db.from("archive_queue").delete().eq("entry_id", entryId);

      return Response.json({ ok: true });
    }

    return apiError(400, "Unknown action");
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}
