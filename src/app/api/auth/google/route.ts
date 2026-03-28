import { NextResponse } from "next/server";

// TODO: redirect to Google OAuth consent screen using GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
export async function GET() {
  return NextResponse.json({ error: "Google OAuth not yet configured" }, { status: 501 });
}
