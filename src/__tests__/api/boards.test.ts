/**
 * @jest-environment node
 *
 * API contract tests for /api/boards
 *
 * These tests import the route handler functions directly and mock only
 * @/lib/server/db (Knex) and iron-session, so no real DB is touched.
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/boards/route";

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

/**
 * Returns a chainable Knex query-builder stub.
 *
 * - Awaiting the QB resolves to `arrayResult` (mimics `await db("table")…`)
 * - Calling `.first()` resolves to `firstResult` (defaults to `arrayResult[0]`
 *   for arrays, or `arrayResult` itself for a single object / undefined)
 */
function qb(arrayResult: unknown = [], firstResult?: unknown) {
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

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ── GET /api/boards ────────────────────────────────────────────────────────────

describe("GET /api/boards", () => {
  const rows = [
    { id: "kilter-original", name: "Kilter Board (Original)", type: "standard",  location: null, description: null, created_by: null },
    { id: "moonboard-2016",  name: "Moonboard 2016",          type: "standard",  location: null, description: null, created_by: null },
    { id: "my-wall",         name: "My Wall",                 type: "spray_wall", location: "The Cave", description: null, created_by: "alice" },
  ];

  it("returns 200 with all boards mapped through toBoard", async () => {
    mockDb.mockReturnValue(qb(rows));
    const res = await GET(new NextRequest("http://localhost/api/boards"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(3);
    expect(data[0]).toMatchObject({ id: "kilter-original", name: "Kilter Board (Original)", type: "standard" });
    // created_by null → createdBy undefined
    expect(data[0].createdBy).toBeUndefined();
  });

  it("passes the type filter to the DB query when ?type= is provided", async () => {
    mockDb.mockReturnValue(qb([rows[0], rows[1]]));
    const res = await GET(new NextRequest("http://localhost/api/boards?type=standard"));
    expect(res.status).toBe(200);
    // The QB's .where() should have been called with the type filter
    const qbInstance = mockDb.mock.results[0].value;
    expect(qbInstance.where).toHaveBeenCalledWith({ type: "standard" });
  });

  it("omits the type filter when ?type= is not a known value", async () => {
    mockDb.mockReturnValue(qb(rows));
    await GET(new NextRequest("http://localhost/api/boards?type=unknown"));
    const qbInstance = mockDb.mock.results[0].value;
    expect(qbInstance.where).not.toHaveBeenCalled();
  });
});

// ── POST /api/boards ───────────────────────────────────────────────────────────

describe("POST /api/boards", () => {
  it("returns 401 when the request is unauthenticated", async () => {
    mockGetIronSession.mockResolvedValue(unauthSession() as never);
    const req = new NextRequest("http://localhost/api/boards", {
      method: "POST",
      body: JSON.stringify({ name: "Test Board", type: "standard" }),
      headers: { "Content-Type": "application/json" },
    });
    expect((await POST(req)).status).toBe(401);
  });

  it("returns 400 when the board name is empty", async () => {
    mockGetIronSession.mockResolvedValue(authSession() as never);
    const req = new NextRequest("http://localhost/api/boards", {
      method: "POST",
      body: JSON.stringify({ name: "  ", type: "standard" }),
      headers: { "Content-Type": "application/json" },
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 400 when board type is invalid", async () => {
    mockGetIronSession.mockResolvedValue(authSession() as never);
    const req = new NextRequest("http://localhost/api/boards", {
      method: "POST",
      body: JSON.stringify({ name: "Good Name", type: "invalid_type" }),
      headers: { "Content-Type": "application/json" },
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 400 when spray_wall is missing a location", async () => {
    mockGetIronSession.mockResolvedValue(authSession() as never);
    const req = new NextRequest("http://localhost/api/boards", {
      method: "POST",
      body: JSON.stringify({ name: "My Wall", type: "spray_wall" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/location/i);
  });

  it("returns 201 with the created board on a valid request", async () => {
    mockGetIronSession.mockResolvedValue(authSession("alice") as never);
    const created = {
      id: "my-board", name: "My Board", type: "standard",
      location: null, description: null, created_by: "alice",
    };
    mockDb
      .mockReturnValueOnce(qb(undefined, undefined)) // slug uniqueness: no conflict
      .mockReturnValueOnce(qb())                     // insert
      .mockReturnValueOnce(qb(created, created));    // fetch new row

    const req = new NextRequest("http://localhost/api/boards", {
      method: "POST",
      body: JSON.stringify({ name: "My Board", type: "standard" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({ id: "my-board", name: "My Board", type: "standard", createdBy: "alice" });
  });
});
