import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import postgres from "postgres";

function getSql() {
  return postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const sql = getSql();
  try {
    let rows;
    if (since) {
      rows = await sql`
        SELECT
          m.id, m.body,
          COALESCE(m.reactions, '{}') as reactions,
          m.edited,
          m.created_at   as "createdAt",
          m.user_id      as "userId",
          m.deleted_at   as "deletedAt",
          u.name         as "userName",
          u.avatar_url   as "userAvatar",
          m.user_id      as "fromUserId",
          u.name         as "fromName",
          u.avatar_url   as "fromAvatar"
        FROM channel_messages m
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ${channelId}
          AND (m.deleted_at IS NULL)
          AND m.created_at > ${new Date(since)}
        ORDER BY m.created_at ASC
        LIMIT 50
      `;
    } else {
      rows = await sql`
        SELECT
          m.id, m.body,
          COALESCE(m.reactions, '{}') as reactions,
          m.edited,
          m.created_at   as "createdAt",
          m.user_id      as "userId",
          m.deleted_at   as "deletedAt",
          u.name         as "userName",
          u.avatar_url   as "userAvatar",
          m.user_id      as "fromUserId",
          u.name         as "fromName",
          u.avatar_url   as "fromAvatar"
        FROM channel_messages m
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ${channelId}
          AND (m.deleted_at IS NULL)
        ORDER BY m.created_at DESC
        LIMIT 80
      `;
      rows = [...rows].reverse();
    }

    return NextResponse.json(
      rows.map(r => ({ ...r, attachments: "[]" })),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[channels GET]", err?.message);
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  } finally {
    await sql.end();
  }
}
