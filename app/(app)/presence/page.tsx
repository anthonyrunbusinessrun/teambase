import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";
import { TopBar } from "@/components/layout/TopBar";
import { PresenceList } from "@/components/presence/PresenceList";
import { PresenceHeartbeat } from "@/components/presence/PresenceHeartbeat";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function PresencePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const sql = getPg();

  // Ensure columns exist silently
  await Promise.all([
    sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS motto text`.catch(() => {}),
    sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS member_id text`.catch(() => {}),
  ]);

  // Auto-assign member IDs to anyone missing one
  const needsId = await sql`
    SELECT u.id, u.created_at FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE up.member_id IS NULL
    ORDER BY u.created_at ASC
  `.catch(() => []);

  if ((needsId as any[]).length > 0) {
    // Get total count to number correctly
    const allUsers = await sql`SELECT u.id FROM users u ORDER BY u.created_at ASC`.catch(() => []);
    for (let i = 0; i < (allUsers as any[]).length; i++) {
      const u = (allUsers as any[])[i];
      const memberId = String(i + 1).padStart(3, "0");
      await sql`
        INSERT INTO user_profiles (id, user_id, member_id, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${u.id}, ${memberId}, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET member_id = ${memberId}, updated_at = NOW()
      `.catch(() => {});
    }
  }

  const members = await sql`
    SELECT
      u.id,
      u.full_name     AS name,
      u.email,
      u.avatar_url    AS "avatarUrl",
      u.role,
      p.status,
      p.last_seen_at  AS "lastSeenAt",
      up.position_title AS "positionTitle",
      up.bio,
      up.location,
      up.phone,
      up.motto,
      up.member_id    AS "memberId"
    FROM users u
    LEFT JOIN presence p ON p.user_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    ORDER BY
      CASE WHEN p.status = 'online' THEN 0
           WHEN p.status = 'away'   THEN 1
           ELSE 2 END,
      up.member_id ASC NULLS LAST
  `.catch(() => []);

  const onlineCount = (members as any[]).filter(m => m.status === "online").length;

  return (
    <>
      <TopBar title="Team" subtitle={`${onlineCount} online · ${members.length} members`} />
      <div className="page-content">
        <PresenceHeartbeat />
        <PresenceList members={members as any} currentUserId={session.user.id} />
      </div>
    </>
  );
}
