/**
 * SAFETY-CRITICAL behavioural test for the decoy/vault separation.
 *
 * Verifies, against the running stack, that:
 *  A. A FULL session can store documentation (encrypted) and read it back.
 *  B. The export data pipeline returns decryptable entries.
 *  C. A DECOY (PIN) session can NEVER reach the documentation/plan side —
 *     not via any vault API, not via any /tools page, and the decoy session
 *     is never even handed the key material needed to decrypt anything.
 *
 * Run: BASE_URL=http://localhost:3000 npx tsx scripts/safety-decoy-test.ts
 */
import {
  generateVaultMasterKey, wrapVmkWithSecret, unwrapVmkWithSecret,
  generateRecoveryCodes, recoveryLookupHash, encryptPayload, decryptPayload,
  CODE_KEK_ITERATIONS,
} from "../lib/crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const criticalFailures: string[] = [];

function check(name: string, cond: boolean, opts: { critical?: boolean; detail?: unknown } = {}) {
  const mark = opts.critical ? "[CRITICAL] " : "";
  if (cond) { pass++; console.log(`  ✓ ${mark}${name}`); }
  else {
    fail++; console.log(`  ✗ ${mark}${name}`);
    if (opts.detail !== undefined) console.log(`      ↳ ${JSON.stringify(opts.detail).slice(0, 200)}`);
    if (opts.critical) criticalFailures.push(name);
  }
}

let ip = 0;
async function req(method: string, path: string, o: { cookie?: string; json?: unknown } = {}) {
  ip++;
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual", // see the raw proxy redirect, don't follow it
    headers: {
      "x-forwarded-for": `198.51.100.${ip % 250}`,
      ...(o.json ? { "Content-Type": "application/json" } : {}),
      ...(o.cookie ? { cookie: o.cookie } : {}),
    },
    body: o.json ? JSON.stringify(o.json) : undefined,
  });
  let text = ""; try { text = await res.text(); } catch { /* */ }
  return { status: res.status, location: res.headers.get("location"), text, setCookie: res.headers.get("set-cookie") ?? "" };
}
const jget = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

