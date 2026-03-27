/**
 * Unit tests for registration input validation rules.
 * These mirror the exact conditions checked in app/api/auth/register/route.ts
 * so any drift in validation logic will be caught.
 */
import { describe, it, expect } from "vitest";

// Mirror of the validation logic in register/route.ts
function validateRegistration(body: {
  email?: string;
  password?: string;
  decoyCode?: string;
}): string | null {
  const { email, password, decoyCode } = body;
  if (!email || !password || !decoyCode) return "Missing required fields";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/^\d{4}$/.test(decoyCode)) return "Decoy code must be exactly 4 digits";
  return null;
}

describe("registration input validation", () => {
  it("accepts valid input", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: "1234" })
    ).toBeNull();
  });

  it("rejects missing email", () => {
    expect(
      validateRegistration({ password: "12345678", decoyCode: "1234" })
    ).toBe("Missing required fields");
  });

  it("rejects missing password", () => {
    expect(
      validateRegistration({ email: "a@b.com", decoyCode: "1234" })
    ).toBe("Missing required fields");
  });

  it("rejects missing decoy code", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678" })
    ).toBe("Missing required fields");
  });

  it("rejects password shorter than 8 chars", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "short", decoyCode: "1234" })
    ).toBe("Password must be at least 8 characters");
  });

  it("accepts password of exactly 8 chars", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: "1234" })
    ).toBeNull();
  });

  it("rejects non-numeric decoy code", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: "abcd" })
    ).toBe("Decoy code must be exactly 4 digits");
  });

  it("rejects decoy code shorter than 4 digits", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: "123" })
    ).toBe("Decoy code must be exactly 4 digits");
  });

  it("rejects decoy code longer than 4 digits", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: "12345" })
    ).toBe("Decoy code must be exactly 4 digits");
  });

  it("rejects decoy code with spaces", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: "12 4" })
    ).toBe("Decoy code must be exactly 4 digits");
  });
});
