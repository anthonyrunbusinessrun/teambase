import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { huddleRooms, huddleParticipants, users } from "@/lib/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { HuddlePage } from "@/components/huddle/HuddlePage";

export const metadata = { title: "Huddle" };
export const dynamic = "force-dynamic";

export default async function HuddleServerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const rooms = await db.select({
    id: huddleRooms.id, name: huddleRooms.name,
    status: huddleRooms.status, startedAt: huddleRooms.startedAt,
    createdBy: huddleRooms.createdBy,
    creatorName: users.name,
  })
  .from(huddleRooms)
  .leftJoin(users, eq(huddleRooms.createdBy, users.id))
  .orderBy(desc(huddleRooms.startedAt))
  .limit(20);

  const allUsers = await db.select({ id: users.id, name: users.name, phone: users.email }).from(users).limit(30);

  return (
    <HuddlePage
      rooms={rooms as any}
      currentUser={{ id: session.user.id, name: session.user.name || session.user.email || "You" }}
      allUsers={allUsers}
    />
  );
}
