# Allaboard — Claude Code Instructions

## Project Overview

Allaboard is a climbing community platform for logging sessions, sharing climbs, and tracking stats. It's a Next.js frontend backed by an Express.js API and PostgreSQL database.

**Auth:** Google OAuth (MVP). The `alex_sends` hardcoded user is a legacy placeholder — replace with session-based current user as auth is wired up.

---

## Architecture

```
/
├── src/
│   ├── app/
│   │   ├── api/            # Next.js Route Handlers (replaces Express API)
│   │   │   ├── climbs/route.ts
│   │   │   ├── climbs/[id]/route.ts
│   │   │   ├── users/route.ts
│   │   │   ├── users/[handle]/route.ts
│   │   │   ├── sessions/route.ts
│   │   │   ├── log-entries/route.ts
│   │   │   ├── feed/route.ts
│   │   │   ├── stats/[userId]/route.ts
│   │   │   ├── auth/me/route.ts
│   │   │   ├── auth/logout/route.ts
│   │   │   ├── auth/google/route.ts
│   │   │   └── auth/callback/route.ts
│   │   └── (pages)/        # UI pages
│   ├── components/         # Shared UI components
│   └── lib/
│       ├── types.ts        # Shared TypeScript interfaces
│       ├── utils.ts        # timeAgo(), GRADE_COLORS, ALL_GRADES
│       ├── auth-context.tsx # AuthProvider + useAuth hook
│       ├── server/
│       │   ├── db.ts       # Knex instance (server-only, never imported by client)
│       │   └── stats.ts    # computeStats logic
│       └── db/
│           ├── index.ts    # Re-exports from ./remote
│           └── remote.ts   # fetch() calls to /api/* (client-side data layer)
└── api/                    # Migration CLI tooling only (no server code)
    ├── migrations/         # Knex migration files
    ├── seeds/              # Seed data
    └── knexfile.ts         # Knex CLI config
```

### Key rule: server vs client imports
- `src/lib/server/*` — **server-only**. Contains Knex and DB queries. Never import in components or client code.
- `src/lib/db/remote.ts` — **client-safe**. Uses `fetch()` to call `/api/*`. This is what components import.
- `src/app/api/*/route.ts` — **route handlers**. Server-side. Import from `src/lib/server/*`.

---

## Development

```bash
npm run dev
```
Runs Next.js only (port 3000). API routes are served by Next.js at `/api/*`.

---

## Database

**Engine:** PostgreSQL (local: `localhost:5432`, database `allaboard`)
**ORM:** Knex with TypeScript migrations
**Connection:** `DATABASE_URL` env var, or defaults to local postgres

### Common DB commands (run from `api/` or use `--prefix api`)
```bash
npm run migrate --prefix api        # Run pending migrations
npm run rollback --prefix api       # Roll back last migration
npm run seed --prefix api           # Run seeds
npm run db:reset --prefix api       # Rollback + migrate + seed

# First-time setup
npm run db:create --prefix api      # Create the database
npm run db:ping --prefix api        # Check postgres connection
```

### Create a new migration
```bash
cd api && npx tsx knexfile.ts migrate:make <migration_name>
```
Migration files go in `api/migrations/` and are named `YYYYMMDDHHMMSS_description.ts`.

### Migrations that have run (in order)
1. `20260314000001_create_users` — users table
2. `20260314000002_create_climbs` — climbs table
3. `20260314000003_create_beta_videos` — beta_videos table
4. `20260314000004_create_sessions` — climbing sessions table
5. `20260314000005_create_log_entries` — log_entries table
6. `20260328000001_add_auth_fields_to_users` — adds `email`, `profile_picture_url` to users
7. `20260328000002_create_oauth_accounts` — Google OAuth identity → user link
8. `20260328000003_create_auth_sessions` — web login sessions (HttpOnly cookie)
9. `20260328000004_add_picture_to_oauth_accounts` — adds `profile_picture_url` to oauth_accounts (available before users row exists)

