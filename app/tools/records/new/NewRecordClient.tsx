"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import TrustedContactNudgeModal from "@/components/TrustedContactNudgeModal";
import { INCIDENT_TYPES, INCIDENT_TYPE_GROUPS, type IncidentTypeKey } from "@/lib/constants";

const labelFor = (k: IncidentTypeKey) => INCIDENT_TYPES.find((t) => t.key === k)?.label.split(" (")[0] ?? k;
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
  const [occurredAt, setOccurredAt] = useState("");
  const [location, setLocation] = useState("");
  const [incidentTypes, setIncidentTypes] = useState<IncidentTypeKey[]>([]);
  const [flagsPolice, setFlagsPolice] = useState(false);
  const [flagsChildren, setFlagsChildren] = useState(false);
  const [flagsWitness, setFlagsWitness] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [nudgeCount, setNudgeCount] = useState<number | null>(null);

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
        // The incident's own date/time and place — distinct from when it was
        // logged. Kept inside the encrypted payload (zero-knowledge).
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
        location: location.trim() || null,
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

      const { id: entryId, totalCount } = await res.json();

      // Encrypt and upload attachments
      if (files.length > 0) {
        for (const file of files) {
          await uploadFile(file, entryId, vaultKey);
        }
      }

      // Show trusted-contact nudge at every 10th entry
      if (typeof totalCount === "number" && totalCount > 0 && totalCount % 10 === 0) {
        setNudgeCount(totalCount);
        return; // hold navigation until user dismisses
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
      fd.append("mimeType", file.type);
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
      {nudgeCount !== null && (
        <TrustedContactNudgeModal
          title={`${nudgeCount} entries logged`}
          message="You've built a strong record. Consider adding a trusted contact — someone who can help you access this if you ever need it."
          onDismiss={() => router.replace("/tools/records")}
        />
      )}
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

        <p className="text-sm text-gray-500 mb-5 leading-relaxed">
          Take your time. Add only what you want — even a short note helps.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Notes — the primary field */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
              What happened?
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={7}
              placeholder="Describe it in your own words, at your own pace…"
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-[15px] text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
            <p className="text-xs text-gray-400 mt-1.5">Encrypted on your device before it&apos;s saved.</p>
          </div>

          {/* When & where it happened — valuable for a protection order or case */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="occurredAt" className="block text-sm font-medium text-gray-700 mb-1.5">
                When did it happen? <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="occurredAt"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
              <p className="text-xs text-gray-400 mt-1">The date and time of the incident itself, if different from now.</p>
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1.5">
                Where? <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={120}
                placeholder="e.g. home, by phone, the parking lot"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>
          </div>

          {/* Categories — optional, grouped to feel lighter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Add categories <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-3">Tags make entries easier to find and export later.</p>
            <div className="space-y-3">
              {INCIDENT_TYPE_GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.keys.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleType(k)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          incidentTypes.includes(k)
                            ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {labelFor(k)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Flags — optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anything relevant? <span className="font-normal text-gray-400">(optional)</span>
            </label>
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
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Adding audio or video of another person? Recording-consent laws vary by state — see{" "}
              <span className="font-medium text-gray-500">Guides → Recording laws</span> before you record.
            </p>
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
