import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { newPassword } = await req.json();
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    // Hash the password using better-auth's internal hash
    // We use the ctx.password.hash utility from better-auth
    const { hashPassword } = await import("better-auth/crypto");
    const hashed = await hashPassword(newPassword);

    // Check if user has a credential account already
    const [existingAccount] = await db
      .select().from(accounts)
      .where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, "credential")));

    if (existingAccount) {
      // Update existing credential account
      await db.update(accounts)
        .set({ password: hashed })
        .where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, "credential")));
    } else {
      // Create credential account for magic-link user
      await db.insert(accounts).values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        accountId: session.user.id,
        providerId: "credential",
        password: hashed,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Also mark email as verified (needed for email+password login)
    await db.update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[password]", err);
    return NextResponse.json({ error: "Failed to set password. " + String(err) }, { status: 500 });
  }
}
