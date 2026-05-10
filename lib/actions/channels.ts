"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channels, channelMembers, channelMessages, channelInvites, directMessages, users } from "@/lib/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) throw new Error("Unauthorized");
  return s.user;
}

// ── Channels ─────────────────────────────────────────────────────────────────

export async function createChannel(name: string, description: string, emoji: string, isPrivate = false) {
  const user = await getUser();
  const id = crypto.randomUUID();
  await db.insert(channels).values({
    id, name: name.toLowerCase().replace(/\s+/g, "-"),
    description, emoji, createdBy: user.id,
    type: isPrivate ? "private" : "public",
  });
  // Only creator is a member — others must be invited
  await db.insert(channelMembers).values({ channelId: id, userId: user.id, role: "admin" });
  await db.insert(channelMessages).values({
    channelId: id, userId: user.id,
    body: `👋 **#${name}** created${description ? ` — ${description}` : ""}`,
    attachments: "[]",
  });
  revalidatePath("/channels");
  return id;
}

export async function inviteToChannel(channelId: string, invitedUserId: string) {
  const user = await getUser();
  // Check inviter is member
  const [mem] = await db.select().from(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));
  if (!mem) throw new Error("Not a member");
  // Don't re-invite if already a member
  const [existing] = await db.select().from(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, invitedUserId)));
  if (existing) return { already: true };
  // Create invite
  await db.insert(channelInvites).values({
    channelId, invitedBy: user.id, invitedUser: invitedUserId, status: "pending",
  }).onConflictDoNothing();
  revalidatePath("/channels");
  return { ok: true };
}

export async function acceptInvite(inviteId: string) {
  const user = await getUser();
  const [invite] = await db.select().from(channelInvites)
    .where(and(eq(channelInvites.id, inviteId), eq(channelInvites.invitedUser, user.id)));
  if (!invite) throw new Error("Invite not found");
  await db.insert(channelMembers).values({ channelId: invite.channelId, userId: user.id }).onConflictDoNothing();
  await db.update(channelInvites).set({ status: "accepted" }).where(eq(channelInvites.id, inviteId));
  revalidatePath("/channels");
  return invite.channelId;
}

export async function declineInvite(inviteId: string) {
  const user = await getUser();
  await db.update(channelInvites)
    .set({ status: "declined" })
    .where(and(eq(channelInvites.id, inviteId), eq(channelInvites.invitedUser, user.id)));
  revalidatePath("/channels");
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
  await db.insert(channelMessages).values({
    id, channelId, userId: user.id, body: body || " ",
    parentId, attachments: JSON.stringify(attachments),
  });
  return { id, userId: user.id, body, channelId, createdAt: new Date(), edited: false, attachments };
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
  const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
  if (!reactions[emoji]) reactions[emoji] = [];
  const idx = reactions[emoji].indexOf(user.id);
  if (idx >= 0) reactions[emoji].splice(idx, 1); else reactions[emoji].push(user.id);
  if (reactions[emoji].length === 0) delete reactions[emoji];
  await db.update(channelMessages).set({ reactions: JSON.stringify(reactions) })
    .where(eq(channelMessages.id, messageId));
}

export async function markChannelRead(channelId: string) {
  const user = await getUser();
  await db.update(channelMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));
}

// ── Direct Messages ──────────────────────────────────────────────────────────

export async function sendDM(toUserId: string, body: string, attachments: any[] = []) {
  const user = await getUser();
  if (user.id === toUserId) throw new Error("Cannot DM yourself");
  await db.insert(directMessages).values({
    fromUserId: user.id, toUserId, body: body || " ",
    attachments: JSON.stringify(attachments),
  });
  revalidatePath("/channels");
}

export async function markDMRead(fromUserId: string) {
  const user = await getUser();
  await db.update(directMessages)
    .set({ read: true })
    .where(and(eq(directMessages.fromUserId, fromUserId), eq(directMessages.toUserId, user.id)));
}

export async function toggleDMReaction(dmId: string, emoji: string) {
  const user = await getUser();
  const [msg] = await db.select({ reactions: directMessages.reactions })
    .from(directMessages).where(eq(directMessages.id, dmId));
  if (!msg) return;
  const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
  if (!reactions[emoji]) reactions[emoji] = [];
  const idx = reactions[emoji].indexOf(user.id);
  if (idx >= 0) reactions[emoji].splice(idx, 1); else reactions[emoji].push(user.id);
  if (reactions[emoji].length === 0) delete reactions[emoji];
  await db.update(directMessages).set({ reactions: JSON.stringify(reactions) })
    .where(eq(directMessages.id, dmId));
}
