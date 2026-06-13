/**
 * Normalize a password/passphrase before it is used as a secret — for BOTH the
 * server-side password hash and the client-side vault-key derivation.
 *
 * Trimming leading/trailing whitespace is the single highest-value fix for
 * "the password I just set doesn't work": a stray space or newline picked up
 * from copy/paste, autofill, or a password manager makes an otherwise-correct
 * password fail verification. Single-line inputs already strip newlines, but
 * spaces slip through.
 *
 * It is applied identically on the client (vault KDF + request body) and the
 * server (hash/verify) so the two can never disagree. Intentionally trim-only:
 * it must be idempotent and must never alter the interior of a password.
 */
export function normalizePassword(secret: string): string {
  return secret.trim();
}
