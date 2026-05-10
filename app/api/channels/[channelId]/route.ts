import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json([]);

  const { channelId } = await params;
  const since = new URL(req.url).searchParams.get("since");
  const sql = getPg();

  try {
    // NOTE: No avatar_url — client uses DiceBear from name. Saves 99% of payload size.
    let rows;
    if (since) {
      rows = await sql`
        SELECT m.id, m.body, COALESCE(m.reactions,'{}') as reactions,
          m.edited, m.created_at as "createdAt",
          m.user_id as "userId", m.deleted_at as "deletedAt",
          u.full_name as "userName",
          m.user_id as "fromUserId", u.full_name as "fromName"
        FROM channel_messages m
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ${channelId} AND m.deleted_at IS NULL
          AND m.created_at > ${new Date(since)}
        ORDER BY m.created_at ASC LIMIT 50
      `;
    } else {
      rows = await sql`
        SELECT m.id, m.body, COALESCE(m.reactions,'{}') as reactions,
          m.edited, m.created_at as "createdAt",
          m.user_id as "userId", m.deleted_at as "deletedAt",
          u.full_name as "userName",
          m.user_id as "fromUserId", u.full_name as "fromName"
        FROM channel_messages m
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ${channelId} AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC LIMIT 60
      `;
      rows = [...rows].reverse();
    }
    return NextResponse.json(
      rows.map((r: any) => ({ ...r, userAvatar: null, fromAvatar: null, attachments: "[]" })),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[channels GET]", err?.message);
    return NextResponse.json([]);
  }
}
