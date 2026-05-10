import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channels, channelMembers, channelMessages, channelInvites, users } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { ChannelsLayout } from "@/components/channels/ChannelsLayout";

export const metadata = { title: "Channels" };
export const dynamic = "force-dynamic";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; dm?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const sp = await searchParams;
  const activeChannelId = sp.c || null;
  const activeDmUserId = sp.dm || null;

  const [allChannels, allUsers, myMemberships, pendingInvitesRaw] = await Promise.all([
    db.selectDistinct({
      id: channels.id, name: channels.name,
      description: channels.description, emoji: channels.emoji,
      type: channels.type, createdBy: channels.createdBy,
    }).from(channels).where(isNull(channels.archivedAt)).orderBy(channels.name),

    db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users).limit(100),

    db.select({ channelId: channelMembers.channelId })
      .from(channelMembers).where(eq(channelMembers.userId, session.user.id)),

    // Pending invites for current user
    db.select({
      id: channelInvites.id,
      channelId: channelInvites.channelId,
      channelName: channels.name,
      channelEmoji: channels.emoji,
      inviterName: users.name,
    })
    .from(channelInvites)
    .leftJoin(channels, eq(channelInvites.channelId, channels.id))
    .leftJoin(users, eq(channelInvites.invitedBy, users.id))
    .where(and(eq(channelInvites.invitedUser, session.user.id), eq(channelInvites.status, "pending"))),
  ]);

  const memberOf = myMemberships.map(m => m.channelId);

  // Initial messages
  let initialMessages: any[] = [];
  if (activeChannelId) {
    initialMessages = await db.select({
      id: channelMessages.id, body: channelMessages.body,
      reactions: channelMessages.reactions, attachments: channelMessages.attachments,
      edited: channelMessages.edited, createdAt: channelMessages.createdAt,
      userId: channelMessages.userId, userName: users.name, userAvatar: users.avatarUrl,
      deletedAt: channelMessages.deletedAt,
    })
    .from(channelMessages)
    .leftJoin(users, eq(channelMessages.userId, users.id))
    .where(and(eq(channelMessages.channelId, activeChannelId), isNull(channelMessages.parentId)))
    .orderBy(desc(channelMessages.createdAt)).limit(80);
    initialMessages.reverse();
  }

  const activeView = activeChannelId
    ? { type: "channel" as const, id: activeChannelId }
    : activeDmUserId
    ? { type: "dm" as const, userId: activeDmUserId }
    : null;

  const pendingInvites = pendingInvitesRaw.map(i => ({
    id: i.id,
    channelId: i.channelId,
    channelName: i.channelName || "unknown",
    channelEmoji: i.channelEmoji || "💬",
    inviterName: i.inviterName || "Someone",
  }));

  return (
    <ChannelsLayout
      currentUser={{ id: session.user.id, name: session.user.name || "", avatar: session.user.image }}
      allChannels={allChannels}
      memberOf={memberOf}
      activeView={activeView}
      initialMessages={initialMessages}
      allUsers={allUsers}
      pendingInvites={pendingInvites}
    />
  );
}
