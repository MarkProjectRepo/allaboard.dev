/**
 * @jest-environment node
 *
 * API contract tests for GET /api/users/[handle] and PATCH /api/users/[handle]
 */

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/users/[handle]/route";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("next/headers", () => ({ cookies: jest.fn().mockResolvedValue({}) }));
jest.mock("iron-session");
jest.mock("@/lib/server/db", () => ({ __esModule: true, default: jest.fn() }));

import db from "@/lib/server/db";
import { getIronSession } from "iron-session";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as jest.MockedFunction<any>;
const mockGetIronSession = jest.mocked(getIronSession);

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function qb(arrayResult: unknown = [], firstResult?: unknown): Record<string, any> {
  const first =
    firstResult !== undefined
      ? firstResult
      : Array.isArray(arrayResult)
      ? (arrayResult as unknown[])[0]
      : arrayResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: Record<string, any> = {};
  for (const m of [
    "where", "whereIn", "whereILike", "whereNotNull", "whereNot",
    "join", "leftJoin", "orderBy", "orderByRaw", "limit", "offset",
    "select", "onConflict", "ignore", "distinct", "as", "insert",
  ]) {
    b[m] = jest.fn().mockReturnThis();
  }
  b.update    = jest.fn().mockResolvedValue(1);
  b.delete    = jest.fn().mockResolvedValue(1);
  b.increment = jest.fn().mockResolvedValue(1);
  b.decrement = jest.fn().mockResolvedValue(1);
  b.first     = jest.fn().mockResolvedValue(first);
  b.then      = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(arrayResult).then(res, rej);
  b.catch     = (fn: (e: unknown) => unknown) => Promise.resolve(arrayResult).catch(fn);
  b.finally   = (fn: () => void) => Promise.resolve(arrayResult).finally(fn);
  return b;
}

const unauthSession = () => ({ userId: undefined, oauthAccountId: undefined, save: jest.fn() });
const authSession   = (userId = "testuser") => ({ userId, oauthAccountId: "oauth-1", save: jest.fn() });

const params = (handle: string) => ({ params: Promise.resolve({ handle }) });

// ── Fixtures ──────────────────────────────────────────────────────────────────

const dbRow = {
  id: "targetuser",
  handle: "targetuser",
  display_name: "Target User",
  avatar_color: "bg-orange-500",
  profile_picture_url: null,
  bio: "I love climbing",
  home_board: "Kilter Board (Original)",
  home_board_angle: 40,
  joined_at: "2026-01-01T00:00:00.000Z",
  followers_count: 12,
  following_count: 5,
  personal_best_kilter: null,
  personal_best_moonboard: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ── GET /api/users/[handle] ────────────────────────────────────────────────────

describe("GET /api/users/[handle]", () => {
  it("returns 200 with the mapped user object when found", async () => {
    mockDb.mockReturnValue(qb(dbRow, dbRow));
    const req = new NextRequest("http://localhost/api/users/targetuser");
    const res = await GET(req, params("targetuser"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // Verify the DB snake_case row is mapped to camelCase API shape
    expect(data).toMatchObject({
      handle:         "targetuser",
      displayName:    "Target User",
      avatarColor:    "bg-orange-500",
      bio:            "I love climbing",
      homeBoard:      "Kilter Board (Original)",
      homeBoardAngle: 40,
      followersCount: 12,
      followingCount: 5,
    });
    // null DB fields → absent from personalBests
    expect(data.personalBests).toEqual({});
  });

  it("returns 404 when the handle does not exist", async () => {
    mockDb.mockReturnValue(qb(undefined, undefined));
    const req = new NextRequest("http://localhost/api/users/nobody");
    const res = await GET(req, params("nobody"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Not found");
  });
});

// ── PATCH /api/users/[handle] ──────────────────────────────────────────────────

describe("PATCH /api/users/[handle]", () => {
  it("returns 401 when the request has no session", async () => {
    mockGetIronSession.mockResolvedValue(unauthSession() as never);
    const req = new NextRequest("http://localhost/api/users/targetuser", {
      method: "PATCH",
      body: JSON.stringify({ bio: "new bio" }),
      headers: { "Content-Type": "application/json" },
    });
    expect((await PATCH(req, params("targetuser"))).status).toBe(401);
  });

  it("returns 403 when the session belongs to a different user", async () => {
    mockGetIronSession.mockResolvedValue(authSession("otheruser") as never);
    const req = new NextRequest("http://localhost/api/users/targetuser", {
      method: "PATCH",
      body: JSON.stringify({ bio: "new bio" }),
      headers: { "Content-Type": "application/json" },
    });
    expect((await PATCH(req, params("targetuser"))).status).toBe(403);
  });

  it("returns 400 when the request body contains no updatable fields", async () => {
    mockGetIronSession.mockResolvedValue(authSession("targetuser") as never);
    const req = new NextRequest("http://localhost/api/users/targetuser", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    expect((await PATCH(req, params("targetuser"))).status).toBe(400);
  });

  it("returns 200 with the updated user when the owner patches their own profile", async () => {
    mockGetIronSession.mockResolvedValue(authSession("targetuser") as never);
    const updatedRow = { ...dbRow, bio: "Updated bio" };
    mockDb
      .mockReturnValueOnce(qb())                          // db("users").where().update(...)
      .mockReturnValueOnce(qb(updatedRow, updatedRow));   // db("users").where().first()

    const req = new NextRequest("http://localhost/api/users/targetuser", {
      method: "PATCH",
      body: JSON.stringify({ bio: "Updated bio" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, params("targetuser"));
    expect(res.status).toBe(200);
    expect((await res.json()).bio).toBe("Updated bio");
  });

  it("maps personalBests correctly into DB columns on update", async () => {
    mockGetIronSession.mockResolvedValue(authSession("targetuser") as never);
    const updatedRow = { ...dbRow, personal_best_kilter: "V10" };
    mockDb
      .mockReturnValueOnce(qb())
      .mockReturnValueOnce(qb(updatedRow, updatedRow));

    const req = new NextRequest("http://localhost/api/users/targetuser", {
      method: "PATCH",
      body: JSON.stringify({ personalBests: { Kilter: "V10" } }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, params("targetuser"));
    expect(res.status).toBe(200);
    // Verify the update was called with the snake_case DB column
    const updateQb = mockDb.mock.results[0].value;
    expect(updateQb.update).toHaveBeenCalledWith(
      expect.objectContaining({ personal_best_kilter: "V10" }),
    );
  });
});
