import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { resolveUserId } from "@/lib/server/resolveUserId";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const tick = await db("ticks").where({ id }).first();
    if (!tick) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (tick.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { date, sent, attempts, suggestedGrade, rating, comment, instagramUrl } =
      await req.json() as {
        date?: string;
        sent?: boolean;
        attempts?: number;
        suggestedGrade?: string;
        rating?: number;
        comment?: string;
        instagramUrl?: string;
      };

    if (rating !== undefined && (rating < 1 || rating > 4)) {
      return NextResponse.json({ error: "rating must be 1–4" }, { status: 400 });
    }

    const now = new Date();
    let tickTimestamp: Date | undefined;
    if (date) {
      const [y, m, d] = date.split("-").map(Number);
      tickTimestamp = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    }

    const patch: Record<string, unknown> = { updated_at: now };
    if (tickTimestamp !== undefined) patch.date            = tickTimestamp;
    if (sent      !== undefined)      patch.sent           = sent;
    if (attempts  !== undefined)      patch.attempts       = attempts ?? null;
    if (rating    !== undefined)      patch.rating         = rating;
    if (suggestedGrade !== undefined) patch.suggested_grade = suggestedGrade || null;
    if (comment   !== undefined)      patch.comment        = comment?.trim() || null;
    if (instagramUrl !== undefined)   patch.instagram_url  = instagramUrl?.trim() || null;

    await db("ticks").where({ id }).update(patch);

    // Recalculate climb aggregates
    const climbId = tick.climb_id as string;
    const [ratingResult] = await db("ticks").where({ climb_id: climbId }).avg("rating as avg");
    const [sendsResult]  = await db("ticks").where({ climb_id: climbId, sent: true }).count("id as count");
    await db("climbs").where({ id: climbId }).update({
      star_rating: ratingResult?.avg != null ? Number(Number(ratingResult.avg).toFixed(2)) : null,
      sends:       Number(sendsResult?.count ?? 0),
    });

    const updated = await db("ticks").where({ id }).first();
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update tick" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const tick = await db("ticks").where({ id }).first();
    if (!tick) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (tick.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const climbId = tick.climb_id as string;
    await db("ticks").where({ id }).delete();

    // Recalculate climb aggregates
    const [ratingResult] = await db("ticks").where({ climb_id: climbId }).avg("rating as avg");
    const [sendsResult]  = await db("ticks").where({ climb_id: climbId, sent: true }).count("id as count");

    await db("climbs").where({ id: climbId }).update({
      star_rating: ratingResult?.avg != null ? Number(Number(ratingResult.avg).toFixed(2)) : null,
      sends:       Number(sendsResult?.count ?? 0),
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete tick" }, { status: 500 });
  }
}
