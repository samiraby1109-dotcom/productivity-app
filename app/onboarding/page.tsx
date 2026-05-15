"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deriveVaultKey, setVaultKey } from "@/lib/crypto";

type Step = "account" | "decoy" | "disclosure";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [decoyCode, setDecoyCode] = useState("");
  const [confirmDecoy, setConfirmDecoy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateAccount() {
    if (!email.trim()) return "Email is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  function validateDecoy() {
    if (!/^\d{4}$/.test(decoyCode)) return "Code must be exactly 4 digits.";
    if (decoyCode !== confirmDecoy) return "Codes do not match.";
    return null;
  }

  function handleAccountNext(e: React.FormEvent) {
    e.preventDefault();
    const err = validateAccount();
    if (err) { setError(err); return; }
    setError("");
    setStep("decoy");
  }

  function handleDecoyNext(e: React.FormEvent) {
    e.preventDefault();
    const err = validateDecoy();
    if (err) { setError(err); return; }
    setError("");
    setStep("disclosure");
  }

  async function handleFinish() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          passwordHint: passwordHint.trim() || undefined,
          decoyCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setStep("account");
        setLoading(false);
        return;
      }

      // Derive vault key and store in memory for the session
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.passwordSalt) {
          const { key } = await deriveVaultKey(password, Buffer.from(meData.passwordSalt, "base64"));
          setVaultKey(key, meData.passwordSalt);
        }
      }

      router.replace("/dashboard?welcome=1");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create your BelleMeadow Wellness</h1>
          <div className="flex justify-center gap-2 mt-3">
            {(["account", "decoy", "disclosure"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s
                    ? "w-8 bg-brand-500"
                    : i < ["account", "decoy", "disclosure"].indexOf(step)
                    ? "w-4 bg-brand-300"
                    : "w-4 bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Account */}
        {step === "account" && (
          <form onSubmit={handleAccountNext} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Your account</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="Repeat your password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password hint <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={passwordHint}
                onChange={(e) => setPasswordHint(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="A subtle reminder (not your password)"
                maxLength={120}
              />
              <p className="text-xs text-gray-400 mt-1">Shown only if you tap &quot;Need help?&quot; on the login screen.</p>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Continue
            </button>
          </form>
        )}

        {/* Step 2: Decoy Code */}
        {step === "decoy" && (
          <form onSubmit={handleDecoyNext} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Quick-switch code</h2>
            <p className="text-sm text-gray-500">
              Set a 4-digit shortcut for fast access to your daily tracker.
              You can keep it handy when you just want the day view.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">4-digit code</label>
              <input
                type="tel"
                pattern="\d{4}"
                maxLength={4}
                required
                value={decoyCode}
                onChange={(e) => setDecoyCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition text-center text-xl tracking-widest"
                placeholder="0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm code</label>
              <input
                type="tel"
                pattern="\d{4}"
                maxLength={4}
                required
                value={confirmDecoy}
                onChange={(e) => setConfirmDecoy(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition text-center text-xl tracking-widest"
                placeholder="0000"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setError(""); setStep("account"); }}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Archive disclosure */}
        {step === "disclosure" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Before you begin</h2>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 leading-relaxed">
              <p>
                Deleted entries are automatically protected for 30 days to prevent loss under pressure.
              </p>
              <p className="mt-2">
                If you remove an entry, it will appear deleted.
              </p>
              <p className="mt-2">
                You can restore archived entries anytime within 30 days.
              </p>
              <p className="mt-2">
                After 30 days, they permanently delete automatically.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900 leading-relaxed">
              <p className="font-medium">A note about the day view</p>
              <p className="mt-1">
                Anything you type into the main tracker (tasks, notes, habits) lives unencrypted on
                this device and is visible whether you signed in with your password or your 4-digit
                shortcut. Keep the day view for everyday productivity content; sensitive notes
                belong in Records.
              </p>
            </div>

            <p className="text-xs text-gray-400">
              This helps ensure your records are not accidentally or permanently lost.
            </p>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setError(""); setStep("decoy"); }}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating…" : "I understand, start"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
