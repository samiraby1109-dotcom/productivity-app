"use client";
import { useState } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import RecordFilters, { type FilterState } from "@/components/RecordFilters";
import { getVaultKey, decryptPayload, unwrapFileKey, decryptFile, type EncryptedBlob, sha256Hex } from "@/lib/crypto";
import { INCIDENT_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

type ExportFormat = "csv" | "pdf" | "zip";

interface DecryptedEntry {
  id: string;
  created_at: string;
  incident_types: string[];
  flags_police: boolean;
  flags_children: boolean;
  flags_witness: boolean;
  notes: string;
  has_attachments: boolean;
}

interface MediaMeta {
  id: string;
  entry_id: string;
  kind: "IMAGE" | "VIDEO" | "AUDIO";
  mime_type: string;
  size_bytes: number;
  encrypted_media_key: string;
  encrypted_media_iv: string;
}

const EMPTY_FILTERS: FilterState = {
  from: "", to: "", police: null, children: null, witness: null,
  attachments: null, types: [], status: "ACTIVE",
};

/** Detect image format from magic bytes — works regardless of stored MIME type. */
function detectImageFormat(buf: ArrayBuffer): { mime: string; ext: "JPEG" | "PNG" } | null {
  const bytes = new Uint8Array(buf, 0, 4);
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { mime: "image/jpeg", ext: "JPEG" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { mime: "image/png", ext: "PNG" };
  }
  return null; // HEIC, WEBP, or other format jsPDF can't embed
}

/** Convert an ArrayBuffer to base64 without spread (safe for large images). */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 32768;
  const parts: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

async function decryptMediaItem(media: MediaMeta, vaultKey: CryptoKey): Promise<ArrayBuffer> {
  const sigRes = await fetch("/api/media/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaId: media.id }),
  });
  if (!sigRes.ok) throw new Error(`Signed URL failed for ${media.id}`);
  const { signedUrl, wrappedKey, wrappedKeyIv } = await sigRes.json();

  const dlRes = await fetch(signedUrl);
  if (!dlRes.ok) throw new Error(`Download failed for ${media.id}`);
  const encBuf = await dlRes.arrayBuffer();

  const fileKey = await unwrapFileKey({ wrappedKey, iv: wrappedKeyIv }, vaultKey);
  return decryptFile(encBuf, fileKey);
}

