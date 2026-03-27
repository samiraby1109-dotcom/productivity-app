import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pbkdf2 as nodePbkdf2, randomBytes, createHmac } from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(nodePbkdf2);

/**
 * POST /api/admin/seed-demo  — via curl with Authorization: Bearer <CRON_SECRET>
 * GET  /api/admin/seed-demo?secret=<CRON_SECRET>  — browser-friendly
 *
 * Creates (or re-creates) the demo user using the live SESSION_SECRET so the
 * decoy code hash matches exactly what the login route expects.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const secret = req.nextUrl.searchParams.get("secret") ?? "";
  if (secret !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSeed();
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }
  // Auth guard
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSeed();
}

async function runSeed() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.SESSION_SECRET ?? "dev-secret";

  if (!url || !serviceKey) {
    return Response.json({ error: "Supabase env vars not configured" }, { status: 503 });
  }

  // Hash password with same params as lib/auth.ts
  const ITERATIONS = 200_000;
  const KEYLEN = 64;
  const DIGEST = "sha256";

  const pwSalt = randomBytes(16).toString("hex");
  const pwHash = await pbkdf2Async("TrackerDemo2026", pwSalt, ITERATIONS, KEYLEN, DIGEST);
  const passwordHash = `${ITERATIONS}:${pwSalt}:${pwHash.toString("hex")}`;

  // Hash decoy code with same logic as lib/auth.ts hashDecoyCode
  const decoySalt = randomBytes(8).toString("hex");
  const decoyHmac = createHmac("sha256", sessionSecret + decoySalt).update("2468").digest("hex");
  const decoyCodeHash = `${decoySalt}:${decoyHmac}`;

  // Password salt for client-side vault key derivation
  const passwordSalt = randomBytes(16).toString("base64");

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { error } = await db.from("users").upsert(
    {
      id: "00000000-0000-0000-0000-000000000001",
      email: "demo@tracker.local",
      password_hash: passwordHash,
      password_hint: "It's the demo password for BelleMeadow Wellness",
      decoy_code_hash: decoyCodeHash,
      password_salt: passwordSalt,
    },
    { onConflict: "email" }
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    message: "Demo user seeded. Login: demo@tracker.local / TrackerDemo2026 | Decoy PIN: 2468",
  });
}