---

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | text | primary key (handle-based) |
| handle | text | unique |
| display_name | text | |
| avatar_color | text | Tailwind color class |
| bio | text | |
| home_board | text | Kilter / Moonboard |
| home_board_angle | integer | |
| joined_at | timestamp | |
| followers_count | integer | |
| following_count | integer | |
| personal_best_kilter | text | grade string |
| personal_best_moonboard | text | grade string |

### `climbs`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | primary key |
| name | text | |
| grade | text | V0–V16 |
| board_type | text | Kilter / Moonboard |
| angle | integer | |
| description | text | |
| author | text | FK → users.id |
| setter | text | |
| sends | integer | incremented on log |
| created_at | timestamp | |

### `beta_videos`
| Column | Type | Notes |
|--------|------|-------|
| id | increments | primary key |
| climb_id | UUID | FK → climbs.id |
| url | text | |
| thumbnail | text | |
| platform | text | instagram / youtube |
| credit | text | |
| sort_order | integer | |

### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | primary key |
| user_id | text | FK → users.id |
| date | date | unique with user_id |
| board_type | text | |
| angle | integer | |
| duration_minutes | integer | |
| feel_rating | integer | 1–5 |

### `log_entries`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | primary key |
| session_id | UUID | FK → sessions.id |
| climb_id | UUID | FK → climbs.id |
| user_id | text | FK → users.id |
| date | date | |
| attempts | integer | |
| sent | boolean | |
| notes | text | |

---

## Authentication

### Provider
Google OAuth 2.0 only (MVP). Uses Google Cloud Web Application credentials.

### Session cookie
- Name: `allaboard_session` (suggested)
- HttpOnly, Secure, SameSite=Lax
- Value: `auth_sessions.session_token` (UUID or random token)
- Expiry: 30 days (rolling or fixed — TBD)

### Auth flow

```
1. User clicks "Login with Google"
2. Redirect to Google OAuth consent screen
3. Google redirects back to /api/auth/callback?code=...
4. API exchanges code for tokens, decodes ID token to get:
     sub (provider_user_id), email, picture
5a. Existing user (oauth_accounts row with user_id set):
     → Create auth_sessions row, set cookie, redirect to /
5b. New Google account (no oauth_accounts row):
     → Create oauth_accounts row (user_id = null)
     → Create auth_sessions row (user_id = null)
     → Set cookie, redirect to /onboarding
5c. Returning user mid-onboarding (oauth_accounts.user_id = null):
     → Same as 5b redirect to /onboarding
6. Onboarding: user picks a unique handle
     → Create users row, set oauth_accounts.user_id, set auth_sessions.user_id
     → Redirect to /
7. Logout: DELETE auth_sessions row, clear cookie
```

### Resolving the current user on the API
```typescript
// Pseudo-code for any authenticated route
const token = req.cookies.allaboard_session;
const session = await db("auth_sessions")
  .where({ session_token: token })
  .where("expires_at", ">", new Date())
  .first();
if (!session) return res.status(401).json({ error: "Unauthenticated" });
// session.user_id is null → onboarding incomplete
// session.user_id is set → fully authenticated user
```

### Auth tables

