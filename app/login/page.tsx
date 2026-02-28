"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setVaultKey, deriveVaultKey } from "@/lib/crypto";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [fetchingHint, setFetchingHint] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Check your credentials and try again.");
        setLoading(false);
        return;
      }

      // For FULL mode: derive vault key from password and store in memory
      if (data.mode === "FULL") {
        // We need the salt; fetch from /api/auth/me after cookie is set
        // The salt is in the session; we fetch it to derive the key
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.passwordSalt) {
            const { key } = await deriveVaultKey(password, Buffer.from(meData.passwordSalt, "base64"));
            setVaultKey(key, meData.passwordSalt);
          }
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
          <p className="text-sm text-gray-500 mt-1">Sign in to your Daybook</p>
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
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              placeholder="Your password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
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
      </div>
    </div>
  );
}
