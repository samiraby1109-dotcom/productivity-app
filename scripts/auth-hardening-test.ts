/**
 * Auth-hardening regression test.
 *
 * Locks in the fixes for the "I set a password and then neither it nor my PIN
 * worked" report:
 *   1. Leading/trailing whitespace in the password OR the PIN is tolerated, so
 *      a stray space from copy/paste or autofill doesn't fail a correct login.
 *   2. The decoy PIN keeps working even when the real password is locked out
 *      from failed attempts (the lockout must not collateral-damage the
 *      survivor's coercion-safety path).
 *
 * Run: BASE_URL=http://localhost:3000 npx tsx scripts/auth-hardening-test.ts
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra) : ""); }
}
async function post(path: string, body: unknown) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data: any = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const reg = (email: string, password: string, decoyCode: string) => post("/api/auth/register", { email, password, decoyCode });
const login = (email: string, password: string) => post("/api/auth/login", { email, password });

async function main() {
  console.log(`Auth-hardening test → ${BASE}`);
  const stamp = Date.now();
  const PW = "Tr0ub4dor&3!correct";
  const PIN = "7193";

  console.log("Whitespace tolerance (the copy/paste footgun)");
  const u1 = `ws${stamp}@t.local`;
  check("register", (await reg(u1, PW, PIN)).status === 200);
  check("trailing-space password → FULL", (await login(u1, PW + " ")).data?.mode === "FULL");
  check("leading-space password → FULL", (await login(u1, " " + PW)).data?.mode === "FULL");
  check("padded PIN → DECOY", (await login(u1, "  " + PIN + " ")).data?.mode === "DECOY");
  check("genuinely wrong password → 401", (await login(u1, "totallyWrong9")).status === 401);

  console.log("Decoy PIN survives password lockout (the 'both fail' trap)");
  const u2 = `lock${stamp}@t.local`;
  check("register", (await reg(u2, PW, PIN)).status === 200);
  let last = 0;
  for (let i = 0; i < 5; i++) last = (await login(u2, "wrong#" + i)).status;
  check("5 wrong passwords each → 401", last === 401);
  check("correct password is now locked → 401", (await login(u2, PW)).status === 401);
  check("correct PIN STILL works while locked → DECOY", (await login(u2, PIN)).data?.mode === "DECOY");

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error("harness error", e); process.exit(1); });
