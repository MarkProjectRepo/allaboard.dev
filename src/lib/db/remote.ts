/**
 * Data access layer — calls Next.js API route handlers at /api/*.
 * Credentials are included on every request so the auth session cookie is sent.
 */

import { Climb, User, Session, LogEntry, ClimberStats, FeedActivity } from "@/lib/types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ─── No-op stubs kept for API compatibility ───────────────────────────────────

export function initStorage(): void { /* no-op */ }
export function resetStorage(): void { /* no-op */ }

// ─── Climbs ───────────────────────────────────────────────────────────────────

export async function getClimbs(): Promise<Climb[]> {
  return api<Climb[]>("/climbs");
}

export async function getClimbById(id: string): Promise<Climb | undefined> {
  try {
    return await api<Climb>(`/climbs/${id}`);
  } catch {
    return undefined;
  }
}

export async function createClimb(data: Omit<Climb, "id" | "createdAt" | "author">): Promise<Climb> {
  return api<Climb>("/climbs", { method: "POST", body: JSON.stringify(data) });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  return api<User[]>("/users");
}

export async function getUserById(id: string): Promise<User | undefined> {
  try {
    return await api<User>(`/users/${id}`);
  } catch {
    return undefined;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await api<User>("/auth/me");
  } catch {
    return null;
  }
}

export async function updateCurrentUser(userId: string, patch: Partial<Omit<User, "id">>): Promise<User> {
  return api<User>(`/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify(patch) });
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getSessions(userId?: string): Promise<Session[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return api<Session[]>(`/sessions${qs}`);
}

export async function logClimb({
  climbId, date, attempts, sent, notes, userId,
}: {
  climbId: string;
  date: string;
  attempts: number;
  sent: boolean;
  notes?: string;
  userId: string;
}): Promise<LogEntry> {
  return api<LogEntry>("/log-entries", {
    method: "POST",
    body: JSON.stringify({ climbId, date, attempts, sent, notes, userId }),
  });
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export async function getFeedActivities(userId?: string): Promise<FeedActivity[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return api<FeedActivity[]>(`/feed${qs}`);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function computeStats(userId: string): Promise<ClimberStats> {
  return api<ClimberStats>(`/stats/${userId}`);
}
