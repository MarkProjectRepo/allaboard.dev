import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/server/db";

function toClimb(row: Record<string, unknown>, videos: Record<string, unknown>[]) {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    boardType: row.board_type,
    angle: row.angle,
    description: row.description,
    author: row.author,
    setter: row.setter,
    sends: row.sends,
    createdAt: row.created_at,
    betaVideos: videos.map((v) => ({
      url: v.url,
      thumbnail: v.thumbnail,
      platform: v.platform,
      credit: v.credit ?? undefined,
    })),
  };
}

export async function GET() {
  try {
    const rows = await db("climbs").orderBy("created_at", "desc");
    const climbIds = rows.map((r) => r.id);
    const videos = climbIds.length
      ? await db("beta_videos").whereIn("climb_id", climbIds).orderBy("sort_order")
      : [];

    const videosByClimb: Record<string, Record<string, unknown>[]> = {};
    for (const v of videos) {
      if (!videosByClimb[v.climb_id]) videosByClimb[v.climb_id] = [];
      videosByClimb[v.climb_id].push(v);
    }

    return NextResponse.json(rows.map((r) => toClimb(r, videosByClimb[r.id] ?? [])));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch climbs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, grade, boardType, angle, description, author, setter, sends } =
      await req.json() as Record<string, unknown>;
    const id = uuidv4();
    await db("climbs").insert({
      id, name, grade, board_type: boardType,
      angle: angle ?? null, description,
      author: author ?? null,
      setter: setter ?? null,
      sends: sends ?? 0,
    });
    const row = await db("climbs").where({ id }).first();
    return NextResponse.json(toClimb(row, []), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create climb" }, { status: 500 });
  }
}
