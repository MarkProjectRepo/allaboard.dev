import { NextResponse } from "next/server";

// TODO: exchange code for tokens → upsert oauth_accounts → create auth_sessions → redirect to frontend
export async function GET() {
  return NextResponse.json({ error: "Google OAuth not yet configured" }, { status: 501 });
}
