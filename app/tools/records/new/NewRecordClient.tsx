"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import TrustedContactNudgeModal from "@/components/TrustedContactNudgeModal";
import { INCIDENT_TYPES, INCIDENT_TYPE_GROUPS, type IncidentTypeKey } from "@/lib/constants";

const labelFor = (k: IncidentTypeKey) => INCIDENT_TYPES.find((t) => t.key === k)?.label.split(" (")[0] ?? k;

/**
 * Re-encode an image through a canvas to strip ALL embedded metadata — EXIF GPS
 * coordinates, capture timestamps, device info. This protects against location
 * leaking if a decrypted export is ever shared. Non-images and any format the
 * browser can't decode pass through unchanged (upload is never blocked).
 */
async function stripImageMetadata(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const isPng = file.type === "image/png";
    const mime = isPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, isPng ? undefined : 0.92)
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + (isPng ? ".png" : ".jpg");
    return new File([blob], name, { type: mime });
  } catch {
    return file;
  }
}
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
  const [stripMetadata, setStripMetadata] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [nudgeCount, setNudgeCount] = useState<number | null>(null);
  // Remembers an already-created entry so that retrying after a failed
  // attachment upload does NOT create a duplicate record.
  const savedEntryIdRef = useRef<string | null>(null);
  const savedTotalRef = useRef<number | null>(null);

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

      // Create the record — unless a previous submit already created it and we
      // are only retrying failed attachment uploads (avoids duplicate entries).
      let entryId = savedEntryIdRef.current;
      let totalCount = savedTotalRef.current;
      if (!entryId) {
        const encrypted = await encryptPayload(payload, vaultKey);
        const encryptedPayloadStr = JSON.stringify(encrypted);
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

        const created = await res.json();
        entryId = created.id as string;
        totalCount = created.totalCount as number;
        savedEntryIdRef.current = entryId;
        savedTotalRef.current = totalCount;
      }

      // Encrypt and upload attachments, tracking any that fail so we never
      // pretend the entry is complete when an attachment didn't make it.
      const failedUploads: string[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const ok = await uploadFile(file, entryId, vaultKey);
          if (!ok) failedUploads.push(file.name || "attachment");
        }
      }

      if (failedUploads.length > 0) {
        const n = failedUploads.length;
        setError(
          `Your entry was saved, but ${n} attachment${n > 1 ? "s" : ""} could not be uploaded (${failedUploads.join(", ")}). ` +
            `${n > 1 ? "They were" : "It was"} NOT stored. Tap Save to try the upload again — your entry won't be duplicated.`
        );
        setSubmitting(false);
        return; // do NOT navigate away as if everything succeeded
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

  // Returns true if the attachment uploaded successfully, false otherwise.
  async function uploadFile(file: File, entryId: string, vaultKey: CryptoKey): Promise<boolean> {
    try {
      const toUpload = stripMetadata ? await stripImageMetadata(file) : file;
      const fileKey = await generateFileKey();
      const wrapped = await wrapFileKey(fileKey, vaultKey);
      const buf = await toUpload.arrayBuffer();
      const encBuf = await encryptFile(buf, fileKey);
      const encBlob = new Blob([encBuf], { type: "application/octet-stream" });

      const kind = toUpload.type.startsWith("video/")
        ? "VIDEO"
        : toUpload.type.startsWith("audio/")
        ? "AUDIO"
        : "IMAGE";

      const fd = new FormData();
      fd.append("entryId", entryId);
      fd.append("kind", kind);
      fd.append("mimeType", toUpload.type);
      fd.append("wrappedKey", wrapped.wrappedKey);
      fd.append("wrappedKeyIv", wrapped.iv);
      fd.append("file", encBlob, toUpload.name);

      const res = await fetch("/api/media/upload", { method: "POST", body: fd });

      if (!res.ok) {
        // Keep a local encrypted copy as a backup, but report failure so the
        // caller surfaces it — never let a failed evidence upload look saved.
        await enqueueUpload({
          id: uuidv4(),
          entryId,
          userId: "",
          encryptedBlob: encBuf,
          wrappedKey: wrapped.wrappedKey,
          wrappedKeyIv: wrapped.iv,
          mimeType: toUpload.type,
          kind: kind as "IMAGE" | "VIDEO" | "AUDIO",
          sizeBytes: toUpload.size,
          createdAt: new Date().toISOString(),
          retries: 0,
        }).catch(() => {});
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  return (
    <>
      {nudgeCount !== null && (
        <TrustedContactNudgeModal
          title={`${nudgeCount} entries logged`}
          message="You've built a strong record. Consider saving a trusted contact — a DV advocate, attorney, or friend. It just keeps their info handy; to let them help you get back into your account, you can share a recovery code with them."
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
                When did it happen? <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="occurredAt"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
              <p className="text-xs text-gray-500 mt-1">The date and time of the incident itself, if different from now.</p>
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1.5">
                Where? <span className="font-normal text-gray-500">(optional)</span>
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
              Add categories <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">Tags make entries easier to find and export later.</p>
            <div className="space-y-3">
              {INCIDENT_TYPE_GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">{g.label}</p>
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
              Anything relevant? <span className="font-normal text-gray-500">(optional)</span>
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
                      ? "bg-brand-600 text-white"
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
              Attachments <span className="font-normal text-gray-500">(photos, video, audio)</span>
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-medium hover:file:bg-brand-100 transition"
            />
            {files.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{files.length} file(s) selected — will be encrypted before upload.</p>
            )}
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Adding audio or video of another person? Recording-consent laws vary by state — see{" "}
              <span className="font-medium text-gray-500">Guides → Recording laws</span> before you record.
            </p>
            <label className="flex items-start gap-2 mt-3 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={stripMetadata}
                onChange={(e) => setStripMetadata(e.target.checked)}
                className="mt-0.5 accent-brand-500"
              />
              <span>
                Remove hidden location data (GPS/EXIF) from photos.{" "}
                <span className="text-gray-500">Recommended — protects your location if an export is ever shared. Photos are re-saved; video and audio are unaffected.</span>
              </span>
            </label>
          </div>

          {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

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