async function main() {
  const email = `safety+${Date.now()}@tracker.local`;
  const password = "SafetyTest2026!";
  const decoy = "8472";
  const MARKER = "EXIT-PLAN-MARKER-9f3a7c"; // distinctive plaintext we’ll hunt for

  // ─── setup: register a real account ───
  const vmk = await generateVaultMasterKey();
  const vmkPw = await wrapVmkWithSecret(vmk, password);
  const codes = generateRecoveryCodes();
  const rc = await Promise.all(codes.map(async (c) => {
    const w = await wrapVmkWithSecret(vmk, c, CODE_KEK_ITERATIONS);
    return { codeHash: await recoveryLookupHash(c, email), wrapped: w.wrapped, iv: w.iv, salt: w.salt };
  }));
  await req("POST", "/api/auth/register", { json: {
    email, password, decoyCode: decoy,
    vault: { vmkWrapped: vmkPw.wrapped, vmkWrappedIv: vmkPw.iv, vmkSalt: vmkPw.salt, recoveryCodes: rc },
  }});

  // ─── A. FULL session: store + read documentation ───
  console.log("\nA. Storage (FULL session)");
  const full = await req("POST", "/api/auth/login", { json: { email, password } });
  const fullCookie = full.setCookie.split(";")[0];
  const me = jget((await req("GET", "/api/auth/me", { cookie: fullCookie })).text);
  if (!me?.vmkWrapped) {
    console.error("Setup failed — /me returned no vmkWrapped. Is the full stack (postgres/postgrest/proxy/dev) up and migrated?", me);
    process.exit(2);
  }
  const key = await unwrapVmkWithSecret({ wrapped: me.vmkWrapped, iv: me.vmkWrappedIv, salt: me.vmkSalt }, password);

  const doc = { notes: `2026-06-10 incident log + ${MARKER}`, timestamp: new Date().toISOString() };
  const enc = await encryptPayload(doc, key);
  const created = await req("POST", "/api/records", { cookie: fullCookie, json: {
    encryptedPayload: JSON.stringify(enc), incidentTypes: ["PHYSICAL_VIOLENCE"], flagsPolice: true,
  }});
  check("documentation saves (201)", created.status === 201, { critical: true, detail: { status: created.status } });
  const recId = jget(created.text)?.id;

  const listed = jget((await req("GET", "/api/records", { cookie: fullCookie })).text);
  check("saved entry appears in the list", !!listed?.records?.some((r: any) => r.id === recId));

  const fetched = await req("GET", `/api/records/${recId}`, { cookie: fullCookie });
  check("server stores ONLY ciphertext (no plaintext notes in the row)", !fetched.text.includes(MARKER), { critical: true });
  const back = await decryptPayload<{ notes: string }>(jget(fetched.text).record.encrypted_payload && JSON.parse(jget(fetched.text).record.encrypted_payload), key);
  check("stored documentation decrypts back to the original", back.notes === doc.notes, { critical: true });

  // ─── B. Export pipeline ───
  console.log("\nB. Export (FULL session)");
  const exp = await req("POST", "/api/export", { cookie: fullCookie, json: { password, filters: { status: "ACTIVE" } } });
  check("export returns data (200)", exp.status === 200, { detail: { status: exp.status } });
  const expData = jget(exp.text);
  const expEntry = expData?.entries?.find((e: any) => e.id === recId);
  check("export payload is present and decrypts to the original", !!expEntry &&
    (await decryptPayload<{ notes: string }>(JSON.parse(expEntry.encrypted_payload), key)).notes === doc.notes);
  check("export response carries no plaintext notes", !exp.text.includes(MARKER), { critical: true });

  // ─── C. DECOY session: must be fully walled off ───
  console.log("\nC. Decoy isolation (PIN session)");
  const d = await req("POST", "/api/auth/login", { json: { email, password: decoy } });
  check("PIN logs in as DECOY mode", d.status === 200 && jget(d.text)?.mode === "DECOY", { critical: true, detail: jget(d.text) });
  const decoyCookie = d.setCookie.split(";")[0];

  const dme = jget((await req("GET", "/api/auth/me", { cookie: decoyCookie })).text);
  check("decoy /me withholds the vault key material (salt + wrapped VMK)", !dme?.passwordSalt && !dme?.vmkWrapped, { critical: true, detail: dme });
  check("decoy /me withholds the password hint", !dme?.passwordHint, { critical: true });

  const leakRe = /encrypted_payload|"records"\s*:\s*\[\s*\{|"entries"\s*:\s*\[\s*\{|"contacts"\s*:\s*\[\s*\{|signedUrl/;
  const vaultApis: [string, string, unknown?][] = [
    ["GET", "/api/records"],
    ["GET", `/api/records/${recId}`],
    ["GET", "/api/archive"],
    ["GET", "/api/contacts"],
    ["POST", "/api/export", { password, filters: {} }],
    ["POST", "/api/media/signed-url", { mediaId: recId }],
    ["GET", `/api/records/${recId}/media`],
  ];
  for (const [m, p, body] of vaultApis) {
    const r = await req(m, p, { cookie: decoyCookie, json: body });
    const blocked = r.status !== 200;
    const noLeak = !leakRe.test(r.text) && !r.text.includes(MARKER);
    check(`decoy ${m} ${p} blocked & leaks nothing (status ${r.status}${r.location ? ` → ${r.location}` : ""})`,
      blocked && noLeak, { critical: true, detail: { status: r.status, body: r.text.slice(0, 120) } });
  }

  for (const p of ["/tools", "/tools/records", `/tools/records/${recId}`, "/tools/export", "/tools/records/new", "/tools/recovery", "/tools/archive", "/tools/contacts"]) {
    const r = await req("GET", p, { cookie: decoyCookie });
    const redirected = [301, 302, 307, 308].includes(r.status) && (r.location ?? "").includes("/dashboard");
    const noLeak = !r.text.includes(MARKER);
    check(`decoy page ${p} redirects to /dashboard (status ${r.status})`, redirected && noLeak, { critical: true, detail: { status: r.status, location: r.location } });
  }

  const dash = await req("GET", "/dashboard", { cookie: decoyCookie });
  check("decoy /dashboard (the cover view) still loads", dash.status === 200, { detail: { status: dash.status } });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (criticalFailures.length) {
    console.log(`\n‼ ${criticalFailures.length} CRITICAL failure(s):`);
    for (const c of criticalFailures) console.log(`   - ${c}`);
  } else {
    console.log("\n✅ No critical failures — decoy isolation and storage hold.");
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("harness error:", e); process.exit(1); });
