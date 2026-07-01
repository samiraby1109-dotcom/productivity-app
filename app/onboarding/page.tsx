"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setVaultKey,
  generateVaultMasterKey,
  wrapVmkWithSecret,
  generateRecoveryCodes,
  recoveryLookupHash,
  CODE_KEK_ITERATIONS,
} from "@/lib/crypto";
import { formatRecoveryCode } from "@/lib/recovery-format";
import { normalizePassword } from "@/lib/password";
import CoverPicker from "@/components/CoverPicker";

type Step = "account" | "decoy" | "disclosure" | "recovery";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [decoyCode, setDecoyCode] = useState("");
  const [confirmDecoy, setConfirmDecoy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  function validateAccount() {
    const pw = normalizePassword(password);
    if (!email.trim()) return "Email is required.";
    if (pw.length < 8) return "Password must be at least 8 characters.";
    if (pw !== normalizePassword(confirmPassword)) return "Passwords do not match.";
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
      // Generate the Vault Master Key and recovery codes entirely client-side.
      // The server only ever receives wrapped/hashed material. The password is
      // normalized first so the vault key and the server hash match at login.
      const pw = normalizePassword(password);
      const vmk = await generateVaultMasterKey();
      const vmkPw = await wrapVmkWithSecret(vmk, pw);
      const codes = generateRecoveryCodes();
      const recoveryPayload = await Promise.all(
        codes.map(async (code) => {
          // Code-grade KDF cost — high-entropy secrets don't need password-grade
          // stretching, and there are ten of these on the signup critical path.
          const rc = await wrapVmkWithSecret(vmk, code, CODE_KEK_ITERATIONS);
          const codeHash = await recoveryLookupHash(code, email.trim());
          return { codeHash, wrapped: rc.wrapped, iv: rc.iv, salt: rc.salt };
        })
      );

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: pw,
          decoyCode,
          vault: {
            vmkWrapped: vmkPw.wrapped,
            vmkWrappedIv: vmkPw.iv,
            vmkSalt: vmkPw.salt,
            recoveryCodes: recoveryPayload,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setStep("account");
        setLoading(false);
        return;
      }

      // Store the vault key in memory for this session, then show the codes.
      setVaultKey(vmk, vmkPw.salt);
      setRecoveryCodes(codes);
      setLoading(false);
      setStep("recovery");
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
          {step !== "recovery" && (
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
          )}
        </div>

        {/* Step 1: Account */}
        {step === "account" && (
          <form onSubmit={handleAccountNext} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Your account</h2>

            <CoverPicker className="pb-1" />

            <div>
              <label htmlFor="onboard-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="onboard-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="onboard-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                id="onboard-password"
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
              <label htmlFor="onboard-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                id="onboard-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="Repeat your password"
              />
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
              <p className="font-medium">Choose a password only you will remember</p>
              <p className="mt-1">
                Try not to save it in your phone&apos;s password manager — a saved password can hint that this
                app exists, or be seen by anyone with access to your accounts. You&apos;ll get one-time recovery
                codes at the end in case you ever forget it. If you have a trusted advocate, you can give them
                your recovery codes to keep somewhere safe.
              </p>
            </div>

            {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

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
              <label htmlFor="onboard-decoy-code" className="block text-sm font-medium text-gray-700 mb-1">4-digit code</label>
              <input
                id="onboard-decoy-code"
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
              <label htmlFor="onboard-confirm-code" className="block text-sm font-medium text-gray-700 mb-1">Confirm code</label>
              <input
                id="onboard-confirm-code"
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

            {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

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

            {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

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

        {/* Step 4: Recovery codes (shown once) */}
        {step === "recovery" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Save your recovery codes</h2>
            <p className="text-sm text-gray-500">
              If you ever forget your password, these codes are the only way back
              into your account — and they keep your existing entries readable.
              Each code works once.
            </p>

            <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-sm text-gray-800">
              {recoveryCodes.map((c) => (
                <div key={c} className="tracking-wider text-center">{formatRecoveryCode(c)}</div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900 leading-relaxed">
              <p className="font-medium">Keep them off this device</p>
              <p className="mt-1">
                Write them on paper and store them somewhere private — ideally not
                in this phone, and not anywhere someone else could find them. Avoid
                screenshots. A trusted advocate can also hold a copy for you. No one
                can recover your account or your entries without one of these codes.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={savedConfirmed}
                onChange={(e) => setSavedConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>I&apos;ve saved my recovery codes somewhere safe.</span>
            </label>

            <button
              type="button"
              disabled={!savedConfirmed}
              onClick={() => router.replace("/dashboard?welcome=1")}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
