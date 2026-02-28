"use client";
import Link from "next/link";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

const TOOLS = [
  { href: "/tools/records", icon: "📋", label: "Records", desc: "View and add entries" },
  { href: "/tools/archive", icon: "🗂", label: "Archive", desc: "Removed entries" },
  { href: "/tools/resources", icon: "📚", label: "Resources", desc: "Local support services" },
  { href: "/tools/safety", icon: "🛡", label: "Safety Plan", desc: "Planning ahead" },
  { href: "/tools/guides", icon: "📖", label: "Guides", desc: "Understand what's happening" },
  { href: "/tools/export", icon: "📤", label: "Export", desc: "Download your records" },
];

export default function ToolsClient({ mode, email, passwordSalt }: Props) {
  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Tools</h1>
        <div className="grid grid-cols-2 gap-3">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-col gap-1 p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all"
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="font-medium text-gray-900 text-sm">{t.label}</span>
              <span className="text-xs text-gray-400">{t.desc}</span>
            </Link>
          ))}
        </div>
      </NavShell>
    </>
  );
}
