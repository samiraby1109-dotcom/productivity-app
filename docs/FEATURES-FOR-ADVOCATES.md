# BelleMeadow — Features Overview for DV Advocates

*Prepared by Belle Meadow LLC. Shared in confidence for professional review.*

---

## What BelleMeadow is

BelleMeadow is a private safety and documentation app for survivors of domestic
violence — **disguised as an ordinary wellness / daily-tracker app.** On the
surface it looks and works like a simple tasks, notes, and habits tracker.
Behind a private password, it becomes a secure place to document abuse, store
evidence, plan for safety, and reach help.

Everything about it is built around one hard question: *what if the abuser is
holding the phone?* Every feature below traces back to that.

We'd genuinely value your eyes on the **tone, the local resources, and the
safety model** — you know things about survivors' real experience that we can't
design for from the outside.

---

## The five things most worth showing you first

1. **The disguise + the decoy code** — the app looks like a wellness tracker, and a
   separate 4-digit code opens a *fake* version with nothing sensitive in it.
2. **One-tap crisis help** — hotlines and local resources are one tap from the home screen.
3. **Everything private is encrypted on the device** — even we can't read a survivor's records.
4. **Court-ready evidence export** — a timeline PDF with a signable declaration and tamper-evidence.
5. **Trauma-informed guides and safety planning** — written to inform and empower, not alarm.

---

## A. Staying hidden (the disguise)

- **Looks like a wellness app.** The name, icon, and home screen are a neutral
  daily tracker (mood, tasks, habits, journal). Nowhere in the visible app do the
  words "abuse," "domestic violence," "safety plan," or similar appear until a
  survivor signs in privately.
  *Why: an abuser scrolling the phone should see nothing that raises suspicion.*

- **More than one "look."** A survivor can choose between different app identities
  (for example a wellness tracker or a plain notes/lists app), each with its own
  name and icon. New installs also start on a look at random.
  *Why: if an abuser has seen the app on one person's phone, it shouldn't be
  recognizable on the next.*

- **The decoy code.** In addition to a private password, the survivor sets a
  **4-digit code**. Entering that code opens a *believable, fully working* daily
  tracker — but the real records, contacts, and safety plan are completely hidden
  and cannot be reached. Nothing reveals that a private side even exists.
  *Why: if someone pressures a survivor to unlock the app, she can enter the decoy
  code and hand it over safely. This is the heart of "plausible deniability."*

- **The decoy is genuinely functional.** The everyday tracker actually works
  (you can add tasks, log mood, write a journal), so it holds up under scrutiny.

---

## B. Staying safe in the moment

- **Quick Exit button.** A tap instantly leaves the app for a neutral website and
  signs the survivor out, so returning requires the password again.
  *Why: for the moment someone walks up unexpectedly.*

- **Automatic lock.** The app locks itself after a short idle period **and the
  instant it's put away** (screen off, switching apps), then requires the password
  to reopen the private side.
  *Why: an unlocked phone left on a counter shouldn't expose anything.*

- **Privacy screen.** When the app is backgrounded, its contents are hidden from
  the phone's app-switcher preview.
  *Why: so a glance at recent apps reveals nothing.*

---

## C. Keeping a survivor's information private

- **Encrypted on the device ("end-to-end").** Records, contacts, and attached
  photos/videos/audio are scrambled on the survivor's own device *before* they're
  saved, using strong, industry-standard encryption. **We cannot read them** — a
  data breach or a curious insider would see only unreadable data.
  *Why: the survivor's trust shouldn't depend on trusting us.*

- **We never see the secrets.** The password, the decoy code, and recovery codes
  are never stored or seen by us in a usable form.

- **Protected sign-in.** Accounts lock temporarily after repeated wrong-password
  attempts, and sign-in attempts are rate-limited.
  *Why: to blunt someone guessing the password or the 4-digit code.*

- **Recovery codes.** At sign-up the survivor gets one-time recovery codes — the
  only way back in if the password is forgotten, and they keep existing records
  readable. A survivor can give one to a trusted advocate to hold.

- **Email-confirmed password reset.** Resetting a forgotten password needs **both**
  a recovery code **and** a confirmation link sent to the account email.
  *Why: so someone who finds a printed recovery code can't take over the account
  without also controlling the survivor's email.*

---

## D. Documenting what happened (Records)

- **Log an incident** with: a free-text account, the **date/time it occurred and
  the location** (kept separate from when it was logged), incident-type tags
  (e.g. physical, emotional, financial), and flags for police involvement,
  children present, or witnesses.
  *Why: the details that matter for a protection order or a case.*

- **Attach evidence** — photos, video, and audio, all encrypted.

