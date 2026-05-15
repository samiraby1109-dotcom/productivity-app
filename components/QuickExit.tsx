"use client";
/**
 * QuickExit — always visible in Full mode.
 * Single click: immediately routes to /dashboard, clears sensitive nav history.
 */
import { quickExit } from "@/lib/utils";

export default function QuickExit() {
  return (
    <button
      onClick={quickExit}
      aria-label="Go to home"
      title="Go to home"
      className="
        fixed top-3 right-3 z-50
        flex items-center justify-center
        w-12 h-12 rounded-full
        bg-white/85 backdrop-blur-sm
        border border-gray-200
        text-gray-500 hover:text-gray-700
        shadow-sm hover:shadow
        transition-all duration-150
        select-none
      "
    >
      {/* Neutral house icon */}
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </button>
  );
}
