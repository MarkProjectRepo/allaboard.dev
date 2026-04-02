/**
 * @jest-environment node
 *
 * API contract tests for POST /api/onboarding
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/onboarding/route";

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
    "where", "whereIn", "orderBy", "select", "onConflict", "ignore",
    "join", "leftJoin", "insert",
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

/** Session that has gone through Google OAuth but not yet onboarded */
const preOnboardingSession = (overrides?: object) => ({
  oauthAccountId: "oauth-123",
  userId: undefined,
  save: jest.fn(),
  ...overrides,
});

function postReq(body: object) {
  return new NextRequest("http://localhost/api/onboarding", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const board        = { id: "kilter-original", name: "Kilter Board (Original)", type: "standard" };
const oauthAccount = { id: "oauth-123", email: "alex@example.com", profile_picture_url: null };

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

describe("POST /api/onboarding", () => {
  it("returns 401 when there is no oauthAccountId in the session", async () => {
    mockGetIronSession.mockResolvedValue({ oauthAccountId: undefined, userId: undefined, save: jest.fn() } as never);
    expect((await POST(postReq({ displayName: "Alex", boardId: "kilter-original" }))).status).toBe(401);
  });

  it("returns 400 when the user has already completed onboarding", async () => {
    mockGetIronSession.mockResolvedValue(
      preOnboardingSession({ userId: "existing_handle" }) as never,
    );
    const res = await POST(postReq({ displayName: "Alex", boardId: "kilter-original" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already onboarded/i);
  });

  it("returns 400 when displayName or boardId is missing", async () => {
    mockGetIronSession.mockResolvedValue(preOnboardingSession() as never);
    expect((await POST(postReq({ displayName: "", boardId: "kilter-original" }))).status).toBe(400);
    expect((await POST(postReq({ displayName: "Alex", boardId: "" }))).status).toBe(400);
  });

  it("returns 400 when the derived handle is too short (< 2 chars)", async () => {
    mockGetIronSession.mockResolvedValue(preOnboardingSession() as never);
    // Single character name → handle "a" (length 1)
    const res = await POST(postReq({ displayName: "A", boardId: "kilter-original" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too short/i);
  });

  it("returns 409 when the derived handle is already taken", async () => {
    mockGetIronSession.mockResolvedValue(preOnboardingSession() as never);
    // handle check → existing user found
    mockDb.mockReturnValueOnce(qb({ id: "alex", handle: "alex" }, { id: "alex", handle: "alex" }));
    const res = await POST(postReq({ displayName: "Alex", boardId: "kilter-original" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/taken/i);
  });

  it("returns 400 when the boardId doesn't match any board", async () => {
    mockGetIronSession.mockResolvedValue(preOnboardingSession() as never);
    mockDb
      .mockReturnValueOnce(qb(undefined, undefined))   // handle check: not taken
      .mockReturnValueOnce(qb(undefined, undefined));   // board lookup: not found
    const res = await POST(postReq({ displayName: "Alex", boardId: "nonexistent" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid board/i);
  });

  it("returns 200 with { ok: true }, creates the user row, and saves the session on success", async () => {
    const mockSession = preOnboardingSession();
    mockGetIronSession.mockResolvedValue(mockSession as never);

    mockDb
      .mockReturnValueOnce(qb(undefined, undefined))         // handle check: not taken
      .mockReturnValueOnce(qb(board, board))                  // board lookup
      .mockReturnValueOnce(qb(oauthAccount, oauthAccount))    // oauth_accounts lookup
      .mockReturnValueOnce(qb())                              // db("users").insert(...)
      .mockReturnValueOnce(qb());                             // db("oauth_accounts").where().update(...)

    const res = await POST(postReq({ displayName: "Alex Sends", boardId: "kilter-original" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    // Session should have been promoted with the new userId
    expect(mockSession.userId).toBe("alex_sends");
    expect(mockSession.save).toHaveBeenCalledTimes(1);
  });

  it("inserts the user row with the correct fields derived from the request", async () => {
    const mockSession = preOnboardingSession();
    mockGetIronSession.mockResolvedValue(mockSession as never);

    mockDb
      .mockReturnValueOnce(qb(undefined, undefined))
      .mockReturnValueOnce(qb(board, board))
      .mockReturnValueOnce(qb(oauthAccount, oauthAccount))
      .mockReturnValueOnce(qb())
      .mockReturnValueOnce(qb());

    await POST(postReq({ displayName: "Alex Sends", boardId: "kilter-original" }));

    // The 4th DB call is the users insert
    const usersInsertQb = mockDb.mock.results[3].value;
    expect(usersInsertQb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        handle:       "alex_sends",
        display_name: "Alex Sends",
        home_board:   "Kilter Board (Original)",
        email:        "alex@example.com",
      }),
    );
  });
});
