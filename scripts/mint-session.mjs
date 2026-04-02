/**
 * Mint a valid iron-session cookie for pen testing.
 *
 * Usage:
 *   node scripts/mint-session.mjs <userId> [oauthAccountId]
 *
 * The SESSION_SECRET env var must match what the dev server is using.
 * Falls back to the hard-coded dev default when unset.
 *
 * Example:
 *   SESSION_SECRET=... node scripts/mint-session.mjs alice
 *   → allaboard_session=Fe26.2**...
 *
 * Pipe the output directly into curl:
 *   COOKIE=$(node scripts/mint-session.mjs alice)
 *   curl -H "Cookie: $COOKIE" -H "Origin: http://localhost:3000" \
 *        http://localhost:3000/api/users/alice
 */

import { sealData } from "iron-session";

const userId        = process.argv[2];
const oauthAccountId = process.argv[3] ?? "pentest-oauth-id";

if (!userId) {
  console.error("Usage: node scripts/mint-session.mjs <userId> [oauthAccountId]");
  process.exit(1);
}

const secret = process.env.SESSION_SECRET ?? "dev-only-secret-do-not-use-in-production!!";

const sealed = await sealData(
  { userId, oauthAccountId },
  { password: secret, ttl: 60 * 60 * 24 },
);

console.log(`allaboard_session=${sealed}`);
