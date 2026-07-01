"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { INCIDENT_TYPES } from "@/lib/constants";
import { getVaultKey, decryptPayload, unwrapFileKey, decryptFile, type EncryptedBlob } from "@/lib/crypto";
import { formatDate } from "@/lib/utils";

interface Props {
  id: string;
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

interface RecordDetail {
  id: string;
  created_at: string;
  updated_at: string;
  incident_types: string[];
  flags_police: boolean;
  flags_children: boolean;
  flags_witness: boolean;
  has_attachments: boolean;
  encrypted_payload: string;
}

interface DecryptedPayload {
  notes: string;
  timestamp: string;
  occurredAt?: string | null;
  location?: string | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** Best-effort file extension for a download filename, from the stored MIME type. */
function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif",
    "video/mp4": "mp4", "video/quicktime": "mov",
    "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-m4a": "m4a",
  };
  return map[mime] ?? (mime.split("/")[1]?.split(";")[0] ?? "bin");
}

interface MediaRow {
  id: string;
  kind: "IMAGE" | "VIDEO" | "AUDIO";
  mime_type: string;
  size_bytes: number;
}

interface Viewing {
  url: string;
  mime: string;
  kind: MediaRow["kind"];
}

export default function RecordDetailClient({ id, mode, email, passwordSalt }: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedPayload | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [loadingMedia, setLoadingMedia] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [recRes, mediaRes] = await Promise.all([
          fetch(`/api/records/${id}`),
          fetch(`/api/records/${id}/media`),
        ]);

        if (!recRes.ok) { setError("Entry not found."); setLoading(false); return; }

        const { record: r } = await recRes.json();
        setRecord(r);

        if (mediaRes.ok) {
          const { media: m } = await mediaRes.json();
          setMedia(m ?? []);
        }

        const key = getVaultKey();
        if (key) {
          const blob = JSON.parse(r.encrypted_payload) as EncryptedBlob;
          const plain = await decryptPayload<DecryptedPayload>(blob, key);
          setDecrypted(plain);
        } else {
          setDecrypted({ notes: "[Session expired — sign in again to view notes]", timestamp: r.created_at });
        }
      } catch {
        setError("Failed to load entry.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const closeViewer = useCallback(() => {
    if (viewing) URL.revokeObjectURL(viewing.url);
    setViewing(null);
  }, [viewing]);

  // Shared decrypt path: signed URL → download ciphertext → unwrap key → decrypt.
  // The plaintext exists only as an in-memory ArrayBuffer here.
  async function decryptToBuffer(m: MediaRow): Promise<ArrayBuffer> {
    const vaultKey = getVaultKey();
    if (!vaultKey) throw new Error("Session expired. Sign in again.");
    const sigRes = await fetch("/api/media/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: m.id }),
    });
    if (!sigRes.ok) throw new Error("Could not get download URL");
    const { signedUrl, wrappedKey, wrappedKeyIv } = await sigRes.json();
    const dlRes = await fetch(signedUrl);
    if (!dlRes.ok) throw new Error("Download failed");
    const encBuf = await dlRes.arrayBuffer();
    const fileKey = await unwrapFileKey({ wrappedKey, iv: wrappedKeyIv }, vaultKey);
    return decryptFile(encBuf, fileKey);
  }

  async function viewMedia(m: MediaRow) {
    setLoadingMedia(m.id);
    setError("");
    try {
      const plainBuf = await decryptToBuffer(m);
      const blob = new Blob([plainBuf], { type: m.mime_type });
      const url = URL.createObjectURL(blob);
      setViewing({ url, mime: m.mime_type, kind: m.kind });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decrypt file.");
    } finally {
      setLoadingMedia(null);
    }
  }

  // Save the decrypted file to the device so it can be sent on to a lawyer/advocate.
  // (Unlike View, this writes an unencrypted copy to the device — see the note in the UI.)
  async function downloadMedia(m: MediaRow) {
    setDownloadingId(m.id);
    setError("");
    try {
      const plainBuf = await decryptToBuffer(m);
      const blob = new Blob([plainBuf], { type: m.mime_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attachment-${m.id.slice(0, 8)}.${extForMime(m.mime_type)}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download file.");
    } finally {
      setDownloadingId(null);
    }
  }

  function incidentLabel(key: string): string {
    return INCIDENT_TYPES.find((t) => t.key === key)?.label ?? key;
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
          <h1 className="text-lg font-semibold text-gray-900">Entry detail</h1>
        </div>

        {loading && <p className="text-center py-12 text-gray-400 text-sm">Decrypting…</p>}
        {error && <p className="text-red-600 text-sm bg-red-50 rounded-xl p-4">{error}</p>}

        {record && !loading && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              {decrypted?.occurredAt && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Occurred</p>
                  <p className="text-sm font-medium text-gray-800">{formatDateTime(decrypted.occurredAt)}</p>
                </div>
              )}
              {decrypted?.location && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Location</p>
                  <p className="text-sm font-medium text-gray-800">{decrypted.location}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Logged</p>
                <p className="text-sm font-medium text-gray-800">{formatDate(record.created_at)}</p>
              </div>
            </div>

            {record.incident_types.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-2">Incident types</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.incident_types.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                      {incidentLabel(t)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(record.flags_police || record.flags_children || record.flags_witness) && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-2">Details</p>
                <div className="flex flex-wrap gap-2">
                  {record.flags_police && <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">Police involved</span>}
                  {record.flags_children && <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">Children involved</span>}
                  {record.flags_witness && <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">Witnesses present</span>}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-2">Notes</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {decrypted?.notes || <span className="text-gray-400 italic">No notes.</span>}
              </p>
            </div>

            {media.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-3">Attachments ({media.length})</p>
                <div className="space-y-2">
                  {media.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">{m.kind === "IMAGE" ? "🖼" : m.kind === "VIDEO" ? "🎥" : "🎵"}</span>
                      <span className="text-xs text-gray-500 flex-1 truncate">{m.mime_type} — {(m.size_bytes / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => viewMedia(m)}
                        disabled={loadingMedia === m.id}
                        className="flex-shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loadingMedia === m.id ? "Decrypting…" : "View"}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadMedia(m)}
                        disabled={downloadingId === m.id}
                        aria-label={`Save ${m.kind.toLowerCase()} attachment to this device`}
                        className="flex-shrink-0 text-xs font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {downloadingId === m.id ? "Saving…" : "Save"}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mt-3 leading-relaxed">
                  <span className="font-medium">View</span> keeps the file encrypted and shows it only here.
                  <span className="font-medium"> Save</span> downloads a copy to this device (into your Files/Photos)
                  so you can send it to a lawyer or advocate — that copy is no longer encrypted, so only save on a
                  safe device and delete it after sending if needed.
                </p>
              </div>
            )}
          </div>
        )}
      </NavShell>

      {/* Media lightbox */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
          onClick={closeViewer}
        >
          <div
            className="relative max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeViewer}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              Close
            </button>

            {viewing.kind === "IMAGE" && (
              // eslint-disable-next-line @next/next/no-img-element -- decrypted blob: URL; next/image can't optimize it
              <img
                src={viewing.url}
                alt="Attachment"
                className="max-w-[90vw] max-h-[80vh] rounded-lg object-contain"
              />
            )}
            {viewing.kind === "VIDEO" && (
              <video
                src={viewing.url}
                controls
                autoPlay
                className="max-w-[90vw] max-h-[80vh] rounded-lg"
              />
            )}
            {viewing.kind === "AUDIO" && (
              <div className="bg-white rounded-xl p-6 min-w-[280px]">
                <p className="text-sm text-gray-500 mb-3 text-center">Audio attachment</p>
                <audio src={viewing.url} controls autoPlay className="w-full" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
