import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://allaboard.dev",
  "https://www.allaboard.dev",
  "http://localhost:3000",
]);

/**
 * Routes that browsers navigate to directly — no Origin header is sent.
 * These are exempt from the CORS origin check.
 */
const NAVIGATION_PREFIXES = [
  "/api/auth/google",
  "/api/auth/callback",
  "/api/health",
];

/**
 * When Origin is absent the request is either:
 *   - A same-origin browser fetch (browsers omit Origin on same-origin GET requests)
 *   - A server-side fetch from Next.js route handlers or RSC
 *   - A direct browser navigation
 * None of these are cross-origin threats, so we let them through.
 *
 * We only reject when Origin IS present but NOT in the allowlist — that is the
 * signature of a cross-origin JavaScript request from a disallowed domain.
 */

function applyCORSHeaders(res: NextResponse, origin: string): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth redirect routes — browser navigates to these, no Origin present
  if (NAVIGATION_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin");

  // Preflight — always respond; only include CORS headers for allowed origins
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (origin && ALLOWED_ORIGINS.has(origin)) applyCORSHeaders(res, origin);
    return res;
  }

  // If Origin is set but not in the allowlist, it's a cross-origin request
  // from a disallowed domain — reject it.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // No Origin (same-origin browser fetch / server-side fetch) or allowed Origin
  const res = NextResponse.next();
  if (origin) applyCORSHeaders(res, origin);
  return res;
}

export const config = { matcher: "/api/:path*" };
