"use client";

import { useEffect, useState, useCallback } from "react";
import { Session, ClimberStats, BoardType } from "@/lib/types";
import { getSessions, computeStats } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import UserAvatar from "@/components/UserAvatar";
import GradeBadge from "@/components/GradeBadge";
import SessionCard from "@/components/SessionCard";
import Link from "next/link";

const BOARD_ORDER: BoardType[] = ["Kilter", "Moonboard"];

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats]       = useState<ClimberStats | null>(null);

  const reload = useCallback(() => {
    if (!user) return;
    void (async () => {
      const allSessions = await getSessions(user.id);
      setSessions(allSessions.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4));
      setStats(await computeStats(user.id));
    })();
  }, [user]);

  useEffect(reload, [reload]);

  if (authLoading) {
    return <div className="text-stone-500 text-center py-16">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-24">
        <p className="text-stone-400 mb-4">Sign in to view your profile.</p>
        <a
          href="/api/auth/google"
          className="inline-block px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-colors"
        >
          Login with Google
        </a>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-stone-500 text-center py-16">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-5">
        <UserAvatar user={user} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
          <p className="text-stone-400 text-sm mt-0.5">@{user.handle}</p>
          <p className="text-stone-300 text-sm mt-2 leading-relaxed">{user.bio}</p>
          <div className="mt-2 text-xs text-stone-500">
            Home board: {user.homeBoard} at {user.homeBoardAngle}° ·{" "}
            Joined {new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
        <Tile value={stats.totalSends}   label="Total Sends"    accent="text-green-400" />
        <Tile value={stats.totalAttempts} label="Total Attempts" />
        <Tile value={user.followersCount} label="Followers" />
        <Tile value={user.followingCount} label="Following" />
      </div>

      {/* Personal bests */}
      <section className="mt-8">
        <h2 className="text-white font-semibold text-lg mb-3">Personal Bests</h2>
        {Object.keys(user.personalBests).length === 0 ? (
          <p className="text-stone-500 text-sm">No personal bests logged yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {BOARD_ORDER.filter((b) => user.personalBests[b]).map((board) => (
              <div key={board} className="bg-stone-800 border border-stone-700 rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-stone-400 text-sm">{board}</span>
                <GradeBadge grade={user.personalBests[board]!} size="md" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Stats link */}
      <section className="mt-8">
        <Link
          href="/stats"
          className="flex items-center justify-between bg-stone-800 border border-stone-700 hover:border-stone-500 rounded-xl px-5 py-4 transition-colors"
        >
          <div>
            <div className="text-white font-semibold">My Stats</div>
            <div className="text-stone-400 text-sm mt-0.5">Grade pyramid, session frequency, progress over time</div>
          </div>
          <span className="text-stone-400 text-lg">→</span>
        </Link>
      </section>

      {/* Recent sessions */}
      <section className="mt-8 pb-8">
        <h2 className="text-white font-semibold text-lg mb-3">Recent Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-stone-500 text-sm">No sessions logged yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</div>
      <div className="text-stone-400 text-xs mt-0.5">{label}</div>
    </div>
  );
}
