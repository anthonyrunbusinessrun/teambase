import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channels, channelMembers, channelMessages, channelInvites, directMessages, users } from "@/lib/db/schema";
import { eq, and, isNull, desc, or, ne } from "drizzle-orm";
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
  const activeDmUserId = sp.dm || null;

  // All data in parallel
  const [allChannels, allUsers, myMemberships, pendingInvitesRaw, initialMessages] = await Promise.all([
    db.select({
      id: channels.id, name: channels.name,
      description: channels.description, emoji: channels.emoji,
      type: channels.type, createdBy: channels.createdBy,
    }).from(channels).where(isNull(channels.archivedAt)).orderBy(channels.name),

    db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).limit(100),

    db.select({ channelId: channelMembers.channelId })
      .from(channelMembers).where(eq(channelMembers.userId, session.user.id)),

    db.select({
      id: channelInvites.id, channelId: channelInvites.channelId,
      channelName: channels.name, channelEmoji: channels.emoji,
      inviterName: users.name,
    })
    .from(channelInvites)
    .leftJoin(channels, eq(channelInvites.channelId, channels.id))
    .leftJoin(users, eq(channelInvites.invitedBy, users.id))
    .where(and(eq(channelInvites.invitedUser, session.user.id), eq(channelInvites.status, "pending"))),

    // Load initial messages server-side for the active view
    activeChannelId
      ? db.select({
          id: channelMessages.id, body: channelMessages.body,
          reactions: channelMessages.reactions, attachments: channelMessages.attachments,
          edited: channelMessages.edited, createdAt: channelMessages.createdAt,
          userId: channelMessages.userId, userName: users.name, userAvatar: users.avatarUrl,
          deletedAt: channelMessages.deletedAt,
          // Normalize for shared Message type
          fromUserId: channelMessages.userId, toUserId: channelMessages.channelId,
          fromName: users.name, fromAvatar: users.avatarUrl, read: channelMessages.edited,
        })
        .from(channelMessages)
        .leftJoin(users, eq(channelMessages.userId, users.id))
        .where(and(eq(channelMessages.channelId, activeChannelId), isNull(channelMessages.deletedAt)))
        .orderBy(desc(channelMessages.createdAt)).limit(60)
        .then(rows => rows.reverse())
      : activeDmUserId
      ? db.select({
          id: directMessages.id, body: directMessages.body,
          reactions: directMessages.reactions, attachments: directMessages.attachments,
          read: directMessages.read, createdAt: directMessages.createdAt,
          fromUserId: directMessages.fromUserId, toUserId: directMessages.toUserId,
          fromName: users.name, fromAvatar: users.avatarUrl,
          // Fill channel-only fields with null
          edited: directMessages.read, userId: directMessages.fromUserId,
          userName: users.name, userAvatar: users.avatarUrl, deletedAt: directMessages.deletedAt,
        })
        .from(directMessages)
        .leftJoin(users, eq(directMessages.fromUserId, users.id))
        .where(or(
          and(eq(directMessages.fromUserId, session.user.id), eq(directMessages.toUserId, activeDmUserId)),
          and(eq(directMessages.fromUserId, activeDmUserId), eq(directMessages.toUserId, session.user.id)),
        )!)
        .orderBy(desc(directMessages.createdAt)).limit(60)
        .then(rows => rows.reverse())
      : Promise.resolve([]),
  ]);

  const memberOf = myMemberships.map(m => m.channelId);

  const activeView = activeChannelId
    ? { type: "channel" as const, id: activeChannelId }
    : activeDmUserId
    ? { type: "dm" as const, userId: activeDmUserId }
    : null;

  const pendingInvites = pendingInvitesRaw.map(i => ({
    id: i.id, channelId: i.channelId,
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
      initialMessages={initialMessages as any}
      allUsers={allUsers}
      pendingInvites={pendingInvites}
    />
  );
}
