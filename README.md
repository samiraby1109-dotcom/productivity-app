# BelleMeadow Wellness — Daily Tracker

> **Public positioning:** A neutral daily productivity tracker for tasks, notes, and habits.
> This document describes the full system including its hidden features.
> **Do not share this README publicly.**

---

## ⚠️ DEV MODE Credentials

> These credentials exist for local development only. Do NOT use in production.

| Field | Value |
|---|---|
| Email | `demo@tracker.local` |
| Password | `TrackerDemo2026` |
| Decoy Code | `2468` |
| Password Hint | `It's the demo password for BelleMeadow Wellness` |

To create the demo user in your Supabase instance:
```bash
npm run seed
```

---

## Architecture Overview

```
Next.js 15 (App Router) + TypeScript
├── Public landing page (neutral)
├── /login              → custom auth (no Supabase Auth)
├── /onboarding         → account creation + hint + decoy code + disclosure
├── /dashboard          → productivity tracker (Decoy + Full mode)
└── /tools/*            → Full mode only (never accessible in Decoy mode)
    ├── /records        → encrypted evidence journal
    ├── /archive        → 30-day soft-delete buffer
    ├── /resources      → local support services by ZIP
    ├── /safety         → safety planning guide
    ├── /guides         → education + glossary
    └── /export         → court-ready export (PDF/CSV/ZIP + hash manifest)

Supabase Postgres    → stores ciphertext + minimal unencrypted metadata
Supabase Storage     → stores encrypted media blobs (private bucket)
IndexedDB            → offline task data + upload retry queue
WebCrypto AES-GCM    → client-side encryption (server never sees plaintext)
PBKDF2               → vault key derivation from password
httpOnly cookies     → session management (no localStorage tokens)
```

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd bellemeadow-wellness
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your values:
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose) |
| `SESSION_SECRET` | 32+ char random string for JWT signing (`openssl rand -base64 32`) |
| `CRON_SECRET` | Random string for protecting the purge cron endpoint |
| `DEV_MODE` | Set `true` to disable email verification |

### 3. Run Supabase migrations

In the Supabase SQL editor, run in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_storage_bucket.sql`

### 4. Seed demo user (DEV only)

```bash
npm run seed
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Login: `demo@tracker.local` / `TrackerDemo2026`

### 6. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy

