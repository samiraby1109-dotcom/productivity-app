"use client";
import Link from "next/link";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const C = "w-6 h-6";

const ICON = {
  records: <svg viewBox="0 0 24 24" {...S} className={C}><path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>,
  contacts: <svg viewBox="0 0 24 24" {...S} className={C}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  archive: <svg viewBox="0 0 24 24" {...S} className={C}><path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M2 4h20v4H2zM10 12h4" /></svg>,
  export: <svg viewBox="0 0 24 24" {...S} className={C}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg>,
  safety: <svg viewBox="0 0 24 24" {...S} className={C}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>,
  risk: <svg viewBox="0 0 24 24" {...S} className={C}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  guides: <svg viewBox="0 0 24 24" {...S} className={C}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  resources: <svg viewBox="0 0 24 24" {...S} className={C}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><path d="M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M14.9 9.1l4.2-4.2M14.9 9.1l3.5-3.5M4.9 19.1l4.2-4.2" /></svg>,
  recovery: <svg viewBox="0 0 24 24" {...S} className={C}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L21 2M17 6l3 3M14 9l3 3" /></svg>,
};

const GROUPS = [
  {
    title: "Document",
    items: [
      { href: "/tools/records", label: "Records", desc: "View and add entries", icon: ICON.records },
      { href: "/tools/contacts", label: "Contacts", desc: "Advocates & trusted people", icon: ICON.contacts },
      { href: "/tools/archive", label: "Archive", desc: "Removed entries", icon: ICON.archive },
      { href: "/tools/export", label: "Export", desc: "Download your records", icon: ICON.export },
    ],
  },
  {
    title: "Plan & support",
    items: [
      { href: "/tools/safety", label: "Safety Plan", desc: "Planning ahead", icon: ICON.safety },
      { href: "/tools/risk", label: "Safety risk check", desc: "Reflect on risk factors", icon: ICON.risk },
      { href: "/tools/guides", label: "Guides", desc: "Understand what's happening", icon: ICON.guides },
      { href: "/tools/resources", label: "Resources", desc: "Local support services", icon: ICON.resources },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/tools/recovery", label: "Recovery codes", desc: "Backup access to your account", icon: ICON.recovery },
    ],
  },
];

export default function ToolsClient({ mode, email, passwordSalt }: Props) {
  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Tools</h1>
        <div className="space-y-7">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5 px-1">{g.title}</h2>
              <div className="grid grid-cols-2 gap-3">
                {g.items.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="flex flex-col gap-2 p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <span className="text-brand-600">{t.icon}</span>
                    <span className="font-medium text-gray-900 text-sm">{t.label}</span>
                    <span className="text-xs text-gray-400 leading-snug">{t.desc}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </NavShell>
    </>
  );
}
