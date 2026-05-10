import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { huddleRooms } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json();
  const id = crypto.randomUUID();
  await db.insert(huddleRooms).values({ id, name, status: "active", createdBy: session.user.id, startedAt: new Date() });
  return NextResponse.json({ id, name });
}
