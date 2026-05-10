import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { channelId, toUserId, body: msgBody = "" } = body;
  const safeBody = (msgBody || "").trim() || " ";
  const id = crypto.randomUUID();
  const sql = getPg();

  try {
    if (channelId) {
      await sql`
        INSERT INTO channel_messages (id, channel_id, user_id, body, reactions, edited, created_at)
        VALUES (${id}, ${channelId}, ${session.user.id}, ${safeBody}, '{}', false, NOW())
      `;
      return NextResponse.json({ ok: true, id, channelId, body: safeBody, createdAt: new Date() });
    }
    if (toUserId) {
      const exists = await sql`SELECT 1 FROM pg_tables WHERE tablename='direct_messages' AND schemaname='public'`;
      if (!exists.length) return NextResponse.json({ error: "DM table not ready" }, { status: 503 });
      await sql`
        INSERT INTO direct_messages (id, from_user_id, to_user_id, body, reactions, read, created_at)
        VALUES (${id}, ${session.user.id}, ${toUserId}, ${safeBody}, '{}', false, NOW())
      `;
      return NextResponse.json({ ok: true, id, toUserId, body: safeBody, createdAt: new Date() });
    }
    return NextResponse.json({ error: "channelId or toUserId required" }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/messages]", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
