"use client";
import { useState } from "react";
import { INCIDENT_TYPES, type IncidentTypeKey } from "@/lib/constants";

export interface FilterState {
  from: string;
  to: string;
  police: boolean | null;
  children: boolean | null;
  witness: boolean | null;
  attachments: boolean | null;
  types: IncidentTypeKey[];
  status: "ACTIVE" | "ARCHIVED";
}

const EMPTY: FilterState = {
  from: "",
  to: "",
  police: null,
  children: null,
  witness: null,
  attachments: null,
  types: [],
  status: "ACTIVE",
};

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

export default function RecordFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function toggle(key: IncidentTypeKey) {
    const has = filters.types.includes(key);
    onChange({
      ...filters,
      types: has ? filters.types.filter((t) => t !== key) : [...filters.types, key],
    });
  }

  function triToggle(field: "police" | "children" | "witness" | "attachments") {
    const current = filters[field];
    const next = current === null ? true : current === true ? false : null;
    onChange({ ...filters, [field]: next });
  }

  function triLabel(val: boolean | null): string {
    if (val === null) return "Any";
    return val ? "Yes" : "No";
  }

  function triClass(val: boolean | null): string {
    if (val === null) return "bg-gray-100 text-gray-600";
    if (val) return "bg-brand-100 text-brand-700";
    return "bg-red-50 text-red-600";
  }

  const activeCount =
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.police !== null ? 1 : 0) +
    (filters.children !== null ? 1 : 0) +
    (filters.witness !== null ? 1 : 0) +
    (filters.attachments !== null ? 1 : 0) +
    filters.types.length;

  return (
    <div className="mb-4">
      {/* Toggle button */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-medium">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            onClick={() => onChange(EMPTY)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4 shadow-sm">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="filter-from-date" className="block text-xs font-medium text-gray-500 mb-1">From date</label>
              <input
                id="filter-from-date"
                type="date"
                value={filters.from}
                onChange={(e) => onChange({ ...filters, from: e.target.value })}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="filter-to-date" className="block text-xs font-medium text-gray-500 mb-1">To date</label>
              <input
                id="filter-to-date"
                type="date"
                value={filters.to}
                onChange={(e) => onChange({ ...filters, to: e.target.value })}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <div className="flex gap-2">
              {(["ACTIVE", "ARCHIVED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ ...filters, status: s })}
                  aria-pressed={filters.status === s}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.status === s
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Flag toggles */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Flags</label>
            <div className="grid grid-cols-2 gap-2">
              {(["police", "children", "witness", "attachments"] as const).map((field) => {
                const fieldName =
                  field === "police"
                    ? "Police involved"
                    : field === "children"
                      ? "Children involved"
                      : field === "witness"
                        ? "Witnesses"
                        : "Has files";
                return (
                  <button
                    key={field}
                    onClick={() => triToggle(field)}
                    aria-label={`${fieldName}: ${triLabel(filters[field])}`}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${triClass(filters[field])}`}
                  >
                    {fieldName}
                    <span className="ml-1 font-normal opacity-70">({triLabel(filters[field])})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Incident types */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Incident types</label>
            <div className="flex flex-wrap gap-1.5">
              {INCIDENT_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => toggle(t.key as IncidentTypeKey)}
                  aria-pressed={filters.types.includes(t.key as IncidentTypeKey)}
                  className={`inline-flex items-center min-h-[44px] px-3 py-2 rounded-full text-[11px] font-medium transition-colors ${
                    filters.types.includes(t.key as IncidentTypeKey)
                      ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t.label.split(" (")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
