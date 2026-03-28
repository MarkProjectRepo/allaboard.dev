import { NextResponse } from "next/server";

// TODO: read session cookie → look up auth_sessions → join users → return user
export async function GET() {
  return NextResponse.json(null, { status: 401 });
}
