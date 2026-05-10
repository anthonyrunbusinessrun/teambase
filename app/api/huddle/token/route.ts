import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import twilio from "twilio";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const API_KEY     = process.env.TWILIO_API_KEY     || "";
const API_SECRET  = process.env.TWILIO_API_SECRET  || "";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { roomName } = await req.json();
  const identity = (session.user.name || session.user.email || session.user.id).slice(0, 50);
  try {
    const { AccessToken } = twilio.jwt;
    const { VideoGrant } = AccessToken;
    const token = new AccessToken(ACCOUNT_SID, API_KEY, API_SECRET, { identity, ttl: 3600 });
    token.addGrant(new VideoGrant({ room: roomName }));
    return NextResponse.json({ token: token.toJwt(), identity, roomName });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
