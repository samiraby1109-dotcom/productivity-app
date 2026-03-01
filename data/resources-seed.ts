/**
 * Curated local support resources seed.
 * Kansas City metro area + national hotlines.
 * Expand by adding more ZIP entries or state-level entries.
 * All data is static — no web scraping, no Google lookups.
 */

export interface Resource {
  name: string;
  phone: string;
  website?: string;
  description: string;
  zip_codes?: string[]; // covered ZIP codes or "ALL" for national
  national: boolean;
}

export const RESOURCES: Resource[] = [
  // ─── National ─────────────────────────────────────────────────────────────
  {
    name: "National Support Line",
    phone: "1-800-799-7233",
    website: "https://www.thehotline.org",
    description: "24/7 confidential support. Chat also available at thehotline.org. TTY: 1-800-787-3224.",
    national: true,
  },
  {
    name: "Crisis Text Line",
    phone: "Text HOME to 741741",
    description: "Free, 24/7 crisis counseling via text message.",
    national: true,
  },
  {
    name: "RAINN",
    phone: "1-800-656-4673",
    website: "https://www.rainn.org",
    description: "Sexual assault support and referrals. 24/7.",
    national: true,
  },
  {
    name: "WomensLaw.org Legal Help",
    phone: "",
    website: "https://www.womenslaw.org",
    description: "State-by-state legal information. Not legal advice.",
    national: true,
  },
  {
    name: "StrongHearts Native Helpline",
    phone: "1-844-762-8483",
    website: "https://www.strongheartshelpline.org",
    description: "Culturally appropriate support for Native Americans. 24/7.",
    national: true,
  },

  // ─── Kansas City metro ─────────────────────────────────────────────────────
  {
    name: "Synergy Services",
    phone: "(816) 587-4100",
    website: "https://www.synergyservices.org",
    description: "Emergency shelter, crisis hotline, and advocacy for the Northland (North KC / Platte / Clay County). Available 24/7.",
    zip_codes: ["64118", "64119", "64150", "64151", "64152", "64153", "64154", "64155", "64156", "64157", "64158", "64164", "64165", "64166", "64167", "64168", "64079", "64080", "64075", "64118"],
    national: false,
  },
  {
    name: "Newhouse KC",
    phone: "(816) 471-5800",
    website: "https://newhousekc.org",
    description: "Kansas City's longest-running DV shelter. Emergency shelter, counseling, legal advocacy, and transitional housing. 24/7 crisis line.",
    zip_codes: ["64101", "64102", "64105", "64106", "64108", "64109", "64110", "64111", "64112", "64113", "64114", "64116", "64117", "64118", "64119", "64120", "64123", "64124", "64125", "64126", "64127", "64128", "64129", "64130", "64131", "64132", "64133", "64134", "64136", "64137", "64138", "64139"],
    national: false,
  },
  {
    name: "Rose Brooks Center",
    phone: "(816) 861-6100",
    website: "https://www.rosebrooks.org",
    description: "Emergency shelter, legal advocacy, counseling. Kansas City, MO.",
    zip_codes: ["64101", "64102", "64106", "64108", "64109", "64110", "64111", "64112", "64113", "64114", "64115", "64116", "64117", "64118", "64119", "64120", "64123", "64124", "64125", "64126", "64127", "64128", "64129", "64130", "64131", "64132", "64133", "64134", "64136", "64137", "64138", "64139", "64145", "64146", "64147", "64149", "64150", "64151", "64152", "64153", "64154", "64155", "64156", "64157", "64158"],
    national: false,
  },
  {
    name: "Hope House",
    phone: "(816) 461-4673",
    website: "https://www.hopehouse.net",
    description: "Shelter and services for survivors. Lee's Summit / Eastern Jackson County, MO.",
    zip_codes: ["64063", "64064", "64065", "64081", "64082", "64083", "64086"],
    national: false,
  },
  {
    name: "Safehome",
    phone: "(913) 262-2868",
    website: "https://www.safehome-ks.org",
    description: "Shelter, legal help, counseling. Johnson County, KS.",
    zip_codes: ["66062", "66202", "66203", "66204", "66205", "66206", "66207", "66208", "66209", "66210", "66211", "66212", "66213", "66214", "66215", "66216", "66217", "66218", "66219", "66220", "66221", "66222", "66223", "66224", "66225", "66226", "66227"],
    national: false,
  },
  {
    name: "The Shelter KC",
    phone: "(816) 474-6446",
    description: "Emergency shelter and crisis services. Kansas City metro.",
    zip_codes: ["64101", "64108", "64109", "64110"],
    national: false,
  },
];

/** Return resources for a given ZIP code plus all national resources. */
export function getResourcesByZip(zip: string): Resource[] {
  const local = RESOURCES.filter(
    (r) => !r.national && r.zip_codes?.includes(zip)
  );
  const national = RESOURCES.filter((r) => r.national);
  return [...national, ...local];
}
