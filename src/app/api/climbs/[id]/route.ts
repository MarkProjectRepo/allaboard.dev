import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = await db("climbs").where({ id }).first();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const videos = await db("beta_videos").where({ climb_id: id }).orderBy("sort_order");
    return NextResponse.json({
      id: row.id, name: row.name, grade: row.grade, boardType: row.board_type,
      angle: row.angle, description: row.description, author: row.author,
      setter: row.setter, sends: row.sends, createdAt: row.created_at,
      betaVideos: videos.map((v) => ({
        url: v.url, thumbnail: v.thumbnail, platform: v.platform,
        credit: v.credit ?? undefined,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch climb" }, { status: 500 });
  }
}
