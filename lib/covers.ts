/**
 * Cover "skins" — multiple disguises for the app so it doesn't always present the
 * same name/look. The point (DV threat model) is that an abuser who has seen the
 * app on one survivor's phone shouldn't recognize it on another's. What actually
 * defeats recognition is varying the COVER IDENTITY (name + accent + eventually
 * icon), not just colors — so each cover changes the wordmark, the document
 * title, the theme color, and the accent palette together.
 *
 * The accent RAMP for each cover lives in globals.css under `[data-cover="<id>"]`
 * (the styling source of truth). This module holds the identity + a single swatch
 * colour used for the picker preview and the runtime <meta theme-color>.
 *
 * This is a plain module (no "use client") so server components — the root layout
 * and the public landing page — can import it for their default render.
 */

export interface Cover {
  /** Stable id; also the value of the `data-cover` attribute and the accent ramp selector. */
  id: string;
  /** Full display name / wordmark. */
  name: string;
  /** Short name (installed app label / tight spaces). */
  shortName: string;
  /** Suffix appended to the document title, e.g. "Daily Tracker". */
  titleSuffix: string;
  /** One-line neutral tagline for the landing/cover. */
  tagline: string;
  /** Hex used for the runtime <meta name="theme-color"> and PWA chrome. */
  themeColor: string;
  /** Representative accent hex for the cover picker swatch (mirrors --brand-500). */
  swatch: string;
}

export const COVERS: Cover[] = [
  {
    id: "belle",
    name: "BelleMeadow Wellness",
    shortName: "BelleMeadow",
    titleSuffix: "Daily Tracker",
    tagline: "Tasks, notes, and habits in one quiet place.",
    themeColor: "#4f6b54",
    swatch: "#648469",
  },
  {
    id: "daybook",
    name: "Daybook",
    shortName: "Daybook",
    titleSuffix: "Notes & Lists",
    tagline: "Notes and lists for your day.",
    themeColor: "#45597a",
    swatch: "#566f92",
  },
];

/** The cover used by default (server render + first paint). */
export const DEFAULT_COVER_ID = "belle";

/** localStorage key holding the chosen cover id (per device — the cover is what
 *  this device shows; it is not tied to the encrypted account). */
export const COVER_STORAGE_KEY = "bw_cover";

/** Resolve a cover id to a Cover, falling back to the default for unknown/empty ids. */
export function getCover(id: string | null | undefined): Cover {
  return COVERS.find((c) => c.id === id) ?? COVERS[0];
}

/** Full document title for a cover. */
export function coverTitle(cover: Cover): string {
  return `${cover.name} — ${cover.titleSuffix}`;
}
