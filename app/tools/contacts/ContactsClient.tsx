"use client";
import { useState, useEffect, useCallback } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { getVaultKey, encryptPayload, decryptPayload, type EncryptedBlob } from "@/lib/crypto";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

interface ContactPayload {
  name: string;
  phone: string;
  email: string;
  notes: string;
  relationship?: string;
}

interface Contact {
  id: string;
  relationship: string;
  payload: ContactPayload;
}

interface RawContact {
  id: string;
  // Legacy cleartext field; kept on the wire for backward-compat read of old
  // rows. New writes leave it empty and store the label inside the encrypted
  // payload instead.
  relationship?: string;
  encrypted_payload: string;
}

const RELATIONSHIP_OPTIONS = [
  "DV Advocate",
  "Attorney",
  "Guardian ad Litem",
  "Therapist / Counselor",
  "Trusted Friend / Family",
  "Shelter Staff",
  "Police / Detective",
  "Other",
];

const EMPTY_FORM = { name: "", phone: "", email: "", notes: "", relationship: "" };

export default function ContactsClient({ mode, email, passwordSalt }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Per-card state
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    const vaultKey = getVaultKey();
    if (!vaultKey) { setLoadStatus("error"); return; }

    try {
      const res = await fetch("/api/contacts");
      if (!res.ok) { setLoadStatus("error"); return; }
      const { contacts: raw } = await res.json() as { contacts: RawContact[] };

      const decrypted: Contact[] = [];
      for (const c of raw) {
        try {
          const blob = JSON.parse(c.encrypted_payload) as EncryptedBlob;
          const payload = await decryptPayload<ContactPayload>(blob, vaultKey);
          // Prefer the encrypted relationship; fall back to the legacy cleartext
          // column for rows written before the migration.
          const relationship = payload.relationship ?? c.relationship ?? "";
          decrypted.push({ id: c.id, relationship, payload });
        } catch {
          // Skip contacts that fail to decrypt rather than crashing the list
        }
      }
      decrypted.sort((a, b) => a.relationship.localeCompare(b.relationship));
      setContacts(decrypted);
      setLoadStatus("ready");
    } catch {
      setLoadStatus("error");
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(c: Contact) {
    setEditId(c.id);
    setForm({
      name: c.payload.name,
      phone: c.payload.phone,
      email: c.payload.email,
      notes: c.payload.notes,
      relationship: c.relationship,
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
    setFormError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.phone.trim()) { setFormError("Phone is required."); return; }

    const vaultKey = getVaultKey();
    if (!vaultKey) { setFormError("Session expired — please sign in again."); return; }

    setSaving(true);
    setFormError("");

    try {
      const blob = await encryptPayload(
        {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim(),
          relationship: form.relationship.trim().slice(0, 100),
        },
        vaultKey
      );
      const encryptedPayload = JSON.stringify(blob);

      if (editId) {
        const res = await fetch(`/api/contacts/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ encryptedPayload }),
        });
        if (!res.ok) { setFormError("Failed to save. Please try again."); return; }
      } else {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ encryptedPayload }),
        });
        if (!res.ok) { setFormError("Failed to save. Please try again."); return; }
      }

      closeForm();
      await loadContacts();
    } catch {
      setFormError("An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);

    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function copyPhone(id: string, phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback: select text (for older browsers / iOS)
    }
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold text-gray-900">Contacts</h1>
          {!formOpen && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add Contact
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Encrypted and stored privately. Tap a phone number to copy it.
        </p>

        {/* Add / Edit form */}
        {formOpen && (
          <form onSubmit={handleSave} className="bg-white border border-brand-100 rounded-2xl p-4 mb-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900">{editId ? "Edit contact" : "New contact"}</p>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. 816-555-0100"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <input
                type="text"
                list="relationship-options"
                value={form.relationship}
                onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
                placeholder="e.g. DV Advocate, Attorney…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
              <datalist id="relationship-options">
                {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email (optional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Best time to call, 24/7 availability…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>

            {formError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Contact list */}
        {loadStatus === "loading" && (
          <p className="text-sm text-gray-400 text-center py-8">Loading contacts…</p>
        )}

        {loadStatus === "error" && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
            Could not load contacts. Please refresh or sign in again.
          </p>
        )}

        {loadStatus === "ready" && contacts.length === 0 && !formOpen && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-500 mb-1">No contacts yet</p>
            <p className="text-xs text-gray-400">
              Add a DV advocate, attorney, or anyone you may need to reach quickly.
            </p>
          </div>
        )}

        {loadStatus === "ready" && contacts.length > 0 && (
          <div className="space-y-3">
            {contacts.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{c.payload.name}</p>
                      {c.relationship && (
                        <span className="text-[10px] font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
                          {c.relationship}
                        </span>
                      )}
                    </div>

                    {/* Phone — tap to copy */}
                    <button
                      onClick={() => copyPhone(c.id, c.payload.phone)}
                      className="flex items-center gap-1.5 mt-1.5 group"
                      title="Tap to copy"
                    >
                      <span className="text-brand-600 font-medium text-sm group-hover:underline">
                        {c.payload.phone}
                      </span>
                      {copied === c.id ? (
                        <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">
                          Copied!
                        </span>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      )}
                    </button>

                    {c.payload.email && (
                      <p className="text-xs text-gray-400 mt-0.5">{c.payload.email}</p>
                    )}
                    {c.payload.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">{c.payload.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        confirmDelete === c.id
                          ? "text-white bg-red-500 hover:bg-red-600"
                          : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                      }`}
                      title={confirmDelete === c.id ? "Tap again to confirm" : "Delete"}
                    >
                      {confirmDelete === c.id ? (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {confirmDelete === c.id && (
                  <div className="mt-2 flex items-center justify-between bg-red-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-red-700">Delete this contact?</p>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-xs text-gray-500 hover:text-gray-800 ml-4"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </NavShell>
    </>
  );
}
