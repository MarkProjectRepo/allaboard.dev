import type { SessionOptions } from "iron-session";

export interface SessionData {
  /** Set immediately after Google OAuth callback. */
  oauthAccountId?: string;
  /** Null / absent until onboarding is complete (handle chosen). */
  userId?: string;
}

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET environment variable is required in production.");
}

export const sessionOptions: SessionOptions = {
  // Must be at least 32 characters. Generate with: openssl rand -hex 32
  password: process.env.SESSION_SECRET ?? "dev-only-secret-do-not-use-in-production!!",
  cookieName: "allaboard_session",
  cookieOptions: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 30, // 30 days
  },
};
