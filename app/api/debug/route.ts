import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import postgres from "postgres";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
  try {
    const [userCols, msgCols, sampleUser] = await Promise.all([
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`,
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'channel_messages' ORDER BY ordinal_position`,
      sql`SELECT * FROM users LIMIT 1`,
    ]);
    return NextResponse.json({ userCols, msgCols, sampleUser });
  } finally {
    await sql.end();
  }
}
