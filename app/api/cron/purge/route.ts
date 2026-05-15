import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db";
import { apiError } from "@/lib/server-session";

/**
 * Vercel Cron endpoint: runs daily to permanently purge entries
 * that have been in the archive for 30+ days.
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/purge", "schedule": "0 4 * * *" }]
 * }
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Verify cron secret
  if (!cronSecret || secret !== `Bearer ${cronSecret}`) {
    return apiError(401, "Unauthorized");
  }

  try {
    const db = createServiceClient();
    const now = new Date().toISOString();

    // Find entries due for purge
    const { data: due, error: fetchError } = await db
      .from("archive_queue")
      .select("entry_id, user_id")
      .lte("purge_at", now);

    if (fetchError) {
      console.error("Purge fetch error:", fetchError);
      return apiError(500, "Failed to fetch purge queue");
    }

    if (!due || due.length === 0) {
      return Response.json({ purged: 0 });
    }

    const entryIds = due.map((r) => r.entry_id);

    // Delete storage objects for purged entries
    const { data: mediaRows } = await db
      .from("vault_media")
      .select("storage_path")
      .in("entry_id", entryIds);

    if (mediaRows && mediaRows.length > 0) {
      const paths = mediaRows.map((m) => m.storage_path);
      const { error: storageError } = await db.storage.from("vault-media").remove(paths);
      if (storageError) {
        console.error("Purge: storage cleanup failed, aborting to prevent orphaned files:", storageError);
        return apiError(500, "Storage cleanup failed; entries not purged. Will retry on next run.");
      }
    }

    // Actually delete the rows (FK cascade drops vault_media rows).
    // Previously this only flipped status to PURGED, leaving the
    // encrypted_payload sitting in the table after the 30-day window.
    await db.from("archive_queue").delete().in("entry_id", entryIds);
    const { error: delError } = await db
      .from("vault_entries")
      .delete()
      .in("id", entryIds);
    if (delError) {
      console.error("Purge cron: DB delete failed:", delError);
      return apiError(500, "DB delete failed; will retry on next run.");
    }

    console.log(`Purge cron: purged ${entryIds.length} entries`);
    return Response.json({ purged: entryIds.length });
  } catch (err) {
    console.error("Purge cron error:", err);
    return apiError(500, "Internal server error");
  }
}
