"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { unlockVaultFromMe } from "@/lib/crypto";
import { normalizePassword } from "@/lib/password";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [fetchingHint, setFetchingHint] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Trim before both the request and the vault unlock so a stray space
      // can't fail the login or, worse, log in but leave the vault unreadable.
      const pw = normalizePassword(password);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pw }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Check your credentials and try again.");
        setLoading(false);
        return;
      }

      // For FULL mode: unwrap the vault key into memory. /api/auth/me returns
      // the wrapped VMK (or, for legacy accounts, the password salt).
      if (data.mode === "FULL") {
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          await unlockVaultFromMe(pw, await meRes.json());
        }
      }

      router.replace("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleNeedHelp() {
    if (hint !== null) {
      setShowHint(!showHint);
      return;
    }

    if (!email.trim()) {
      setShowHint(true);
      setHint(null);
      return;
    }

    setFetchingHint(true);
    try {
      // We use a dedicated hint endpoint that only reveals the hint
      const res = await fetch("/api/auth/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      setHint(data.hint ?? null);
    } catch {
      setHint(null);
    } finally {
      setFetchingHint(false);
      setShowHint(true);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your BelleMeadow Wellness</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22M9.88 9.88a3 3 0 1 0 4.24 4.24" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="space-y-2">
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Check for an accidental space (tap the eye to see what you typed) and that your
                saved password is current. Still stuck?{" "}
                <Link href="/recover" className="text-brand-600 hover:underline font-medium">Use a recovery code</Link>.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Need help — password hint only */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleNeedHelp}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline-offset-2 hover:underline"
          >
            {fetchingHint ? "Looking up…" : "Need help?"}
          </button>

          {showHint && (
            <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-800 text-left">
              {hint ? (
                <>
                  <span className="font-medium">Your hint:</span> {hint}
                </>
              ) : (
                <span>No hint stored. Enter your email first to look up your hint.</span>
              )}
            </div>
          )}
        </div>

        {/* Register link */}
        <p className="mt-6 text-center text-xs text-gray-500">
          New here?{" "}
          <Link href="/onboarding" className="text-brand-600 hover:underline font-medium">
            Create an account
          </Link>
        </p>

        {/* Recovery */}
        <p className="mt-2 text-center text-xs text-gray-400">
          <Link href="/recover" className="hover:text-gray-600 hover:underline">
            Lost access? Use a recovery code
          </Link>
        </p>
      </div>
    </div>
  );
}