# Add environment variables in Vercel dashboard or via:
vercel env add SESSION_SECRET
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add CRON_SECRET
```

The `vercel.json` configures the daily purge cron at 4:00 AM UTC.

---

## Security Model

### Authentication

- **No Supabase Auth** — custom email + PBKDF2 password auth
- Password hash: `PBKDF2(password, random_salt, 200_000, sha256, 64)`
- Decoy code: 4-digit PIN stored as HMAC-SHA256 with server secret
- Sessions: signed JWT in `httpOnly; Secure; SameSite=Strict` cookie
- Lockout: 5 failed attempts → 15-minute silent lockout (neutral error message)
- Idle lock: 5-minute idle → requires password re-entry
- Restart lock: app close/reopen → requires sign-in
- Recovery: user-held one-time codes (issued at onboarding) re-wrap the vault key client-side, so a forgotten password can be reset **without losing encrypted entries** — the server never sees a code in plaintext (see "Account recovery" below)

### Encryption

- **KDF:** PBKDF2 (WebCrypto, 310,000 iterations, SHA-256)
- **Vault key:** Derived client-side from password + stored salt; never leaves browser
- **Entry encryption:** AES-GCM 256-bit, per-entry IV, payload is JSON
- **Media encryption:** AES-GCM 256-bit per-file key, key wrapped by vault key
- **Server stores:** ciphertext only — server cannot read entry notes
- **Unencrypted metadata:** `created_at`, `incident_types[]`, flag booleans, `has_attachments`, `status`

### Account recovery (content-preserving)

- Vault content is encrypted with a random **Vault Master Key (VMK)**, not the password directly
- The VMK is wrapped (AES-GCM key-wrap) under a password-derived key **and** under each recovery code
- Recovery codes are generated client-side, shown once at onboarding, and never stored on-device
- Server stores only: the wrapped VMK copies + a slow client-side PBKDF2 lookup hash per code — never the password, the VMK, or a plaintext code
- Reset flow: enter a code → unwrap the VMK locally → set a new password → re-wrap. Existing entries stay readable because the VMK is unchanged. Codes are single-use.
- Trade-off (deliberate): a recovery code is a second key to the vault, so it must be kept off-device — the onboarding screen says so explicitly
- Existing accounts (created before this feature) enrol or regenerate codes under **Tools → Recovery codes** (re-enter password → re-wrap the in-memory key → new codes); the client self-checks the re-wrap before saving so a forgotten-password reset can never orphan content

### Decoy Mode

- 4-digit code → DECOY session → only `/dashboard` accessible
- Middleware hard-blocks `/tools/*` and all vault API endpoints in DECOY mode
- No DV modules are dynamically imported in DECOY mode paths
- No gear icon, no tools link visible in DECOY mode

### Quick Exit

- Single tap: `history.replaceState` + `location.replace("/dashboard")`
- Browser back button cannot navigate back to vault pages after exit
- Works offline (dashboard is pre-cached by service worker)

### Archive (Soft Delete)

- Delete → status: `ARCHIVED` (invisible, not shown at delete time)
- Message at delete time: `"Entry removed."` — no archive mention
- 30-day fixed retention — no user setting
- Vercel cron runs nightly, purges entries past `purge_at`
- Permanent delete requires: confirmation dialog + password re-entry

### Service Worker

- Caches: app shell + static Next.js assets only
- Never caches: API responses, vault content, tools pages
- Quick Exit pre-cached for offline use

### CSP Headers

```
default-src 'self'
script-src 'self' 'unsafe-eval' 'unsafe-inline'  # WASM requires unsafe-eval
style-src 'self' 'unsafe-inline'
img-src 'self' blob: data:
media-src 'self' blob:
connect-src 'self' https://*.supabase.co
frame-src 'none'
object-src 'none'
```

> Note: `unsafe-eval` is required for WASM modules. Tighten with nonces in post-MVP.

---

## Threat Model Summary

| Threat | Mitigation |
|---|---|
| Shoulder surfing | Decoy mode shows only productivity tracker |
| Coercion to show phone | Decoy code gives plausible deniability |
| Device confiscation | Vault content AES-GCM encrypted; no key stored on device |
| Abuser explores app | Decoy mode middleware hard-blocks all DV routes |
| Internet monitoring | App works offline; no DV keywords in metadata or URLs |
| Server breach | Server only stores ciphertext; cannot decrypt |
| Abuser forces deletion | 30-day archive buffer (disclosed at onboarding) |
| Account takeover | No emailed reset link; recovery needs a user-held one-time code (never on-device); lockout on 5 failed attempts |
| Browser history | Quick Exit uses replaceState; tools routes excluded from SW cache |
| XSS | CSP headers; httpOnly cookies; no localStorage tokens |
| CSRF | SameSite=Strict cookies; JSON API with Content-Type check |

---

## Limitations (MVP)

- [ ] Argon2id WASM preferred over PBKDF2 — upgrade post-MVP
- [ ] In-memory lockout store resets on server restart — use Redis/DB in production
- [x] Recovery codes: issued at onboarding for new accounts; existing accounts enrol/regenerate under Tools → Recovery codes
- [ ] Biometric lock is not implemented (delegated to OS screen lock)
- [ ] Argon2id requires WASM which needs `unsafe-eval` in CSP — switch to nonces in production
- [ ] Media download/decryption UI is not yet implemented (metadata visible, download requires further work)
- [ ] National resource database is manually curated — expand with CSV import in V2
- [ ] No email verification in DEV_MODE — enable before production launch

---

## File Structure

```
/
├── app/
│   ├── layout.tsx              # Root layout + PWA registration
│   ├── page.tsx                # Public landing page (neutral)
│   ├── login/page.tsx          # Login (hint-only, no reset link)
│   ├── onboarding/page.tsx     # 3-step account creation
│   ├── dashboard/              # Productivity tracker (Decoy + Full)
│   │   ├── page.tsx            # Server component (reads session)
│   │   └── DashboardClient.tsx # Client tracker UI
│   ├── tools/                  # Full mode only
│   │   ├── page.tsx            # Tools hub
│   │   ├── records/            # Encrypted evidence journal
│   │   ├── archive/            # 30-day soft-delete buffer
│   │   ├── resources/          # Local support by ZIP
│   │   ├── safety/             # Safety planning guide
│   │   ├── guides/             # Education + glossary
│   │   └── export/             # PDF/CSV/ZIP export
│   └── api/
│       ├── auth/               # login, logout, register, me, hint, recover
│       ├── records/            # CRUD + media list
│       ├── archive/            # restore + permanent delete
│       ├── media/              # upload + signed URL
│       ├── export/             # filtered export data
│       └── cron/purge/         # Vercel cron purge job
├── components/
│   ├── NavShell.tsx            # Authenticated shell (mode-aware)
│   ├── QuickExit.tsx           # Quick exit button (Full mode)
│   ├── IdleLock.tsx            # 5-min idle lock overlay
│   ├── RecordFilters.tsx       # Collapsible filter panel
│   └── PwaRegistration.tsx     # SW registration
├── lib/
│   ├── crypto.ts               # WebCrypto AES-GCM + PBKDF2
│   ├── auth.ts                 # Password hash + decoy + lockout
│   ├── session.ts              # JWT sign/verify
│   ├── db.ts                   # Supabase clients
│   ├── server-session.ts       # Server-side session helpers + API error
│   ├── offline-queue.ts        # IndexedDB upload queue + tracker data
│   ├── constants.ts            # Incident types, session modes, routes
│   └── utils.ts                # cn(), formatDate(), quickExit()
├── data/
│   └── resources-seed.ts       # Curated local resource database
├── supabase/migrations/
│   ├── 001_initial_schema.sql  # Tables + indexes + RLS
│   ├── 002_storage_bucket.sql  # vault-media bucket setup
│   └── 003_seed_demo_user.sql  # Demo user placeholder
├── scripts/
│   └── seed-demo-user.ts       # Demo user seed script
├── public/
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker
└── vercel.json                 # Cron configuration
```

---

## Content Decisions

### Why "BelleMeadow Wellness"?
Placeholder name. Neutral, diary-adjacent, does not suggest legal evidence or DV. Must be trademark-checked before production launch.

### Why no Argon2id in MVP?
Argon2id WASM requires `unsafe-eval` in CSP, and the WASM bundle adds ~300KB. MVP uses PBKDF2 at 310,000 iterations (above NIST minimums). Argon2id is the planned V2 upgrade.

### Why no *emailed* password reset?
An emailed reset link requires email and creates a recoverable link an abuser could intercept or discover. Instead, recovery uses **user-held one-time codes** generated at onboarding (see "Account recovery" above): the codes never touch email or the device, the server never sees them in plaintext, and using one preserves existing encrypted entries. This is the survivor-safe alternative to a reset link.

### Why fixed 30-day archive?
Reducing this window under pressure ("just delete it forever") is a known coercion vector. The fixed window is disclosed upfront so it cannot be weaponized at the time of deletion. Users cannot shorten or lengthen it.

---

## License

Private / All rights reserved. Not open-source until further notice.
