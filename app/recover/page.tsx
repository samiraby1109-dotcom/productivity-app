"use client";
import { useState } from "react";
import Link from "next/link";
import {
  unwrapVmkWithSecret,
  wrapVmkWithSecret,
  recoveryLookupHash,
} from "@/lib/crypto";
import { normalizeRecoveryCode, isValidRecoveryCodeShape } from "@/lib/recovery-format";

type Phase = "enter" | "newpw" | "done";

export default function RecoverPage() {
  const [phase, setPhase] = useState<Phase>("enter");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The VMK (unwrapped client-side from the code) and the normalized code are
  // held only in memory, only between the two steps.
  const [vmk, setVmk] = useState<CryptoKey | null>(null);
  const [normCode, setNormCode] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !isValidRecoveryCodeShape(code)) {
      setError("Enter your email and a valid recovery code.");
      return;
    }
    setLoading(true);
    try {
      const normalized = normalizeRecoveryCode(code);
      const lookupHash = await recoveryLookupHash(normalized, email.trim());
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", email: email.trim(), lookupHash }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That email and recovery code don't match.");
        return;
      }
      // Unwrap locally with the real code — proves the code and yields the VMK.
      const key = await unwrapVmkWithSecret(
        { wrapped: data.vmkWrapped, iv: data.vmkWrappedIv, salt: data.rcSalt },
        normalized
      );
      setVmk(key);
      setNormCode(normalized);
      setPhase("newpw");
    } catch {
      setError("That email and recovery code don't match.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!vmk) {
      setError("Something went wrong. Please start again.");
      setPhase("enter");
      return;
    }
    setLoading(true);
    try {
      // Re-wrap the same VMK under the new password — existing entries stay
      // readable because the key itself is unchanged.
      const rewrapped = await wrapVmkWithSecret(vmk, newPassword);
      const lookupHash = await recoveryLookupHash(normCode, email.trim());
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          email: email.trim(),
          lookupHash,
          newPassword,
          vault: { wrapped: rewrapped.wrapped, iv: rewrapped.iv, salt: rewrapped.salt },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not reset your password. Try again.");
        return;
      }
      setVmk(null);
      setNewPassword("");
      setConfirm("");
      setPhase("done");
    } catch {
      setError("Could not reset your password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Recover access</h1>
          <p className="text-sm text-gray-500 mt-1">Use one of your recovery codes</p>
        </div>

        {phase === "enter" && (
          <form onSubmit={handleVerify} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="code">Recovery code</label>
              <input
                id="code"
                type="text"
                autoComplete="off"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="ABCDE-FGHJK"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
        )}

        {phase === "newpw" && (
          <form onSubmit={handleReset} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <p className="text-sm text-gray-500">Choose a new password. Your existing entries will stay intact.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="newpw">New password</label>
              <input
                id="newpw"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmpw">Confirm new password</label>
              <input
                id="confirmpw"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="Repeat your new password"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}

        {phase === "done" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4 text-center">
            <div className="text-4xl">✓</div>
            <p className="text-sm text-gray-700">
              Your password has been reset and that recovery code is now used up.
              Sign in with your new password.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Go to sign in
            </Link>
          </div>
        )}

        {phase !== "done" && (
          <p className="mt-6 text-center text-xs text-gray-400">
            <Link href="/login" className="hover:text-gray-600 hover:underline">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
