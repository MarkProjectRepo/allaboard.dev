import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle")?.trim();

  if (!handle || handle.length < 2) {
    return NextResponse.json({ available: false, reason: "too_short" });
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return NextResponse.json({ available: false, reason: "invalid_chars" });
  }

  const existing = await db("users").where({ handle }).first();
  return NextResponse.json({ available: !existing });
}
