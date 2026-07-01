"use client";
import { useState } from "react";
import Link from "next/link";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import CrisisHelp from "@/components/CrisisHelp";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

// Recognized lethality / danger risk factors drawn from domestic-violence
// research (including the work of Dr. Jacquelyn Campbell). Phrased as a plain
// educational reflection — not the copyrighted instrument, and not a clinical
// score. Nothing here is stored.
const FACTORS: { id: string; label: string }[] = [
  { id: "weapon", label: "Has access to a gun, or has used or threatened you with a weapon." },
  { id: "threats_kill", label: "Has threatened to kill you, your children, or themselves." },
  { id: "strangle", label: "Has ever choked or strangled you (hands or anything around your throat)." },
  { id: "escalating", label: "The violence or threats have gotten worse or more frequent in the past year." },
  { id: "control", label: "Is constantly jealous, or controls most of your daily activities." },
  { id: "forced_sex", label: "Has forced you into sex when you did not want to." },
  { id: "stalking", label: "Follows, watches, tracks, or leaves you threatening messages." },
  { id: "pregnancy", label: "Has been violent toward you during a pregnancy." },
  { id: "separation", label: "You have recently separated, or are planning to leave." },
  { id: "substances", label: "Heavily uses alcohol or drugs." },
  { id: "children_pets", label: "Has threatened to harm your children or pets." },
  { id: "suicide", label: "Has threatened or attempted suicide." },
];

function reflection(count: number): { heading: string; body: string; tone: "calm" | "soft" | "warn" } {
  if (count === 0) {
    return {
      tone: "calm",
      heading: "You didn't mark any of these",
      body:
        "That doesn't mean everything is okay — these are only some of many risk factors, and only you know your situation. Trust your instincts. Support is here whenever you want it, no matter what.",
    };
  }
  if (count <= 3) {
    return {
      tone: "soft",
      heading: "You marked a few risk factors",
      body:
        "Research recognizes these as things that can raise risk. It can really help to talk through your situation with a trained advocate — it's free, confidential, and you don't have to have decided anything. They'll go at your pace.",
    };
  }
  return {
    tone: "warn",
    heading: "You marked several serious risk factors",
    body:
      "Research links these to higher danger. That doesn't predict what will happen — but please consider reaching out to an advocate soon. You deserve support and a plan, and you are not overreacting. If you're ever in immediate danger, call 911.",
  };
}

const TONE: Record<"calm" | "soft" | "warn", string> = {
  calm: "bg-brand-50 border-brand-100 text-brand-900",
  soft: "bg-brand-50 border-brand-200 text-brand-900",
  warn: "bg-amber-50 border-amber-200 text-amber-900",
};

export default function RiskCheckClient({ mode, email, passwordSalt }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = checked.size;
  const result = reflection(count);

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Safety risk check</h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-1">
          A private, gentle reflection on some risk factors that domestic-violence research has linked
          to greater danger. Check the ones that fit. Take your time.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-5">
          Nothing here is saved or sent anywhere. This is not a clinical assessment, a diagnosis, or a
          prediction — and marking few or none does not mean you are safe.
        </p>

        {!submitted ? (
          <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-3">
            {FACTORS.map((f) => {
              const on = checked.has(f.id);
              return (
                <label
                  key={f.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    on ? "bg-brand-50 border-brand-300" : "bg-white border-gray-200 hover:border-brand-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(f.id)}
                    className="mt-0.5 accent-brand-500"
                  />
                  <span className="text-sm text-gray-800 leading-relaxed">{f.label}</span>
                </label>
              );
            })}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              See my reflection
            </button>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Based on risk factors identified in domestic-violence research, including the work of
              Dr.&nbsp;Jacquelyn Campbell. An advocate can help you make sense of your specific situation.
            </p>
          </form>
        ) : (
          <div className="space-y-5">
            <div role="status" aria-live="polite" className={`rounded-2xl border p-4 ${TONE[result.tone]}`}>
              <p className="text-sm font-semibold">{result.heading}</p>
              <p className="text-sm mt-1 leading-relaxed">{result.body}</p>
              <p className="text-xs mt-3 opacity-80">
                You marked {count} of {FACTORS.length}. This is a reflection, not a score — there is no
                threshold that means you are or aren&apos;t in danger.
              </p>
            </div>

            <CrisisHelp />

            <Link
              href="/tools/safety"
              className="flex items-center justify-between gap-3 rounded-xl bg-white border border-gray-200 p-4 hover:border-brand-300 transition-colors"
            >
              <span>
                <span className="block text-sm font-medium text-gray-900">Open your safety plan</span>
                <span className="block text-xs text-gray-500">Go-bag, escape fund, and quick-leave steps</span>
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400"><path d="M9 18l6-6-6-6" /></svg>
            </Link>

            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Review my answers
            </button>
          </div>
        )}
      </NavShell>
    </>
  );
}
