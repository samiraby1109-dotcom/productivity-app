"use client";
/**
 * Client-side encryption using WebCrypto AES-GCM.
 * KDF: PBKDF2 (universally supported) with Argon2id WASM as preferred upgrade path.
 * All vault content is encrypted before leaving the browser.
 */
import {
  RECOVERY_ALPHABET,
  RECOVERY_CODE_LENGTH,
  RECOVERY_CODE_COUNT,
} from "./recovery-format";

const PBKDF2_ITERATIONS = 310_000; // NIST recommended minimum 2024
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_LENGTH = 256;

// ─── Type helpers ─────────────────────────────────────────────────────────────
export interface EncryptedBlob {
  ciphertext: string; // base64
  iv: string;         // base64
  salt: string;       // base64 (only in password-derived keys)
}

export interface WrappedKey {
  wrappedKey: string; // base64 AES-GCM encrypted raw key
  iv: string;         // base64
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const str = atob(b64);
  const result = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) result[i] = str.charCodeAt(i);
  return result;
}

// ─── Key Derivation ───────────────────────────────────────────────────────────
/**
 * Derive an AES-GCM key from a password using PBKDF2.
 * Returns { key, salt } where salt is a fresh random salt.
 */
export async function deriveVaultKey(
  password: string,
  saltBytes?: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const salt = saltBytes ? new Uint8Array(saltBytes) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    true, // extractable so we can wrap per-file keys
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
  return { key, salt };
}

/**
 * Re-derive vault key using stored salt.
 */
export async function rederiveVaultKey(
  password: string,
  saltB64: string
): Promise<CryptoKey> {
  const salt = fromBase64(saltB64);
  const { key } = await deriveVaultKey(password, salt);
  return key;
}

// ─── Symmetric Encryption ─────────────────────────────────────────────────────
/**
 * Encrypt a JSON-serializable payload with an AES-GCM key.
 */
export async function encryptPayload(
  plaintext: unknown,
  key: CryptoKey
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(plaintext))
  );
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    salt: "", // salt stored separately at the user level
  };
}

/**
 * Decrypt an encrypted blob back to a parsed object.
 */
export async function decryptPayload<T = unknown>(
  blob: EncryptedBlob,
  key: CryptoKey
): Promise<T> {
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plaintext)) as T;
}

// ─── Per-file Key Management ──────────────────────────────────────────────────
/**
 * Generate a fresh random AES-GCM key for a single media file.
 */
export async function generateFileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Wrap (encrypt) a file key using the vault key so it can be stored in DB.
 */
export async function wrapFileKey(
  fileKey: CryptoKey,
  vaultKey: CryptoKey
): Promise<WrappedKey> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrapped = await crypto.subtle.wrapKey("raw", fileKey, vaultKey, {
    name: "AES-GCM",
    iv,
  });
  return { wrappedKey: toBase64(wrapped), iv: toBase64(iv) };
}

/**
 * Unwrap a file key using the vault key.
 */
export async function unwrapFileKey(
  wrapped: WrappedKey,
  vaultKey: CryptoKey
): Promise<CryptoKey> {
  const iv = fromBase64(wrapped.iv);
  const wrappedKeyBytes = fromBase64(wrapped.wrappedKey);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKeyBytes,
    vaultKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Media Encryption ─────────────────────────────────────────────────────────
/**
 * Encrypt a binary file (ArrayBuffer) with a given key.
 * Returns an ArrayBuffer with IV prepended: [12-byte IV][ciphertext].
 */
export async function encryptFile(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_BYTES);
  return result.buffer as ArrayBuffer;
}

/**
 * Decrypt an encrypted file blob (IV-prepended format).
 */
export async function decryptFile(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = new Uint8Array(data, 0, IV_BYTES);
  const ciphertext = new Uint8Array(data, IV_BYTES);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

// ─── SHA-256 Manifest ─────────────────────────────────────────────────────────
export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  let buf: ArrayBuffer;
  if (typeof data === "string") {
    buf = new TextEncoder().encode(data).buffer as ArrayBuffer;
  } else {
    buf = data;
  }
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Vault Master Key (VMK) + recovery codes ──────────────────────────────────
//
// The VMK is the actual key that encrypts vault content. It is wrapped (AES-GCM
// key-wrap) under a key derived from the password, AND under a key derived from
// each recovery code. The server only ever stores wrapped copies — it never
// sees the VMK, the password, or a recovery code in plaintext.
//
// Because the VMK itself never changes, a recovery code can be used to set a new
// password (re-wrapping the VMK) WITHOUT losing access to existing ciphertext.

const KEK_ITERATIONS = 310_000;

export interface WrappedVmk {
  wrapped: string; // base64 — VMK wrapped with a secret-derived KEK
  iv: string;      // base64
  salt: string;    // base64 — PBKDF2 salt for the KEK
}

/** Derive a wrap/unwrap key (KEK) from a secret (password or recovery code). */
async function deriveKek(secret: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: KEK_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

/** Generate a fresh random 256-bit Vault Master Key. */
export async function generateVaultMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
    "wrapKey",
    "unwrapKey",
  ]);
}

