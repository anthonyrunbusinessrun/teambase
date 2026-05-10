import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId, toUserId, body, attachments = [] } = await req.json();
  if (!body?.trim() && !attachments.length) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const msgBody = body?.trim() || " ";
  const id = crypto.randomUUID();
  const now = new Date();

  try {
    if (channelId) {
      // Channel message — try with attachments column first
      try {
        await db.execute(sql`
          INSERT INTO channel_messages (id, channel_id, user_id, body, attachments, reactions, edited, created_at)
          VALUES (${id}, ${channelId}, ${session.user.id}, ${msgBody}, ${JSON.stringify(attachments)}, '{}', false, ${now})
        `);
      } catch {
        // attachments column missing — insert without it
        await db.execute(sql`
          INSERT INTO channel_messages (id, channel_id, user_id, body, reactions, edited, created_at)
          VALUES (${id}, ${channelId}, ${session.user.id}, ${msgBody}, '{}', false, ${now})
        `);
      }
      return NextResponse.json({ ok: true, id, channelId, body: msgBody, createdAt: now });
    }

    if (toUserId) {
      // Direct message
      try {
        await db.execute(sql`
          INSERT INTO direct_messages (id, from_user_id, to_user_id, body, attachments, reactions, read, created_at)
          VALUES (${id}, ${session.user.id}, ${toUserId}, ${msgBody}, ${JSON.stringify(attachments)}, '{}', false, ${now})
        `);
      } catch {
        await db.execute(sql`
          INSERT INTO direct_messages (id, from_user_id, to_user_id, body, reactions, read, created_at)
          VALUES (${id}, ${session.user.id}, ${toUserId}, ${msgBody}, '{}', false, ${now})
        `);
      }
      return NextResponse.json({ ok: true, id, toUserId, body: msgBody, createdAt: now });
    }

    return NextResponse.json({ error: "channelId or toUserId required" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/messages]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
