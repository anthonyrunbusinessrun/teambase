import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { presence } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({ status: "online" }));
  const status = body.status === "offline" ? "offline" : "online";

  await db.insert(presence).values({
    userId: session.user.id,
    status,
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: presence.userId,
    set: { status, lastSeenAt: new Date(), updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}
