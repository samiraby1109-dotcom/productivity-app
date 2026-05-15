"use client";
/**
 * IdleLock — locks screen after 5 min idle.
 * Shows a PIN re-entry screen. On success, re-derives vault key.
 * On page restart, forces re-login via server session check.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { IDLE_TIMEOUT_MS } from "@/lib/constants";
import { deriveVaultKey, setVaultKey, clearVaultKey } from "@/lib/crypto";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

export default function IdleLock({ mode, email, passwordSalt }: Props) {
  const [locked, setLocked] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    clearVaultKey();
    setLocked(true);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(lock, IDLE_TIMEOUT_MS);
  }, [lock]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });

      if (!res.ok) {
        setError("Incorrect password. Try again.");
        return;
      }

      const data = await res.json();

      // Refuse to unlock if the entered credential downgraded the session
      // (e.g. decoy PIN entered on a locked FULL-mode screen). The locked
      // page still has FULL-mode data in memory; quietly switching cookies
      // would let a coercer view that data with only the decoy code.
      if (data.mode !== mode) {
        setPw("");
        await fetch("/api/auth/logout", { method: "POST" });
        clearVaultKey();
        window.location.replace("/login");
        return;
      }

      if (mode === "FULL") {
        const { key } = await deriveVaultKey(pw, Buffer.from(passwordSalt, "base64"));
        setVaultKey(key, passwordSalt);
      }
      setPw("");
      setLocked(false);
      resetTimer();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs text-center space-y-6">
        <div>
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-gray-900">Screen locked</h2>
          <p className="text-sm text-gray-500 mt-1">Enter your password to continue.</p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            autoFocus
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-center"
            placeholder="Your password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {submitting ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
