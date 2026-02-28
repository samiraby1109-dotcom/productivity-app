"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { INCIDENT_TYPES } from "@/lib/constants";
import { getVaultKey, decryptPayload, type EncryptedBlob } from "@/lib/crypto";
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
}

interface MediaRow {
  id: string;
  kind: "IMAGE" | "VIDEO" | "AUDIO";
  mime_type: string;
  size_bytes: number;
}

export default function RecordDetailClient({ id, mode, email, passwordSalt }: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedPayload | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        // Decrypt payload client-side
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
            {/* Date */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-0.5">Recorded</p>
              <p className="text-sm font-medium text-gray-800">{formatDate(record.created_at)}</p>
            </div>

            {/* Incident types */}
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

            {/* Flags */}
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

            {/* Notes */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-2">Notes</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {decrypted?.notes || <span className="text-gray-400 italic">No notes.</span>}
              </p>
            </div>

            {/* Media */}
            {media.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-2">Attachments ({media.length})</p>
                <div className="space-y-1">
                  {media.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <span>{m.kind === "IMAGE" ? "🖼" : m.kind === "VIDEO" ? "🎥" : "🎵"}</span>
                      <span className="text-xs text-gray-500">{m.mime_type} — {(m.size_bytes / 1024).toFixed(1)} KB</span>
                      <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Encrypted</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </NavShell>
    </>
  );
}
