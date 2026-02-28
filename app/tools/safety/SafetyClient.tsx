"use client";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

export default function SafetyClient({ mode, email, passwordSalt }: Props) {
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
            <CheckList items={[
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
            ]} />
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

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
          <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border border-gray-300 flex items-center justify-center">
            <span className="sr-only">□</span>
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
