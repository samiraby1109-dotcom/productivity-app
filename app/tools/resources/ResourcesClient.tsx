"use client";
import { useState } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { RESOURCES, searchByZip, type Resource } from "@/data/resources-seed";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

const NATIONAL = RESOURCES.filter((r) => r.national);

export default function ResourcesClient({ mode, email, passwordSalt }: Props) {
  const [zip, setZip] = useState("");
  const [searchedZip, setSearchedZip] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = zip.trim().replace(/\D/g, "").slice(0, 5);
    if (clean.length === 5) setSearchedZip(clean);
  }

  const staticResults = searchedZip ? searchByZip(searchedZip) : null;

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Resources</h1>
        <p className="text-xs text-gray-400 mb-5">
          Enter your ZIP code to find local services. National lines are always shown.
          Your location is never stored.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="ZIP code"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
          <button
            type="submit"
            disabled={zip.length < 5}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="space-y-5">

          {/* National lines — always shown */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              National (24/7 · any location)
            </p>
            {NATIONAL.map((r) => <StaticCard key={r.name} resource={r} />)}
          </div>

          {/* DomesticShelters.org link card — shown after any ZIP is entered */}
          {searchedZip && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Local services near {searchedZip}
              </p>

              <a
                href={`https://www.domesticshelters.org/search?q=${searchedZip}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 bg-brand-50 border border-brand-100 rounded-xl p-4 hover:bg-brand-100 transition-colors group"
              >
                <div>
                  <p className="text-sm font-semibold text-brand-800">
                    Find shelters near {searchedZip}
                  </p>
                  <p className="text-xs text-brand-600 mt-0.5">
                    3,300+ DV programs nationwide · DomesticShelters.org
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-brand-500 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            </div>
          )}

          {/* KC-area hardcoded shelters — shown as bonus when ZIP matches */}
          {staticResults && staticResults.local.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Also near {searchedZip}
              </p>
              {staticResults.local.map((r) => <StaticCard key={r.name} resource={r} />)}
            </div>
          )}

        </div>
      </NavShell>
    </>
  );
}

function StaticCard({ resource }: { resource: Resource }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
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
  );
}
