"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { channels, channelMembers, channelMessages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
  await db.insert(channelMessages).values({
    channelId: id,
    userId: user.id,
    body: `👋 **#${name}** created${description ? ` — ${description}` : ""}`,
    attachments: "[]",
  }).catch(() => 
    db.insert(channelMessages).values({ channelId: id, userId: user.id, body: `👋 #${name} created` })
  );
  revalidatePath("/channels");
  return id;
}

export async function sendMessage(channelId: string, body: string, attachments: any[] = []) {
  const user = await getUser();
  const id = crypto.randomUUID();
  const safeBody = (body || "").trim() || " ";
  const safeAtts = JSON.stringify(attachments || []);

  // Try full insert first
  try {
    await db.insert(channelMessages).values({
      id, channelId, userId: user.id, body: safeBody, attachments: safeAtts,
    });
    return { id, ok: true };
  } catch (e1) {
    console.error("[sendMessage] failed:", e1);
    throw new Error("Failed to send message. Please try again.");
  }
}

export async function toggleReaction(messageId: string, emoji: string) {
  const user = await getUser();
  try {
    const [msg] = await db.select({ reactions: channelMessages.reactions })
      .from(channelMessages).where(eq(channelMessages.id, messageId));
    if (!msg) return;
    const r = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
    if (!r[emoji]) r[emoji] = [];
    const idx = r[emoji].indexOf(user.id);
    if (idx >= 0) r[emoji].splice(idx, 1); else r[emoji].push(user.id);
    if (r[emoji].length === 0) delete r[emoji];
    await db.update(channelMessages).set({ reactions: JSON.stringify(r) })
      .where(eq(channelMessages.id, messageId));
  } catch {}
}

export async function inviteToChannel(channelId: string, invitedUserId: string) {
  const user = await getUser();
  try {
    const { channelInvites } = await import("@/lib/db/schema");
    const [existing] = await db.select().from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, invitedUserId)));
    if (existing) return { already: true };
    await db.insert(channelInvites).values({
      channelId, invitedBy: user.id, invitedUser: invitedUserId, status: "pending",
    }).onConflictDoNothing();
    return { ok: true };
  } catch {
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
    if (!invite) throw new Error("Not found");
    await db.insert(channelMembers).values({ channelId: invite.channelId, userId: user.id }).onConflictDoNothing();
    await db.update(channelInvites).set({ status: "accepted" }).where(eq(channelInvites.id, inviteId));
    return invite.channelId;
  } catch { return ""; }
}

export async function declineInvite(inviteId: string) {
  const user = await getUser();
  try {
    const { channelInvites } = await import("@/lib/db/schema");
    await db.update(channelInvites).set({ status: "declined" })
      .where(and(eq(channelInvites.id, inviteId), eq(channelInvites.invitedUser, user.id)));
  } catch {}
}

export async function markChannelRead(channelId: string) {
  const user = await getUser();
  await db.update(channelMembers).set({ lastReadAt: new Date() })
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));
}

export async function sendDM(toUserId: string, body: string, attachments: any[] = []) {
  const user = await getUser();
  if (user.id === toUserId) throw new Error("Cannot DM yourself");
  const safeBody = (body || "").trim() || " ";
  try {
    const { directMessages } = await import("@/lib/db/schema");
    await db.insert(directMessages).values({
      fromUserId: user.id, toUserId,
      body: safeBody, attachments: JSON.stringify(attachments || []),
    });
  } catch (err) {
    // fallback: raw SQL if table schema mismatch
    try {
      // Simplified fallback without attachments
      const { directMessages } = await import("@/lib/db/schema");
      await db.insert(directMessages).values({
        fromUserId: user.id, toUserId, body: safeBody,
      });
    } catch (e2) {
      throw new Error("DM send failed. Please try again.");
    }
  }
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
    await db.update(directMessages).set({ reactions: JSON.stringify(r) })
      .where(eq(directMessages.id, dmId));
  } catch {}
}
