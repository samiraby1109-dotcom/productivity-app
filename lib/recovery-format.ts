/**
 * Recovery-code format + normalization.
 *
 * Pure module (NO "use client") so both the browser (code generation, KEK
 * derivation, lookup-hash) and server route handlers can import it and agree on
 * exactly what a "code" is.
 *
 * Codes use an unambiguous alphabet (no 0/1/O/I/L/U) so they can be read off a
 * screen and typed back without confusion.
 */

export const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // 30 chars
export const RECOVERY_CODE_LENGTH = 10; // chars → ~49 bits of entropy each
export const RECOVERY_CODE_COUNT = 10; // codes issued per account
export const RECOVERY_GROUP = 5; // display grouping

/** Uppercase and strip anything that isn't an alphabet character. */
export function normalizeRecoveryCode(raw: string): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Render a normalized code grouped for display, e.g. "ABCDE-FGHJK". */
export function formatRecoveryCode(normalized: string): string {
  return normalize(normalized).match(new RegExp(`.{1,${RECOVERY_GROUP}}`, "g"))?.join("-") ?? normalized;
}

/** Shape check — correct length and only alphabet characters. */
export function isValidRecoveryCodeShape(raw: string): boolean {
  const n = normalizeRecoveryCode(raw);
  if (n.length !== RECOVERY_CODE_LENGTH) return false;
  return [...n].every((c) => RECOVERY_ALPHABET.includes(c));
}

function normalize(s: string): string {
  return normalizeRecoveryCode(s);
}
