"use client";
import { useState, useEffect, useCallback } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

interface SafetyState {
  checked: string[];
  notes: Record<string, string>;
  fundGoal: string;
  fundSaved: string;
}

const GO_BAG_ITEMS = [
  "Government-issued ID (yours and children's)",
  "Social Security cards",
  "Birth certificates",
  "Immigration documents (if applicable)",
  "Passport(s)",
  "Prescription medications",
  "Medical records",
  "Cash and/or prepaid card",
  "Spare phone charger",
  "Change of clothing",
  "Spare keys",
  "Insurance cards / policy documents",
  "Important financial records, account numbers",
  "Any custody orders or protective orders",
  "Cherished items (photos, sentimental items)",
];

function storageKey(email: string) {
  // Simple namespace — not secret, just per-user
  return `safety_plan_${btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
}

export default function SafetyClient({ mode, email, passwordSalt }: Props) {
  const [state, setState] = useState<SafetyState>({
    checked: [],
    notes: {},
    fundGoal: "",
    fundSaved: "",
  });

  // Load from localStorage once on mount. A lazy useState initializer would
  // read it during SSR-mismatched first render; doing it post-mount keeps
  // server and client markup identical, at the cost of one extra render.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(email));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time hydration from external store
      if (raw) setState(JSON.parse(raw));
    } catch {
      // ignore parse errors
    }
  }, [email]);

  const save = useCallback(
    (next: SafetyState) => {
      setState(next);
      try {
        localStorage.setItem(storageKey(email), JSON.stringify(next));
      } catch {
        // storage full or unavailable
      }
    },
    [email]
  );

  function toggleItem(item: string) {
    const checked = state.checked.includes(item)
      ? state.checked.filter((x) => x !== item)
      : [...state.checked, item];
    save({ ...state, checked });
  }

  function setNote(item: string, note: string) {
    save({ ...state, notes: { ...state.notes, [item]: note } });
  }

  function setFund(field: "fundGoal" | "fundSaved", value: string) {
    save({ ...state, [field]: value });
  }

  const goal = parseFloat(state.fundGoal) || 0;
  const saved = parseFloat(state.fundSaved) || 0;
  const pct = goal > 0 ? Math.min(saved / goal, 1) : 0;
  const barColor =
    pct >= 1 ? "bg-green-500" : pct >= 0.5 ? "bg-amber-400" : "bg-rose-400";

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Safety Plan</h1>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6 text-sm text-blue-900">
          <p className="font-medium">You do not need documentation to leave.</p>
          <p className="text-xs mt-1 text-blue-700">This guide is for planning, not legal advice.</p>
        </div>

        <div className="space-y-4">
          <Section title="If you cannot leave yet">
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Identify the safest room in your home — avoid rooms with weapons or no exit.</li>
              <li>✓ Practice how to leave quickly; know which doors, windows, stairwells.</li>
              <li>✓ Consider a code word with a friend, family member, or neighbor that signals you need help.</li>
              <li>✓ Memorize important phone numbers in case you cannot access your phone.</li>
              <li>✓ Know the nearest safe location: a trusted neighbor, library, shelter, or police station.</li>
            </ul>
          </Section>

          <Section title="Go-bag checklist">
            <p className="text-xs text-gray-400 mb-3">
              Tap items to mark them as gathered. Add a note to any item. Your progress is saved on this device.
            </p>
            <ul className="space-y-2">
              {GO_BAG_ITEMS.map((item) => (
                <CheckItem
                  key={item}
                  item={item}
                  checked={state.checked.includes(item)}
                  note={state.notes[item] ?? ""}
                  onToggle={() => toggleItem(item)}
                  onNote={(v) => setNote(item, v)}
                />
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">
              {state.checked.length} of {GO_BAG_ITEMS.length} gathered
            </p>
          </Section>

          <Section title="Escape fund">
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Track how much you have set aside and how much you are aiming for.
              Even small amounts add up. First months rent, a bus ticket, or a prepaid card can make a difference.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Goal ($)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={state.fundGoal}
                  onChange={(e) => setFund("fundGoal", e.target.value)}
                  placeholder="e.g. 1200"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Saved so far ($)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={state.fundSaved}
                  onChange={(e) => setFund("fundSaved", e.target.value)}
                  placeholder="e.g. 350"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                />
              </div>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {goal > 0
                ? saved >= goal
                  ? `$${saved.toLocaleString()} — goal reached!`
                  : `$${saved.toLocaleString()} of $${goal.toLocaleString()} (${Math.round(pct * 100)}%)`
                : "Set a goal above to track progress."}
            </p>
          </Section>

          <Section title="Children and school safety">
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Notify the school about any custody or safety orders.</li>
              <li>✓ Identify who is authorized to pick up your children.</li>
              <li>✓ Have a plan for after-school hours if you need to leave quickly.</li>
              <li>✓ Consider discussing age-appropriate safety plans with your children.</li>
            </ul>
          </Section>

          <Section title="Co-parenting safety">
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Use a neutral third party or supervised exchange location.</li>
              <li>✓ Keep communication documented and through text or a co-parenting app if possible.</li>
              <li>✓ Consult with a legal advocate before making custody changes.</li>
              <li>✓ Do not share your new address unless legally required.</li>
            </ul>
          </Section>

          <Section title="Tech safety">
            <ul className="space-y-2 text-sm text-gray-700">
              <li>⚠️ Your device, accounts, or network may be monitored. Use a safer device when possible.</li>
              <li>✓ Consider a library computer or a trusted friend&apos;s device for private browsing.</li>
              <li>✓ Clear your browser history and remove this app from recent apps if needed.</li>
              <li>✓ Change passwords on a safer device — not the one you share with an abuser.</li>
              <li>✓ Review app permissions and location sharing on your phone.</li>
              <li>✓ Check whether your car, bag, or belongings have hidden tracking devices.</li>
            </ul>
          </Section>

          <Section title="Legal resources">
            <p className="text-sm text-gray-700 mb-2">
              For state-specific legal information on protective orders, custody, and housing:
            </p>
            <a
              href="https://www.womenslaw.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 text-sm font-medium hover:underline"
            >
              WomensLaw.org
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
            </a>
            <p className="text-xs text-gray-400 mt-1">External link — opens in a new tab.</p>
          </Section>
        </div>

        <div className="mt-6 bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
          <p className="text-sm font-medium text-gray-700">You do not need documentation to leave.</p>
          <p className="text-xs text-gray-500 mt-1">Your safety is the priority, not the paperwork.</p>
        </div>
      </NavShell>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="font-semibold text-gray-900 text-sm mb-3">{title}</h2>
      {children}
    </div>
  );
}

function CheckItem({
  item,
  checked,
  note,
  onToggle,
  onNote,
}: {
  item: string;
  checked: boolean;
  note: string;
  onToggle: () => void;
  onNote: (v: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);

  return (
    <li className="text-sm">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={checked ? "Uncheck item" : "Check item"}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            checked
              ? "bg-brand-500 border-brand-500 text-white"
              : "border-gray-300 hover:border-brand-400"
          }`}
        >
          {checked && (
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </button>
        <span className={`flex-1 leading-snug ${checked ? "line-through text-gray-400" : "text-gray-700"}`}>
          {item}
        </span>
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className="flex-shrink-0 text-xs text-gray-400 hover:text-brand-500 transition-colors mt-0.5"
        >
          {note ? "edit note" : "add note"}
        </button>
      </div>
      {(showNote || note) && (
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="mt-1.5 ml-7 w-[calc(100%-1.75rem)] text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none transition"
        />
      )}
    </li>
  );
}
