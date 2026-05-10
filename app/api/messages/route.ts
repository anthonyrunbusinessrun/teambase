import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { channelMessages, directMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { channelId, toUserId, body: msgBody = "", attachments = [] } = body;

  const safeBody = (msgBody || "").trim() || " ";
  const id = crypto.randomUUID();
  const atts = JSON.stringify(attachments || []);

  try {
    if (channelId) {
      const db = getDb();
      // Try with attachments column
      try {
        await db.insert(channelMessages).values({
          id, channelId, userId: session.user.id,
          body: safeBody, attachments: atts,
        });
      } catch {
        // attachments column missing — insert without it
        await db.insert(channelMessages).values({
          id, channelId, userId: session.user.id,
          body: safeBody,
        });
      }
      return NextResponse.json({ ok: true, id, channelId, body: safeBody });
    }

    if (toUserId) {
      const db = getDb();
      try {
        await db.insert(directMessages).values({
          id, fromUserId: session.user.id, toUserId,
          body: safeBody, attachments: atts,
        });
      } catch {
        await db.insert(directMessages).values({
          id, fromUserId: session.user.id, toUserId,
          body: safeBody,
        });
      }
      return NextResponse.json({ ok: true, id, toUserId, body: safeBody });
    }

    return NextResponse.json({ error: "channelId or toUserId required" }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/messages]", err?.message || err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
