import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/contacts/[id] — update a contact
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireFullSession(req);
    const { id } = await params;
    const body = await req.json() as {
      encryptedPayload?: string;
      relationship?: string;
    };

    const db = createServiceClient();

    // Verify ownership
    const { data: existing } = await db
      .from("vault_contacts")
      .select("id")
      .eq("id", id)
      .eq("user_id", session.userId)
      .single();

    if (!existing) return apiError(404, "Not found");

    const update: { encrypted_payload?: string; relationship?: string } = {};
    if (body.encryptedPayload !== undefined) update.encrypted_payload = body.encryptedPayload;
    if (body.relationship !== undefined) update.relationship = body.relationship.trim().slice(0, 100);

    const { error } = await db
      .from("vault_contacts")
      .update(update)
      .eq("id", id)
      .eq("user_id", session.userId);

    if (error) return apiError(500, "Update failed");
    return Response.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    if (err instanceof Error && err.message === "Forbidden") return apiError(403, "Forbidden");
    return apiError(500, "Internal server error");
  }
}

// DELETE /api/contacts/[id] — delete a contact
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireFullSession(req);
    const { id } = await params;
    const db = createServiceClient();

    const { data: existing } = await db
      .from("vault_contacts")
      .select("id")
      .eq("id", id)
      .eq("user_id", session.userId)
      .single();

    if (!existing) return apiError(404, "Not found");

    const { error } = await db
      .from("vault_contacts")
      .delete()
      .eq("id", id)
      .eq("user_id", session.userId);

    if (error) return apiError(500, "Delete failed");
    return Response.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    if (err instanceof Error && err.message === "Forbidden") return apiError(403, "Forbidden");
    return apiError(500, "Internal server error");
  }
}
