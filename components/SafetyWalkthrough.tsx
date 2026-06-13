"use client";
import { useState, useEffect } from "react";

/**
 * SafetyWalkthrough — a one-time orientation shown on the first FULL-mode visit,
 * covering the safety features a survivor most needs to know up front. Dismissal
 * is remembered per device in localStorage. Rendered by NavShell in FULL mode only.
 */
const KEY = "bw_walkthrough_seen";
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const C = "w-5 h-5";

const ExitIcon = () => (<svg viewBox="0 0 24 24" {...stroke} className={C}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>);
const PinIcon = () => (<svg viewBox="0 0 24 24" {...stroke} className={C}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V8a5 5 0 0 1 10 0v3" /></svg>);
const NoteIcon = () => (<svg viewBox="0 0 24 24" {...stroke} className={C}><path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>);
const KeyIcon = () => (<svg viewBox="0 0 24 24" {...stroke} className={C}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L21 2M17 6l3 3M14 9l3 3" /></svg>);

const POINTS = [
  { Icon: ExitIcon, title: "Quick exit, anytime", body: "The Exit button in the bottom bar instantly leaves for a neutral website and clears this page from history." },
  { Icon: PinIcon, title: "Your PIN opens a decoy", body: "Entering your 4-digit code shows an ordinary daily tracker — not your records. Use it if someone asks to see your phone." },
  { Icon: NoteIcon, title: "Keep private notes in Records", body: "The day view (tasks, notes, habits) isn't encrypted and appears in both views. Anything sensitive belongs in Records." },
  { Icon: KeyIcon, title: "Save your recovery codes", body: "They're the only way back in if you forget your password — keep them somewhere safe, ideally off this device." },
];

export default function SafetyWalkthrough() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      try { if (!localStorage.getItem(KEY)) setShow(true); } catch { /* ignore */ }
    });
  }, []);

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome and safety tips"
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[85vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900">A few things to know</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Your safety comes first — here&apos;s how this app helps protect you.</p>
        <ul className="space-y-3.5">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span className="text-brand-600 mt-0.5 flex-shrink-0"><p.Icon /></span>
              <span>
                <span className="block text-sm font-medium text-gray-900">{p.title}</span>
                <span className="block text-xs text-gray-500 leading-relaxed mt-0.5">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <button
          onClick={dismiss}
          className="mt-5 w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
