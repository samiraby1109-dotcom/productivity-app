import { describe, it, expect, afterEach } from "vitest";
import { emailEnabled } from "../lib/email";
import { signVerifyToken, verifyVerifyToken } from "../lib/verify-token";

// ─── emailEnabled ─────────────────────────────────────────────────────────────

describe("emailEnabled", () => {
  const original = { ...process.env };

  afterEach(() => {
    // Restore env
    Object.assign(process.env, original);
    // Remove any keys that weren't in the original
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
  });

  it("returns false when RESEND_API_KEY is absent", () => {
    delete process.env.RESEND_API_KEY;
    process.env.DEV_MODE = "false";
    expect(emailEnabled()).toBe(false);
  });

  it("returns false when DEV_MODE=true even with a key", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.DEV_MODE = "true";
    expect(emailEnabled()).toBe(false);
  });

  it("returns true when key is present and DEV_MODE is not true", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.DEV_MODE = "false";
    expect(emailEnabled()).toBe(true);
  });

  it("returns true when key is present and DEV_MODE is absent", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.DEV_MODE;
    expect(emailEnabled()).toBe(true);
  });
});

// ─── signVerifyToken / verifyVerifyToken ──────────────────────────────────────

describe("email verification tokens", () => {
  it("round-trips a verification token", async () => {
    const token = await signVerifyToken("user-1", "a@b.com");
    expect(typeof token).toBe("string");

    const payload = await verifyVerifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("user-1");
    expect(payload!.email).toBe("a@b.com");
    expect(payload!.purpose).toBe("verify-email");
  });

  it("rejects a tampered token", async () => {
    const token = await signVerifyToken("user-1", "a@b.com");
    const [h, p, s] = token.split(".");
    expect(await verifyVerifyToken(`${h}.${p}.${s}tampered`)).toBeNull();
  });

  it("rejects an invalid token string", async () => {
    expect(await verifyVerifyToken("not-a-jwt")).toBeNull();
    expect(await verifyVerifyToken("")).toBeNull();
  });

  it("rejects a session JWT used as a verify token (wrong purpose)", async () => {
    // A session JWT has a different payload shape — purpose field absent
    const { signSession } = await import("../lib/session");
    const sessionToken = await signSession({
      userId: "u1",
      email: "a@b.com",
      mode: "FULL",
      passwordSalt: "abc",
    });
    // verifyVerifyToken should reject because purpose !== "verify-email"
    expect(await verifyVerifyToken(sessionToken)).toBeNull();
  });
});
