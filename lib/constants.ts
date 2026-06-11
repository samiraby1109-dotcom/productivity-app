// ─── Session Modes ────────────────────────────────────────────────────────────
export const SESSION_MODES = {
  FULL: "FULL",
  DECOY: "DECOY",
} as const;

export type SessionMode = keyof typeof SESSION_MODES;

// ─── Routes ───────────────────────────────────────────────────────────────────
export const PUBLIC_ROUTES = ["/", "/login", "/onboarding", "/recover"];
export const DECOY_ALLOWED_ROUTES = ["/dashboard"];
export const FULL_ALLOWED_PREFIXES = [
  "/dashboard",
  "/tools",
  "/api/records",
  "/api/archive",
  "/api/media",
  "/api/export",
  "/api/contacts",
];

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const SESSION_COOKIE_NAME = "bellemeadow_wellness_session";
export const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

// ─── Archive ──────────────────────────────────────────────────────────────────
export const ARCHIVE_RETENTION_DAYS = 30;

// ─── Payload size ─────────────────────────────────────────────────────────────
// Limit on the base64-ish encrypted payload string. Real entries top out well
// below this; the cap exists so a misbehaving or malicious client can't pin
// the database / Postgres TOAST storage with multi-megabyte rows.
export const MAX_ENCRYPTED_PAYLOAD_BYTES = 256 * 1024; // 256 KB

// ─── Incident Types ───────────────────────────────────────────────────────────
export const INCIDENT_TYPES = [
  { key: "PHYSICAL_VIOLENCE", label: "Physical violence (hit, shove, restrain)" },
  { key: "THREATS_INTIMIDATION", label: "Threats / intimidation (including threats to harm self/others)" },
  { key: "PROPERTY_DAMAGE", label: "Property damage (breaking things, punching walls)" },
  { key: "STRANGULATION", label: "Strangulation / choking" },
  { key: "SEXUAL_VIOLENCE", label: "Sexual violence / coercion" },
  { key: "REPRODUCTIVE_CONTROL", label: "Reproductive control (pregnancy pressure, contraception interference)" },
  { key: "EMOTIONAL_VERBAL", label: "Emotional / verbal abuse (insults, humiliation, fear)" },
  { key: "GASLIGHTING_MANIPULATION", label: "Gaslighting / manipulation" },
  { key: "COERCIVE_CONTROL", label: "Coercive control / controlling rules (monitoring, demands, punishment)" },
  { key: "ISOLATION", label: "Isolation (kept from friends/family, restricted movement)" },
  { key: "STALKING", label: "Stalking (repeated unwanted contact causing fear)" },
  { key: "TECH_ABUSE_SURVEILLANCE", label: "Tech abuse / surveillance (tracking, spyware, account control)" },
  { key: "FINANCIAL_ECONOMIC", label: "Financial / economic abuse (money control, debt, blocked access)" },
  { key: "WORK_SCHOOL_SABOTAGE", label: "Work/school sabotage (prevented work, harassment at job)" },
  { key: "CHILD_RELATED_CONTROL", label: "Using children to control (threats, manipulation, triangulation)" },
  { key: "CUSTODY_INTERFERENCE", label: "Custody interference / parenting threats (withholding, not returning)" },
  { key: "LEGAL_SYSTEMS_ABUSE", label: "Legal/systems abuse (false reports, weaponizing courts/child services)" },
] as const;

export type IncidentTypeKey = (typeof INCIDENT_TYPES)[number]["key"];

// Presentation grouping for the entry form so 17 options aren't one daunting
// wall. Keys reference INCIDENT_TYPES; every key appears exactly once.
export const INCIDENT_TYPE_GROUPS: { label: string; keys: IncidentTypeKey[] }[] = [
  { label: "Physical & sexual", keys: ["PHYSICAL_VIOLENCE", "STRANGULATION", "SEXUAL_VIOLENCE", "REPRODUCTIVE_CONTROL"] },
  { label: "Emotional & psychological", keys: ["THREATS_INTIMIDATION", "EMOTIONAL_VERBAL", "GASLIGHTING_MANIPULATION", "PROPERTY_DAMAGE"] },
  { label: "Control & isolation", keys: ["COERCIVE_CONTROL", "ISOLATION", "STALKING", "TECH_ABUSE_SURVEILLANCE"] },
  { label: "Financial & work", keys: ["FINANCIAL_ECONOMIC", "WORK_SCHOOL_SABOTAGE"] },
  { label: "Children & legal", keys: ["CHILD_RELATED_CONTROL", "CUSTODY_INTERFERENCE", "LEGAL_SYSTEMS_ABUSE"] },
];

// ─── Entry Status ─────────────────────────────────────────────────────────────
export const ENTRY_STATUS = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  PURGED: "PURGED",
} as const;

export type EntryStatus = keyof typeof ENTRY_STATUS;

// ─── Media Kinds ──────────────────────────────────────────────────────────────
export const MEDIA_KINDS = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
} as const;

export type MediaKind = keyof typeof MEDIA_KINDS;