- **Automatic photo-metadata removal.** Hidden location (GPS) and device data are
  stripped from photos by default, with an option to keep them for a specific file.
  *Why: a shared photo shouldn't leak where the survivor was — safety first, with
  a choice when evidence value matters.*

- **View or Save attachments.** "View" shows a file privately inside the app;
  "Save" downloads a copy so it can be sent to a lawyer or advocate — with a clear
  warning that a saved copy is no longer encrypted.

- **Deletion is forgiving.** Removed entries are recoverable for 30 days before
  they permanently delete.
  *Why: so nothing critical is lost in a moment of pressure or panic.*

---

## E. Court-ready export

A survivor can export their records as a **CSV**, a **PDF timeline**, or a **ZIP**
(records + the actual media files). The PDF is designed as a possible court exhibit:

- **A signable declaration** — a statement, under penalty of perjury, with the
  survivor's name, their state, and signature/date lines. *(The wording is a
  template; we explicitly tell survivors to confirm the exact declaration with an
  attorney.)*

- **A clear timeline** of entries in date order.

- **Two kinds of timestamps, kept honest and separate:** the date the survivor
  says the incident *occurred*, and the *independent date our system received the
  entry.* *Why: courts care a great deal about when a record was actually made.*

- **Tamper-evidence.** Every entry gets a unique digital fingerprint (SHA-256),
  and those are chained into a single document fingerprint printed on every page,
  along with "Page X of Y." **Changing any word, date, order, or attachment — or
  adding/removing a page — breaks the fingerprint.** Each attached photo also
  carries its own fingerprint so a specific file can be verified.
  *Why: it lets a survivor show the record hasn't been altered.*

- **Honest disclaimers** — the export is labeled as user-created content that the
  platform does not verify, and as information rather than legal advice.

---

## F. Getting help now (Crisis + Resources)

- **One-tap crisis help.** A "Get help now" block — the National DV Hotline, text
  options, and the 988 Suicide & Crisis Lifeline — is one tap from the home screen
  (and also on the Safety Plan page), with a note that calls/texts leave a trace
  in the phone but the online chat does not.

- **Local resources by ZIP.** Entering a ZIP code pulls up local services through
  a national directory of 3,300+ DV programs, alongside the always-visible national
  hotlines. *(Right now, hand-verified local listings are a Kansas City pilot;
  everywhere else uses the national directory. A broader local database is planned.)*

- **A private risk reflection** — a gentle, self-guided set of questions informed
  by domestic-violence lethality research, framed clearly as a reflection, **not**
  a diagnosis, a score, or a guarantee of safety.

---

## G. Learning and planning

- **Guides** (private, behind the password): "Is this abuse?", types of abuse, the
  cycle of abuse, early warning signs, why leaving is complicated, how to support
  someone, recording-consent laws, a glossary, the Power and Control Wheel, and a
  plain-language explainer of how the app's own safety features protect them.

- **Safety Plan:** guidance for when leaving isn't possible yet, a go-bag checklist
  (with a caveat to gather only what's safe to gather), and an escape-fund tracker
  — with a clear note that *leaving can be the highest-risk time* and encouragement
  to plan it with an advocate.

- **Trusted contacts:** a private, encrypted place to keep an advocate's,
  attorney's, or friend's details.

---

## H. Built to be used under stress

- **Accessibility:** works with screen readers, supports zoom and larger text,
  has readable contrast and comfortable tap targets, and asks for confirmation
  before anything permanent (like deleting a record).
  *Why: survivors use this on phones, sometimes older devices, often in a hurry.*

- **Trauma-informed tone throughout:** calm and non-alarming, never victim-blaming,
  with repeated, accurate reassurance — *you don't need documentation to leave;
  it's not your fault; people leave an average of seven times.*

---

## What's a pilot / current limitations (so we're upfront)

- Hand-verified **local resource listings are a Kansas City pilot**; other areas
  fall back to the national directory. Expanding this is a priority.
- The app is a **web app** — it can't override phone-level screenshot capture, so
  we advise survivors accordingly and suggest a safer device when a phone may be
  monitored.
- The court-export wording is a **template**; survivors are told to confirm
  specifics with an attorney.

---

## Questions we'd most love your feedback on

1. Does the **tone and wording** feel right and safe for survivors?
2. Are the **local resources** accurate and complete for our community?
3. Does the **disguise / decoy** match how survivors actually need to hide an app?
4. Would the **court export** be useful and credible in our local courts — and what
   declaration wording do you prefer?
5. How much access should a **trusted contact** ever have (we're weighing an
   "emergency, view/export-only" option)?
6. Anything that could unintentionally **increase risk** for someone using it?

---

*This document describes what the app does and why. Specific technical
implementation is proprietary to Belle Meadow LLC and is intentionally omitted.
Please treat this overview as confidential.*