/** Export a key's raw bytes (used to adopt a legacy password-derived key as a VMK). */
export async function exportKeyRaw(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", key);
}

/** Import raw bytes as a VMK with full vault-key usages. */
export async function importVmkFromRaw(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
    "wrapKey",
    "unwrapKey",
  ]);
}

/** Wrap the VMK under a secret (password or recovery code). */
export async function wrapVmkWithSecret(vmk: CryptoKey, secret: string): Promise<WrappedVmk> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const kek = await deriveKek(secret, salt);
  const wrapped = await crypto.subtle.wrapKey("raw", vmk, kek, { name: "AES-GCM", iv });
  return { wrapped: toBase64(wrapped), iv: toBase64(iv), salt: toBase64(salt) };
}

/** Unwrap the VMK using a secret. Throws if the secret is wrong (GCM auth fail). */
export async function unwrapVmkWithSecret(blob: WrappedVmk, secret: string): Promise<CryptoKey> {
  const kek = await deriveKek(secret, fromBase64(blob.salt));
  return crypto.subtle.unwrapKey(
    "raw",
    fromBase64(blob.wrapped),
    kek,
    { name: "AES-GCM", iv: fromBase64(blob.iv) },
    { name: "AES-GCM", length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

/** Generate N high-entropy recovery codes (normalized form, no separators). */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < RECOVERY_CODE_LENGTH; j++) code += randomAlphabetChar();
    codes.push(code);
  }
  return codes;
}

// Unbiased single-character pick from RECOVERY_ALPHABET via rejection sampling.
function randomAlphabetChar(): string {
  const n = RECOVERY_ALPHABET.length;
  const max = 256 - (256 % n);
  const buf = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < max) return RECOVERY_ALPHABET[buf[0] % n];
  }
}

/**
 * Slow, deterministic lookup hash for a recovery code, derived client-side so
 * the server never receives the plaintext code. Salted by the (lowercased)
 * email so identical codes across accounts don't collide. Stored and compared
 * server-side as an opaque string; the wrapped VMK still requires the real code
 * to unwrap, so a leaked lookup hash never yields plaintext content.
 */
export async function recoveryLookupHash(normalizedCode: string, email: string): Promise<string> {
  const enc = new TextEncoder();
  const saltSeed = await crypto.subtle.digest(
    "SHA-256",
    enc.encode("bellemeadow-recovery:" + email.toLowerCase().trim())
  );
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(normalizedCode),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new Uint8Array(saltSeed), iterations: KEK_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toBase64(bits);
}

// ─── Vault Key in Session Memory ─────────────────────────────────────────────
// We store the derived vault key ONLY in memory (module-level WeakMap via closure)
// so it never persists to storage. This key lives only for the session.
let _vaultKey: CryptoKey | null = null;
let _vaultSalt: string | null = null;

export function setVaultKey(key: CryptoKey, saltB64: string): void {
  _vaultKey = key;
  _vaultSalt = saltB64;
}

export function getVaultKey(): CryptoKey | null {
  return _vaultKey;
}

export function getVaultSalt(): string | null {
  return _vaultSalt;
}

export function clearVaultKey(): void {
  _vaultKey = null;
  _vaultSalt = null;
}

/**
 * Acquire and store the in-memory vault key from a /api/auth/me payload.
 *
 * New/migrated accounts ship a wrapped VMK → unwrap it with the password.
 * Legacy accounts (no VMK yet) fall back to the original password-derived key.
 * Throws if the password can't unwrap the VMK (treat as a failed unlock).
 */
export interface MeVaultFields {
  vmkWrapped?: string | null;
  vmkWrappedIv?: string | null;
  vmkSalt?: string | null;
  passwordSalt?: string | null;
}

export async function unlockVaultFromMe(password: string, me: MeVaultFields): Promise<void> {
  if (me.vmkWrapped && me.vmkWrappedIv && me.vmkSalt) {
    const vmk = await unwrapVmkWithSecret(
      { wrapped: me.vmkWrapped, iv: me.vmkWrappedIv, salt: me.vmkSalt },
      password
    );
    setVaultKey(vmk, me.vmkSalt);
    return;
  }
  if (me.passwordSalt) {
    const { key } = await deriveVaultKey(password, fromBase64(me.passwordSalt));
    setVaultKey(key, me.passwordSalt);
  }
}
