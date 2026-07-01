"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import RecordFilters, { type FilterState } from "@/components/RecordFilters";
import { INCIDENT_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface RecordRow {
  id: string;
  created_at: string;
  incident_types: string[];
  flags_police: boolean;
  flags_children: boolean;
  flags_witness: boolean;
  has_attachments: boolean;
  encrypted_payload: string;
}

const EMPTY_FILTERS: FilterState = {
  from: "",
  to: "",
  police: null,
  children: null,
  witness: null,
  attachments: null,
  types: [],
  status: "ACTIVE",
};

const PAGE_SIZE = 50;

// Value check (not reference equality — RecordFilters' Clear button passes its
// own object) so the empty state can distinguish "no records" from "filtered".
function hasActiveFilters(f: FilterState): boolean {
  return !!(
    f.from || f.to ||
    f.police !== null || f.children !== null || f.witness !== null ||
    f.attachments !== null ||
    f.types.length > 0 ||
    f.status !== "ACTIVE"
  );
}

function buildQuery(filters: FilterState, offset: number): string {
  const params = new URLSearchParams();
  params.set("status", filters.status);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.police !== null) params.set("police", String(filters.police));
  if (filters.children !== null) params.set("children", String(filters.children));
  if (filters.witness !== null) params.set("witness", String(filters.witness));
  if (filters.attachments !== null) params.set("attachments", String(filters.attachments));
  filters.types.forEach((t) => params.append("type", t));
  return params.toString();
}

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

export default function RecordsClient({ mode, email, passwordSalt }: Props) {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // The spinner is switched on in the filter-change handler (and starts true
  // for the initial load) so this never sets state synchronously when invoked
  // from the effect — every setState below sits behind the await.
  const fetchRecords = useCallback(async () => {
    const res = await fetch(`/api/records?${buildQuery(filters, 0)}`);
    if (res.ok) {
      const data = await res.json();
      setRecords(data.records ?? []);
      setHasMore(!!data.hasMore);
    }
    setLoading(false);
  }, [filters]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-in-effect; all setStates are post-await
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function handleFiltersChange(f: FilterState) {
    setLoading(true);
    setFilters(f);
  }

  async function loadMore() {
    setLoadingMore(true);
    const res = await fetch(`/api/records?${buildQuery(filters, records.length)}`);
    if (res.ok) {
      const data = await res.json();
      const fresh = (data.records ?? []) as RecordRow[];
      setRecords((prev) => {
        // Guard against duplicates if a row shifted pages between requests.
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...fresh.filter((r) => !seen.has(r.id))];
      });
      setHasMore(!!data.hasMore);
    }
    setLoadingMore(false);
  }

  async function handleDelete(id: string) {
    setConfirmingDelete(null);
    setDeleting(id);
    const res = await fetch(`/api/records/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRecords((r) => r.filter((e) => e.id !== id));
      showToast("Entry removed.");
    } else {
      showToast("Could not remove that entry. Please try again.");
    }
    setDeleting(null);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function incidentLabel(key: string): string {
    return INCIDENT_TYPES.find((t) => t.key === key)?.label.split(" (")[0] ?? key;
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg"
        >
          {toast}
        </div>
      )}

      <NavShell mode={mode}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Records</h1>
          <Link
            href="/tools/records/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add entry
          </Link>
        </div>

        <RecordFilters filters={filters} onChange={handleFiltersChange} />

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {hasActiveFilters(filters) ? "No records match your filters." : "No records yet. Add your first entry."}
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-gray-100 p-4 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">{formatDate(r.created_at)}</p>

                    {/* Incident type badges */}
                    {r.incident_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {r.incident_types.slice(0, 3).map((t) => (
                          <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px]">
                            {incidentLabel(t)}
                          </span>
                        ))}
                        {r.incident_types.length > 3 && (
                          <span className="text-[11px] text-gray-500">+{r.incident_types.length - 3} more</span>
                        )}
                      </div>
                    )}

                    {/* Flags */}
                    <div className="flex gap-2 text-xs text-gray-500">
                      {r.flags_police && <span>Police</span>}
                      {r.flags_children && <span>Children</span>}
                      {r.flags_witness && <span>Witness</span>}
                      {r.has_attachments && <span>📎</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/tools/records/${r.id}`}
                      className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      aria-label="View entry"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => setConfirmingDelete(r.id)}
                      disabled={deleting === r.id}
                      className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      aria-label="Remove entry"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Two-step confirm — deletion is permanent, so never delete on a
                    single (possibly mis-tapped) press. */}
                {confirmingDelete === r.id && (
                  <div role="alertdialog" aria-label="Confirm delete" className="mt-3 rounded-lg bg-red-50 border border-red-100 p-3">
                    <p className="text-xs text-red-800 mb-2">
                      Delete this entry permanently? This can&apos;t be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        className="flex-1 min-h-11 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {deleting === r.id ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(null)}
                        className="flex-1 min-h-11 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:border-brand-300 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </NavShell>
    </>
  );
}
