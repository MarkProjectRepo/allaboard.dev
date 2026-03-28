import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get("allaboard_session")?.value;
  if (!sessionToken) return NextResponse.json(null, { status: 401 });

  const session = await db("auth_sessions")
    .where({ session_token: sessionToken })
    .where("expires_at", ">", new Date())
    .first();

  if (!session?.user_id) return NextResponse.json(null, { status: 401 });

  const user = await db("users").where({ id: session.user_id }).first();
  if (!user) return NextResponse.json(null, { status: 401 });

  return NextResponse.json({
    id:                  user.id,
    handle:              user.handle,
    displayName:         user.display_name,
    avatarColor:         user.avatar_color,
    profilePictureUrl:   user.profile_picture_url ?? undefined,
    bio:                 user.bio,
    homeBoard:           user.home_board,
    homeBoardAngle:      user.home_board_angle,
    joinedAt:            user.joined_at,
    followersCount:      user.followers_count,
    followingCount:      user.following_count,
    personalBests: {
      ...(user.personal_best_kilter    ? { Kilter:     user.personal_best_kilter    } : {}),
      ...(user.personal_best_moonboard ? { Moonboard:  user.personal_best_moonboard } : {}),
    },
  });
}
