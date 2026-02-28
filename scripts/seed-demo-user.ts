/**
 * DEV MODE ONLY — seed demo user into Supabase.
 * Run: npm run seed
 *
 * Demo credentials:
 *   Email:       demo@tracker.local
 *   Password:    TrackerDemo2026
 *   Decoy code:  2468
 *   Hint:        "It's the demo password for Daybook"
 */

import { createClient } from "@supabase/supabase-js";
import { pbkdf2, createHmac, randomBytes } from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(pbkdf2);

const HASH_ITERATIONS = 200_000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = "sha256";
const SEPARATOR = ":";

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await pbkdf2Async(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST);
  return `${HASH_ITERATIONS}${SEPARATOR}${salt}${SEPARATOR}${hash.toString("hex")}`;
}

function hashDecoyCode(code: string, secret: string): string {
  const salt = randomBytes(8).toString("hex");
  const hash = createHmac("sha256", secret + salt).update(code).digest("hex");
  return `${salt}${SEPARATOR}${hash}`;
}

function generatePasswordSalt(): string {
  return randomBytes(16).toString("base64");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.SESSION_SECRET ?? "dev-secret-32-chars-replace-in-prod!!";

  if (!url || !serviceKey || url.includes("placeholder")) {
    console.log("⚠  No Supabase credentials found. Skipping live seed.");
    console.log("   To seed, set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    console.log("\n📋 Demo credentials:");
    console.log("   Email:      demo@tracker.local");
    console.log("   Password:   TrackerDemo2026");
    console.log("   Decoy code: 2468");
    return;
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const [passwordHash, passwordSalt] = await Promise.all([
    hashPassword("TrackerDemo2026"),
    Promise.resolve(generatePasswordSalt()),
  ]);

  const decoyCodeHash = hashDecoyCode("2468", sessionSecret);

  const { error } = await db.from("users").upsert(
    {
      id: "00000000-0000-0000-0000-000000000001",
      email: "demo@tracker.local",
      password_hash: passwordHash,
      password_hint: "It's the demo password for Daybook",
      decoy_code_hash: decoyCodeHash,
      password_salt: passwordSalt,
    },
    { onConflict: "email" }
  );

  if (error) {
    console.error("❌ Seed failed:", error.message);
    process.exit(1);
  }

  console.log("✅ Demo user seeded successfully.");
  console.log("\n📋 Demo credentials:");
  console.log("   Email:      demo@tracker.local");
  console.log("   Password:   TrackerDemo2026");
  console.log("   Decoy code: 2468");
}

main().catch(console.error);
