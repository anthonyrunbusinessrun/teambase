"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channels, channelMembers, channelMessages } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) throw new Error("Unauthorized");
  return s.user;
}

export async function createChannel(name: string, description: string, emoji: string, isPrivate = false) {
  const user = await getUser();
  const id = crypto.randomUUID();
  await db.insert(channels).values({
    id,
    name: name.toLowerCase().replace(/\s+/g, "-"),
    description: description || null,
    emoji: emoji || "💬",
    createdBy: user.id,
    type: isPrivate ? "private" : "public",
  });
  await db.insert(channelMembers).values({ channelId: id, userId: user.id, role: "admin" });
  // Welcome message — use basic fields only in case attachments col missing
  try {
    await db.insert(channelMessages).values({
      channelId: id,
      userId: user.id,
      body: `👋 **#${name}** created${description ? ` — ${description}` : ""}`,
    });
  } catch { /* ignore if schema not yet migrated */ }
  revalidatePath("/channels");
  return id;
}

export async function inviteToChannel(channelId: string, invitedUserId: string) {
  const user = await getUser();
  try {
    const { channelInvites } = await import("@/lib/db/schema");
    // Check if already member
    const [existing] = await db.select().from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, invitedUserId)));
    if (existing) return { already: true };
    await db.insert(channelInvites).values({
      channelId, invitedBy: user.id, invitedUser: invitedUserId, status: "pending",
    }).onConflictDoNothing();
    revalidatePath("/channels");
    return { ok: true };
  } catch (err) {
    console.error("inviteToChannel:", err);
    // Fallback: just add directly
    await db.insert(channelMembers).values({ channelId, userId: invitedUserId }).onConflictDoNothing();
    return { ok: true };
  }
}

export async function acceptInvite(inviteId: string) {
  const user = await getUser();
  try {
    const { channelInvites } = await import("@/lib/db/schema");
    const [invite] = await db.select().from(channelInvites)
      .where(and(eq(channelInvites.id, inviteId), eq(channelInvites.invitedUser, user.id)));
    if (!invite) throw new Error("Invite not found");
    await db.insert(channelMembers).values({ channelId: invite.channelId, userId: user.id }).onConflictDoNothing();
    await db.update(channelInvites).set({ status: "accepted" }).where(eq(channelInvites.id, inviteId));
    revalidatePath("/channels");
    return invite.channelId;
  } catch { return ""; }
}

export async function declineInvite(inviteId: string) {
  const user = await getUser();
  try {
    const { channelInvites } = await import("@/lib/db/schema");
    await db.update(channelInvites).set({ status: "declined" })
      .where(and(eq(channelInvites.id, inviteId), eq(channelInvites.invitedUser, user.id)));
    revalidatePath("/channels");
  } catch { /* ignore */ }
}

export async function leaveChannel(channelId: string) {
  const user = await getUser();
  await db.delete(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));
  revalidatePath("/channels");
}

export async function sendMessage(channelId: string, body: string, attachments: any[] = [], parentId?: string) {
  const user = await getUser();
  const id = crypto.randomUUID();
  // Try with attachments field first, fallback without it
  try {
    await db.insert(channelMessages).values({
      id, channelId, userId: user.id,
      body: body || " ",
      parentId: parentId || null,
      attachments: JSON.stringify(attachments),
    });
  } catch {
    // attachments column might not exist yet — insert without it
    await db.insert(channelMessages).values({
      id, channelId, userId: user.id,
      body: body || " ",
      parentId: parentId || null,
    });
  }
  return { id, userId: user.id, body, channelId, createdAt: new Date() };
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
  const [msg] = await db.select({ reactions: channelMessages.reactions })
    .from(channelMessages).where(eq(channelMessages.id, messageId));
  if (!msg) return;
  const r = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
  if (!r[emoji]) r[emoji] = [];
  const idx = r[emoji].indexOf(user.id);
  if (idx >= 0) r[emoji].splice(idx, 1); else r[emoji].push(user.id);
  if (r[emoji].length === 0) delete r[emoji];
  await db.update(channelMessages).set({ reactions: JSON.stringify(r) }).where(eq(channelMessages.id, messageId));
}

export async function markChannelRead(channelId: string) {
  const user = await getUser();
  await db.update(channelMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));
}

export async function sendDM(toUserId: string, body: string, attachments: any[] = []) {
  const user = await getUser();
  if (user.id === toUserId) throw new Error("Cannot DM yourself");
  try {
    const { directMessages } = await import("@/lib/db/schema");
    await db.insert(directMessages).values({
      fromUserId: user.id, toUserId,
      body: body || " ",
      attachments: JSON.stringify(attachments),
    });
  } catch (err) {
    console.error("sendDM:", err);
    throw new Error("Messaging not available yet — database migrating. Try again in 1 minute.");
  }
}

export async function markDMRead(fromUserId: string) {
  const user = await getUser();
  try {
    const { directMessages } = await import("@/lib/db/schema");
    await db.update(directMessages)
      .set({ read: true })
      .where(and(eq(directMessages.fromUserId, fromUserId), eq(directMessages.toUserId, user.id)));
  } catch { /* ignore */ }
}

export async function toggleDMReaction(dmId: string, emoji: string) {
  const user = await getUser();
  try {
    const { directMessages } = await import("@/lib/db/schema");
    const [msg] = await db.select({ reactions: directMessages.reactions })
      .from(directMessages).where(eq(directMessages.id, dmId));
    if (!msg) return;
    const r = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
    if (!r[emoji]) r[emoji] = [];
    const idx = r[emoji].indexOf(user.id);
    if (idx >= 0) r[emoji].splice(idx, 1); else r[emoji].push(user.id);
    if (r[emoji].length === 0) delete r[emoji];
    await db.update(directMessages).set({ reactions: JSON.stringify(r) }).where(eq(directMessages.id, dmId));
  } catch { /* ignore */ }
}
