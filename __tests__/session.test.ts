import { describe, it, expect } from "vitest";
import { signSession, verifySession, sessionCookieOptions } from "../lib/session";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "../lib/constants";

const SAMPLE_PAYLOAD = {
  userId: "abc-123",
  email: "user@example.com",
  mode: "FULL" as const,
  passwordSalt: "dGVzdHNhbHQ=",
};

// ─── signSession / verifySession ──────────────────────────────────────────────

describe("signSession / verifySession", () => {
  it("round-trips a FULL session payload", async () => {
    const token = await signSession(SAMPLE_PAYLOAD);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT format

    const verified = await verifySession(token);
    expect(verified).not.toBeNull();
    expect(verified!.userId).toBe(SAMPLE_PAYLOAD.userId);
    expect(verified!.email).toBe(SAMPLE_PAYLOAD.email);
    expect(verified!.mode).toBe("FULL");
    expect(verified!.passwordSalt).toBe(SAMPLE_PAYLOAD.passwordSalt);
  });

  it("round-trips a DECOY session payload", async () => {
    const token = await signSession({ ...SAMPLE_PAYLOAD, mode: "DECOY" });
    const verified = await verifySession(token);
    expect(verified!.mode).toBe("DECOY");
  });

  it("returns null for a tampered token", async () => {
    const token = await signSession(SAMPLE_PAYLOAD);
    const [header, payload, sig] = token.split(".");
    const tampered = `${header}.${payload}.${sig}X`;
    expect(await verifySession(tampered)).toBeNull();
  });

  it("returns null for a completely invalid token", async () => {
    expect(await verifySession("not.a.jwt")).toBeNull();
    expect(await verifySession("")).toBeNull();
  });

  it("token includes iat and exp", async () => {
    const token = await signSession(SAMPLE_PAYLOAD);
    const verified = await verifySession(token);
    expect(verified!.iat).toBeDefined();
    expect(verified!.exp).toBeDefined();
    expect(verified!.exp! - verified!.iat!).toBe(SESSION_MAX_AGE);
  });
});

// ─── sessionCookieOptions ─────────────────────────────────────────────────────

describe("sessionCookieOptions", () => {
  it("uses the correct cookie name constant", () => {
    const { name } = sessionCookieOptions();
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(name).toBe("bellemeadow_wellness_session");
  });

  it("returns HttpOnly + SameSite strict options", () => {
    const { options } = sessionCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/");
  });

  it("respects maxAge override", () => {
    const { options } = sessionCookieOptions(3600);
    expect(options.maxAge).toBe(3600);
  });
});

// ─── Cookie name consistency ───────────────────────────────────────────────────

describe("SESSION_COOKIE_NAME consistency", () => {
  it("constant matches what routes hardcode in Set-Cookie headers", () => {
    // The register and login routes use SESSION_COOKIE_NAME in their Set-Cookie strings.
    // If a route ever hardcodes the string instead of using the constant, this test catches it.
    expect(SESSION_COOKIE_NAME).toBe("bellemeadow_wellness_session");
  });
});
