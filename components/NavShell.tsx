"use client";
/**
 * NavShell — wraps authenticated pages.
 * Full mode: shows gear icon leading to /tools.
 * Decoy mode: NO gear, NO tools link.
 */
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import QuickExit from "./QuickExit";
import { cn } from "@/lib/utils";

interface Props {
  mode: "FULL" | "DECOY";
  children: React.ReactNode;
}

export default function NavShell({ mode, children }: Props) {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/dashboard" aria-label="BelleMeadow Wellness">
          <Image src="/logo.png" alt="BelleMeadow Wellness" width={140} height={56} className="h-10 w-auto" priority />
        </Link>

        <div className="flex items-center gap-3">
          {/* Full mode: gear → Tools */}
          {mode === "FULL" && (
            <Link
              href="/tools"
              aria-label="Tools"
              className={cn(
                "p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors",
                pathname.startsWith("/tools") && "text-brand-600 bg-brand-50"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          )}

          {/* Logout */}
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
        </div>
      </header>

      {/* Full mode Quick Exit (fixed overlay) */}
      {mode === "FULL" && <QuickExit />}

      {/* Page content */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
