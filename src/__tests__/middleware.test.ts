/**
 * @jest-environment node
 *
 * Tests for src/middleware.ts — CORS enforcement and rate limiting.
 *
 * CORS: requests whose Origin is present but NOT in the allowlist are rejected
 * with 403. Requests with no Origin pass through (same-origin browser fetches
 * and server-side fetches are not cross-origin threats).
 *
 * Rate limiting: unauthenticated clients are limited to 25 req/min by IP;
 * authenticated clients (allaboard_session cookie present) are limited to
 * 250 req/min by session. These tests WILL FAIL if the checks are removed.
 */

import { middleware } from "@/middleware";
import { NextRequest, NextResponse } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(
  path: string,
  {
    method = "GET",
    origin,
    sessionCookie,
    ip,
  }: { method?: string; origin?: string; sessionCookie?: string; ip?: string } = {},
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const headers: Record<string, string> = {};
  if (origin)        headers["origin"]          = origin;
  if (ip)            headers["x-forwarded-for"] = ip;
  if (sessionCookie) headers["cookie"]          = `allaboard_session=${sessionCookie}`;
  return new NextRequest(url, { method, headers });
}

/** Send `n` requests from the same IP and return the last response. */
function exhaust(n: number, ip: string, sessionCookie?: string): NextResponse {
  let res!: NextResponse;
  for (let i = 0; i < n; i++) {
    res = middleware(req("/api/climbs", { ip, sessionCookie })) as NextResponse;
  }
  return res;
}

// ── Test isolation ────────────────────────────────────────────────────────────
// The rate-limit store lives on globalThis so it survives Next.js hot-module
// re-evaluation in dev. Clear it before each test for a clean slate.

