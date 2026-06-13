/**
 * CrisisHelp — one-tap crisis support (U.S. National Domestic Violence Hotline)
 * with a safety caveat: calls and texts leave a trace in the phone's history,
 * while the online chat does not. Rendered inside FULL mode only.
 */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke} className="w-5 h-5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
);
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke} className="w-5 h-5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /></svg>
);
const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke} className="w-5 h-5"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
);
const Chevron = () => (
  <svg viewBox="0 0 24 24" {...stroke} className="w-4 h-4 text-brand-400 flex-shrink-0"><path d="M9 18l6-6-6-6" /></svg>
);

const ROWS = [
  { label: "Call 1-800-799-7233", sub: "National hotline · 24/7", href: "tel:18007997233", external: false, Icon: PhoneIcon },
  { label: "Text START to 88788", sub: "Text-based support", href: "sms:88788?&body=START", external: false, Icon: ChatIcon },
  { label: "Chat online", sub: "thehotline.org · no call history", href: "https://www.thehotline.org/", external: true, Icon: GlobeIcon },
];

export default function CrisisHelp({ className = "" }: { className?: string }) {
  return (
    <section aria-label="Crisis support" className={`rounded-2xl border border-brand-200 bg-brand-50 p-4 ${className}`}>
      <p className="text-sm font-semibold text-brand-900">Get help now</p>
      <p className="text-xs text-brand-700 mt-0.5 leading-relaxed">
        Free, confidential, 24/7. If you&apos;re in immediate danger, call 911.
      </p>

      <div className="mt-3 grid gap-2">
        {ROWS.map(({ label, sub, href, external, Icon }) => (
          <a
            key={label}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="flex items-center gap-3 rounded-xl bg-white border border-brand-100 px-3 py-2.5 hover:border-brand-300 transition-colors"
          >
            <span className="text-brand-600"><Icon /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900">{label}</span>
              <span className="block text-xs text-gray-500">{sub}</span>
            </span>
            <Chevron />
          </a>
        ))}
      </div>

      <p className="text-[11px] text-brand-700 mt-3 leading-relaxed">
        Calls and texts may appear in your phone&apos;s history; the online chat does not.
        You can tap <span className="font-medium">Exit</span> any time to leave quickly.
      </p>
    </section>
  );
}
