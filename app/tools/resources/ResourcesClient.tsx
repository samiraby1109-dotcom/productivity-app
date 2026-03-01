"use client";
import { useState } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { RESOURCES, searchByZip, type Resource } from "@/data/resources-seed";
import type { LiveResource } from "@/app/api/resources/route";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "live"; zip: string; results: LiveResource[] }
  | { status: "static"; zip: string; local: Resource[]; matchType: "exact" | "nearby" | "none" }
  | { status: "error"; message: string };

const NATIONAL = RESOURCES.filter((r) => r.national);

export default function ResourcesClient({ mode, email, passwordSalt }: Props) {
  const [zip, setZip] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = zip.trim().replace(/\D/g, "").slice(0, 5);
    if (!clean || clean.length < 5) return;

    setSearch({ status: "loading" });

    try {
      const res = await fetch(`/api/resources?zip=${clean}`);
      const body = await res.json() as
        | { source: "live"; zip: string; results: LiveResource[] }
        | { source: "static" }
        | { error: string };

      if ("error" in body) {
        // Server error — fall back to static
        const fallback = searchByZip(clean);
        setSearch({ status: "static", zip: clean, local: fallback.local, matchType: fallback.matchType });
        return;
      }

      if (body.source === "live") {
        setSearch({ status: "live", zip: clean, results: body.results });
      } else {
        // API key not configured — use static list
        const fallback = searchByZip(clean);
        setSearch({ status: "static", zip: clean, local: fallback.local, matchType: fallback.matchType });
      }
    } catch {
      // Network error — use static list
      const fallback = searchByZip(clean);
      setSearch({ status: "static", zip: clean, local: fallback.local, matchType: fallback.matchType });
    }
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Resources</h1>
        <p className="text-xs text-gray-400 mb-5">
          Enter your ZIP code to find local services. National lines are always shown.
          Your location is never stored.
        </p>

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
            disabled={zip.length < 5 || search.status === "loading"}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {search.status === "loading" ? "Searching…" : "Search"}
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

          {/* Loading */}
          {search.status === "loading" && (
            <p className="text-sm text-gray-400 text-center py-4">Searching for local services…</p>
          )}

          {/* Live results from 211 API */}
          {search.status === "live" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Near {search.zip}
                <span className="ml-2 font-normal normal-case text-gray-400">
                  {search.results.length} local service{search.results.length !== 1 ? "s" : ""} found
                </span>
              </p>

              {search.results.length === 0 ? (
                <NoLocalResults zip={search.zip} />
              ) : (
                search.results.map((r) => <LiveCard key={r.id} resource={r} />)
              )}
            </div>
          )}

          {/* Static fallback results */}
          {search.status === "static" && (
            <div className="space-y-3">
              {search.local.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {search.matchType === "exact" ? `Near ${search.zip}` : `Nearest to ${search.zip}`}
                  </p>
                  {search.matchType === "nearby" && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      No listings found exactly at {search.zip} — showing the closest available services.
                    </p>
                  )}
                  {search.local.map((r) => <StaticCard key={r.name} resource={r} />)}
                </>
              ) : (
                <NoLocalResults zip={search.zip} />
              )}
            </div>
          )}

        </div>
      </NavShell>
    </>
  );
}

function NoLocalResults({ zip }: { zip: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-700 mb-1">No local listings found for {zip}</p>
      <p className="text-sm text-gray-600 leading-relaxed mb-2">
        The National Support Line can connect you with shelters and services in your area — free, 24/7, confidential:
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <a href="tel:18007997233" className="text-brand-600 font-semibold text-sm hover:underline">
          1-800-799-7233
        </a>
        <span className="text-xs text-gray-400">or text START to 88788</span>
        <a
          href="https://www.thehotline.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-500 hover:underline"
        >
          thehotline.org
        </a>
      </div>
    </div>
  );
}

function LiveCard({ resource }: { resource: LiveResource }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm">{resource.name}</p>
          {resource.phone && (
            <a
              href={`tel:${resource.phone.replace(/\D/g, "")}`}
              className="text-brand-600 text-sm font-medium mt-0.5 block hover:underline"
            >
              {resource.phone}
            </a>
          )}
          {resource.address && (
            <p className="text-xs text-gray-400 mt-0.5">{resource.address}</p>
          )}
          {resource.description && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{resource.description}</p>
          )}
          {resource.website && (
            <a
              href={resource.website.startsWith("http") ? resource.website : `https://${resource.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-500 hover:underline mt-1 block"
            >
              {resource.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
        {resource.distance_miles !== null && (
          <span className="flex-shrink-0 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full whitespace-nowrap">
            {resource.distance_miles.toFixed(1)} mi
          </span>
        )}
      </div>
    </div>
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
