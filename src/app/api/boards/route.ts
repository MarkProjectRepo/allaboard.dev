import { NextResponse } from "next/server";
import db from "@/lib/server/db";

export async function GET() {
  try {
    const boards = await db("boards").orderBy("name");
    return NextResponse.json(boards);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: 500 });
  }
}
