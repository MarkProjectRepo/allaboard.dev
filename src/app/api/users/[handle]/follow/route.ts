import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { resolveUserId } from "@/lib/server/resolveUserId";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { handle } = await params;
    if (userId === handle) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const target = await db("users").where({ handle }).first();
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db("follows")
      .insert({ follower_id: userId, following_id: target.id })
      .onConflict(["follower_id", "following_id"])
      .ignore();

    await db("users").where({ id: target.id }).increment("followers_count", 1);
    await db("users").where({ id: userId }).increment("following_count", 1);

    return NextResponse.json({ following: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { handle } = await params;

    const target = await db("users").where({ handle }).first();
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const deleted = await db("follows")
      .where({ follower_id: userId, following_id: target.id })
      .delete();

    if (deleted > 0) {
      await db("users").where({ id: target.id }).decrement("followers_count", 1);
      await db("users").where({ id: userId }).decrement("following_count", 1);
    }

    return NextResponse.json({ following: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** GET — check if the current user follows this handle */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ following: false });

    const { handle } = await params;
    const target = await db("users").where({ handle }).first();
    if (!target) return NextResponse.json({ following: false });

    const row = await db("follows")
      .where({ follower_id: userId, following_id: target.id })
      .first();

    return NextResponse.json({ following: !!row });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
