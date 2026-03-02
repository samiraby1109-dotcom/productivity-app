import { NextRequest } from "next/server";
import { requireFullSession, apiError } from "@/lib/server-session";

/**
 * GET /api/resources?zip=64118
 *
 * Proxies to the 211 National Data Platform Search V2 API.
 * Requires RESOURCES_API_KEY env var — subscribe to "Search V2" (free) at
 * https://apiportal.211.org, then copy the Primary or Secondary key from
 * your Profile page.
 *
 * Auth: Azure APIM subscription key (Ocp-Apim-Subscription-Key header).
 *
 * If the key is absent, returns { source: "static" } so the client falls
 * back to the hardcoded KC shelter list — nothing breaks.
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

function extractString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parsePhone(obj: Record<string, unknown>): string {
  const phones = obj.phones ?? obj.phone_numbers;
  if (Array.isArray(phones) && phones.length > 0) {
    const first = phones[0] as Record<string, unknown>;
    return extractString(first, "number", "phone_number", "value") || "";
  }
  return extractString(obj, "phone", "phone_number", "telephone");
}

function parseAddress(obj: Record<string, unknown>): string {
  // Search V2 nests address under location.physical_address
  const loc = (obj.location ?? {}) as Record<string, unknown>;
  const addrObj = (
    loc.physical_address ?? obj.address ?? obj.physical_address ?? obj.location ?? {}
  ) as Record<string, unknown>;
  const line1 = extractString(addrObj, "address_1", "address1", "street", "street_address");
  const city  = extractString(addrObj, "city");
  const state = extractString(addrObj, "state_province", "state", "region");
  const zip   = extractString(addrObj, "postal_code", "zip", "zipcode");
  return [line1, city, state && zip ? `${state} ${zip}` : state || zip].filter(Boolean).join(", ");
}

function normalizeResult(r: Record<string, unknown>): LiveResource {
  // Search V2: service name nested under r.service.name; org under r.organization.name
  const service = (r.service ?? {}) as Record<string, unknown>;
  const org     = (r.organization ?? {}) as Record<string, unknown>;

  const name = extractString(service, "name", "service_name")
    || extractString(org, "name", "organization_name")
    || extractString(r, "service_name", "organization_name", "name", "program_name");

  const description = extractString(service, "description", "short_description")
    || extractString(r, "description", "short_description", "summary");

  const website = extractString(service, "url", "website")
    || extractString(org, "url", "website")
    || extractString(r, "website", "url", "web_address");

  return {
    id:            extractString(r, "id", "resource_id"),
    name,
    phone:         parsePhone(r),
    address:       parseAddress(r),
    description,
    website,
    distance_miles: typeof r.distance === "number" ? r.distance : null,
  };
}

async function query211(zip: string, keyword: string, apiKey: string): Promise<LiveResource[]> {
  // Search V2 POST — correct base URL confirmed from apiportal.211.org docs
  const endpoints = [
    "https://api.211.org/resources/v2/search/keyword",
    "https://api.211.org/search/v2",
    "https://api.211.org/search",
  ];

  for (const base of endpoints) {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: keyword,
        location: zip,
        distance: 30,
        per_page: 20,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) continue;
    if (res.status === 401 || res.status === 403) throw new Error("invalid_key");
    if (!res.ok) throw new Error(`211 API error: ${res.status}`);

    const body = await res.json() as Record<string, unknown>;

    let items: unknown[] = [];
    if (Array.isArray(body))              items = body;
    else if (Array.isArray(body.results)) items = body.results as unknown[];
    else if (Array.isArray(body.data))    items = body.data as unknown[];
    else if (Array.isArray(body.services))items = body.services as unknown[];
    else if (Array.isArray(body.records)) items = body.records as unknown[];

    return items
      .map((r) => normalizeResult(r as Record<string, unknown>))
      .filter((r) => r.name);
  }

  return [];
}

export async function GET(req: NextRequest) {
  try {
    await requireFullSession(req);

    const zip = req.nextUrl.searchParams.get("zip")?.replace(/\D/g, "").slice(0, 5) ?? "";
    if (!zip || zip.length < 5) return apiError(400, "Valid 5-digit ZIP required");

    const apiKey = process.env.RESOURCES_API_KEY;
    if (!apiKey) return Response.json({ source: "static" });

    // Progressively broader search terms
    let results = await query211(zip, "domestic violence shelter", apiKey);
    if (results.length === 0) results = await query211(zip, "domestic violence", apiKey);
    if (results.length === 0) results = await query211(zip, "intimate partner violence", apiKey);

    return Response.json({ source: "live", zip, results });

  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === "Unauthorized") return apiError(401, "Unauthorized");
      if (err.message === "invalid_key")  return apiError(500, "API key invalid or expired");
    }
    console.error("[/api/resources]", err);
    return Response.json({ source: "static" });
  }
}
