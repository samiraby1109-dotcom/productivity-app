import { describe, it, expect } from "vitest";
import {
  generateVaultMasterKey,
  wrapVmkWithSecret,
  unwrapVmkWithSecret,
  generateRecoveryCodes,
  recoveryLookupHash,
  exportKeyRaw,
  importVmkFromRaw,
  encryptPayload,
  decryptPayload,
  CODE_KEK_ITERATIONS,
  PASSWORD_KEK_ITERATIONS,
} from "../lib/crypto";
import {
  normalizeRecoveryCode,
  isValidRecoveryCodeShape,
  formatRecoveryCode,
  RECOVERY_CODE_LENGTH,
  RECOVERY_CODE_COUNT,
  RECOVERY_ALPHABET,
} from "../lib/recovery-format";

describe("VMK wrap/unwrap", () => {
  it("round-trips the VMK under a password", async () => {
    const vmk = await generateVaultMasterKey();
    const blob = await wrapVmkWithSecret(vmk, "correct horse battery");
    const unwrapped = await unwrapVmkWithSecret(blob, "correct horse battery");

    // The unwrapped key must decrypt what the original VMK encrypts.
    const enc = await encryptPayload({ note: "hello" }, vmk);
    const dec = await decryptPayload<{ note: string }>(enc, unwrapped);
    expect(dec.note).toBe("hello");
  });

  it("fails to unwrap with the wrong secret", async () => {
    const vmk = await generateVaultMasterKey();
    const blob = await wrapVmkWithSecret(vmk, "right-secret");
    await expect(unwrapVmkWithSecret(blob, "wrong-secret")).rejects.toBeDefined();
  });

  it("produces a fresh salt/iv each wrap", async () => {
    const vmk = await generateVaultMasterKey();
    const a = await wrapVmkWithSecret(vmk, "s");
    const b = await wrapVmkWithSecret(vmk, "s");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.wrapped).not.toBe(b.wrapped);
  });

  it("self-describes the KDF cost in the wrapped string", async () => {
    const vmk = await generateVaultMasterKey();
    const pw = await wrapVmkWithSecret(vmk, "secret");
    const code = await wrapVmkWithSecret(vmk, "secret", CODE_KEK_ITERATIONS);
    expect(pw.wrapped.startsWith(`${PASSWORD_KEK_ITERATIONS}:`)).toBe(true);
    expect(code.wrapped.startsWith(`${CODE_KEK_ITERATIONS}:`)).toBe(true);
  });

  it("round-trips at code-grade iterations", async () => {
    const vmk = await generateVaultMasterKey();
    const blob = await wrapVmkWithSecret(vmk, "WXYZ234567", CODE_KEK_ITERATIONS);
    const unwrapped = await unwrapVmkWithSecret(blob, "WXYZ234567");
    const enc = await encryptPayload({ n: 7 }, vmk);
    expect((await decryptPayload<{ n: number }>(enc, unwrapped)).n).toBe(7);
  });

  it("unwraps legacy blobs (bare base64, no iterations prefix) at 310k", async () => {
    const vmk = await generateVaultMasterKey();
    const blob = await wrapVmkWithSecret(vmk, "legacy-pass", PASSWORD_KEK_ITERATIONS);
    // Simulate a blob stored before the prefix existed.
    const legacy = { ...blob, wrapped: blob.wrapped.split(":")[1] };
    const unwrapped = await unwrapVmkWithSecret(legacy, "legacy-pass");
    const enc = await encryptPayload({ legacy: "yes" }, vmk);
    expect((await decryptPayload<{ legacy: string }>(enc, unwrapped)).legacy).toBe("yes");
  });
});

describe("recovery code wrap/unwrap", () => {
  it("unwraps with the correct code, rejects a wrong one", async () => {
    const vmk = await generateVaultMasterKey();
    const [code] = generateRecoveryCodes(1);
    const blob = await wrapVmkWithSecret(vmk, code);

    const ok = await unwrapVmkWithSecret(blob, code);
    const enc = await encryptPayload({ x: 1 }, vmk);
    expect((await decryptPayload<{ x: number }>(enc, ok)).x).toBe(1);

    await expect(unwrapVmkWithSecret(blob, "WRONGCODE12")).rejects.toBeDefined();
  });
});

describe("recovery code generation + format", () => {
  it("generates the right count, length, and alphabet", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    for (const c of codes) {
      expect(c).toHaveLength(RECOVERY_CODE_LENGTH);
      expect([...c].every((ch) => RECOVERY_ALPHABET.includes(ch))).toBe(true);
    }
    // All unique.
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("normalizes and validates shapes", () => {
    const [code] = generateRecoveryCodes(1);
    const formatted = formatRecoveryCode(code);
    expect(formatted).toContain("-");
    expect(normalizeRecoveryCode(formatted.toLowerCase())).toBe(code);
    expect(isValidRecoveryCodeShape(formatted)).toBe(true);
    expect(isValidRecoveryCodeShape("too-short")).toBe(false);
  });
});

describe("recoveryLookupHash", () => {
  it("is deterministic per (code, email) and varies otherwise", async () => {
    const h1 = await recoveryLookupHash("ABCDE12345", "user@example.com");
    const h2 = await recoveryLookupHash("ABCDE12345", "user@example.com");
    const h3 = await recoveryLookupHash("ABCDE12345", "other@example.com");
    const h4 = await recoveryLookupHash("ZZZZZ99999", "user@example.com");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).not.toBe(h4);
  });

  it("is case-insensitive on email (matches server normalization)", async () => {
    const a = await recoveryLookupHash("ABCDE12345", "User@Example.com");
    const b = await recoveryLookupHash("ABCDE12345", "user@example.com");
    expect(a).toBe(b);
  });

  it("differs by iteration count (legacy 310k vs current 50k)", async () => {
    const current = await recoveryLookupHash("ABCDE12345", "user@example.com");
    const explicit = await recoveryLookupHash("ABCDE12345", "user@example.com", CODE_KEK_ITERATIONS);
    const legacy = await recoveryLookupHash("ABCDE12345", "user@example.com", PASSWORD_KEK_ITERATIONS);
    expect(current).toBe(explicit); // default is code-grade
    expect(current).not.toBe(legacy); // recovery page retries with legacy cost
  });
});

describe("legacy migration safety (raw export/import)", () => {
  it("adopting a key's raw bytes preserves decryption", async () => {
    const original = await generateVaultMasterKey();
    const enc = await encryptPayload({ legacy: true }, original);

    const raw = await exportKeyRaw(original);
    const adopted = await importVmkFromRaw(raw);

    const dec = await decryptPayload<{ legacy: boolean }>(enc, adopted);
    expect(dec.legacy).toBe(true);
  });
});
