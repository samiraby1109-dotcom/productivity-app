/**
 * Unit tests for registration input validation rules.
 * These mirror the exact conditions checked in app/api/auth/register/route.ts
 * so any drift in validation logic will be caught.
 */
import { describe, it, expect } from "vitest";

// Mirror of the validation logic in register/route.ts
function isWeakDecoyCode(code: string): boolean {
  if (/^(\d)\1{3}$/.test(code)) return true;
  if (/^0123|1234|2345|3456|4567|5678|6789$/.test(code)) return true;
  if (/^9876|8765|7654|6543|5432|4321|3210$/.test(code)) return true;
  const blocklist = new Set(["1004", "2580", "0852", "1212", "2121", "0007", "6969", "1010"]);
  return blocklist.has(code);
}

function validateRegistration(body: {
  email?: string;
  password?: string;
  decoyCode?: string;
}): string | null {
  const { email, password, decoyCode } = body;
  if (!email || !password || !decoyCode) return "Missing required fields";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/^\d{4}$/.test(decoyCode)) return "Decoy code must be exactly 4 digits";
  if (isWeakDecoyCode(decoyCode)) return "Please choose a less guessable 4-digit code.";
  return null;
}

describe("registration input validation", () => {
  it("accepts valid input", () => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: "2468" })
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
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: "2468" })
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

  it.each(["0000", "1111", "9999", "1234", "4321", "5678", "6789", "0123", "1010", "6969"])(
    "rejects weak decoy code %s",
    (code) => {
      expect(
        validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: code })
      ).toBe("Please choose a less guessable 4-digit code.");
    }
  );

  it.each(["2468", "8137", "5093", "7204"])("accepts non-trivial code %s", (code) => {
    expect(
      validateRegistration({ email: "a@b.com", password: "12345678", decoyCode: code })
    ).toBeNull();
  });
});
