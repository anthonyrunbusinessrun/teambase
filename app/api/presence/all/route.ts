import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { presence, users, userProfiles } from "@/lib/db/schema";
import { eq, desc, lt, and } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Mark users with stale heartbeats (>90s) as offline
  const staleThreshold = new Date(Date.now() - 90_000);
  await db.update(presence)
    .set({ status: "offline" })
    .where(and(
      eq(presence.status, "online"),
      lt(presence.lastSeenAt, staleThreshold),
    ))
    .catch(() => {});

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: presence.status,
      lastSeenAt: presence.lastSeenAt,
      positionTitle: userProfiles.positionTitle,
    })
    .from(users)
    .leftJoin(presence, eq(presence.userId, users.id))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .orderBy(desc(presence.lastSeenAt));

  return NextResponse.json(members, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
