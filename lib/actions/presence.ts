"use server";

import { db } from "@/lib/db";
import { presence } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type PresenceStatus = "online" | "away" | "offline";

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function heartbeat() {
  const userId = await getCurrentUserId();

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

  return { ok: true };
}

export async function setStatus(status: PresenceStatus) {
  const userId = await getCurrentUserId();

  await db
    .insert(presence)
    .values({
      userId,
      status,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: presence.userId,
      set: {
        status,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/presence");
  return { ok: true };
}

export async function markOffline(userId: string) {
  await db
    .update(presence)
    .set({ status: "offline", updatedAt: new Date() })
    .where(eq(presence.userId, userId));
}