beforeEach(() => {
  (globalThis as { __rateLimitStore?: Map<string, unknown> }).__rateLimitStore?.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── CORS — blocked origins ────────────────────────────────────────────────────

describe("CORS — blocked (disallowed) origins", () => {
  it("returns 403 for an arbitrary third-party origin", () => {
    expect(middleware(req("/api/climbs", { origin: "https://evil.example.com" })).status).toBe(403);
  });

  it("returns 403 for a subdomain not in the allowlist", () => {
    expect(middleware(req("/api/climbs", { origin: "https://api.allaboard.dev" })).status).toBe(403);
  });

  it("returns 403 for the http:// variant of a production domain", () => {
    expect(middleware(req("/api/climbs", { origin: "http://allaboard.dev" })).status).toBe(403);
  });
});

// ── CORS — no Origin passes through ──────────────────────────────────────────

describe("CORS — no Origin header passes through", () => {
  it("allows a GET with no Origin (same-origin browser fetch)", () => {
    const res = middleware(req("/api/climbs"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows a POST with no Origin", () => {
    expect(middleware(req("/api/sessions", { method: "POST" })).status).toBe(200);
  });
});

// ── CORS — allowed origins ────────────────────────────────────────────────────

describe("CORS — allowed origins", () => {
  const allowed = [
    "http://localhost:3000",
    "https://allaboard.dev",
    "https://www.allaboard.dev",
  ];

  for (const origin of allowed) {
    it(`passes through and sets CORS headers for ${origin}`, () => {
      const res = middleware(req("/api/climbs", { origin }));
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    });
  }
});

// ── CORS — OPTIONS preflight ──────────────────────────────────────────────────

describe("CORS — OPTIONS preflight", () => {
  it("returns 204 with CORS headers for an allowed origin", () => {
    const res = middleware(req("/api/climbs", { method: "OPTIONS", origin: "http://localhost:3000" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-methods")).toMatch(/PATCH/);
  });

  it("returns 204 without CORS headers for a disallowed origin", () => {
    const res = middleware(req("/api/climbs", { method: "OPTIONS", origin: "https://evil.example.com" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns 204 without CORS headers when no origin is present", () => {
    const res = middleware(req("/api/climbs", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

// ── CORS — navigation-exempt routes ──────────────────────────────────────────

describe("CORS — navigation-exempt routes", () => {
  const exemptPaths = [
    "/api/auth/google",
    "/api/auth/callback",
    "/api/auth/callback?code=abc&state=xyz",
    "/api/health",
  ];

  for (const path of exemptPaths) {
    it(`passes through ${path} without an Origin header`, () => {
      expect(middleware(req(path)).status).toBe(200);
    });
  }
});

// ── CORS — Vary header ────────────────────────────────────────────────────────

describe("CORS — Vary header", () => {
  it("sets Vary: Origin on allowed-origin responses", () => {
    const res = middleware(req("/api/climbs", { origin: "https://allaboard.dev" }));
    expect(res.headers.get("vary")).toBe("Origin");
  });
});

// ── Rate limiting — response headers ─────────────────────────────────────────

describe("Rate limiting — response headers", () => {
  it("includes X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on every allowed response", () => {
    const res = middleware(req("/api/climbs", { ip: "1.1.1.1" }));
    expect(res.headers.get("x-ratelimit-limit")).toBe("25");
    expect(res.headers.get("x-ratelimit-remaining")).not.toBeNull();
    expect(res.headers.get("x-ratelimit-reset")).not.toBeNull();
  });

  it("reports limit=250 for authenticated requests", () => {
    const res = middleware(req("/api/climbs", { sessionCookie: "tok", ip: "1.1.1.1" }));
    expect(res.headers.get("x-ratelimit-limit")).toBe("250");
  });

  it("X-RateLimit-Remaining decrements with each request", () => {
    const ip = "1.1.1.2";
    const r1 = middleware(req("/api/climbs", { ip }));
    const r2 = middleware(req("/api/climbs", { ip }));
    const r3 = middleware(req("/api/climbs", { ip }));
    expect(Number(r1.headers.get("x-ratelimit-remaining"))).toBe(24);
    expect(Number(r2.headers.get("x-ratelimit-remaining"))).toBe(23);
    expect(Number(r3.headers.get("x-ratelimit-remaining"))).toBe(22);
  });

  it("X-RateLimit-Reset is a Unix timestamp roughly 60 s in the future", () => {
    const before = Math.floor(Date.now() / 1000);
    const res = middleware(req("/api/climbs", { ip: "1.1.1.3" }));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    expect(reset).toBeGreaterThanOrEqual(before + 59);
    expect(reset).toBeLessThanOrEqual(before + 61);
  });

  it("includes rate-limit headers on 429 responses", () => {
    const ip = "1.1.1.4";
    exhaust(25, ip);
    const res = middleware(req("/api/climbs", { ip }));
    expect(res.status).toBe(429);
    expect(res.headers.get("x-ratelimit-limit")).toBe("25");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(res.headers.get("x-ratelimit-reset")).not.toBeNull();
  });

  it("Retry-After on 429 is the seconds until the window resets", () => {
    const now = 1_000_000_000_000; // fixed ms timestamp
    jest.spyOn(Date, "now").mockReturnValue(now);
    const ip = "1.1.1.5";
    exhaust(25, ip);
    const res = middleware(req("/api/climbs", { ip }));
    expect(res.status).toBe(429);
    // Window was opened on first request; resetAt = now + 60_000 ms = now + 60 s
    const retryAfter = Number(res.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(59);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });
});

// ── Rate limiting — unauthenticated (25 req/min by IP) ───────────────────────

describe("Rate limiting — unauthenticated (25 req/min by IP)", () => {
  it("allows the first 25 requests", () => {
    const ip = "2.0.0.1";
    const last = exhaust(25, ip);
    expect(last.status).toBe(200);
    expect(Number(last.headers.get("x-ratelimit-remaining"))).toBe(0);
  });

  it("blocks the 26th request with 429", () => {
    const ip = "2.0.0.2";
    exhaust(25, ip);
    expect(middleware(req("/api/climbs", { ip })).status).toBe(429);
  });

  it("returns a JSON error body on 429", async () => {
    const ip = "2.0.0.3";
    exhaust(25, ip);
    const body = await middleware(req("/api/climbs", { ip })).json();
    expect(body.error).toMatch(/too many requests/i);
  });

  it("keeps separate buckets per IP", () => {
    exhaust(25, "2.0.0.4");
    expect(middleware(req("/api/climbs", { ip: "2.0.0.4" })).status).toBe(429);
    // Different IP — untouched
    expect(middleware(req("/api/climbs", { ip: "2.0.0.5" })).status).toBe(200);
  });

  it("resets the counter after the window expires", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);
    const ip = "2.0.0.6";
    exhaust(25, ip);
    expect(middleware(req("/api/climbs", { ip })).status).toBe(429);

    // Advance time past the 60-second window
    jest.spyOn(Date, "now").mockReturnValue(now + 60_001);
    expect(middleware(req("/api/climbs", { ip })).status).toBe(200);
  });

  it("remaining is 0 on the last allowed request", () => {
    const ip = "2.0.0.7";
    const last = exhaust(25, ip);
    expect(last.headers.get("x-ratelimit-remaining")).toBe("0");
  });
});

// ── Rate limiting — authenticated (250 req/min by session) ───────────────────

describe("Rate limiting — authenticated (250 req/min by session)", () => {
  it("allows the first 250 requests", () => {
    const last = exhaust(250, "3.0.0.1", "sess-a");
    expect(last.status).toBe(200);
    expect(Number(last.headers.get("x-ratelimit-remaining"))).toBe(0);
  });

  it("blocks the 251st request with 429", () => {
    exhaust(250, "3.0.0.2", "sess-b");
    expect(middleware(req("/api/climbs", { sessionCookie: "sess-b", ip: "3.0.0.2" })).status).toBe(429);
  });

  it("keeps separate buckets per session token", () => {
    exhaust(250, "3.0.0.3", "sess-c");
    expect(middleware(req("/api/climbs", { sessionCookie: "sess-c", ip: "3.0.0.3" })).status).toBe(429);
    // Different session — untouched
    expect(middleware(req("/api/climbs", { sessionCookie: "sess-d", ip: "3.0.0.3" })).status).toBe(200);
  });

  it("resets the counter after the window expires", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);
    exhaust(250, "3.0.0.4", "sess-e");
    expect(middleware(req("/api/climbs", { sessionCookie: "sess-e", ip: "3.0.0.4" })).status).toBe(429);

    jest.spyOn(Date, "now").mockReturnValue(now + 60_001);
    expect(middleware(req("/api/climbs", { sessionCookie: "sess-e", ip: "3.0.0.4" })).status).toBe(200);
  });

  it("session bucket is independent from the IP bucket for the same IP", () => {
    const ip = "3.0.0.5";
    // Exhaust the unauthenticated bucket for this IP
    exhaust(25, ip);
    expect(middleware(req("/api/climbs", { ip })).status).toBe(429);

    // The same IP with a session uses a separate (auth) bucket — not blocked
    expect(middleware(req("/api/climbs", { sessionCookie: "sess-f", ip })).status).toBe(200);
  });
});

// ── Rate limiting — applies to navigation-exempt routes ──────────────────────

describe("Rate limiting — navigation-exempt routes are still rate-limited", () => {
  it("rate-limits /api/health", () => {
    const ip = "4.0.0.1";
    for (let i = 0; i < 25; i++) middleware(req("/api/health", { ip }));
    expect(middleware(req("/api/health", { ip })).status).toBe(429);
  });

  it("rate-limits /api/auth/google", () => {
    const ip = "4.0.0.2";
    for (let i = 0; i < 25; i++) middleware(req("/api/auth/google", { ip }));
    expect(middleware(req("/api/auth/google", { ip })).status).toBe(429);
  });

  it("counts requests across different paths in the same bucket", () => {
    // /api/health and /api/climbs share the same IP bucket
    const ip = "4.0.0.3";
    for (let i = 0; i < 20; i++) middleware(req("/api/health", { ip }));
    for (let i = 0; i < 5; i++) middleware(req("/api/climbs", { ip }));
    // 25 total — next request must be blocked regardless of path
    expect(middleware(req("/api/feed", { ip })).status).toBe(429);
  });
});
