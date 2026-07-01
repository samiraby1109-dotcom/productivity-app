import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Where "Exit" sends the user: a neutral, universally-plausible site so the
// screen no longer shows this app at all. (An in-app redirect left the abuser
// one tap from the vault.)
export const QUICK_EXIT_URL = "https://www.google.com";

export function quickExit() {
  // Best-effort: end the server session so returning to the app requires a
  // fresh unlock (the FULL session cookie otherwise stays valid for 24h, and an
  // abuser who grabbed the phone could navigate straight back into the vault).
  // keepalive lets the request complete even as we navigate away.
  try {
    void fetch("/api/auth/logout", { method: "POST", keepalive: true });
  } catch {
    /* navigating away regardless */
  }
  // location.replace (not assign) drops the current entry from history, and the
  // logout above means any back-navigation into a vault route redirects to
  // /login. Leaving the origin also tears down the in-memory vault key.
  window.location.replace(QUICK_EXIT_URL);
}
