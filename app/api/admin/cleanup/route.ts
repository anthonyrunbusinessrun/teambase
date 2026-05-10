import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getPg();
  const deleted = await sql`DELETE FROM channels WHERE name ILIKE '%test%' RETURNING name`;
  return NextResponse.json({ deleted: deleted.map((r:any) => r.name) });
}
