"use client";
/**
 * BottomNav — thumb-reachable primary navigation for Full mode only.
 * Rendered exclusively by NavShell when mode === "FULL", so the decoy/cover
 * view never shows it. "Exit" is the quick-exit panic action, kept in the
 * thumb zone for one-handed use under stress.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { quickExit, cn } from "@/lib/utils";

type Tab = { href: string; label: string; match: (p: string) => boolean; icon: React.ReactNode };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const TABS: Tab[] = [
  {
    href: "/dashboard", label: "Home", match: (p) => p === "/dashboard",
    icon: <svg viewBox="0 0 24 24" {...stroke} className="w-6 h-6"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>,
  },
  {
    href: "/tools/records", label: "Records", match: (p) => p.startsWith("/tools/records"),
    icon: <svg viewBox="0 0 24 24" {...stroke} className="w-6 h-6"><path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>,
  },
  {
    // Crisis-first slot: leads to Resources (hotline + local services) and Guides —
    // the content a survivor needs "in the moment". Kept in the prime thumb position.
    href: "/tools/resources", label: "Support",
    match: (p) => p.startsWith("/tools/resources") || p.startsWith("/tools/guides"),
    icon: <svg viewBox="0 0 24 24" {...stroke} className="w-6 h-6"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><path d="M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M14.9 9.1l4.2-4.2M4.9 19.1l4.2-4.2" /></svg>,
  },
  {
    // Everything else, including the Safety Plan (go-bag, escape fund) — calm-time planning.
    href: "/tools", label: "More",
    match: (p) => p === "/tools" || (p.startsWith("/tools/") && !p.startsWith("/tools/records") && !p.startsWith("/tools/resources") && !p.startsWith("/tools/guides")),
    icon: <svg viewBox="0 0 24 24" {...stroke} className="w-6 h-6"><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>,
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 safe-area-inset-bottom">
      <div className="max-w-2xl mx-auto grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-brand-700" : "text-gray-400 hover:text-gray-600"
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={quickExit}
          aria-label="Exit to home screen"
          className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg viewBox="0 0 24 24" {...stroke} className="w-6 h-6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
          <span>Exit</span>
        </button>
      </div>
    </nav>
  );
}
