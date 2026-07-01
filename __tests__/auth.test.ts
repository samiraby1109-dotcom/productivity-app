import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  hashDecoyCode,
  verifyDecoyCode,
  generatePasswordSalt,
  checkLockout,
  recordFailedAttempt,
  clearAttempts,
} from "../lib/auth";

const SECRET = "test-secret-for-unit-tests";

// ─── hashPassword / verifyPassword ────────────────────────────────────────────

describe("hashPassword", () => {
  it("produces a colon-delimited string with iterations, salt, and hash", async () => {
    const hash = await hashPassword("MyPassword1!");
    const parts = hash.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("200000");
    expect(parts[1]).toHaveLength(32); // 16 bytes → 32 hex chars
    expect(parts[2]).toHaveLength(128); // 64 bytes → 128 hex chars
  });

  it("produces a different hash each call (random salt)", async () => {
    const h1 = await hashPassword("same-password");
    const h2 = await hashPassword("same-password");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyPassword", () => {
  it("verifies correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects empty password", async () => {
    const hash = await hashPassword("some-password");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("rejects malformed stored hash gracefully", async () => {
    expect(await verifyPassword("anything", "bad:data")).toBe(false);
    expect(await verifyPassword("anything", "totally-invalid")).toBe(false);
  });

  it("is case-sensitive", async () => {
    const hash = await hashPassword("MyPassword");
    expect(await verifyPassword("mypassword", hash)).toBe(false);
    expect(await verifyPassword("MYPASSWORD", hash)).toBe(false);
  });
});

// ─── hashDecoyCode / verifyDecoyCode ──────────────────────────────────────────

describe("hashDecoyCode", () => {
  it("produces a tagged pbkdf2:iterations:salt:hash string", async () => {
    const stored = await hashDecoyCode("1234", SECRET);
    const parts = stored.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2");
    expect(Number(parts[1])).toBeGreaterThanOrEqual(200_000); // iteration count
    expect(parts[2]).toHaveLength(16); // 8-byte salt → 16 hex chars
    expect(parts[3]).toHaveLength(128); // 64-byte key → 128 hex chars
  });

  it("produces different stored values each call (random salt)", async () => {
    const h1 = await hashDecoyCode("1234", SECRET);
    const h2 = await hashDecoyCode("1234", SECRET);
    expect(h1).not.toBe(h2);
  });
});

describe("verifyDecoyCode", () => {
  it("verifies correct decoy code", async () => {
    const stored = await hashDecoyCode("5678", SECRET);
    expect(await verifyDecoyCode("5678", stored, SECRET)).toBe(true);
  });

  it("rejects wrong decoy code", async () => {
    const stored = await hashDecoyCode("5678", SECRET);
    expect(await verifyDecoyCode("1234", stored, SECRET)).toBe(false);
  });

  it("rejects correct code with wrong secret", async () => {
    const stored = await hashDecoyCode("5678", SECRET);
    expect(await verifyDecoyCode("5678", stored, "different-secret")).toBe(false);
  });

  it("rejects malformed stored value gracefully", async () => {
    expect(await verifyDecoyCode("1234", "invalid", SECRET)).toBe(false);
    expect(await verifyDecoyCode("1234", "", SECRET)).toBe(false);
  });

  it("still verifies a legacy fast-HMAC stored value (back-compat)", async () => {
    // Pre-upgrade format: "salt:hmacHex" using HMAC(secret+salt, code).
    const { createHmac } = await import("crypto");
    const salt = "abcdef0123456789";
    const legacy = `${salt}:${createHmac("sha256", SECRET + salt).update("4321").digest("hex")}`;
    expect(await verifyDecoyCode("4321", legacy, SECRET)).toBe(true);
    expect(await verifyDecoyCode("0000", legacy, SECRET)).toBe(false);
  });
});

// ─── generatePasswordSalt ──────────────────────────────────────────────────────

describe("generatePasswordSalt", () => {
  it("produces a base64 string of 16 random bytes", () => {
    const salt = generatePasswordSalt();
    const decoded = Buffer.from(salt, "base64");
    expect(decoded).toHaveLength(16);
  });

  it("produces unique values each call", () => {
    const s1 = generatePasswordSalt();
    const s2 = generatePasswordSalt();
    expect(s1).not.toBe(s2);
  });
});

// ─── Lockout ──────────────────────────────────────────────────────────────────

describe("lockout", () => {
  const id = "lockout-test@example.com";
  const MAX = 5;
  const DURATION = 1000; // 1 second for fast tests

  it("starts with no lockout", () => {
    clearAttempts(id);
    expect(checkLockout(id)).toEqual({ locked: false, remainingMs: 0 });
  });

  it("not locked before max attempts", () => {
    clearAttempts(id);
    for (let i = 0; i < MAX - 1; i++) {
      recordFailedAttempt(id, MAX, DURATION);
    }
    expect(checkLockout(id).locked).toBe(false);
  });

  it("locks on reaching max attempts", () => {
    clearAttempts(id);
    for (let i = 0; i < MAX; i++) {
      recordFailedAttempt(id, MAX, DURATION);
    }
    const result = checkLockout(id);
    expect(result.locked).toBe(true);
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it("clears lockout on clearAttempts", () => {
    clearAttempts(id);
    for (let i = 0; i < MAX; i++) {
      recordFailedAttempt(id, MAX, DURATION);
    }
    clearAttempts(id);
    expect(checkLockout(id).locked).toBe(false);
  });

  it("lockout expires after duration", async () => {
    clearAttempts(id);
    for (let i = 0; i < MAX; i++) {
      recordFailedAttempt(id, MAX, 50); // 50ms lockout
    }
    expect(checkLockout(id).locked).toBe(true);
    await new Promise((r) => setTimeout(r, 60));
    expect(checkLockout(id).locked).toBe(false);
  });
});
