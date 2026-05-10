import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendSMS, makeCall } from "@/lib/twilio/notify";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, to, message } = await req.json();
  if (!to || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  try {
    if (type === "sms") return NextResponse.json(await sendSMS(to, message, session.user.id));
    if (type === "call") return NextResponse.json(await makeCall(to, message, session.user.id));
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
