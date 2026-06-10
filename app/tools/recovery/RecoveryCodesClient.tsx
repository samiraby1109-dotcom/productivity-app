"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import {
  getVaultKey,
  wrapVmkWithSecret,
  unwrapVmkWithSecret,
  encryptPayload,
  decryptPayload,
  generateRecoveryCodes,
  recoveryLookupHash,
  CODE_KEK_ITERATIONS,
} from "@/lib/crypto";
import { formatRecoveryCode } from "@/lib/recovery-format";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

export default function RecoveryCodesClient({ mode, email, passwordSalt }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const vaultKey = getVaultKey();
    if (!vaultKey) {
      setError("Your session is locked. Go back to the dashboard, unlock, and try again.");
      return;
    }
    if (!password) {
      setError("Enter your password to continue.");
      return;
    }

    setLoading(true);
    try {
      // Re-wrap the in-memory vault key under the password (establishes/refreshes
      // the password-wrapped VMK) and self-check it before sending: if the wrap
      // can't be reversed with this exact password, abort rather than risk
      // locking the account out of its own content.
      const vmkPw = await wrapVmkWithSecret(vaultKey, password);
      const check = await unwrapVmkWithSecret(vmkPw, password);
      const probe = await encryptPayload({ ok: 1 }, vaultKey);
      const back = await decryptPayload<{ ok: number }>(probe, check);
      if (back.ok !== 1) {
        setError("Something went wrong preparing your codes. Please try again.");
        setLoading(false);
        return;
      }

      const fresh = generateRecoveryCodes();
      const recoveryPayload = await Promise.all(
        fresh.map(async (code) => {
          const rc = await wrapVmkWithSecret(vaultKey, code, CODE_KEK_ITERATIONS);
          const codeHash = await recoveryLookupHash(code, email);
          return { codeHash, wrapped: rc.wrapped, iv: rc.iv, salt: rc.salt };
        })
      );

      const res = await fetch("/api/auth/recovery-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          vmkWrapped: vmkPw.wrapped,
          vmkWrappedIv: vmkPw.iv,
          vmkSalt: vmkPw.salt,
          recoveryCodes: recoveryPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate codes. Try again.");
        setLoading(false);
        return;
      }

      setPassword("");
      setCodes(fresh);
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const showingCodes = codes.length > 0;

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Recovery codes</h1>
        <p className="text-sm text-gray-500 mb-6">
          A way back in if you forget your password — without losing your entries.
        </p>

        {!showingCodes && (
          <form
            onSubmit={handleGenerate}
            className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4"
          >
            <p className="text-sm text-gray-600">
              Generate a set of one-time codes. Each works once. Generating new codes
              replaces any you created before.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pw">
                Confirm your password
              </label>
              <input
                id="pw"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                placeholder="Your password"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Generating…" : "Generate recovery codes"}
            </button>
          </form>
        )}

        {showingCodes && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <p className="text-sm text-gray-600">
              These are shown only once. Each code works one time.
            </p>

            <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-sm text-gray-800">
              {codes.map((c) => (
                <div key={c} className="tracking-wider text-center">{formatRecoveryCode(c)}</div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900 leading-relaxed">
              <p className="font-medium">Keep them off this device</p>
              <p className="mt-1">
                Write them on paper and store them somewhere private — ideally not in
                this phone, and not anywhere someone else could find them. Avoid
                screenshots. No one can recover your account or your entries without
                one of these codes.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="mt-0.5"
              />
              <span>I&apos;ve saved my recovery codes somewhere safe.</span>
            </label>

            <button
              type="button"
              disabled={!saved}
              onClick={() => router.push("/tools")}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </NavShell>
    </>
  );
}
