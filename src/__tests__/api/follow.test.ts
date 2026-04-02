/**
 * @jest-environment node
 *
 * API contract tests for POST/DELETE/GET /api/users/[handle]/follow
 */

import { NextRequest } from "next/server";
import { POST, DELETE, GET } from "@/app/api/users/[handle]/follow/route";

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
    "where", "whereIn", "whereNotNull", "join", "leftJoin", "orderBy",
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
const authSession   = (userId = "me") => ({ userId, oauthAccountId: "oauth-1", save: jest.fn() });

const targetUser = { id: "targetuser", handle: "targetuser" };

const params = (handle: string) => ({ params: Promise.resolve({ handle }) });

function postReq(handle: string) {
  return new NextRequest(`http://localhost/api/users/${handle}/follow`, { method: "POST" });
}
function deleteReq(handle: string) {
  return new NextRequest(`http://localhost/api/users/${handle}/follow`, { method: "DELETE" });
}
function getReq(handle: string) {
  return new NextRequest(`http://localhost/api/users/${handle}/follow`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ── POST (follow) ──────────────────────────────────────────────────────────────

describe("POST /api/users/[handle]/follow", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetIronSession.mockResolvedValue(unauthSession() as never);
    expect((await POST(postReq("targetuser"), params("targetuser"))).status).toBe(401);
  });

  it("returns 400 when the user tries to follow themselves", async () => {
    mockGetIronSession.mockResolvedValue(authSession("targetuser") as never);
    const res = await POST(postReq("targetuser"), params("targetuser"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/yourself/i);
  });

  it("returns 404 when the target user does not exist", async () => {
    mockGetIronSession.mockResolvedValue(authSession("me") as never);
    mockDb.mockReturnValue(qb(undefined, undefined)); // target user lookup → not found
    const res = await POST(postReq("nobody"), params("nobody"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with { following: true } and updates follower/following counts", async () => {
    mockGetIronSession.mockResolvedValue(authSession("me") as never);
    mockDb
      .mockReturnValueOnce(qb(targetUser, targetUser))  // find target user
      .mockReturnValueOnce(qb())                         // insert follow (onConflict.ignore)
      .mockReturnValueOnce(qb())                         // increment target followers_count
      .mockReturnValueOnce(qb());                        // increment caller following_count

    const res = await POST(postReq("targetuser"), params("targetuser"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ following: true });

    // Verify both increment calls were made
    const incrementCalls = mockDb.mock.results
      .map((r: { value: { increment: jest.Mock } }) => r.value.increment)
      .filter((inc: jest.Mock) => inc.mock.calls.length > 0);
    expect(incrementCalls).toHaveLength(2);
  });
});

// ── DELETE (unfollow) ──────────────────────────────────────────────────────────

describe("DELETE /api/users/[handle]/follow", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetIronSession.mockResolvedValue(unauthSession() as never);
    expect((await DELETE(deleteReq("targetuser"), params("targetuser"))).status).toBe(401);
  });

  it("returns 404 when the target user does not exist", async () => {
    mockGetIronSession.mockResolvedValue(authSession("me") as never);
    mockDb.mockReturnValue(qb(undefined, undefined));
    expect((await DELETE(deleteReq("nobody"), params("nobody"))).status).toBe(404);
  });

  it("returns 200 with { following: false } and decrements counts when a follow row existed", async () => {
    mockGetIronSession.mockResolvedValue(authSession("me") as never);
    // delete returns 1 (a row was actually removed)
    const deleteQb = qb();
    deleteQb.delete = jest.fn().mockResolvedValue(1);

    mockDb
      .mockReturnValueOnce(qb(targetUser, targetUser))  // find target user
      .mockReturnValueOnce(deleteQb)                     // delete follow row
      .mockReturnValueOnce(qb())                         // decrement target followers_count
      .mockReturnValueOnce(qb());                        // decrement caller following_count

    const res = await DELETE(deleteReq("targetuser"), params("targetuser"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ following: false });
  });

  it("does not decrement counts when no follow row existed", async () => {
    mockGetIronSession.mockResolvedValue(authSession("me") as never);
    const deleteQb = qb();
    deleteQb.delete = jest.fn().mockResolvedValue(0); // nothing deleted

    mockDb
      .mockReturnValueOnce(qb(targetUser, targetUser))
      .mockReturnValueOnce(deleteQb);

    const res = await DELETE(deleteReq("targetuser"), params("targetuser"));
    expect(res.status).toBe(200);
    // decrement should not have been called on any QB
    const decrementCalls = mockDb.mock.results
      .map((r: { value: { decrement: jest.Mock } }) => r.value.decrement)
      .filter((dec: jest.Mock) => dec.mock.calls.length > 0);
    expect(decrementCalls).toHaveLength(0);
  });
});

// ── GET (check following status) ──────────────────────────────────────────────

describe("GET /api/users/[handle]/follow", () => {
  it("returns { following: false } when not authenticated", async () => {
    mockGetIronSession.mockResolvedValue(unauthSession() as never);
    const res = await GET(getReq("targetuser"), params("targetuser"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ following: false });
  });

  it("returns { following: false } when the target does not exist", async () => {
    mockGetIronSession.mockResolvedValue(authSession("me") as never);
    mockDb.mockReturnValue(qb(undefined, undefined)); // target not found
    const res = await GET(getReq("nobody"), params("nobody"));
    expect(await res.json()).toEqual({ following: false });
  });

  it("returns { following: false } when no follow row exists", async () => {
    mockGetIronSession.mockResolvedValue(authSession("me") as never);
    mockDb
      .mockReturnValueOnce(qb(targetUser, targetUser))  // find target
      .mockReturnValueOnce(qb(undefined, undefined));    // follows row → not found
    expect(await (await GET(getReq("targetuser"), params("targetuser"))).json())
      .toEqual({ following: false });
  });

  it("returns { following: true } when the follow row exists", async () => {
    mockGetIronSession.mockResolvedValue(authSession("me") as never);
    const followRow = { follower_id: "me", following_id: "targetuser" };
    mockDb
      .mockReturnValueOnce(qb(targetUser, targetUser))
      .mockReturnValueOnce(qb(followRow, followRow));
    expect(await (await GET(getReq("targetuser"), params("targetuser"))).json())
      .toEqual({ following: true });
  });
});
