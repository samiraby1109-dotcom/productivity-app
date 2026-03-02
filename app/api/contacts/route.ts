import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";

// GET /api/contacts — list all contacts for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await requireFullSession(req);
    const db = createServiceClient();

    const { data, error } = await db
      .from("vault_contacts")
      .select("id, created_at, updated_at, relationship, encrypted_payload, payload_version")
      .eq("user_id", session.userId)
      .order("relationship", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Contacts fetch error:", error);
      return apiError(500, "Failed to fetch contacts");
    }

    return Response.json({ contacts: data ?? [] });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    if (err instanceof Error && err.message === "Forbidden") return apiError(403, "Forbidden");
    return apiError(500, "Internal server error");
  }
}

// POST /api/contacts — create a new contact
export async function POST(req: NextRequest) {
  try {
    const session = await requireFullSession(req);
    const body = await req.json() as {
      encryptedPayload: string;
      relationship?: string;
    };

    const { encryptedPayload, relationship = "" } = body;
    if (!encryptedPayload) return apiError(400, "Missing payload");

    const db = createServiceClient();
    const { data, error } = await db
      .from("vault_contacts")
      .insert({
        user_id: session.userId,
        relationship: relationship.trim().slice(0, 100),
        encrypted_payload: encryptedPayload,
        payload_version: 1,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      console.error("Contact insert error:", error);
      return apiError(500, "Failed to create contact");
    }

    return Response.json({ id: data.id, created_at: data.created_at }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    if (err instanceof Error && err.message === "Forbidden") return apiError(403, "Forbidden");
    return apiError(500, "Internal server error");
  }
}
