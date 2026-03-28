import { NextRequest, NextResponse } from "next/server";
import { computeStats } from "@/lib/server/stats";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const stats = await computeStats(userId);
    return NextResponse.json(stats);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
