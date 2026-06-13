# Security & Privacy

BelleMeadow Wellness is a domestic-violence documentation tool disguised as a
wellness tracker. Its security model is unusual because the **primary adversary
often has physical access to the device and may know the user personally.** This
document describes the threat model, the cryptography, what is and isn't
protected, and how to report a vulnerability.

> Contact for vulnerability reports: **security@bellemeadow.app**
> *(configure this alias before launch, or replace with your preferred address).*

---

## 1. Threat model

### Who we defend against
- **An abuser with hands-on access to the unlocked phone**, who may open the app
  to check on the user. → Defended by the **decoy/cover view**: a 4-digit PIN
  opens an innocuous daily tracker with no path to the protected records.
- **An abuser who coerces the user to "show me the app."** → The decoy PIN gives
  a believable, fully-functional cover. The real vault requires the password and
  is unreachable from the cover.
- **A network adversary.** → All traffic is HTTPS. The server is zero-knowledge
  (see §2); intercepted traffic carries only ciphertext, wrapped keys, and hashes.
- **The platform operator / a database or backup leak / a subpoena of the
  server.** → The server never holds plaintext, the password, the vault key, or
  recovery codes. A full database dump does not reveal record contents.
- **Forensic examination of a confiscated device.** → Record contents, the
  safety plan, and media are encrypted at rest. The app switcher snapshot is
  covered (§4).

### What we explicitly do NOT defend against
- **A compromised device** — keyloggers, spyware, screen recording, or a
  jailbroken/rooted OS. If the device itself is compromised, no app can protect
  plaintext the user is actively viewing.
- **The cover/day-view content.** Tasks, notes, and habits typed into the
  innocuous tracker are stored **unencrypted on the device** by design (it must
  look and behave like a normal tracker, and is visible in both modes). Sensitive
  content belongs in Records, not the day view. This is disclosed to users during
  onboarding.
- **Structured metadata.** For filtering and search, each record stores
  `incident_types` and the police/children/witness flags as **plaintext columns**
  (the free-text notes, dates, location, and attachments are encrypted). A server
  leak reveals category/flag metadata but not contents.
- **Exported files once downloaded.** A PDF/CSV/ZIP export is decrypted on the
  device and leaves the encryption boundary; the user is responsible for where it
  is stored or sent.
- **Coercion to reveal the real password.** No technical control defeats a user
  being forced to unlock the vault.

---

## 2. Cryptography

All vault cryptography happens **client-side** in the browser via the Web Crypto
API. The server stores only wrapped/hashed material.

| Purpose | Scheme |
| --- | --- |
| Password hash (auth) | PBKDF2-HMAC-SHA256, 200,000 iterations, 16-byte per-user salt, stored `iterations:salt:hash` |
| Vault contents | AES-256-GCM |
| Vault Master Key (VMK) | Generated client-side; wrapped by a password-derived KEK (PBKDF2). Server stores only the wrapped VMK + KDF salt |
| Per-record / per-contact data | AES-256-GCM under the VMK |
| Media files | Per-file AES-256-GCM key, wrapped by the VMK; ciphertext stored in a private bucket |
| Recovery codes | High-entropy codes; each independently wraps the VMK so recovery preserves existing data. Server stores a code hash + wrapped VMK |
| Decoy PIN | HMAC-SHA256(server secret + per-user salt) over the PIN |
| Session token | Signed JWT (HS256) with `SESSION_SECRET` |

**Zero-knowledge property:** the server never receives the password, the VMK, the
plaintext records, or the plaintext recovery codes. Password normalization
(trim) is applied identically on client and server so the vault key and the auth
hash never disagree.

---

## 3. Authentication & sessions

- **Two secrets, two views.** The password opens the FULL vault; the 4-digit
  decoy PIN opens the cover. Weak/guessable PINs are rejected at signup.
- **Lockout.** Per-account failed-password lockout (5 attempts → 15 min) is
  tracked in the database so it survives serverless cold starts. The **decoy PIN
  is checked before the lockout gate**, so a locked password never disables the
  user's coercion-safety path. Per-IP rate limits bound brute force (tighter for
  4-digit-shaped attempts).
- **Idle lock.** FULL-mode screens re-prompt for the password after inactivity
  and clear the vault key from memory.
- **Cookies.** `HttpOnly`, `SameSite=Strict`, `Secure` in production.
- **Resilience.** If an expected column is missing (schema drift), login
  degrades gracefully (lockout disabled) and logs the cause rather than failing
  every sign-in or masquerading as "wrong credentials."

---

## 4. Privacy hardening

- **App-switcher cover.** When the app is backgrounded/hidden, a neutral splash
  covers the screen so the OS snapshot can't reveal vault content.
- **Quick exit.** A one-tap Exit replaces the page and history with a neutral
  site.
- **Neutral footprint.** App name, manifest, metadata, and icons contain no DV
  keywords.
- **Redacted logs.** Server auth logs record a SHA-256 **fingerprint** of the
  email, never the address itself.
- **Crisis help** discloses that calls/texts appear in phone history while the
  online chat does not.

---

## 5. Operational security

- **Secrets** (`SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, Supabase URL/keys)
  are environment variables; production hard-fails rather than falling back to a
  dev secret. The service-role key must never reach the browser.
- **Database** access is server-side via the service role; RLS denies the anon
  role on every user table as defense in depth.
- **Migrations** must all be applied to production. A missing migration is the
  most likely operational failure (see the graceful-degradation safeguard above);
  verify the schema after each deploy.
- **Account deletion** permanently purges the user row (cascading to all records,
  media rows, contacts, and recovery codes) and removes stored media objects.

---

## 6. Dependency posture

- `npm audit` is run as part of review. As of this writing, the only remaining
  advisories are a **PostCSS** issue **inside Next.js's own build toolchain**
  (build-time CSS stringify; not reachable at runtime), whose only `audit fix`
  is a breaking Next downgrade — so it is tracked rather than applied. High-
  severity dev advisories (esbuild, ws) are patched.

---

## 7. Known limitations (please read before relying on this for safety)

This app supports documentation and planning; it is **not** a substitute for a
professional safety plan or legal advice. See §1 for what is out of scope. Note
especially: the day-view is plaintext, category metadata is unencrypted,
recording laws vary by state (the app links guidance), and a confiscated unlocked
device with the password entered is not protected.

---

## 8. Responsible disclosure

If you find a vulnerability, please email **security@bellemeadow.app** with:

- a description and the impact,
- steps to reproduce (a proof-of-concept if possible),
- any relevant logs or screenshots.

Please give us a reasonable window to remediate before public disclosure. We will
acknowledge receipt, keep you updated, and credit you if you wish. Given who this
app protects, we treat reports that could expose a user's identity or records as
the highest priority.

### Scope for an external audit
Authentication & session handling · the decoy/vault isolation boundary · all
client-side cryptography (`lib/crypto.ts`, `lib/auth.ts`) · the export/integrity
pipeline · media encryption & signed-URL access · RLS and server route
authorization · the absence of DV-identifying metadata in network/telemetry.
