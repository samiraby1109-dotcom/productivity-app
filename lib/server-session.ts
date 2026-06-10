/**
 * Helpers for reading session from server components and API routes.
 */
import { cookies } from "next/headers";
import { verifySession, type SessionPayload } from "./session";
import { SESSION_COOKIE_NAME } from "./constants";
import { createServiceClient } from "./db";

/** Read and verify session from request cookie. Returns null if invalid. */
export async function getServerSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
  } catch {
    return null;
  }
}

/** Require full session or throw 401. Used in API routes. */
export async function requireFullSession(req: Request): Promise<SessionPayload> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match?.[1];
  if (!token) throw new ApiError(401, "Unauthorized");
  const session = await verifySession(token);
  if (!session) throw new ApiError(401, "Unauthorized");
  if (session.mode !== "FULL") throw new ApiError(403, "Forbidden");
  return session;
}

export async function requireAnySession(req: Request): Promise<SessionPayload> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match?.[1];
  if (!token) throw new ApiError(401, "Unauthorized");
  const session = await verifySession(token);
  if (!session) throw new ApiError(401, "Unauthorized");
  return session;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function apiError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Defence-in-depth CSRF check for mutating JSON endpoints.
 *
 * Cookies are already SameSite=Strict, but rejecting anything that isn't an
 * application/json body blocks simple cross-origin form posts and curl-style
 * exploits that rely on a permissive Content-Type. Multipart uploads (media
 * upload) opt out via the `allow` param.
 */
export function requireJsonBody(req: Request, allow: ReadonlyArray<string> = []): Response | null {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct.startsWith("application/json")) return null;
  if (allow.some((prefix) => ct.startsWith(prefix))) return null;
  return apiError(415, "Unsupported Media Type");
}

/** Look up user row by userId, enforcing ownership. */
export async function getUser(userId: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("users")
    .select("id, email, password_hint, password_salt")
    .eq("id", userId)
    .single();
  if (error || !data) throw new ApiError(404, "User not found");
  return data;
}
