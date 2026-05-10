import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPg } from "@/lib/db/postgres";
import { ChannelsLayout } from "@/components/channels/ChannelsLayout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Channels" };

export default async function ChannelsPage({
  searchParams,
}: { searchParams: Promise<{ c?: string; dm?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const sp = await searchParams;
  const activeDmUserId = sp.dm || null;

  const sql = getPg();

  // All data in parallel — using raw SQL so it ALWAYS works regardless of Drizzle schema
  const [channelsRows, allUsersRows, membershipsRows] = await Promise.all([
    sql`SELECT id, name, description, emoji, type, created_by as "createdBy" FROM channels WHERE archived_at IS NULL ORDER BY name`,
    sql`SELECT id, full_name as name FROM users LIMIT 100`.then((r:any[]) => r.map(u => ({...u, avatarUrl: null}))),  // No avatar - saves MB of payload
    sql`SELECT channel_id as "channelId" FROM channel_members WHERE user_id = ${session.user.id}`,
  ]);

  const memberOf = membershipsRows.map((m: any) => m.channelId as string);

  // Auto-select first channel
  const firstChannel = memberOf[0] || null;
  const activeChannelId = sp.c || (!activeDmUserId && firstChannel ? firstChannel : null);

  // Load messages server-side with raw SQL
  let initialMessages: any[] = [];
  if (activeChannelId) {
    const rows = await sql`
      SELECT m.id, m.body,
        COALESCE(m.reactions, '{}') as reactions,
        m.edited, m.created_at as "createdAt",
        m.user_id as "userId",
        m.deleted_at as "deletedAt",
        u.full_name as "userName",
        u.avatar_url as "userAvatar",
        m.user_id as "fromUserId",
        u.full_name as "fromName",
        u.avatar_url as "fromAvatar"
      FROM channel_messages m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.channel_id = ${activeChannelId}
        AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 60
    `;
    initialMessages = [...rows].reverse().map((r: any) => ({ ...r, attachments: "[]", userAvatar: null, fromAvatar: null }));
  }

  // Pending invites
  let pendingInvites: any[] = [];
  try {
    const inv = await sql`
      SELECT ci.id, ci.channel_id as "channelId",
        c.name as "channelName", c.emoji as "channelEmoji",
        u.full_name as "inviterName"
      FROM channel_invites ci
      LEFT JOIN channels c ON c.id = ci.channel_id
      LEFT JOIN users u ON u.id = ci.invited_by
      WHERE ci.invited_user = ${session.user.id} AND ci.status = 'pending'
    `;
    pendingInvites = inv.map((i: any) => ({
      id: i.id, channelId: i.channelId,
      channelName: i.channelName || "unknown",
      channelEmoji: i.channelEmoji || "💬",
      inviterName: i.inviterName || "Someone",
    }));
  } catch {}

  const activeView = activeChannelId
    ? { type: "channel" as const, id: activeChannelId }
    : activeDmUserId
    ? { type: "dm" as const, userId: activeDmUserId }
    : null;

  return (
    <ChannelsLayout
      currentUser={{
        id: session.user.id,
        name: session.user.name || session.user.email?.split("@")[0] || "You",
        avatar: session.user.image,
      }}
      allChannels={channelsRows as any}
      memberOf={memberOf}
      activeView={activeView}
      initialMessages={initialMessages}
      allUsers={allUsersRows as any}
      pendingInvites={pendingInvites}
    />
  );
}
