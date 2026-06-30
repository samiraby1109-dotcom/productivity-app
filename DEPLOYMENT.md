# Production Deployment & Launch Checklist

> Internal document — do not share publicly.
> Use this before putting the app in front of real users or DV advocates.

This is the operational checklist to take the app from a dev build to a safe
production deployment. The application code is ready; these are the
configuration and provisioning steps that must be done in the hosting/database
environment.

---

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

Set these for the **Production** environment. Never commit real values.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only. Never expose to the client. |
| `SESSION_SECRET` | ✅ | 32+ char random. `openssl rand -base64 32`. Signs sessions **and** HMACs the decoy PIN — if it changes, existing decoy PINs stop verifying. |
| `CRON_SECRET` | ✅ | Random string protecting the nightly purge endpoint. |
| `RESEND_API_KEY` | ✅ for email | Enables verification + welcome email. Without it, email is silently skipped (the app still works). |
| `RESEND_FROM_ADDRESS` | ✅ for email | Must be a **verified** Resend sender domain. Keep the name neutral. |
| `DEV_MODE` | ❌ | **Do NOT set in production.** It is ignored for email in production by design, but leave it unset to avoid confusion and to keep the demo-seed path disabled. |
| `NODE_ENV` | auto | Vercel sets this to `production` automatically. |

**Self-checks built into the app:**
- A missing `SESSION_SECRET` in production throws on boot (no silent dev fallback).
- A missing `RESEND_API_KEY` in production logs an error and disables email.
- `DEV_MODE=true` in production logs an error and is ignored for email.

---

## 2. Database (Supabase)

Run the migrations in order in the Supabase SQL editor (or via CLI):

```
supabase/migrations/001_initial_schema.sql
002_storage_bucket.sql
003_seed_demo_user.sql        # DEV only — skip or remove for production
004_vault_contacts.sql
005_email_verified.sql
006_rate_limits.sql
007_encrypt_contact_relationship.sql
008_persistent_lockout.sql
009_restrict_rate_limit_rpc.sql
010_recovery_codes.sql
011_login_events.sql
```

Verify after running:
- [ ] `users` table has `failed_attempts` and `locked_until` columns (008) — required for persistent login lockout.
- [ ] `increment_rate_limit` RPC exists and is restricted (006, 009) — required for the distributed rate limiter.
- [ ] `vault-media` storage bucket exists and is **private** (002).
- [ ] Row Level Security is enabled on all vault tables.
- [ ] **Do not** run `003_seed_demo_user.sql` in production (it creates the public demo credentials).

---

## 3. Cron (purge job)

`vercel.json` schedules the nightly archive purge at 04:00 UTC. Confirm:
- [ ] The cron is registered in the Vercel dashboard after first deploy.
- [ ] `CRON_SECRET` is set and the `/api/cron/purge` route rejects requests without it.

---

## 4. Email deliverability

- [ ] Resend sender domain verified (SPF/DKIM records added to DNS).
- [ ] `RESEND_FROM_ADDRESS` uses a **neutral** display name — never reference the app's true purpose.
- [ ] Send yourself a test registration and confirm the welcome + verification emails arrive and read as ordinary product email.

Email verification is intentionally **soft** — it never blocks account creation or
access (a survivor may not have safe email). Verifying just records a timestamp.

---

## 5. Security headers & PWA

- [ ] Confirm CSP headers are present in production responses (see `next.config.ts`).
- [ ] Service worker registers and the app installs as a PWA.
- [ ] Quick Exit works offline (dashboard pre-cached).
- [ ] `unsafe-eval` in the CSP is a known MVP item (WASM) — tighten with nonces post-launch.

---

## 6. Naming / legal (before any public push)

- [ ] Trademark-check the app name(s) (currently "BelleMeadow Wellness"; see the
      cover/skins system for alternates).
- [ ] Confirm all user-facing copy carries the "not legal advice" framing where appropriate.
- [ ] Privacy policy / terms reviewed for the neutral public positioning.

---

## 7. Pre-advocate smoke test

Run through the full survivor path on a production-like build:
- [ ] Register → save recovery codes → sign out → sign back in.
- [ ] Decoy PIN opens only the cover dashboard; `/tools/*` is hard-blocked in decoy mode.
- [ ] Add a record with a photo attachment → reopen → decrypt and view it.
- [ ] Resources: national lines show everywhere; a ZIP search returns the national directory.
- [ ] Quick Exit leaves cleanly and can't be reached via the back button.
- [ ] 5 wrong passwords → lockout holds even after a redeploy (proves DB-backed lockout).

---

## Quick reference: generate secrets

```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -base64 32   # CRON_SECRET
```
