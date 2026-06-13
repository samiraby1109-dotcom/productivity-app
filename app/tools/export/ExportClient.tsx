"use client";
import { useState } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import RecordFilters, { type FilterState } from "@/components/RecordFilters";
import { getVaultKey, decryptPayload, unwrapFileKey, decryptFile, type EncryptedBlob, sha256Hex } from "@/lib/crypto";
import { INCIDENT_TYPES } from "@/lib/constants";

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

/** Full date + time + timezone — courts want precise, contemporaneous timestamps. */
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

/** Stable, order-independent serialization of an entry for hashing. */
function canonicalEntry(e: DecryptedEntry, media: MediaMeta[] | undefined): string {
  return JSON.stringify({
    id: e.id,
    recorded_at: e.created_at,
    incident_types: [...e.incident_types].sort(),
    police: e.flags_police,
    children: e.flags_children,
    witness: e.flags_witness,
    notes: e.notes ?? "",
    attachments: (media ?? [])
      .map((m) => ({ id: m.id, kind: m.kind, size_bytes: m.size_bytes }))
      .sort((a, b) => (a.id < b.id ? -1 : 1)),
  });
}

/**
 * SHA-256 each entry, then chain them in chronological order into one document
 * hash. Any edit to wording, dates, order, or the attachment manifest — or any
 * added/removed entry — changes the document hash, making the export tamper-evident.
 */
