import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/health
 * Diagnostic endpoint — shows which env vars are set, DB connectivity,
 * whether the schema exists, and whether the demo user has been seeded.
 * Never leaks actual values; only booleans.
 *
 * Requires Authorization: Bearer <CRON_SECRET>. The endpoint used to be
 * fully public and gave attackers a free read on which env vars were set,
 * whether the demo user existed, and instructions for setup — useful recon.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    // 404 (not 401) so unauthed callers can't even detect the endpoint exists.
    return new Response("Not found", { status: 404 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sessionSecret = process.env.SESSION_SECRET;

  const env = {
    supabaseUrl: !!url && !url.includes("placeholder"),
    serviceKey: !!serviceKey,
    anonKey: !!anonKey,
    sessionSecret: !!sessionSecret,
    cronSecret: !!cronSecret,
  };

  // Short-circuit if we can't even build a client
  if (!env.supabaseUrl || !env.serviceKey) {
    return Response.json(
      { env, db: { connected: false, tablesExist: false }, demoUser: { exists: false } },
      { status: 200 }
    );
  }

  const db = createClient(url!, serviceKey!, { auth: { persistSession: false } });

  // Test DB connectivity and schema existence
  let connected = false;
  let tablesExist = false;
  let demoUserExists = false;

  try {
    const { error } = await db.from("users").select("id").limit(1);
    if (!error) {
      connected = true;
      tablesExist = true;
    } else if (error.code === "42P01") {
      // relation does not exist — DB is reachable but migrations not run
      connected = true;
      tablesExist = false;
    } else {
      // some other error (auth, network, etc.)
      connected = false;
      tablesExist = false;
    }
  } catch {
    connected = false;
  }

  if (tablesExist) {
    try {
      const { data } = await db
        .from("users")
        .select("id")
        .eq("email", "demo@tracker.local")
        .maybeSingle();
      demoUserExists = !!data;
    } catch {
      demoUserExists = false;
    }
  }

  const status = env.supabaseUrl && env.serviceKey && env.sessionSecret && tablesExist ? 200 : 503;

  return Response.json(
    {
      env,
      db: { connected, tablesExist },
      // In production the demo user should NOT exist; surface it as a warning,
      // not a goal. (No credentials are ever included in this response.)
      demoUser: { exists: demoUserExists },
      hint: !env.supabaseUrl || !env.serviceKey
        ? "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env vars, then redeploy."
        : !tablesExist
        ? "Run the migrations in supabase/migrations (001–011) in your Supabase SQL editor."
        : demoUserExists && process.env.NODE_ENV === "production"
        ? "WARNING: the demo user exists in production. Delete it — see supabase/audit_migrations.sql (the 003 row must read NO)."
        : "All systems go.",
    },
    { status }
  );
}
