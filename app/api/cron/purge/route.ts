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
      await db.storage.from("vault-media").remove(paths);
    }

    // Mark entries as PURGED (cascade deletes media rows via FK)
    await db
      .from("vault_entries")
      .update({ status: "PURGED" })
      .in("id", entryIds);

    // Remove from archive queue
    await db.from("archive_queue").delete().in("entry_id", entryIds);

    console.log(`Purge cron: purged ${entryIds.length} entries`);
    return Response.json({ purged: entryIds.length });
  } catch (err) {
    console.error("Purge cron error:", err);
    return apiError(500, "Internal server error");
  }
}
