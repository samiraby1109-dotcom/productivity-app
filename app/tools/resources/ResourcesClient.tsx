"use client";
import { useState } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import { RESOURCES, getResourcesByZip, type Resource } from "@/data/resources-seed";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

export default function ResourcesClient({ mode, email, passwordSalt }: Props) {
  const [zip, setZip] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Resource[]>([]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = zip.trim().replace(/\D/g, "").slice(0, 5);
    if (!trimmed) {
      setResults(RESOURCES.filter((r) => r.national));
    } else {
      setResults(getResourcesByZip(trimmed));
    }
    setSubmitted(true);
  }

  const national = results.filter((r) => r.national);
  const local = results.filter((r) => !r.national);

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Resources</h1>
        <p className="text-xs text-gray-400 mb-5">
          Enter a ZIP code to find local services. National lines are always shown.
          Location permission is never requested.
        </p>

        {/* ZIP search */}
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

        {!submitted && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">National lines</p>
            {RESOURCES.filter((r) => r.national).map((r) => (
              <ResourceCard key={r.name} resource={r} />
            ))}
          </div>
        )}

        {submitted && (
          <div className="space-y-5">
            {national.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">National</p>
                {national.map((r) => <ResourceCard key={r.name} resource={r} />)}
              </div>
            )}
            {local.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Near {zip}</p>
                {local.map((r) => <ResourceCard key={r.name} resource={r} />)}
              </div>
            )}
            {local.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No local services found for {zip || "that area"}.
                The national lines above are available 24/7.
              </p>
            )}
          </div>
        )}
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
