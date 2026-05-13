import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getPg();

  // Mark stale users offline
  await sql`
    UPDATE presence SET status = 'offline'
    WHERE status = 'online' AND last_seen_at < NOW() - INTERVAL '90 seconds'
  `.catch(() => {});

  const members = await sql`
    SELECT
      u.id, u.full_name AS name, u.email,
      u.avatar_url AS "avatarUrl", u.role,
      p.status, p.last_seen_at AS "lastSeenAt",
      up.position_title AS "positionTitle",
      up.bio, up.location, up.phone,
      up.motto, up.member_id AS "memberId"
    FROM users u
    LEFT JOIN presence p ON p.user_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    ORDER BY
      CASE WHEN p.status = 'online' THEN 0 WHEN p.status = 'away' THEN 1 ELSE 2 END,
      up.member_id ASC NULLS LAST
  `.catch(() => []);

  return NextResponse.json(members, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
