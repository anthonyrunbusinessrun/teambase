"use server";

import { db } from "@/lib/db";
import { users, userProfiles } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  positionTitle: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(100).optional(),
  motto: z.string().max(200).optional(),
});

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function updateProfile(formData: {
  name: string;
  positionTitle?: string;
  bio?: string;
  phone?: string;
  location?: string;
  motto?: string;
}) {
  const user = await getUser();
  const data = profileSchema.parse({ ...formData, motto: formData.motto });

  // Update user name
  await db.update(users).set({
    name: data.name,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  // Upsert profile
  await db.insert(userProfiles).values({
    userId: user.id,
    positionTitle: data.positionTitle || null,
    bio: data.bio || null,
    phone: data.phone || null,
    location: data.location || null,
    motto: (formData.motto || null) as any,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: userProfiles.userId,
    set: {
      positionTitle: data.positionTitle || null,
      bio: data.bio || null,
      phone: data.phone || null,
      location: data.location || null,
      motto: (formData.motto || null) as any,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/profile");
  revalidatePath("/presence");
  return { success: true };
}

export async function updateAvatar(avatarUrl: string) {
  const user = await getUser();

  await db.update(users).set({
    avatarUrl,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  await db.insert(userProfiles).values({
    userId: user.id,
    avatarUrl,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: userProfiles.userId,
    set: { avatarUrl, updatedAt: new Date() },
  });

  revalidatePath("/profile");
  revalidatePath("/presence");
  return { success: true };
}

export async function getFullProfile(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
  return { user, profile: profile || null };
}
