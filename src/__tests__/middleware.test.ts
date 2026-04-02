/**
 * @jest-environment node
 *
 * CORS enforcement tests for src/middleware.ts
 *
 * Requests whose Origin header is present but NOT in the allowlist are rejected
 * with 403 — this is the cross-origin threat (e.g. evil.com running JavaScript
 * with the user's cookies). Requests with no Origin (same-origin browser fetches,
 * server-side fetches, curl without -H "Origin:") are passed through; they are
 * not cross-origin threats because browsers enforce the same-origin policy on the
 * client side, and curl has no access to the user's session cookies.
 *
 * These tests WILL FAIL if the origin check is removed.
 */

import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(
  path: string,
  method = "GET",
  origin?: string,
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const headers: Record<string, string> = {};
  if (origin !== undefined) headers["origin"] = origin;
  return new NextRequest(url, { method, headers });
}

// ── Blocked origins ───────────────────────────────────────────────────────────

describe("CORS — blocked (disallowed) origins", () => {
  it("returns 403 for an arbitrary third-party origin", () => {
    const res = middleware(req("/api/climbs", "GET", "https://evil.example.com"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for a partial domain match", () => {
    // Subdomains not in the allowlist must be rejected
    const res = middleware(req("/api/climbs", "GET", "https://api.allaboard.dev"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for http:// variant of a production domain", () => {
    const res = middleware(req("/api/climbs", "GET", "http://allaboard.dev"));
    expect(res.status).toBe(403);
  });
});

// ── No Origin (same-origin browser / server-side / curl) ─────────────────────

describe("CORS — no Origin header passes through", () => {
  it("passes through a GET with no Origin (same-origin browser fetch)", () => {
    // Browsers omit Origin on same-origin GET requests — must not break the app
    const res = middleware(req("/api/climbs"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("passes through a POST with no Origin", () => {
    const res = middleware(req("/api/sessions", "POST"));
    expect(res.status).toBe(200);
  });
});

// ── Allowed origins ───────────────────────────────────────────────────────────

describe("CORS — allowed origins", () => {
  const allowed = [
    "http://localhost:3000",
    "https://allaboard.dev",
    "https://www.allaboard.dev",
  ];

  for (const origin of allowed) {
    it(`passes through and sets CORS headers for ${origin}`, () => {
      const res = middleware(req("/api/climbs", "GET", origin));
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    });
  }
});

// ── OPTIONS preflight ─────────────────────────────────────────────────────────

describe("CORS — OPTIONS preflight", () => {
  it("returns 204 with CORS headers for an allowed origin", () => {
    const res = middleware(req("/api/climbs", "OPTIONS", "http://localhost:3000"));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-methods")).toMatch(/PATCH/);
  });

  it("returns 204 without CORS headers for a disallowed origin", () => {
    const res = middleware(req("/api/climbs", "OPTIONS", "https://evil.example.com"));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns 204 without CORS headers when no origin is present", () => {
    const res = middleware(req("/api/climbs", "OPTIONS"));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

// ── Exempt routes (browser navigations) ──────────────────────────────────────

describe("CORS — navigation-exempt routes", () => {
  const exemptPaths = [
    "/api/auth/google",
    "/api/auth/callback",
    "/api/auth/callback?code=abc&state=xyz",
    "/api/health",
  ];

  for (const path of exemptPaths) {
    it(`passes through ${path} without an Origin header`, () => {
      const res = middleware(req(path));
      expect(res.status).toBe(200);
    });
  }
});

// ── Vary header ───────────────────────────────────────────────────────────────

describe("CORS — Vary header", () => {
  it("sets Vary: Origin on allowed-origin responses so caches don't serve wrong-origin data", () => {
    const res = middleware(req("/api/climbs", "GET", "https://allaboard.dev"));
    expect(res.headers.get("vary")).toBe("Origin");
  });
});
