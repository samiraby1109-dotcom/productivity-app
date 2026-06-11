"use client";
import { useState, useEffect } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { INCIDENT_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface ArchiveRow {
  id: string;
  created_at: string;
  incident_types: string[];
  purge_at: string | null;
}

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

type ModalState =
  | { kind: "none" }
  | { kind: "restore"; id: string }
  | { kind: "purge-confirm"; id: string }
  | { kind: "purge-password"; id: string };

export default function ArchiveClient({ mode, email, passwordSalt }: Props) {
  const [records, setRecords] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [password, setPassword] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  // Snapshot of mount time for the days-until-purge labels — day granularity,
  // so it doesn't need to tick, and render stays pure (no Date.now() in render).
  const [now] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/archive")
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleRestore(id: string) {
    setSubmitting(true);
    setActionError("");
    const res = await fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: id, action: "restore" }),
    });
    if (res.ok) {
      setRecords((r) => r.filter((e) => e.id !== id));
      showToast("Entry restored.");
    } else {
      const d = await res.json();
      setActionError(d.error ?? "Failed to restore.");
    }
    setSubmitting(false);
    setModal({ kind: "none" });
  }

  async function handlePurge(id: string) {
    setSubmitting(true);
    setActionError("");
    const res = await fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: id, action: "purge", password }),
    });
    if (res.ok) {
      setRecords((r) => r.filter((e) => e.id !== id));
      setPassword("");
      setModal({ kind: "none" });
      showToast("Entry permanently deleted.");
    } else {
      const d = await res.json();
      setActionError(d.error ?? "Failed. Check your password.");
    }
    setSubmitting(false);
  }

  function daysUntilPurge(purgeAt: string | null): string {
    if (!purgeAt) return "";
    const diff = Math.ceil((new Date(purgeAt).getTime() - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? `Auto-removes in ${diff}d` : "Due for removal";
  }

  function incidentLabel(key: string): string {
    return INCIDENT_TYPES.find((t) => t.key === key)?.label.split(" (")[0] ?? key;
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Restore modal */}
      {modal.kind === "restore" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">Restore entry?</h3>
            <p className="text-sm text-gray-500">This will move the entry back to your active records.</p>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModal({ kind: "none" })} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
              <button onClick={() => handleRestore(modal.id)} disabled={submitting} className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium disabled:opacity-50">
                {submitting ? "Restoring…" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge confirm modal */}
      {modal.kind === "purge-confirm" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">Permanently delete?</h3>
            <p className="text-sm text-gray-500">
              This cannot be undone. The entry and all attachments will be removed forever.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModal({ kind: "none" })} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
              <button
                onClick={() => setModal({ kind: "purge-password", id: modal.id })}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge password modal */}
      {modal.kind === "purge-password" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">Confirm your password</h3>
            <p className="text-sm text-gray-500">Enter your account password to permanently delete this entry.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Your password"
            />
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setModal({ kind: "none" }); setPassword(""); setActionError(""); }} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
              <button onClick={() => handlePurge(modal.id)} disabled={submitting || !password} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-50">
                {submitting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Archive</h1>
        <p className="text-xs text-gray-400 mb-5">Removed entries are held for 30 days before auto-deletion.</p>

        {loading ? (
          <p className="text-center py-12 text-gray-400 text-sm">Loading…</p>
        ) : records.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm">No archived entries.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-1">{formatDate(r.created_at)}</p>
                    {r.incident_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {r.incident_types.slice(0, 2).map((t) => (
                          <span key={t} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{incidentLabel(t)}</span>
                        ))}
                        {r.incident_types.length > 2 && <span className="text-[11px] text-gray-400">+{r.incident_types.length - 2}</span>}
                      </div>
                    )}
                    {r.purge_at && <p className="text-[11px] text-amber-600">{daysUntilPurge(r.purge_at)}</p>}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setModal({ kind: "restore", id: r.id })}
                      className="px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 transition-colors"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => setModal({ kind: "purge-confirm", id: r.id })}
                      className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </NavShell>
    </>
  );
}
