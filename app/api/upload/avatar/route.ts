import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { users, userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: "Max 3MB" }, { status: 413 });
    const allowed = ["image/jpeg","image/png","image/webp","image/gif"];
    if (!allowed.includes(file.type)) return NextResponse.json({ error: "Use JPG, PNG, WebP or GIF" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    await db.update(users).set({ avatarUrl: dataUrl, updatedAt: new Date() }).where(eq(users.id, session.user.id));
    await db.insert(userProfiles).values({ userId: session.user.id, avatarUrl: dataUrl, updatedAt: new Date() })
      .onConflictDoUpdate({ target: userProfiles.userId, set: { avatarUrl: dataUrl, updatedAt: new Date() } });

    return NextResponse.json({ ok: true, avatarUrl: dataUrl });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
