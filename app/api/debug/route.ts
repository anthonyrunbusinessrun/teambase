import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import postgres from "postgres";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
  try {
    // Get actual columns in channel_messages
    const cols = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'channel_messages' 
      ORDER BY ordinal_position
    `;
    
    // Get row count
    const count = await sql`SELECT COUNT(*) as n FROM channel_messages`;
    
    // Get first few rows (no WHERE)
    const rows = await sql`SELECT * FROM channel_messages LIMIT 5`;
    
    return NextResponse.json({ cols, count, rows });
  } finally {
    await sql.end();
  }
}
