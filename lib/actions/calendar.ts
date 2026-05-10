"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) throw new Error("Unauthorized");
  return s.user;
}

export async function createEvent(data: {
  title: string; description?: string;
  startAt: string; endAt: string; allDay?: boolean;
  color?: string; taskId?: string;
}) {
  const user = await getUser();
  await db.insert(calendarEvents).values({
    ...data, createdBy: user.id,
    startAt: new Date(data.startAt),
    endAt: new Date(data.endAt),
    allDay: data.allDay ?? false,
  });
  revalidatePath("/calendar");
}

export async function updateEvent(id: string, data: Partial<{
  title: string; description: string; startAt: string; endAt: string; allDay: boolean; color: string;
}>) {
  const user = await getUser();
  await db.update(calendarEvents)
    .set({ ...data, startAt: data.startAt ? new Date(data.startAt) : undefined, endAt: data.endAt ? new Date(data.endAt) : undefined, updatedAt: new Date() })
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.createdBy, user.id)));
  revalidatePath("/calendar");
}

export async function deleteEvent(id: string) {
  const user = await getUser();
  await db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.createdBy, user.id)));
  revalidatePath("/calendar");
}
