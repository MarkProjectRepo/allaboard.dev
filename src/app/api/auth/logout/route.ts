import { NextResponse } from "next/server";

// TODO: parse session cookie → DELETE from auth_sessions → clear cookie
export async function POST() {
  return NextResponse.json({ ok: true });
}
