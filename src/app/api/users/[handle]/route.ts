import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { toUser } from "../route";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle } = await params;
    const row = await db("users").where({ handle }).first();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toUser(row));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle } = await params;
    const { displayName, bio, homeBoard, homeBoardAngle, personalBests } =
      await req.json() as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if (displayName !== undefined) patch.display_name = displayName;
    if (bio !== undefined) patch.bio = bio;
    if (homeBoard !== undefined) patch.home_board = homeBoard;
    if (homeBoardAngle !== undefined) patch.home_board_angle = homeBoardAngle;
    if (personalBests && typeof personalBests === "object") {
      const pb = personalBests as Record<string, string>;
      if (pb.Kilter !== undefined) patch.personal_best_kilter = pb.Kilter;
      if (pb.Moonboard !== undefined) patch.personal_best_moonboard = pb.Moonboard;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db("users").where({ handle }).update(patch);
    const row = await db("users").where({ handle }).first();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toUser(row));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
