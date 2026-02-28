"use client";
import { useState } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import RecordFilters, { type FilterState } from "@/components/RecordFilters";
import { getVaultKey, decryptPayload, type EncryptedBlob, sha256Hex } from "@/lib/crypto";
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
}

const EMPTY_FILTERS: FilterState = {
  from: "", to: "", police: null, children: null, witness: null,
  attachments: null, types: [], status: "ACTIVE",
};

export default function ExportClient({ mode, email, passwordSalt }: Props) {
  const [password, setPassword] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDone("");

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

      const { entries, exportedAt, disclaimer } = await res.json() as {
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
        exportedAt: string;
        disclaimer: string;
      };

      // Decrypt all entries client-side
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
          });
        }
      }

      if (format === "csv") {
        await exportCsv(decrypted, disclaimer, exportedAt);
      } else if (format === "pdf") {
        await exportPdf(decrypted, disclaimer, exportedAt);
      } else {
        await exportZip(decrypted, disclaimer, exportedAt);
      }

      setDone(`Export complete. ${decrypted.length} entries exported.`);
    } catch (err) {
      console.error("Export error:", err);
      setError("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function buildCsvContent(entries: DecryptedEntry[], disclaimer: string, exportedAt: string): string {
    const header = ["Date", "Incident Types", "Police", "Children", "Witness", "Notes", "ID"].join(",");
    const rows = entries.map((e) => [
      formatDate(e.created_at),
      e.incident_types.map((k) => INCIDENT_TYPES.find((t) => t.key === k)?.label ?? k).join("; "),
      e.flags_police ? "Yes" : "No",
      e.flags_children ? "Yes" : "No",
      e.flags_witness ? "Yes" : "No",
      `"${(e.notes ?? "").replace(/"/g, '""')}"`,
      e.id,
    ].join(","));
    return [`# Exported: ${exportedAt}`, `# ${disclaimer}`, header, ...rows].join("\n");
  }

  async function exportCsv(entries: DecryptedEntry[], disclaimer: string, exportedAt: string) {
    const csv = buildCsvContent(entries, disclaimer, exportedAt);
    const hash = await sha256Hex(csv);
    const manifest = `# SHA-256: ${hash}\n# File: export.csv\n# Exported: ${exportedAt}\n`;
    downloadFile(csv, "daybook-export.csv", "text/csv");
    downloadFile(manifest, "daybook-manifest.txt", "text/plain");
  }

  async function exportPdf(entries: DecryptedEntry[], disclaimer: string, exportedAt: string) {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.setFontSize(14);
    doc.text("Daybook — Record Timeline", 40, 40);
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
    doc.save("daybook-export.pdf");
  }

  async function exportZip(entries: DecryptedEntry[], disclaimer: string, exportedAt: string) {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const csv = buildCsvContent(entries, disclaimer, exportedAt);
    zip.file("timeline.csv", csv);
    const hash = await sha256Hex(csv);
    zip.file("manifest.txt", `# SHA-256 of timeline.csv: ${hash}\n# Exported: ${exportedAt}\n# ${disclaimer}\n`);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daybook-export.zip";
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

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Preparing export…" : `Export as ${format.toUpperCase()}`}
          </button>
        </form>
      </NavShell>
    </>
  );
}
