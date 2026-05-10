import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { presence, users, userProfiles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await db
    .select({
      id: users.id, name: users.name, email: users.email,
      avatarUrl: users.avatarUrl, role: users.role,
      status: presence.status, lastSeenAt: presence.lastSeenAt,
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
