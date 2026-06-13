import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";
import { createServiceClient } from "@/lib/db";

/**
 * GET /api/auth/activity
 * Recent sign-in events for the current user (FULL session only). If the
 * login_events table hasn't been created yet, returns available:false instead
 * of erroring, so the screen can show a "not enabled yet" state.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireFullSession(req);
    const db = createServiceClient();

    const { data, error } = await db
      .from("login_events")
      .select("outcome, user_agent, created_at")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return Response.json({ available: false, events: [] });
    return Response.json({ available: true, events: data ?? [] });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return apiError(401, "Unauthorized");
    return apiError(500, "Internal server error");
  }
}
