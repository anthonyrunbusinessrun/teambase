import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { presence, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { subMinutes } from "date-fns";
import { TopBar } from "@/components/layout/TopBar";
import { PresenceCard } from "@/components/presence/PresenceCard";
import { PresenceHeartbeat } from "@/components/presence/PresenceHeartbeat";

export const metadata = { title: "Team" };
export const revalidate = 30; // ISR: revalidate every 30s

async function getTeamPresence() {
  const staleThreshold = subMinutes(new Date(), 5);

  const rows = await db
    .select({
      userId: presence.userId,
      status: presence.status,
      lastSeenAt: presence.lastSeenAt,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      timezone: users.timezone,
    })
    .from(presence)
    .innerJoin(users, eq(presence.userId, users.id))
    .orderBy(desc(presence.lastSeenAt));

  return rows.map((r) => ({
    ...r,
    status:
      r.status === "online" && r.lastSeenAt < staleThreshold
        ? ("offline" as const)
        : r.status,
  }));
}

export default async function PresencePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const team = await getTeamPresence();

  const online = team.filter((m) => m.status === "online");
  const away = team.filter((m) => m.status === "away");
  const offline = team.filter((m) => m.status === "offline");

  return (
    <>
      <TopBar title="Team" />

      {/* Client component — sends heartbeat every 30s */}
      <PresenceHeartbeat />

      <main className="px-5 pt-4 pb-6 space-y-6">
        {online.length > 0 && (
          <section>
            <p className="section-label px-0 pt-0">Online · {online.length}</p>
            <div className="space-y-2">
              {online.map((m) => (
                <PresenceCard key={m.userId} member={m} isCurrentUser={m.userId === session.user.id} />
              ))}
            </div>
          </section>
        )}

        {away.length > 0 && (
          <section>
            <p className="section-label px-0 pt-0">Away · {away.length}</p>
            <div className="space-y-2">
              {away.map((m) => (
                <PresenceCard key={m.userId} member={m} isCurrentUser={m.userId === session.user.id} />
              ))}
            </div>
          </section>
        )}

        {offline.length > 0 && (
          <section>
            <p className="section-label px-0 pt-0">Offline · {offline.length}</p>
            <div className="space-y-2 opacity-60">
              {offline.map((m) => (
                <PresenceCard key={m.userId} member={m} isCurrentUser={m.userId === session.user.id} />
              ))}
            </div>
          </section>
        )}

        {team.length === 0 && (
          <div className="card-base p-8 text-center">
            <p className="text-sm text-muted-foreground">No team members yet</p>
          </div>
        )}
      </main>
    </>
  );
}
