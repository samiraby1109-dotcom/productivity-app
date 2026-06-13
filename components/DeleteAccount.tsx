"use client";
import { useState } from "react";
import { normalizePassword } from "@/lib/password";
import { clearVaultKey } from "@/lib/crypto";

/**
 * DeleteAccount — irreversible account + data deletion. Requires the password
 * and a typed "DELETE" confirmation, and is collapsed behind an explicit intent
 * click so it can't be triggered by accident.
 */
export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: normalizePassword(password), confirm }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Could not delete account.");
        setLoading(false);
        return;
      }
      clearVaultKey();
      window.location.replace("/login");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-red-200 bg-red-50/60 p-4">
      <h2 className="text-sm font-semibold text-red-800">Delete account</h2>
      <p className="text-xs text-red-700 mt-1 leading-relaxed">
        Permanently erases your account and everything in it — all records, attachments, contacts, and
        recovery codes. This cannot be undone and there is no backup. Consider exporting your records first.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
        >
          I want to delete my account
        </button>
      ) : (
        <form onSubmit={handleDelete} className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-red-800 mb-1">Confirm your password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 transition"
              placeholder="Your password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-red-800 mb-1">Type DELETE to confirm</label>
            <input
              type="text"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoCapitalize="characters"
              className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 transition"
              placeholder="DELETE"
            />
          </div>
          {error && <p className="text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(""); setPassword(""); setConfirm(""); }}
              className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password || confirm !== "DELETE"}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Deleting…" : "Permanently delete"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
