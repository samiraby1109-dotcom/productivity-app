"use client";
/**
 * Client-side encryption using WebCrypto AES-GCM.
 * KDF: PBKDF2 (universally supported) with Argon2id WASM as preferred upgrade path.
 * All vault content is encrypted before leaving the browser.
 */

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
