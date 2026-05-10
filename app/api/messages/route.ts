import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import postgres from "postgres";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { channelId, toUserId, body: msgBody = "" } = body;
  const safeBody = (msgBody || "").trim() || " ";
  const id = crypto.randomUUID();

  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "No DATABASE_URL" }, { status: 500 });

  const sql = postgres(url, { ssl: "require", max: 1 });
  try {
    if (channelId) {
      // Insert without optional columns — guaranteed schema-safe
      await sql`
        INSERT INTO channel_messages (id, channel_id, user_id, body, reactions, edited, created_at)
        VALUES (${id}, ${channelId}, ${session.user.id}, ${safeBody}, '{}', false, NOW())
      `;

      // Verify the insert worked by reading it back
      const verify = await sql`SELECT id, channel_id, body FROM channel_messages WHERE id = ${id}`;
      if (!verify.length) {
        return NextResponse.json({ error: "Insert appeared to succeed but row not found" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, id, channelId, body: safeBody, verified: true });
    }

    if (toUserId) {
      // Check direct_messages table exists
      const check = await sql`SELECT 1 FROM pg_tables WHERE tablename='direct_messages' AND schemaname='public'`;
      if (!check.length) {
        return NextResponse.json({ error: "DM table not ready yet. Run db:push first." }, { status: 503 });
      }

      await sql`
        INSERT INTO direct_messages (id, from_user_id, to_user_id, body, reactions, read, created_at)
        VALUES (${id}, ${session.user.id}, ${toUserId}, ${safeBody}, '{}', false, NOW())
      `;
      return NextResponse.json({ ok: true, id, toUserId, body: safeBody });
    }

    return NextResponse.json({ error: "channelId or toUserId required" }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/messages]", err?.message);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  } finally {
    await sql.end();
  }
}
