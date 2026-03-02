import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";
// ARCHIVE_RETENTION_DAYS used in DELETE handler via records/[id]/route.ts

// ─── GET /api/records — list entries with optional filters ────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await requireFullSession(req);
    const db = createServiceClient();
    const params = req.nextUrl.searchParams;

    let query = db
      .from("vault_entries")
      .select("id, created_at, updated_at, status, incident_types, flags_police, flags_children, flags_witness, has_attachments, encrypted_payload, payload_version")
      .eq("user_id", session.userId)
      .neq("status", "PURGED")
      .order("created_at", { ascending: false });

    // Filters
    const status = params.get("status");
    if (status && ["ACTIVE", "ARCHIVED"].includes(status)) {
      query = query.eq("status", status as "ACTIVE" | "ARCHIVED");
    } else {
      query = query.eq("status", "ACTIVE");
    }

    const fromDate = params.get("from");
    if (fromDate) query = query.gte("created_at", fromDate);

    const toDate = params.get("to");
    if (toDate) query = query.lte("created_at", toDate + "T23:59:59Z");

    const policeFlag = params.get("police");
    if (policeFlag === "true") query = query.eq("flags_police", true);

    const childrenFlag = params.get("children");
    if (childrenFlag === "true") query = query.eq("flags_children", true);

    const witnessFlag = params.get("witness");
    if (witnessFlag === "true") query = query.eq("flags_witness", true);

    const hasAttach = params.get("attachments");
    if (hasAttach === "true") query = query.eq("has_attachments", true);

    const incidentTypes = params.getAll("type");
    if (incidentTypes.length > 0) {
      query = query.overlaps("incident_types", incidentTypes);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Records fetch error:", error);
      return apiError(500, "Failed to fetch records");
    }

    return Response.json({ records: data ?? [] });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    if (err instanceof Error && err.message === "Forbidden") return apiError(403, "Forbidden");
    return apiError(500, "Internal server error");
  }
}

// ─── POST /api/records — create a new entry ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await requireFullSession(req);
    const body = await req.json();

    const {
      encryptedPayload,
      incidentTypes = [],
      flagsPolice = false,
      flagsChildren = false,
      flagsWitness = false,
    } = body as {
      encryptedPayload: string;
      incidentTypes?: string[];
      flagsPolice?: boolean;
      flagsChildren?: boolean;
      flagsWitness?: boolean;
    };

    if (!encryptedPayload) return apiError(400, "Missing payload");

    const db = createServiceClient();
    const { data, error } = await db
      .from("vault_entries")
      .insert({
        user_id: session.userId,
        status: "ACTIVE",
        incident_types: incidentTypes,
        flags_police: flagsPolice,
        flags_children: flagsChildren,
        flags_witness: flagsWitness,
        has_attachments: false,
        encrypted_payload: encryptedPayload,
        payload_version: 1,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      console.error("Record insert error:", error);
      return apiError(500, "Failed to create record");
    }

    // Count active entries for milestone nudge (best-effort; non-fatal if it fails)
    const { count } = await db
      .from("vault_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("status", "ACTIVE");

    return Response.json({ id: data.id, created_at: data.created_at, totalCount: count ?? 0 }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    if (err instanceof Error && err.message === "Forbidden") return apiError(403, "Forbidden");
    return apiError(500, "Internal server error");
  }
}
