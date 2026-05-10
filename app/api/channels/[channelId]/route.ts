import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channelMessages, users } from "@/lib/db/schema";
import { eq, isNull, and, gte, desc, asc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  try {
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
        fromUserId: channelMessages.userId,
        fromName: users.name,
        fromAvatar: users.avatarUrl,
      })
      .from(channelMessages)
      .leftJoin(users, eq(channelMessages.userId, users.id))
      .where(and(...conditions))
      .orderBy(since ? asc(channelMessages.createdAt) : desc(channelMessages.createdAt))
      .limit(since ? 50 : 80);

    return NextResponse.json(since ? messages : messages.reverse(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[channels API]", err);
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }
}
