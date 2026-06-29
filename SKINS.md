# Cover "Skins" — design & status

> Internal document — do not share publicly.

## Why

In the DV threat model, an abuser who has seen this app on one survivor's phone
should not be able to recognize it on another's. The defense is varying the
**cover identity** — name, wordmark, accent, and (eventually) icon — not just a
color tweak. This scaffold makes the app re-skin from a single source of truth so
we can ship 2–4 believable covers.

## What's implemented (scaffold)

- **Registry** — `lib/covers.ts` defines the covers (currently 2: `belle`,
  `daybook`). Each cover has a name, short name, title suffix, tagline, theme
  color, and a swatch. Plain module so server components can import it.
- **Theming** — `app/globals.css` defines an accent **ramp per cover** under
  `[data-cover="<id>"]`; `tailwind.config.ts` maps `brand-*` to those CSS
  variables. Setting one attribute on `<html>` re-themes the whole app. The
  default (`:root` = `belle`) is byte-for-byte the previous sage palette, so
  nothing changes unless another cover is chosen.
- **Runtime apply** — `components/CoverProvider.tsx` reads the saved cover
  (per-device `localStorage`), sets `data-cover`, the document title, and the
  `<meta theme-color>`, and exposes `useCover()`. A small inline script in the
  root layout applies the accent **before first paint** (no flash).
- **Wordmark** — `components/CoverLogo.tsx` renders the image logo for the
  default cover and a styled text wordmark for others; `CoverName` is a text-only
  variant used on the landing page.
- **Selection** — `components/CoverPicker.tsx` ("Choose your look") appears at
  onboarding (account step) and under **Tools → Account security → Appearance**,
  framed as ordinary theming.

## To fully finish each cover (production follow-ups)

These are intentionally **not** in the scaffold and need design/asset work:

1. **Per-cover app icon + installed name.** The PWA `manifest.json` and the
   iOS `apple-mobile-web-app-title` are static, so the *installed* icon/name
   don't vary yet. Options: serve a per-cover manifest (e.g. `/manifest?cover=…`
   via a route handler) and swap icon `<link>`s at boot. This is the highest-value
   remaining piece — the home-screen icon is what an abuser sees first.
2. **Per-cover logo images.** Replace the text wordmark fallback with a real logo
   asset per cover.
3. **Decoy-content depth.** The cover dashboard (tasks/notes/habits) is generic
   enough to fit both current covers. A cover that implies different content
   (e.g. a recipe or budget app) would need matching decoy data to stay
   believable — scope each new cover with an advocate.
4. **Neutral email templates per cover.** `lib/email.ts` is hardcoded to the
   BelleMeadow name; tie it to the cover if covers diverge by account.

## Adding a cover

1. Add an entry to `COVERS` in `lib/covers.ts`.
2. Add a matching `[data-cover="<id>"]` accent ramp in `app/globals.css`.
3. (Production) add its icon set + manifest handling and a logo asset.

## Guardrails (keep these true)

- The **vault UX never changes** between covers — only the disguise. Survivors
  rely on muscle memory under stress.
- All cover names/taglines stay neutral — never hint at the app's true purpose.
- Start with **2 strong covers**, not 4 thin ones. Each must be believable on its
  own or the disguise becomes a tell.
