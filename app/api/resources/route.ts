import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";

/**
 * GET /api/resources?zip=64118
 *
 * Proxies to the 211 National Data Platform API to find local DV services.
 * Requires RESOURCES_API_KEY env var (free — register at https://apiportal.211.org).
 *
 * If the key is absent the route returns { source: "static" } and the client
 * falls back to the hardcoded KC resource list so the app still works during
 * development or before the key is configured.
 */

export interface LiveResource {
  id: string;
  name: string;
  phone: string;
  address: string;
  description: string;
  website: string;
  distance_miles: number | null;
}

// 211 HSDS-standard response — field names vary slightly across implementations
// so we try multiple candidates for each field.
function extractString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parsePhone(obj: Record<string, unknown>): string {
  // phones may be an array of { number } objects, or a flat string
  const phones = obj.phones ?? obj.phone_numbers;
  if (Array.isArray(phones) && phones.length > 0) {
    const first = phones[0] as Record<string, unknown>;
    return extractString(first, "number", "phone_number", "value") || "";
  }
  return extractString(obj, "phone", "phone_number", "telephone");
}

function parseAddress(obj: Record<string, unknown>): string {
  // address may be nested or flat
  const addrObj = (obj.address ?? obj.location ?? obj.physical_address ?? {}) as Record<string, unknown>;
  const line1 = extractString(addrObj, "address_1", "address1", "street", "street_address", "line1");
  const city  = extractString(addrObj, "city");
  const state = extractString(addrObj, "state_province", "state", "region");
  const zip   = extractString(addrObj, "postal_code", "zip", "zipcode");
  return [line1, city, state && zip ? `${state} ${zip}` : state || zip].filter(Boolean).join(", ");
}

function normalizeResult(r: Record<string, unknown>): LiveResource {
  return {
    id:            extractString(r, "id", "resource_id"),
    name:          extractString(r, "service_name", "organization_name", "name", "program_name", "agency_name"),
    phone:         parsePhone(r),
    address:       parseAddress(r),
    description:   extractString(r, "description", "short_description", "summary", "service_description"),
    website:       extractString(r, "website", "url", "web_address"),
    distance_miles: typeof r.distance === "number" ? r.distance : null,
  };
}

async function query211(zip: string, keyword: string, apiKey: string): Promise<LiveResource[]> {
  const url = new URL("https://api.211.org/search");
  url.searchParams.set("query", keyword);
  url.searchParams.set("location", zip);
  url.searchParams.set("distance", "30");
  url.searchParams.set("per_page", "20");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    // 8 second timeout
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("invalid_key");
    if (res.status === 404) return []; // no results
    throw new Error(`211 API error: ${res.status}`);
  }

  const body = await res.json() as Record<string, unknown>;

  // Response may be { results: [...] } or { data: [...] } or a bare array
  let items: unknown[] = [];
  if (Array.isArray(body)) {
    items = body;
  } else if (Array.isArray(body.results)) {
    items = body.results as unknown[];
  } else if (Array.isArray(body.data)) {
    items = body.data as unknown[];
  } else if (Array.isArray(body.services)) {
    items = body.services as unknown[];
  }

  return items
    .map((r) => normalizeResult(r as Record<string, unknown>))
    .filter((r) => r.name); // drop results with no name
}

export async function GET(req: NextRequest) {
  try {
    await requireFullSession(req);

    const zip = req.nextUrl.searchParams.get("zip")?.replace(/\D/g, "").slice(0, 5) ?? "";
    if (!zip || zip.length < 5) return apiError(400, "Valid 5-digit ZIP required");

    const apiKey = process.env.RESOURCES_API_KEY;

    // No API key configured — tell the client to use the static fallback
    if (!apiKey) {
      return Response.json({ source: "static" });
    }

    // Try specific keyword first, then broader fallback
    let results = await query211(zip, "domestic violence shelter", apiKey);
    if (results.length === 0) {
      results = await query211(zip, "domestic violence", apiKey);
    }
    if (results.length === 0) {
      results = await query211(zip, "intimate partner violence shelter", apiKey);
    }

    return Response.json({ source: "live", zip, results });

  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === "Unauthorized") return apiError(401, "Unauthorized");
      if (err.message === "invalid_key") return apiError(500, "API key invalid or expired");
    }
    console.error("[/api/resources]", err);
    // On any failure fall back gracefully — client will show static list
    return Response.json({ source: "static" });
  }
}
