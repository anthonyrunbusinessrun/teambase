export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presence, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { subMinutes } from "date-fns";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-mark stale presences as offline (>5min without heartbeat = offline)
  const staleThreshold = subMinutes(new Date(), 5);

  const teamPresence = await db
    .select({
      userId: presence.userId,
      status: presence.status,
      lastSeenAt: presence.lastSeenAt,
      name: users.name,
      avatarUrl: users.avatarUrl,
      timezone: users.timezone,
    })
    .from(presence)
    .innerJoin(users, eq(presence.userId, users.id))
    .orderBy(desc(presence.lastSeenAt));

  // Apply stale detection without DB update (lightweight)
  const normalized = teamPresence.map((p) => ({
    ...p,
    status:
      p.status === "online" && p.lastSeenAt < staleThreshold
        ? "offline"
        : p.status,
  }));

  return NextResponse.json({ presence: normalized });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  await db
    .insert(presence)
    .values({
      userId,
      status: "online",
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: presence.userId,
      set: {
        status: "online",
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
