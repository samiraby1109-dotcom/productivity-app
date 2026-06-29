"use client";
import { useState, useEffect } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import CoverPicker from "@/components/CoverPicker";
import { AUTO_LOCK_OPTIONS, getAutoLockMs, setAutoLockMs, AUTO_LOCK_DEFAULT_MS } from "@/lib/autolock";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

interface LoginEvent {
  outcome: string;
  user_agent: string | null;
  created_at: string;
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad"
    : /Android/.test(ua) ? "Android"
    : /Macintosh/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "Device";
  const browser = /CriOS|Chrome/.test(ua) ? "Chrome"
    : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /Edg/.test(ua) ? "Edge"
    : /Safari/.test(ua) ? "Safari"
    : "browser";
  return `${os} · ${browser}`;
}

function outcomeLabel(o: string): { text: string; tone: string } {
  if (o === "full") return { text: "Full access", tone: "text-gray-700" };
  if (o === "decoy") return { text: "Decoy view (PIN)", tone: "text-amber-700" };
  return { text: "Failed attempt", tone: "text-red-600" };
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function SecurityClient({ mode, email, passwordSalt }: Props) {
  const [lockMs, setLockMs] = useState<number>(AUTO_LOCK_DEFAULT_MS);
  const [events, setEvents] = useState<LoginEvent[] | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => { Promise.resolve().then(() => setLockMs(getAutoLockMs())); }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/activity")
      .then((r) => (r.ok ? r.json() : { available: false, events: [] }))
      .then((d) => {
        if (cancelled) return;
        setAvailable(d.available !== false);
        setEvents(d.events ?? []);
      })
      .catch(() => { if (!cancelled) { setAvailable(false); setEvents([]); } });
    return () => { cancelled = true; };
  }, []);

  function chooseLock(ms: number) {
    setLockMs(ms);
    setAutoLockMs(ms);
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-5">Account security</h1>

        {/* Appearance / cover */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Appearance</h2>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Change how the app looks and is named on this device.
          </p>
          <CoverPicker />
        </section>

        {/* Auto-lock */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-900">Auto-lock</h2>
          <p className="text-xs text-gray-500 mt-1 mb-3 leading-relaxed">
            Lock and clear your records from memory after this much inactivity. Saved on this device.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {AUTO_LOCK_OPTIONS.map((o) => (
              <button
                key={o.ms}
                type="button"
                onClick={() => chooseLock(o.ms)}
                aria-pressed={lockMs === o.ms}
                className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                  lockMs === o.ms ? "bg-brand-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {/* Sign-in activity */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900">Recent sign-ins</h2>
          <p className="text-xs text-gray-500 mt-1 mb-3 leading-relaxed">
            Full sign-ins, decoy (PIN) sign-ins, and failed attempts on your account. If you see something
            you don&apos;t recognize, consider changing your password.
          </p>
          {events === null ? (
            <p className="text-sm text-gray-400 py-2">Loading…</p>
          ) : !available ? (
            <p className="text-sm text-gray-400 py-2 leading-relaxed">
              Sign-in history isn&apos;t enabled yet. Once enabled, your recent sign-ins will appear here.
            </p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No sign-ins recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {events.map((e, i) => {
                const o = outcomeLabel(e.outcome);
                return (
                  <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${o.tone}`}>{o.text}</p>
                      <p className="text-xs text-gray-400 truncate">{deviceLabel(e.user_agent)}</p>
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0">{fmt(e.created_at)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </NavShell>
    </>
  );
}
