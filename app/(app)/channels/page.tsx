import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channels, channelMembers, channelMessages, users } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { ChannelsLayout } from "@/components/channels/ChannelsLayout";
import { redirect } from "next/navigation";

export const metadata = { title: "Channels" };
export const dynamic = "force-dynamic";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; dm?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const sp = await searchParams;
  const activeChannelId = sp.c || null;
  const activeDmUserId  = sp.dm || null;

  // Run all queries with individual try/catch so one missing table doesn't kill the page
  const [allChannels, allUsers, myMemberships] = await Promise.all([
    db.select({
      id: channels.id, name: channels.name,
      description: channels.description, emoji: channels.emoji,
      type: channels.type, createdBy: channels.createdBy,
    }).from(channels).where(isNull(channels.archivedAt)).orderBy(channels.name)
      .catch(() => [] as any[]),

    db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users).limit(100).catch(() => [] as any[]),

    db.select({ channelId: channelMembers.channelId })
      .from(channelMembers).where(eq(channelMembers.userId, session.user.id))
      .catch(() => [] as any[]),
  ]);

  // New tables — try/catch individually
  let pendingInvites: any[] = [];
  try {
    const { channelInvites } = await import("@/lib/db/schema");
    pendingInvites = await db
      .select({
        id: channelInvites.id, channelId: channelInvites.channelId,
        channelName: channels.name, channelEmoji: channels.emoji,
        inviterName: users.name,
      })
      .from(channelInvites)
      .leftJoin(channels, eq(channelInvites.channelId, channels.id))
      .leftJoin(users, eq(channelInvites.invitedBy, users.id))
      .where(and(
        eq(channelInvites.invitedUser, session.user.id),
        eq(channelInvites.status, "pending"),
      ))
      .catch(() => []);
  } catch { pendingInvites = []; }

  // Initial messages
  let initialMessages: any[] = [];
  if (activeChannelId) {
    try {
      const rows = await db
        .select({
          id: channelMessages.id, body: channelMessages.body,
          reactions: channelMessages.reactions,
          attachments: channelMessages.attachments,
          edited: channelMessages.edited,
          createdAt: channelMessages.createdAt,
          userId: channelMessages.userId,
          userName: users.name, userAvatar: users.avatarUrl,
          deletedAt: channelMessages.deletedAt,
          fromUserId: channelMessages.userId,
          fromName: users.name, fromAvatar: users.avatarUrl,
        })
        .from(channelMessages)
        .leftJoin(users, eq(channelMessages.userId, users.id))
        .where(and(
          eq(channelMessages.channelId, activeChannelId),
          isNull(channelMessages.deletedAt),
        ))
        .orderBy(desc(channelMessages.createdAt))
        .limit(60);
      initialMessages = rows.reverse();
    } catch { initialMessages = []; }
  }

  if (activeDmUserId) {
    try {
      const { directMessages } = await import("@/lib/db/schema");
      const { or } = await import("drizzle-orm");
      const rows = await db
        .select({
          id: directMessages.id, body: directMessages.body,
          reactions: directMessages.reactions, attachments: directMessages.attachments,
          read: directMessages.read, createdAt: directMessages.createdAt,
          fromUserId: directMessages.fromUserId, toUserId: directMessages.toUserId,
          fromName: users.name, fromAvatar: users.avatarUrl,
          userId: directMessages.fromUserId, userName: users.name,
          userAvatar: users.avatarUrl, edited: directMessages.read,
          deletedAt: directMessages.deletedAt,
        })
        .from(directMessages)
        .leftJoin(users, eq(directMessages.fromUserId, users.id))
        .where(or(
          and(eq(directMessages.fromUserId, session.user.id), eq(directMessages.toUserId, activeDmUserId)),
          and(eq(directMessages.fromUserId, activeDmUserId), eq(directMessages.toUserId, session.user.id)),
        )!)
        .orderBy(desc(directMessages.createdAt))
        .limit(60);
      initialMessages = rows.reverse();
    } catch { initialMessages = []; }
  }

  const activeView = activeChannelId
    ? { type: "channel" as const, id: activeChannelId }
    : activeDmUserId
    ? { type: "dm" as const, userId: activeDmUserId }
    : null;

  return (
    <ChannelsLayout
      currentUser={{ id: session.user.id, name: session.user.name || "", avatar: session.user.image }}
      allChannels={allChannels}
      memberOf={myMemberships.map(m => m.channelId)}
      activeView={activeView}
      initialMessages={initialMessages}
      allUsers={allUsers}
      pendingInvites={pendingInvites.map(i => ({
        id: i.id, channelId: i.channelId,
        channelName: i.channelName || "unknown",
        channelEmoji: i.channelEmoji || "💬",
        inviterName: i.inviterName || "Someone",
      }))}
    />
  );
}
