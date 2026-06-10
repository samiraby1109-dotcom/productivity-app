/**
 * End-to-end beta test of the signup + auth + recovery pipeline.
 *
 * Uses the REAL client crypto (lib/crypto) to build payloads exactly as the
 * onboarding screen does, then drives the real API routes against the running
 * dev server + database. Run: npx tsx scripts/beta-signup-test.ts
 */
import {
  generateVaultMasterKey,
  wrapVmkWithSecret,
  generateRecoveryCodes,
  recoveryLookupHash,
  unwrapVmkWithSecret,
  encryptPayload,
  decryptPayload,
  CODE_KEK_ITERATIONS,
} from "../lib/crypto";
import { normalizeRecoveryCode } from "../lib/recovery-format";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    if (detail !== undefined) console.log(`      ↳ ${JSON.stringify(detail)}`);
  }
}

async function jpost(path: string, body: unknown, cookie?: string) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") ?? "" };
}

async function main() {
  const stamp = Date.now();
  const email = `beta+${stamp}@tracker.local`;
  const password = "BetaTest2026!";
  const decoy = "7351"; // avoids the weak-PIN blocklist
  const newPassword = "BetaReset2026!";

  console.log(`\nBeta signup test → ${BASE}\nNew user: ${email}\n`);

  // Build the vault payload exactly like the onboarding screen.
  const vmk = await generateVaultMasterKey();
  const vmkPw = await wrapVmkWithSecret(vmk, password);
  const codes = generateRecoveryCodes();
  const recoveryCodes = await Promise.all(
    codes.map(async (code) => {
      const rc = await wrapVmkWithSecret(vmk, code, CODE_KEK_ITERATIONS);
      const codeHash = await recoveryLookupHash(code, email);
      return { codeHash, wrapped: rc.wrapped, iv: rc.iv, salt: rc.salt };
    })
  );

  console.log("Registration");
  const reg = await jpost("/api/auth/register", {
    email, password, decoyCode: decoy,
    vault: { vmkWrapped: vmkPw.wrapped, vmkWrappedIv: vmkPw.iv, vmkSalt: vmkPw.salt, recoveryCodes },
  });
  check("new user registers (201)", reg.status === 201, reg.data);
  check("session cookie is set", /bellemeadow_wellness_session=/.test(reg.setCookie));
  check("FULL mode returned", reg.data?.mode === "FULL", reg.data);

  console.log("Input validation");
  check("duplicate email → 409", (await jpost("/api/auth/register", { email, password, decoyCode: decoy })).status === 409);
  check("short password → 400", (await jpost("/api/auth/register", { email: `a${stamp}@t.local`, password: "short", decoyCode: decoy })).status === 400);
  check("guessable decoy (1234) → 400", (await jpost("/api/auth/register", { email: `b${stamp}@t.local`, password, decoyCode: "1234" })).status === 400);

  console.log("Login");
  const login = await jpost("/api/auth/login", { email, password });
  check("password login → FULL", login.status === 200 && login.data?.mode === "FULL", login.data);
  const cookie = login.setCookie.split(";")[0];

  const me = await fetch(BASE + "/api/auth/me", { headers: { cookie } }).then((r) => r.json());
  check("/me returns wrapped VMK", !!me.vmkWrapped);
  const unwrapped = await unwrapVmkWithSecret({ wrapped: me.vmkWrapped, iv: me.vmkWrappedIv, salt: me.vmkSalt }, password);
  const probe = await encryptPayload({ hello: "world" }, vmk);
  const round = await decryptPayload<{ hello: string }>(probe, unwrapped);
  check("password unwraps VMK and decrypts content", round.hello === "world");

  check("decoy PIN → DECOY mode", (await jpost("/api/auth/login", { email, password: decoy })).data?.mode === "DECOY");
  check("wrong password → 401", (await jpost("/api/auth/login", { email, password: "totallyWrong9" })).status === 401);

  console.log("Recovery code");
  const code0 = codes[0];
  const lookupHash = await recoveryLookupHash(code0, email);
  const recFetch = await jpost("/api/auth/recover", { action: "fetch", email, lookupHash });
  check("recover fetch returns wrapped VMK", recFetch.status === 200 && !!recFetch.data?.vmkWrapped, recFetch.data);

  const recVmk = await unwrapVmkWithSecret(
    { wrapped: recFetch.data.vmkWrapped, iv: recFetch.data.vmkWrappedIv, salt: recFetch.data.rcSalt },
    normalizeRecoveryCode(code0)
  );
  const rewrapped = await wrapVmkWithSecret(recVmk, newPassword);
  const recReset = await jpost("/api/auth/recover", {
    action: "reset", email, lookupHash, newPassword,
    vault: { wrapped: rewrapped.wrapped, iv: rewrapped.iv, salt: rewrapped.salt },
  });
  check("recover reset succeeds", recReset.status === 200 && recReset.data?.ok === true, recReset.data);
  check("login with NEW password → FULL", (await jpost("/api/auth/login", { email, password: newPassword })).data?.mode === "FULL");
  check("OLD password rejected after reset", (await jpost("/api/auth/login", { email, password })).status === 401);
  check("used recovery code is single-use", (await jpost("/api/auth/recover", { action: "fetch", email, lookupHash })).status === 401);

  // Content survives the reset: re-derive the vault key via the new password and
  // decrypt the probe encrypted under the original VMK.
  const me2 = await fetch(BASE + "/api/auth/me", {
    headers: { cookie: (await jpost("/api/auth/login", { email, password: newPassword })).setCookie.split(";")[0] },
  }).then((r) => r.json());
  const vmkAfter = await unwrapVmkWithSecret({ wrapped: me2.vmkWrapped, iv: me2.vmkWrappedIv, salt: me2.vmkSalt }, newPassword);
  const survived = await decryptPayload<{ hello: string }>(probe, vmkAfter);
  check("entries stay readable after recovery (content-preserving)", survived.hello === "world");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("Test harness error:", err);
  process.exit(1);
});
