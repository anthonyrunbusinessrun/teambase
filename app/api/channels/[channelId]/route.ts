import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channelMessages, users } from "@/lib/db/schema";
import { eq, desc, isNull, and, gte } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { channelId } = await params;
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const conditions = [
    eq(channelMessages.channelId, channelId),
    isNull(channelMessages.parentId),
    isNull(channelMessages.deletedAt),
  ];
  if (since) conditions.push(gte(channelMessages.createdAt, new Date(since)));

  const messages = await db
    .select({
      id: channelMessages.id,
      body: channelMessages.body,
      reactions: channelMessages.reactions,
      attachments: channelMessages.attachments,
      edited: channelMessages.edited,
      createdAt: channelMessages.createdAt,
      userId: channelMessages.userId,
      userName: users.name,
      userAvatar: users.avatarUrl,
      deletedAt: channelMessages.deletedAt,
    })
    .from(channelMessages)
    .leftJoin(users, eq(channelMessages.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(channelMessages.createdAt))
    .limit(100);

  return NextResponse.json(messages.reverse());
}
