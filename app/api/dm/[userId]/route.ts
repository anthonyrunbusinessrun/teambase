import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json([]);

  const { userId } = await params;
  const since = new URL(req.url).searchParams.get("since");
  const myId = session.user.id;
  const sql = getPg();

  try {
    const check = await sql`SELECT 1 FROM pg_tables WHERE tablename='direct_messages' AND schemaname='public'`;
    if (!check.length) return NextResponse.json([]);

    let rows;
    if (since) {
      rows = await sql`
        SELECT m.id, m.body, m.from_user_id as "fromUserId", m.to_user_id as "toUserId",
          COALESCE(m.reactions,'{}') as reactions, m.read,
          m.created_at as "createdAt", m.deleted_at as "deletedAt",
          u.full_name as "fromName", m.from_user_id as "userId", u.full_name as "userName"
        FROM direct_messages m LEFT JOIN users u ON u.id = m.from_user_id
        WHERE ((m.from_user_id=${myId} AND m.to_user_id=${userId})
            OR (m.from_user_id=${userId} AND m.to_user_id=${myId}))
          AND m.created_at > ${new Date(since)}
        ORDER BY m.created_at ASC LIMIT 50
      `;
    } else {
      rows = await sql`
        SELECT m.id, m.body, m.from_user_id as "fromUserId", m.to_user_id as "toUserId",
          COALESCE(m.reactions,'{}') as reactions, m.read,
          m.created_at as "createdAt", m.deleted_at as "deletedAt",
          u.full_name as "fromName", m.from_user_id as "userId", u.full_name as "userName"
        FROM direct_messages m LEFT JOIN users u ON u.id = m.from_user_id
        WHERE (m.from_user_id=${myId} AND m.to_user_id=${userId})
           OR (m.from_user_id=${userId} AND m.to_user_id=${myId})
        ORDER BY m.created_at DESC LIMIT 60
      `;
      rows = [...rows].reverse();
    }
    return NextResponse.json(
      rows.map((r: any) => ({ ...r, fromAvatar: null, userAvatar: null, attachments: "[]" })),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[dm GET]", err?.message);
    return NextResponse.json([]);
  }
}
