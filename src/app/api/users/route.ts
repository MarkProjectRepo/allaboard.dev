import { NextResponse } from "next/server";
import db from "@/lib/server/db";

function toUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    profilePictureUrl: row.profile_picture_url ?? undefined,
    bio: row.bio,
    homeBoard: row.home_board,
    homeBoardAngle: row.home_board_angle,
    joinedAt: row.joined_at,
    followersCount: row.followers_count,
    followingCount: row.following_count,
    personalBests: {
      ...(row.personal_best_kilter ? { Kilter: row.personal_best_kilter } : {}),
      ...(row.personal_best_moonboard ? { Moonboard: row.personal_best_moonboard } : {}),
    },
  };
}

export { toUser };

export async function GET() {
  try {
    const rows = await db("users").orderBy("handle");
    return NextResponse.json(rows.map(toUser));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
