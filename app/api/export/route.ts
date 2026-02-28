import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

/**
 * POST /api/export
 * Returns filtered entry list + media metadata for client-side export generation.
 * Requires password re-entry. Decryption happens client-side.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireFullSession(req);
    const body = await req.json() as {
      password: string;
      filters?: {
        from?: string;
        to?: string;
        police?: boolean;
        children?: boolean;
        witness?: boolean;
        attachments?: boolean;
        types?: string[];
        status?: string;
      };
    };

    const { password, filters = {} } = body;
    if (!password) return apiError(400, "Password required");

    const db = createServiceClient();

    // Re-verify password
    const { data: user } = await db
      .from("users")
      .select("password_hash")
      .eq("id", session.userId)
      .single();

    if (!user) return apiError(404, "User not found");
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return apiError(401, "Incorrect password");

    // Build filtered query
    let query = db
      .from("vault_entries")
      .select("id, created_at, updated_at, incident_types, flags_police, flags_children, flags_witness, has_attachments, encrypted_payload, payload_version")
      .eq("user_id", session.userId)
      .neq("status", "PURGED")
      .order("created_at", { ascending: true });

    const status = filters.status ?? "ACTIVE";
    if (["ACTIVE", "ARCHIVED"].includes(status)) {
      query = query.eq("status", status as "ACTIVE" | "ARCHIVED");
    }

    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to + "T23:59:59Z");
    if (filters.police) query = query.eq("flags_police", true);
    if (filters.children) query = query.eq("flags_children", true);
    if (filters.witness) query = query.eq("flags_witness", true);
    if (filters.attachments) query = query.eq("has_attachments", true);
    if (filters.types && filters.types.length > 0) {
      query = query.overlaps("incident_types", filters.types);
    }

    const { data: entries, error } = await query;
    if (error) return apiError(500, "Failed to fetch entries");

    // Fetch media metadata for entries with attachments
    const entryIds = (entries ?? []).filter((e) => e.has_attachments).map((e) => e.id);
    let mediaMap: Record<string, unknown[]> = {};

    if (entryIds.length > 0) {
      const { data: media } = await db
        .from("vault_media")
        .select("id, entry_id, kind, mime_type, size_bytes, encrypted_media_key, encrypted_media_iv, storage_path")
        .in("entry_id", entryIds)
        .eq("user_id", session.userId);

      for (const m of media ?? []) {
        if (!mediaMap[m.entry_id]) mediaMap[m.entry_id] = [];
        mediaMap[m.entry_id].push(m);
      }
    }

    return Response.json({
      entries: entries ?? [],
      mediaMap,
      exportedAt: new Date().toISOString(),
      disclaimer: "User-generated content; platform does not verify accuracy.",
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}