#### `oauth_accounts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | primary key |
| provider | text | `'google'` |
| provider_user_id | text | Google `sub` claim; unique per provider |
| email | text | from Google ID token |
| user_id | text | FK → users.id, **null until onboarding complete** |
| access_token | text | nullable; encrypt at rest in production |
| refresh_token | text | nullable; encrypt at rest in production |
| token_expires_at | timestamp | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `auth_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | primary key |
| session_token | text | unique; stored in HttpOnly cookie |
| oauth_account_id | UUID | FK → oauth_accounts.id (CASCADE delete) |
| user_id | text | FK → users.id, **null until onboarding complete** |
| expires_at | timestamp | |
| created_at | timestamp | |

#### Users table additions (migration 6)
| Column | Type | Notes |
|--------|------|-------|
| email | text | nullable; from Google |
| profile_picture_url | text | nullable; Google account photo URL |

### Unauthenticated access rules
- Activity feed: visible (but cannot filter to "following" only)
- Climb directory: visible
- Climb detail: visible
- Logging a climb: requires auth
- Profile page: requires auth
- Stats page: requires auth
- Navbar profile icon: shows "Login" link when logged out

---

## API Endpoints

All routes are Next.js Route Handlers served under `/api/*` by the Next.js dev server and Vercel in production.

| Method | Path | Handler file |
|--------|------|-------------|
| GET | `/api/health` | `src/app/api/health/route.ts` |
| GET | `/api/climbs` | `src/app/api/climbs/route.ts` |
| POST | `/api/climbs` | `src/app/api/climbs/route.ts` |
| GET | `/api/climbs/:id` | `src/app/api/climbs/[id]/route.ts` |
| GET | `/api/users` | `src/app/api/users/route.ts` |
| GET | `/api/users/:handle` | `src/app/api/users/[handle]/route.ts` |
| PATCH | `/api/users/:handle` | `src/app/api/users/[handle]/route.ts` |
| GET | `/api/sessions?userId=` | `src/app/api/sessions/route.ts` |
| POST | `/api/sessions` | `src/app/api/sessions/route.ts` |
| POST | `/api/log-entries` | `src/app/api/log-entries/route.ts` |
| GET | `/api/feed?userId=` | `src/app/api/feed/route.ts` |
| GET | `/api/stats/:userId` | `src/app/api/stats/[userId]/route.ts` |
| GET | `/api/auth/me` | `src/app/api/auth/me/route.ts` |
| POST | `/api/auth/logout` | `src/app/api/auth/logout/route.ts` |
| GET | `/api/auth/google` | `src/app/api/auth/google/route.ts` |
| GET | `/api/auth/callback` | `src/app/api/auth/callback/route.ts` |

---

## Frontend Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Home feed |
| `/climbs` | `src/app/climbs/page.tsx` | Climb directory with filters |
| `/climbs/[id]` | `src/app/climbs/[id]/page.tsx` | Climb detail + beta videos |
| `/climbs/new` | `src/app/climbs/new/page.tsx` | Submit new climb |
| `/profile` | `src/app/profile/page.tsx` | Current user profile |
| `/stats` | `src/app/stats/page.tsx` | Stats dashboard |

---

## Key Types (`src/lib/types.ts`)

```typescript
type Grade = "V0" | "V1" | ... | "V16"
type BoardType = "Kilter" | "Moonboard"

interface Climb { id, name, grade, boardType, angle, description, betaVideos, author, setter, createdAt, sends }
interface User { id, handle, displayName, avatarColor, bio, homeBoard, homeBoardAngle, joinedAt, followersCount, followingCount, personalBests }
interface Session { id, userId, date, boardType, angle, durationMinutes, logEntries, feelRating }
interface LogEntry { id, climbId, userId, date, attempts, sent, notes }
interface ClimberStats { gradePyramid, sessionFrequency, progressOverTime, attemptsVsSends, totalSends, totalAttempts, currentStreak }
interface FeedActivity { id, user, climb, date, attempts, sent, notes }
```

---

## Adding New Features — Common Patterns

### Add a new API endpoint
1. Create `src/app/api/<route>/route.ts` exporting named functions `GET`, `POST`, `PATCH`, `DELETE` etc.
2. For dynamic segments use `src/app/api/<route>/[param]/route.ts` — params arrive as `{ params: Promise<{ param: string }> }` (always `await params`)
3. Import DB from `@/lib/server/db` (server-only)
4. Return `NextResponse.json(data)` or `NextResponse.json(data, { status: 201 })`
5. Add the `fetch` call in `src/lib/db/remote.ts` using the `/api/...` path
6. Add the TypeScript type in `src/lib/types.ts` if needed

### Route handler template
```typescript
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = await db("table").where({ id }).first();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### Add a new database table
1. Create migration: `cd api && npx tsx knexfile.ts migrate:make <name>`
2. Write the migration in `api/migrations/<timestamp>_<name>.ts`
3. Run it: `npm --prefix api run migrate`
4. Add TypeScript type in `src/lib/types.ts`

### Add a new page
1. Create directory under `src/app/<route>/`
2. Add `page.tsx` (server component by default; add `"use client"` for interactivity)
3. Add navigation link in `src/components/Navbar.tsx` if needed

### Add a new component
- Place in `src/components/`
- Follow existing pattern: dark Tailwind theme (stone-950 bg, orange-500 accents, stone-700 borders)

---

## Style Conventions

- **Theme:** Dark — `bg-stone-950`, `bg-stone-900` cards, `border-stone-700`, `text-stone-400` secondary
- **Accent:** `orange-500` (buttons, highlights, grade badges)
- **Grade colors:** Use `GRADE_COLORS` from `src/lib/utils.ts` — maps V-grades to Tailwind color classes
- **Fonts:** Geist Sans + Geist Mono (loaded in `src/app/layout.tsx`)
- **Images:** External images must be allowlisted in `next.config.ts` (currently `picsum.photos`)

---

## Deployment

### Architecture
Everything deploys as a single Vercel project. There is no separate API server.

| Part | Platform | Notes |
|------|----------|-------|
| Next.js frontend + API routes | **Vercel** | Single deployment |
| Migration CLI | runs during Vercel build | `api/knexfile.ts` + `api/migrations/` |

### Database: Neon (production) / local Postgres (development)
Knex reads connection config from `api/knexfile.ts`:
- **Local**: no env vars set → connects to `localhost:5432` database `allaboard` (no SSL)
- **Neon**: reads `DATABASE_URL_UNPOOLED` first, then `DATABASE_URL`, with `ssl: { rejectUnauthorized: false }`

**Why `DATABASE_URL_UNPOOLED`?** Neon's Vercel integration provides both a pooled connection (PgBouncer) and a direct connection. Knex uses `pg_advisory_lock` during migrations, which breaks under PgBouncer's transaction mode. Always use the direct/unpooled connection. For a long-running Express server, direct is also preferred since Knex manages its own connection pool.

### Vercel (frontend + migration runner)
Vercel uses the `vercel-build` npm script:
```
npm --prefix api run migrate && next build
```
This runs Knex migrations against the production database **before** building Next.js.

**Required Vercel environment variables** (set in Project → Settings → Environment Variables):
| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL_UNPOOLED` | Neon integration (auto) | Direct Neon connection — used by migrations and route handlers |
| `DATABASE_URL` | Neon integration (auto) | Pooled Neon connection — fallback if above absent |

The Neon Vercel integration sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically when you connect a Neon project in the Vercel dashboard.

There is no separate API server deployment. All routes are handled by Next.js on Vercel.

### Google OAuth environment variables
| Variable | Where | Notes |
|----------|-------|-------|
| `GOOGLE_CLIENT_ID` | `.env` (root) | Auto-loaded by Next.js |
| `GOOGLE_CLIENT_SECRET` | `.env` (root) | Auto-loaded by Next.js |

The callback URL is derived from the incoming request's `origin` — no env var needed. It resolves to `http://localhost:3000/api/auth/callback` locally and `https://www.allaboard.dev/api/auth/callback` in production. Both must be registered in Google Cloud Console.

### How Next.js loads environment variables
Next.js automatically loads these files (in priority order, highest last):
1. `.env` — committed defaults, loaded everywhere
2. `.env.local` — local overrides, gitignored, loaded everywhere
3. `.env.production` / `.env.development` — environment-specific

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` live in `.env` (gitignored via `.env*`). Only `NEXT_PUBLIC_` prefixed vars are sent to the browser — all others are server-only.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | local postgres | Full postgres connection string |
| `PGUSER` | `$USER` | Postgres user for local dev |
| `PORT` | `3001` | API server port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API base URL for frontend |
