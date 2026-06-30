"use client";
/**
 * NavShell — wraps authenticated pages.
 * Full mode: bottom tab bar (BottomNav) for navigation + one-tap quick exit.
 * Decoy mode: header only — no tabs, no tools link, no exit affordance.
 */
import Link from "next/link";
import BottomNav from "./BottomNav";
import SafetyWalkthrough from "./SafetyWalkthrough";
import CoverLogo from "./CoverLogo";
import { cn } from "@/lib/utils";

interface Props {
  mode: "FULL" | "DECOY";
  children: React.ReactNode;
}

export default function NavShell({ mode, children }: Props) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-700 focus:shadow"
      >
        Skip to content
      </a>
      {/* Top bar */}
      <header className="bg-white/90 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link href="/dashboard" aria-label="Home">
          <CoverLogo className="h-9 w-auto" />
        </Link>

        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>

      {/* Page content */}
      <main id="main" tabIndex={-1} className={cn("flex-1 px-4 py-6 max-w-2xl mx-auto w-full outline-none", mode === "FULL" && "pb-24")}>
        {children}
      </main>

      {mode === "FULL" && <BottomNav />}
      {mode === "FULL" && <SafetyWalkthrough />}
    </div>
  );
}
