import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { directMessages, users } from "@/lib/db/schema";
import { eq, or, and, desc, gte, asc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const myId = session.user.id;

  try {
    const baseCondition = or(
      and(eq(directMessages.fromUserId, myId), eq(directMessages.toUserId, userId)),
      and(eq(directMessages.fromUserId, userId), eq(directMessages.toUserId, myId)),
    )!;

    const msgs = await db
      .select({
        id: directMessages.id,
        body: directMessages.body,
        fromUserId: directMessages.fromUserId,
        toUserId: directMessages.toUserId,
        attachments: directMessages.attachments,
        reactions: directMessages.reactions,
        read: directMessages.read,
        createdAt: directMessages.createdAt,
        fromName: users.name,
        fromAvatar: users.avatarUrl,
        userId: directMessages.fromUserId,
        userName: users.name,
        userAvatar: users.avatarUrl,
        edited: directMessages.read,
        deletedAt: directMessages.deletedAt,
      })
      .from(directMessages)
      .leftJoin(users, eq(directMessages.fromUserId, users.id))
      .where(since
        ? and(baseCondition, gte(directMessages.createdAt, new Date(since)))
        : baseCondition
      )
      .orderBy(since ? asc(directMessages.createdAt) : desc(directMessages.createdAt))
      .limit(since ? 50 : 80);

    return NextResponse.json(since ? msgs : msgs.reverse(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[DM API]", err);
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }
}
