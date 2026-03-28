import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get("allaboard_session")?.value;
  if (sessionToken) {
    await db("auth_sessions").where({ session_token: sessionToken }).delete();
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("allaboard_session");
  return response;
}
