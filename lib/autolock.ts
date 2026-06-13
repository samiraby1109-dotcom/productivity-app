import { IDLE_TIMEOUT_MS } from "@/lib/constants";

/**
 * Per-device auto-lock preference. Stored in localStorage (a UI preference, not
 * a secret), so it needs no schema. IdleLock reads getAutoLockMs() when arming
 * its timer; the settings screen writes via setAutoLockMs().
 */
export const AUTO_LOCK_KEY = "bw_autolock_ms";
export const AUTO_LOCK_DEFAULT_MS = IDLE_TIMEOUT_MS; // 5 minutes
export const AUTO_LOCK_OPTIONS: { ms: number; label: string }[] = [
  { ms: 60_000, label: "1 minute" },
  { ms: 120_000, label: "2 minutes" },
  { ms: 300_000, label: "5 minutes" },
  { ms: 600_000, label: "10 minutes" },
];

export function getAutoLockMs(): number {
  if (typeof window === "undefined") return AUTO_LOCK_DEFAULT_MS;
  try {
    const v = Number(localStorage.getItem(AUTO_LOCK_KEY));
    if (AUTO_LOCK_OPTIONS.some((o) => o.ms === v)) return v;
  } catch {
    /* ignore */
  }
  return AUTO_LOCK_DEFAULT_MS;
}

export function setAutoLockMs(ms: number): void {
  try {
    localStorage.setItem(AUTO_LOCK_KEY, String(ms));
    window.dispatchEvent(new Event("bw-autolock-change"));
  } catch {
    /* ignore */
  }
}