export default function ExportClient({ mode, email, passwordSalt }: Props) {
  const [password, setPassword] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeMedia, setIncludeMedia] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDone("");
    setProgress("Fetching records…");

    try {
      const key = getVaultKey();
      if (!key) { setError("Session expired. Sign in again."); setLoading(false); return; }

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, filters }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Export failed.");
        setLoading(false);
        return;
      }

      const { entries, mediaMap, exportedAt, disclaimer } = await res.json() as {
        entries: {
          id: string;
          created_at: string;
          incident_types: string[];
          flags_police: boolean;
          flags_children: boolean;
          flags_witness: boolean;
          has_attachments: boolean;
          encrypted_payload: string;
        }[];
        mediaMap: Record<string, MediaMeta[]>;
        exportedAt: string;
        disclaimer: string;
      };

      setProgress("Decrypting entries…");
      const decrypted: DecryptedEntry[] = [];
      for (const entry of entries) {
        try {
          const blob = JSON.parse(entry.encrypted_payload) as EncryptedBlob;
          const plain = await decryptPayload<{ notes: string }>(blob, key);
          decrypted.push({
            id: entry.id,
            created_at: entry.created_at,
            incident_types: entry.incident_types,
            flags_police: entry.flags_police,
            flags_children: entry.flags_children,
            flags_witness: entry.flags_witness,
            notes: plain.notes ?? "",
            has_attachments: entry.has_attachments,
          });
        } catch {
          decrypted.push({
            id: entry.id,
            created_at: entry.created_at,
            incident_types: entry.incident_types,
            flags_police: entry.flags_police,
            flags_children: entry.flags_children,
            flags_witness: entry.flags_witness,
            notes: "[Decryption failed]",
            has_attachments: entry.has_attachments,
          });
        }
      }

      if (format === "csv") {
        setProgress("Building CSV…");
        await exportCsv(decrypted, disclaimer, exportedAt);
      } else if (format === "pdf") {
        await exportPdf(decrypted, mediaMap, disclaimer, exportedAt, key);
      } else {
        await exportZip(decrypted, mediaMap, disclaimer, exportedAt, key);
      }

      setDone(`Export complete. ${decrypted.length} entries exported.`);
    } catch (err) {
      console.error("Export error:", err);
      setError("Export failed. Please try again.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  function buildCsvContent(entries: DecryptedEntry[], disclaimer: string, exportedAt: string): string {
    const header = ["Date", "Incident Types", "Police", "Children", "Witness", "Has Attachments", "Notes", "ID"].join(",");
    const rows = entries.map((e) => [
      formatDate(e.created_at),
      e.incident_types.map((k) => INCIDENT_TYPES.find((t) => t.key === k)?.label ?? k).join("; "),
      e.flags_police ? "Yes" : "No",
      e.flags_children ? "Yes" : "No",
      e.flags_witness ? "Yes" : "No",
      e.has_attachments ? "Yes" : "No",
      `"${(e.notes ?? "").replace(/"/g, '""')}"`,
      e.id,
    ].join(","));
    return [`# Exported: ${exportedAt}`, `# ${disclaimer}`, header, ...rows].join("\n");
  }

  async function exportCsv(entries: DecryptedEntry[], disclaimer: string, exportedAt: string) {
    const csv = buildCsvContent(entries, disclaimer, exportedAt);
    const hash = await sha256Hex(csv);
    const manifest = `# SHA-256: ${hash}\n# File: export.csv\n# Exported: ${exportedAt}\n`;
    downloadFile(csv, "bellemeadow-wellness-export.csv", "text/csv");
    downloadFile(manifest, "bellemeadow-wellness-manifest.txt", "text/plain");
  }

  async function exportPdf(
    entries: DecryptedEntry[],
    mediaMap: Record<string, MediaMeta[]>,
    disclaimer: string,
    exportedAt: string,
    vaultKey: CryptoKey
  ) {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "letter" });

    doc.setFontSize(14);
    doc.text("BelleMeadow Wellness — Record Timeline", 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Exported: ${exportedAt}`, 40, 56);
    doc.text(disclaimer, 40, 68);

    autoTable(doc, {
      startY: 82,
      head: [["Date", "Incident Types", "Police", "Children", "Witness", "Notes"]],
      body: entries.map((e) => [
        formatDate(e.created_at),
        e.incident_types.map((k) => INCIDENT_TYPES.find((t) => t.key === k)?.label?.split(" (")[0] ?? k).join("\n"),
        e.flags_police ? "Yes" : "No",
        e.flags_children ? "Yes" : "No",
        e.flags_witness ? "Yes" : "No",
        e.notes ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: { 5: { cellWidth: 160 } },
    });

    if (includeMedia) {
      const entriesWithMedia = entries.filter((e) => e.has_attachments && mediaMap[e.id]?.length);
      let count = 0;
      const total = entriesWithMedia.reduce((s, e) => s + (mediaMap[e.id]?.length ?? 0), 0);

      for (const entry of entriesWithMedia) {
        for (const m of mediaMap[entry.id] ?? []) {
          count++;
          setProgress(`Decrypting attachment ${count} of ${total}…`);
          doc.addPage();
          doc.setFontSize(10);
          doc.setTextColor(40);
          doc.text(`Entry: ${formatDate(entry.created_at)}`, 40, 40);
          doc.setFontSize(8);
          doc.setTextColor(100);

          if (m.kind !== "IMAGE") {
            doc.text(`${m.kind === "VIDEO" ? "Video" : "Audio"} attachment (${m.mime_type}, ${(m.size_bytes / 1024).toFixed(0)} KB)`, 40, 56);
            doc.text(`File ID: ${m.id}`, 40, 68);
            doc.text("Use ZIP export to include the actual video/audio file.", 40, 80);
            continue;
          }

          try {
            const plain = await decryptMediaItem(m, vaultKey);

            // Detect format from magic bytes — works even if stored MIME type is wrong
            const fmt = detectImageFormat(plain);
            if (!fmt) {
              doc.text(`[Image format not supported in PDF — retrieve via ZIP export]`, 40, 56);
              continue;
            }

            const b64 = arrayBufferToBase64(plain);
            const dataUrl = `data:${fmt.mime};base64,${b64}`;

            doc.text(`Image attachment (${(m.size_bytes / 1024).toFixed(0)} KB)`, 40, 54);

            // Fit image in page (letter 612×792pt, 40pt margins)
            const maxW = 532;
            const maxH = 660;
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error("Image load failed"));
              img.src = dataUrl;
            });
            const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
            doc.addImage(dataUrl, fmt.ext, 40, 68, img.width * ratio, img.height * ratio);
          } catch {
            doc.text(`[Image could not be embedded — retrieve via ZIP export]`, 40, 56);
          }
        }
      }
    }

    doc.save("bellemeadow-wellness-export.pdf");
  }

  async function exportZip(
    entries: DecryptedEntry[],
    mediaMap: Record<string, MediaMeta[]>,
    disclaimer: string,
    exportedAt: string,
    vaultKey: CryptoKey
  ) {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const csv = buildCsvContent(entries, disclaimer, exportedAt);
    zip.file("timeline.csv", csv);

    const mediaFileList: string[] = [];

    if (includeMedia) {
      const entriesWithMedia = entries.filter((e) => e.has_attachments && mediaMap[e.id]?.length);
      let count = 0;
      const total = entriesWithMedia.reduce((s, e) => s + (mediaMap[e.id]?.length ?? 0), 0);

      for (const entry of entriesWithMedia) {
        for (const m of mediaMap[entry.id] ?? []) {
          count++;
          setProgress(`Decrypting attachment ${count} of ${total}…`);
          try {
            const plain = await decryptMediaItem(m, vaultKey);
            const fmt = m.kind === "IMAGE" ? detectImageFormat(plain) : null;
            const ext = fmt
              ? (fmt.ext === "PNG" ? "png" : "jpg")
              : (m.mime_type.split("/")[1]?.split(";")[0] ?? "bin");
            const filename = `media/${entry.id}/${m.id}.${ext}`;
            zip.file(filename, plain);
            mediaFileList.push(`${filename} (${m.kind}, ${(m.size_bytes / 1024).toFixed(0)} KB)`);
          } catch {
            mediaFileList.push(`media/${entry.id}/${m.id} — DECRYPTION FAILED`);
          }
        }
      }
    }

    const hash = await sha256Hex(csv);
    const manifest = [
      `# BelleMeadow Wellness Export`,
      `# Exported: ${exportedAt}`,
      `# ${disclaimer}`,
      ``,
      `# SHA-256 of timeline.csv: ${hash}`,
      ``,
      mediaFileList.length > 0
        ? `# Media files (${mediaFileList.length}):\n${mediaFileList.map((f) => `#   ${f}`).join("\n")}`
        : `# No media files included.`,
    ].join("\n");

    zip.file("manifest.txt", manifest);
    setProgress("Compressing…");
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bellemeadow-wellness-export.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Export</h1>
        <p className="text-xs text-gray-400 mb-5">
          Records are decrypted in your browser and never sent to the server during export.
          Requires password confirmation.
        </p>

        <form onSubmit={handleExport} className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Filter records</p>
            <RecordFilters filters={filters} onChange={setFilters} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
            <div className="grid grid-cols-3 gap-2">
              {(["csv", "pdf", "zip"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                    format === f
                      ? "bg-brand-500 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300"
                  }`}
                >
                  {f.toUpperCase()}
                  {f === "zip" && <span className="block text-[10px] font-normal opacity-70">+ manifest</span>}
                </button>
              ))}
            </div>
          </div>

          {format !== "csv" && (
            <label className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-brand-300 transition-colors">
              <input
                type="checkbox"
                checked={includeMedia}
                onChange={(e) => setIncludeMedia(e.target.checked)}
                className="mt-0.5 accent-brand-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Include attachments</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Decrypts and embeds uploaded photos, videos, and audio.
                  {format === "pdf"
                    ? " Images are embedded inline after the table; video/audio are noted as text references."
                    : " All media files are added to a media/ folder inside the ZIP."}
                  {" "}May be slow for large collections.
                </p>
              </div>
            </label>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm your password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              placeholder="Your account password"
            />
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-500 leading-relaxed">
            User-generated content; platform does not verify accuracy.
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {done && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{done}</p>}
          {loading && progress && <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{progress}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (progress || "Preparing export…") : `Export as ${format.toUpperCase()}`}
          </button>
        </form>
      </NavShell>
    </>
  );
}
