/**
 * Server-side auth utilities.
 * Password hashing uses bcrypt-compatible approach via Web Crypto (PBKDF2).
 * For MVP simplicity we use a Node.js-compatible PBKDF2 via crypto module.
 */
import { createHmac, randomBytes, pbkdf2 as nodePbkdf2 } from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(nodePbkdf2);

const HASH_ITERATIONS = 200_000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = "sha256";
const SEPARATOR = ":";

// ─── Password hashing ─────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await pbkdf2Async(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST);
  return `${HASH_ITERATIONS}${SEPARATOR}${salt}${SEPARATOR}${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [iterations, salt, hash] = stored.split(SEPARATOR);
    const derived = await pbkdf2Async(password, salt, parseInt(iterations), HASH_KEYLEN, HASH_DIGEST);
    // Constant-time compare
    return timingSafeEqual(derived.toString("hex"), hash);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─── Decoy code hashing ───────────────────────────────────────────────────────
// Decoy code is a 4-digit PIN; we store it hashed with HMAC+PBKDF2
export async function hashDecoyCode(code: string, secret: string): Promise<string> {
  const salt = randomBytes(8).toString("hex");
  const hash = createHmac("sha256", secret + salt).update(code).digest("hex");
  return `${salt}${SEPARATOR}${hash}`;
}

export function verifyDecoyCode(code: string, stored: string, secret: string): boolean {
  try {
    const [salt, hash] = stored.split(SEPARATOR);
    const derived = createHmac("sha256", secret + salt).update(code).digest("hex");
    return timingSafeEqual(derived, hash);
  } catch {
    return false;
  }
}

// ─── Password salt for client-side KDF ───────────────────────────────────────
// We store a separate base64 salt used by the client to derive the vault encryption key.
// This is NOT the same as the password hash salt.
export function generatePasswordSalt(): string {
  return randomBytes(16).toString("base64");
}

// ─── Lockout ─────────────────────────────────────────────────────────────────
// Legacy in-memory lockout — retained for unit tests and as a fallback.
// Production code uses the DB-backed helpers below so the counter survives
// Vercel cold starts and works across serverless instances.
const lockoutMap = new Map<string, { attempts: number; lockedUntil: number }>();

export function checkLockout(identifier: string): { locked: boolean; remainingMs: number } {
  const entry = lockoutMap.get(identifier);
  if (!entry) return { locked: false, remainingMs: 0 };
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  return { locked: false, remainingMs: 0 };
}

export function recordFailedAttempt(identifier: string, maxAttempts: number, lockoutMs: number): void {
  const entry = lockoutMap.get(identifier) ?? { attempts: 0, lockedUntil: 0 };
  entry.attempts += 1;
  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = Date.now() + lockoutMs;
  }
  lockoutMap.set(identifier, entry);
}

export function clearAttempts(identifier: string): void {
  lockoutMap.delete(identifier);
}

// ─── DB-backed lockout (used by login route) ─────────────────────────────────
type LockoutRowFields = {
  failed_attempts?: number | null;
  locked_until?: string | null;
};

// Structural type for the bits of a Supabase client we use here. Keeps this
// module decoupled from the SupabaseClient generics without weakening to any.
interface UsersUpdater {
  from(table: "users"): {
    update(values: { failed_attempts?: number; locked_until?: string | null }): {
      eq(column: "id", value: string): unknown;
    };
  };
}

export function isLockedFromRow(row: LockoutRowFields | null | undefined): boolean {
  if (!row?.locked_until) return false;
  return new Date(row.locked_until).getTime() > Date.now();
}

export async function recordFailedAttemptDb(
  db: UsersUpdater,
  userId: string,
  currentAttempts: number,
  maxAttempts: number,
  lockoutMs: number,
): Promise<void> {
  const attempts = currentAttempts + 1;
  const update: { failed_attempts: number; locked_until?: string } = { failed_attempts: attempts };
  if (attempts >= maxAttempts) {
    update.locked_until = new Date(Date.now() + lockoutMs).toISOString();
  }
  await Promise.resolve(db.from("users").update(update).eq("id", userId));
}

export async function clearAttemptsDb(
  db: UsersUpdater,
  userId: string,
): Promise<void> {
  await Promise.resolve(db.from("users").update({ failed_attempts: 0, locked_until: null }).eq("id", userId));
}
