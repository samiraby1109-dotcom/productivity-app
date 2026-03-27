import { describe, it, expect, vi, beforeEach } from "vitest";
import { getClientIp } from "@/lib/rate-limit";

// ─── getClientIp ──────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  it("returns first IP from x-forwarded-for", () => {
    const req = { headers: { get: (name: string) => name === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null } };
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const req = { headers: { get: (name: string) => name === "x-forwarded-for" ? "  9.9.9.9  , 1.1.1.1" : null } };
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = {
      headers: {
        get: (name: string) => {
          if (name === "x-real-ip") return "10.0.0.1";
          return null;
        },
      },
    };
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const req = { headers: { get: () => null } };
    expect(getClientIp(req)).toBe("unknown");
  });
});

// ─── checkRateLimit ───────────────────────────────────────────────────────────

// We mock the db module so tests never touch a real Supabase instance.
vi.mock("@/lib/db", () => ({
  createServiceClient: vi.fn(),
}));

import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/db";

function makeDb(rpcResult: { data: number | null; error: { message: string } | null }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkRateLimit", () => {
  it("allows request when count is within limit", async () => {
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({ data: 3, error: null }));
    const allowed = await checkRateLimit("login:1.2.3.4", 10);
    expect(allowed).toBe(true);
  });

  it("allows request when count exactly equals limit", async () => {
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({ data: 10, error: null }));
    const allowed = await checkRateLimit("login:1.2.3.4", 10);
    expect(allowed).toBe(true);
  });

  it("blocks request when count exceeds limit", async () => {
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({ data: 11, error: null }));
    const allowed = await checkRateLimit("login:1.2.3.4", 10);
    expect(allowed).toBe(false);
  });

  it("fails open (allows) when DB returns an error", async () => {
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb({ data: null, error: { message: "connection refused" } })
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const allowed = await checkRateLimit("login:1.2.3.4", 10);
    expect(allowed).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[rate-limit]"), expect.any(String));
    warnSpy.mockRestore();
  });

  it("fails open (allows) when db.rpc throws", async () => {
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: vi.fn().mockRejectedValue(new Error("network timeout")),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const allowed = await checkRateLimit("register:1.2.3.4", 5);
    expect(allowed).toBe(true);
    warnSpy.mockRestore();
  });

  it("passes correct key and windowStart to rpc", async () => {
    const db = makeDb({ data: 1, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db);

    const before = Math.floor(Date.now() / 60_000);
    await checkRateLimit("test:key", 5);
    const after = Math.floor(Date.now() / 60_000);

    const call = db.rpc.mock.calls[0];
    expect(call[0]).toBe("increment_rate_limit");
    expect(call[1].p_key).toBe("test:key");
    expect(call[1].p_window_start).toBeGreaterThanOrEqual(before);
    expect(call[1].p_window_start).toBeLessThanOrEqual(after);
  });
});
