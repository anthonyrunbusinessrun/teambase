import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = getPg();

  // Ensure columns exist
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS motto text`.catch(() => {});
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS member_id text`.catch(() => {});

  // Assign sequential IDs to anyone missing one, ordered by account creation
  const users = await sql`
    SELECT u.id, u.created_at, up.member_id
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    ORDER BY u.created_at ASC
  `;

  let assigned = 0;
  for (let i = 0; i < users.length; i++) {
    const u = users[i] as any;
    if (!u.member_id) {
      const memberId = String(i + 1).padStart(3, "0");
      await sql`
        INSERT INTO user_profiles (id, user_id, member_id, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${u.id}, ${memberId}, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET member_id = ${memberId}, updated_at = NOW()
      `;
      assigned++;
    }
  }
  return NextResponse.json({ ok: true, total: users.length, assigned });
}
