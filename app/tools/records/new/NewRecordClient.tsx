"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { INCIDENT_TYPES, type IncidentTypeKey } from "@/lib/constants";
import { encryptPayload, getVaultKey } from "@/lib/crypto";
import { generateFileKey, wrapFileKey, encryptFile } from "@/lib/crypto";
import { v4 as uuidv4 } from "uuid";
import { enqueueUpload } from "@/lib/offline-queue";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

export default function NewRecordClient({ mode, email, passwordSalt }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [incidentTypes, setIncidentTypes] = useState<IncidentTypeKey[]>([]);
  const [flagsPolice, setFlagsPolice] = useState(false);
  const [flagsChildren, setFlagsChildren] = useState(false);
  const [flagsWitness, setFlagsWitness] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleType(key: IncidentTypeKey) {
    setIncidentTypes((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const vaultKey = getVaultKey();
      if (!vaultKey) {
        setError("Session expired. Please sign in again.");
        setSubmitting(false);
        return;
      }

      const payload = {
        notes,
        timestamp: new Date().toISOString(),
      };

      const encrypted = await encryptPayload(payload, vaultKey);
      const encryptedPayloadStr = JSON.stringify(encrypted);

      // Create the record
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedPayload: encryptedPayloadStr,
          incidentTypes,
          flagsPolice,
          flagsChildren,
          flagsWitness,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save entry.");
        setSubmitting(false);
        return;
      }

      const { id: entryId } = await res.json();

      // Encrypt and upload attachments
      if (files.length > 0) {
        for (const file of files) {
          await uploadFile(file, entryId, vaultKey);
        }
      }

      router.replace("/tools/records");
    } catch (err) {
      console.error("Save error:", err);
      setError("Something went wrong. Your entry was not saved.");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadFile(file: File, entryId: string, vaultKey: CryptoKey) {
    try {
      const fileKey = await generateFileKey();
      const wrapped = await wrapFileKey(fileKey, vaultKey);
      const buf = await file.arrayBuffer();
      const encBuf = await encryptFile(buf, fileKey);
      const encBlob = new Blob([encBuf], { type: "application/octet-stream" });

      const kind = file.type.startsWith("video/")
        ? "VIDEO"
        : file.type.startsWith("audio/")
        ? "AUDIO"
        : "IMAGE";

      const fd = new FormData();
      fd.append("entryId", entryId);
      fd.append("kind", kind);
      fd.append("wrappedKey", wrapped.wrappedKey);
      fd.append("wrappedKeyIv", wrapped.iv);
      fd.append("file", encBlob, file.name);

      const res = await fetch("/api/media/upload", { method: "POST", body: fd });

      if (!res.ok) {
        // Queue for offline retry
        await enqueueUpload({
          id: uuidv4(),
          entryId,
          userId: "",
          encryptedBlob: encBuf,
          wrappedKey: wrapped.wrappedKey,
          wrappedKeyIv: wrapped.iv,
          mimeType: file.type,
          kind: kind as "IMAGE" | "VIDEO" | "AUDIO",
          sizeBytes: file.size,
          createdAt: new Date().toISOString(),
          retries: 0,
        });
      }
    } catch {
      // Queue for retry
    }
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">New entry</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Incident types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What happened? <span className="font-normal text-gray-400">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INCIDENT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleType(t.key as IncidentTypeKey)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    incidentTypes.includes(t.key as IncidentTypeKey)
                      ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t.label.split(" (")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Details</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Police involved", value: flagsPolice, set: setFlagsPolice },
                { label: "Children involved", value: flagsChildren, set: setFlagsChildren },
                { label: "Witnesses present", value: flagsWitness, set: setFlagsWitness },
              ].map(({ label, value, set }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => set(!value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    value
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="font-normal text-gray-400">(encrypted)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Describe what happened in your own words…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
          </div>

          {/* File attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachments <span className="font-normal text-gray-400">(photos, video, audio)</span>
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-medium hover:file:bg-brand-100 transition"
            />
            {files.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{files.length} file(s) selected — will be encrypted before upload.</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving…" : "Save entry"}
          </button>
        </form>
      </NavShell>
    </>
  );
}
