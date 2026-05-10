import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import postgres from "postgres";

// Get raw postgres client - same connection string as the app
function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return postgres(url, { ssl: "require", max: 1 });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { channelId, toUserId, body: msgBody = "" } = body;
  const safeBody = (msgBody || "").trim() || " ";
  const id = crypto.randomUUID();

  const sql = getClient();
  try {
    if (channelId) {
      await sql`
        INSERT INTO channel_messages (id, channel_id, user_id, body, reactions, edited, created_at)
        VALUES (${id}, ${channelId}, ${session.user.id}, ${safeBody}, '{}', false, NOW())
      `;
      return NextResponse.json({ ok: true, id, channelId, body: safeBody, createdAt: new Date() });
    }

    if (toUserId) {
      // Check if direct_messages table exists first
      const tables = await sql`
        SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='direct_messages'
      `;
      if (!tables.length) {
        return NextResponse.json({ error: "DMs not ready yet — DB migrating. Try again in 1 min." }, { status: 503 });
      }
      await sql`
        INSERT INTO direct_messages (id, from_user_id, to_user_id, body, reactions, read, created_at)
        VALUES (${id}, ${session.user.id}, ${toUserId}, ${safeBody}, '{}', false, NOW())
      `;
      return NextResponse.json({ ok: true, id, toUserId, body: safeBody, createdAt: new Date() });
    }

    return NextResponse.json({ error: "channelId or toUserId required" }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/messages]", err?.message);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  } finally {
    await sql.end();
  }
}
