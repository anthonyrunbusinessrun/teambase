import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import postgres from "postgres";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
  try {
    const [cols, allMsgs, channels] = await Promise.all([
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'channel_messages' ORDER BY ordinal_position`,
      sql`SELECT id, channel_id, body, created_at, deleted_at, parent_id FROM channel_messages ORDER BY created_at DESC LIMIT 20`,
      sql`SELECT id, name, emoji FROM channels ORDER BY name`,
    ]);
    return NextResponse.json({ cols, channels, allMsgs, totalMsgs: allMsgs.length });
  } finally {
    await sql.end();
  }
}
