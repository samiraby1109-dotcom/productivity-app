"use client";
import { useState } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { RESOURCES, searchByZip, type Resource, type ZipSearchResult } from "@/data/resources-seed";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

const DEFAULT_RESULT: ZipSearchResult = {
  national: RESOURCES.filter((r) => r.national),
  local: [],
  matchType: "none",
};

export default function ResourcesClient({ mode, email, passwordSalt }: Props) {
  const [zip, setZip] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<ZipSearchResult>(DEFAULT_RESULT);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = zip.trim().replace(/\D/g, "").slice(0, 5);
    setResult(trimmed ? searchByZip(trimmed) : DEFAULT_RESULT);
    setSubmitted(true);
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Resources</h1>
        <p className="text-xs text-gray-400 mb-5">
          Enter any ZIP code to find local services. National lines are always shown.
          Location permission is never requested.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="ZIP code (optional)"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="space-y-5">
          {/* National lines — always visible */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">National (24/7, any location)</p>
            {result.national.map((r) => <ResourceCard key={r.name} resource={r} />)}
          </div>

          {/* Local results */}
          {submitted && result.local.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {result.matchType === "exact" ? `Near ${zip}` : `Nearby ${zip} (closest area)`}
              </p>
              {result.matchType === "nearby" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  No exact listings for {zip} — showing services in the surrounding area that may be able to help.
                </p>
              )}
              {result.local.map((r) => <ResourceCard key={r.name} resource={r} />)}
            </div>
          )}

          {/* No local match */}
          {submitted && result.local.length === 0 && zip && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">No local listings found for {zip}</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                The National Support Line can connect you with local shelters and services in your specific area — call or chat any time:
              </p>
              <a
                href="tel:18007997233"
                className="mt-2 inline-flex items-center gap-1.5 text-brand-600 font-semibold text-sm hover:underline"
              >
                1-800-799-7233
              </a>
              <span className="text-xs text-gray-400 ml-2">or chat at thehotline.org</span>
            </div>
          )}
        </div>
      </NavShell>
    </>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900 text-sm">{resource.name}</p>
          {resource.phone && (
            <a
              href={`tel:${resource.phone.replace(/\D/g, "")}`}
              className="text-brand-600 text-sm font-medium mt-0.5 block hover:underline"
            >
              {resource.phone}
            </a>
          )}
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{resource.description}</p>
          {resource.website && (
            <a
              href={resource.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-500 hover:underline mt-1 block"
            >
              {resource.website.replace("https://", "")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
