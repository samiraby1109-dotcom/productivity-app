"use client";
/**
 * CoverPicker — lets the user choose how the app looks/names itself at the start.
 * Applies live (via CoverProvider) and persists per-device. Framed neutrally
 * ("Choose your look") so it reads as ordinary theming, not a safety feature.
 */
import { useCover } from "./CoverProvider";

export default function CoverPicker({ className = "" }: { className?: string }) {
  const { cover, setCover, covers } = useCover();

  return (
    <div className={className}>
      <p className="text-xs font-medium text-gray-500 mb-2">Choose your look</p>
      <div className="grid grid-cols-2 gap-2">
        {covers.map((c) => {
          const active = c.id === cover.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCover(c.id)}
              aria-pressed={active}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                active ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span
                className="w-6 h-6 rounded-full flex-shrink-0 border border-black/5"
                style={{ backgroundColor: c.swatch }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900 truncate">{c.name}</span>
                <span className="block text-[11px] text-gray-500 truncate">{c.tagline}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 mt-2">You can change this anytime in settings.</p>
    </div>
  );
}
