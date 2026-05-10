import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channels, channelMembers, channelMessages, users } from "@/lib/db/schema";
import { eq, desc, and, isNull, sql, ne } from "drizzle-orm";
import { ChannelsLayout } from "@/components/channels/ChannelsLayout";

export const metadata = { title: "Channels" };
export const dynamic = "force-dynamic";

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const sp = await searchParams;
  const activeChannelId = sp.c || null;

  // All channels user belongs to + public channels
  const allChannels = await db
    .selectDistinct({
      id: channels.id, name: channels.name,
      description: channels.description, emoji: channels.emoji,
      type: channels.type, createdBy: channels.createdBy,
    })
    .from(channels)
    .leftJoin(channelMembers, eq(channelMembers.channelId, channels.id))
    .where(and(isNull(channels.archivedAt)))
    .orderBy(channels.name);

  // All users for mentions
  const allUsers = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).limit(50);

  // Current user membership
  const myMemberships = await db.select({ channelId: channelMembers.channelId })
    .from(channelMembers).where(eq(channelMembers.userId, session.user.id));
  const memberOf = new Set(myMemberships.map(m => m.channelId));

  // Initial messages for active channel
  let initialMessages: any[] = [];
  if (activeChannelId) {
    initialMessages = await db
      .select({
        id: channelMessages.id, body: channelMessages.body,
        reactions: channelMessages.reactions, edited: channelMessages.edited,
        createdAt: channelMessages.createdAt, userId: channelMessages.userId,
        userName: users.name, userAvatar: users.avatarUrl,
        deletedAt: channelMessages.deletedAt,
      })
      .from(channelMessages)
      .leftJoin(users, eq(channelMessages.userId, users.id))
      .where(and(eq(channelMessages.channelId, activeChannelId), isNull(channelMessages.parentId)))
      .orderBy(desc(channelMessages.createdAt))
      .limit(80);
    initialMessages.reverse();
  }

  return (
    <ChannelsLayout
      currentUser={{ id: session.user.id, name: session.user.name || "", avatar: session.user.image }}
      allChannels={allChannels}
      memberOf={[...memberOf]}
      activeChannelId={activeChannelId}
      initialMessages={initialMessages}
      allUsers={allUsers}
    />
  );
}