async function computeIntegrity(
  entries: DecryptedEntry[],
  mediaMap: Record<string, MediaMeta[]>
): Promise<{ entryHashes: string[]; documentHash: string }> {
  const entryHashes: string[] = [];
  let chain = "";
  for (const e of entries) {
    const h = await sha256Hex(canonicalEntry(e, mediaMap[e.id]));
    entryHashes.push(h);
    chain = await sha256Hex(chain + h);
  }
  return { entryHashes, documentHash: entries.length ? chain : "(no entries)" };
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
  const [declarantName, setDeclarantName] = useState("");
  const [declarantState, setDeclarantState] = useState("");

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

      // Chronological order is what a court timeline expects, and what the
      // tamper-evidence hash chain is computed over.
      decrypted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const { entryHashes, documentHash } = await computeIntegrity(decrypted, mediaMap);

      if (format === "csv") {
        setProgress("Building CSV…");
        await exportCsv(decrypted, disclaimer, exportedAt, entryHashes, documentHash);
      } else if (format === "pdf") {
        await exportPdf(decrypted, mediaMap, disclaimer, exportedAt, key, entryHashes, documentHash);
      } else {
        await exportZip(decrypted, mediaMap, disclaimer, exportedAt, key, entryHashes, documentHash);
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

  function buildCsvContent(
    entries: DecryptedEntry[], disclaimer: string, exportedAt: string,
    entryHashes: string[], documentHash: string
  ): string {
    const header = ["Recorded At", "Incident Types", "Police", "Children", "Witness", "Has Attachments", "Notes", "Entry SHA-256", "ID"].join(",");
    const rows = entries.map((e, i) => [
      `"${formatTimestamp(e.created_at)}"`,
      `"${e.incident_types.map((k) => INCIDENT_TYPES.find((t) => t.key === k)?.label ?? k).join("; ")}"`,
      e.flags_police ? "Yes" : "No",
      e.flags_children ? "Yes" : "No",
      e.flags_witness ? "Yes" : "No",
      e.has_attachments ? "Yes" : "No",
      `"${(e.notes ?? "").replace(/"/g, '""')}"`,
      entryHashes[i] ?? "",
      e.id,
    ].join(","));
    return [
      `# Exported: ${exportedAt}`,
      `# ${disclaimer}`,
      `# Document SHA-256 (chained over all entries in chronological order): ${documentHash}`,
      header, ...rows,
    ].join("\n");
  }

  async function exportCsv(
    entries: DecryptedEntry[], disclaimer: string, exportedAt: string,
    entryHashes: string[], documentHash: string
  ) {
    const csv = buildCsvContent(entries, disclaimer, exportedAt, entryHashes, documentHash);
    const hash = await sha256Hex(csv);
    const manifest = `# SHA-256 of file: ${hash}\n# Document SHA-256: ${documentHash}\n# File: export.csv\n# Exported: ${exportedAt}\n`;
    downloadFile(csv, "bellemeadow-wellness-export.csv", "text/csv");
    downloadFile(manifest, "bellemeadow-wellness-manifest.txt", "text/plain");
  }

  async function exportPdf(
    entries: DecryptedEntry[],
    mediaMap: Record<string, MediaMeta[]>,
    disclaimer: string,
    exportedAt: string,
    vaultKey: CryptoKey,
    entryHashes: string[],
    documentHash: string
  ) {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const M = 40;
    const SAGE: [number, number, number] = [79, 107, 84];

    // ── Cover + declaration ──
    doc.setFontSize(16); doc.setTextColor(30);
    doc.text("Personal Record Timeline", M, 52);
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text(`Prepared: ${exportedAt}`, M, 70);
    doc.text(`Entries: ${entries.length}`, M, 82);
    if (entries.length) {
      doc.text(
        `Period: ${formatTimestamp(entries[0].created_at)}  —  ${formatTimestamp(entries[entries.length - 1].created_at)}`,
        M, 94
      );
    }

    let y = 124;
    doc.setFontSize(12); doc.setTextColor(30); doc.text("Declaration", M, y); y += 18;
    doc.setFontSize(10); doc.setTextColor(55);
    [
      `I, ${declarantName.trim() || "______________________________"}, declare as follows:`,
      "",
      "The records that follow are a true and accurate account of events that I",
      "personally experienced and documented at or near the dates and times shown",
      "for each entry. They have not been altered since I recorded them.",
      "",
      "I declare under penalty of perjury under the laws of the State of",
      `${declarantState.trim() || "____________________"} that the foregoing is true and correct.`,
    ].forEach((l) => { doc.text(l, M, y); y += 15; });
    y += 14;
    doc.text("Signature: ______________________________     Date: ____________________", M, y);
    y += 26;
    doc.setFontSize(8); doc.setTextColor(135);
    doc.text("Template wording only — confirm the declaration your court requires with an attorney.", M, y);

    // ── Timeline table ──
    doc.addPage();
    doc.setFontSize(13); doc.setTextColor(30); doc.text("Timeline of entries", M, 50);
    autoTable(doc, {
      startY: 64,
      head: [["#", "Recorded", "Types", "P", "C", "W", "Notes", "Ref"]],
      body: entries.map((e, i) => [
        String(i + 1),
        formatTimestamp(e.created_at),
        e.incident_types.map((k) => INCIDENT_TYPES.find((t) => t.key === k)?.label?.split(" (")[0] ?? k).join("\n"),
        e.flags_police ? "Y" : "",
        e.flags_children ? "Y" : "",
        e.flags_witness ? "Y" : "",
        e.notes ?? "",
        (entryHashes[i] ?? "").slice(0, 8),
      ]),
      styles: { fontSize: 7.5, cellPadding: 3, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: SAGE },
      columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 104 },
        3: { cellWidth: 14 }, 4: { cellWidth: 14 }, 5: { cellWidth: 14 },
        6: { cellWidth: 150 }, 7: { cellWidth: 50, font: "courier" },
      },
    });

    // ── Attachments (decrypted in the browser) ──
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
          doc.text(`Attachment for entry recorded ${formatTimestamp(entry.created_at)}`, M, 40);
          doc.setFontSize(8);
          doc.setTextColor(100);

          if (m.kind !== "IMAGE") {
            doc.text(`${m.kind === "VIDEO" ? "Video" : "Audio"} attachment (${m.mime_type}, ${(m.size_bytes / 1024).toFixed(0)} KB)`, M, 56);
            doc.text(`File ID: ${m.id}`, M, 68);
            doc.text("Use ZIP export to include the actual video/audio file.", M, 80);
            continue;
          }

          try {
            const plain = await decryptMediaItem(m, vaultKey);

            // Detect format from magic bytes — works even if stored MIME type is wrong
            const fmt = detectImageFormat(plain);
            if (!fmt) {
              doc.text(`[Image format not supported in PDF — retrieve via ZIP export]`, M, 56);
              continue;
            }

            const b64 = arrayBufferToBase64(plain);
            const dataUrl = `data:${fmt.mime};base64,${b64}`;

            doc.text(`Image attachment (${(m.size_bytes / 1024).toFixed(0)} KB) — File ID ${m.id}`, M, 54);

            // Fit image in page (letter 612×792pt, 40pt margins)
            const maxW = 532;
            const maxH = 640;
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error("Image load failed"));
              img.src = dataUrl;
            });
            const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
            doc.addImage(dataUrl, fmt.ext, M, 68, img.width * ratio, img.height * ratio);
          } catch {
            doc.text(`[Image could not be embedded — retrieve via ZIP export]`, M, 56);
          }
        }
      }
    }

    // ── Integrity / tamper-evidence ──
    doc.addPage();
    doc.setFontSize(13); doc.setTextColor(30); doc.text("Integrity verification", M, 50);
    doc.setFontSize(9.5); doc.setTextColor(60);
    let iy = 70;
    [
      "Each entry is hashed with SHA-256, and the entries are chained in",
      "chronological order into a single document hash. Changing the wording,",
      "dates, order, or attachment list of any entry — or adding or removing an",
      "entry — changes the document hash below. The per-entry hashes are listed",
      "so the chain can be independently recomputed.",
    ].forEach((l) => { doc.text(l, M, iy); iy += 14; });
    iy += 8;
    doc.setFontSize(9.5); doc.setTextColor(30); doc.text("Document SHA-256:", M, iy); iy += 14;
    doc.setFont("courier", "normal"); doc.setFontSize(9);
    doc.text(documentHash.slice(0, 32), M, iy); iy += 12;
    doc.text(documentHash.slice(32), M, iy); iy += 18;
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: iy,
      head: [["#", "Recorded", "Entry SHA-256"]],
      body: entries.map((e, i) => [String(i + 1), formatTimestamp(e.created_at), entryHashes[i] ?? ""]),
      styles: { fontSize: 7, cellPadding: 2, font: "courier" },
      headStyles: { fillColor: SAGE, font: "helvetica" },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 104, font: "helvetica" } },
    });

    // ── Page numbers + document hash on every page (so pages can't be swapped) ──
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`Page ${p} of ${pages}`, M, 782);
      doc.text(`Document ${documentHash.slice(0, 12)}`, 612 - M, 782, { align: "right" });
    }

    doc.save("record-timeline.pdf");
  }

  async function exportZip(
    entries: DecryptedEntry[],
    mediaMap: Record<string, MediaMeta[]>,
    disclaimer: string,
    exportedAt: string,
    vaultKey: CryptoKey,
    entryHashes: string[],
    documentHash: string
  ) {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const csv = buildCsvContent(entries, disclaimer, exportedAt, entryHashes, documentHash);
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
      `# Document SHA-256 (chained over all entries in chronological order): ${documentHash}`,
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

          {format === "pdf" && (
            <div className="space-y-3">
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 text-xs text-brand-800 leading-relaxed">
                The PDF includes a signable declaration and a tamper-evidence hash, so it can be used
                as a court exhibit. These fields are optional — leave them blank to fill in by hand.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your full legal name <span className="font-normal text-gray-400">(for the declaration)</span>
                </label>
                <input
                  type="text"
                  value={declarantName}
                  onChange={(e) => setDeclarantName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State / jurisdiction
                </label>
                <input
                  type="text"
                  value={declarantState}
                  onChange={(e) => setDeclarantState(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  placeholder="Optional, e.g. California"
                />
              </div>
            </div>
          )}

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
