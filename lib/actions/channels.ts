"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channels, channelMembers, channelMessages } from "@/lib/db/schema";
import { eq, and, desc, isNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) throw new Error("Unauthorized");
  return s.user;
}

export async function createChannel(name: string, description: string, emoji: string) {
  const user = await getUser();
  const id = crypto.randomUUID();
  await db.insert(channels).values({ id, name: name.toLowerCase().replace(/\s+/g,"-"), description, emoji, createdBy: user.id, type: "public" });
  await db.insert(channelMembers).values({ channelId: id, userId: user.id, role: "admin" });
  // Welcome message
  await db.insert(channelMessages).values({ channelId: id, userId: user.id, body: `👋 Welcome to **#${name}**! ${description || ""}` });
  revalidatePath("/channels");
  return id;
}

export async function joinChannel(channelId: string) {
  const user = await getUser();
  await db.insert(channelMembers).values({ channelId, userId: user.id }).onConflictDoNothing();
  revalidatePath("/channels");
}

export async function sendMessage(channelId: string, body: string, parentId?: string) {
  const user = await getUser();
  const id = crypto.randomUUID();
  await db.insert(channelMessages).values({ id, channelId, userId: user.id, body, parentId });
  return { id, userId: user.id, body, channelId, createdAt: new Date(), edited: false };
}

export async function editMessage(messageId: string, body: string) {
  const user = await getUser();
  await db.update(channelMessages)
    .set({ body, edited: true, editedAt: new Date() })
    .where(and(eq(channelMessages.id, messageId), eq(channelMessages.userId, user.id)));
}

export async function deleteMessage(messageId: string) {
  const user = await getUser();
  await db.update(channelMessages)
    .set({ deletedAt: new Date() })
    .where(and(eq(channelMessages.id, messageId), eq(channelMessages.userId, user.id)));
}

export async function toggleReaction(messageId: string, emoji: string) {
  const user = await getUser();
  const [msg] = await db.select({ reactions: channelMessages.reactions }).from(channelMessages).where(eq(channelMessages.id, messageId));
  if (!msg) return;
  const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
  if (!reactions[emoji]) reactions[emoji] = [];
  const idx = reactions[emoji].indexOf(user.id);
  if (idx >= 0) reactions[emoji].splice(idx, 1);
  else reactions[emoji].push(user.id);
  if (reactions[emoji].length === 0) delete reactions[emoji];
  await db.update(channelMessages).set({ reactions: JSON.stringify(reactions) }).where(eq(channelMessages.id, messageId));
}

export async function markChannelRead(channelId: string) {
  const user = await getUser();
  await db.update(channelMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));
}
