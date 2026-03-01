import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/health
 * Public diagnostic endpoint — shows which env vars are set, DB connectivity,
 * whether the schema exists, and whether the demo user has been seeded.
 * Never leaks actual values; only booleans.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sessionSecret = process.env.SESSION_SECRET;
  const cronSecret = process.env.CRON_SECRET;

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
      demoUser: { exists: demoUserExists },
      hint: !env.supabaseUrl || !env.serviceKey
        ? "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env vars, then redeploy."
        : !tablesExist
        ? "Run supabase/migrations/001_initial_schema.sql and 002_storage_bucket.sql in your Supabase SQL editor."
        : !demoUserExists
        ? "POST /api/admin/seed-demo with Authorization: Bearer <CRON_SECRET> to create the demo user."
        : "All systems go. Login with demo@tracker.local / TrackerDemo2026.",
    },
    { status }
  );
}
