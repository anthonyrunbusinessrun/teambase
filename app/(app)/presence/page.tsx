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
export const revalidate = 30;

async function getTeamPresence() {
  const staleThreshold = subMinutes(new Date(), 5);
  const rows = await db
    .select({
      userId: presence.userId, status: presence.status, lastSeenAt: presence.lastSeenAt,
      name: users.name, avatarUrl: users.avatarUrl, timezone: users.timezone,
    })
    .from(presence).innerJoin(users, eq(presence.userId, users.id))
    .orderBy(desc(presence.lastSeenAt));
  return rows.map((r) => ({
    ...r,
    status: r.status === "online" && r.lastSeenAt < staleThreshold ? ("offline" as const) : r.status,
  }));
}

export default async function PresencePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const team = await getTeamPresence();
  const online = team.filter((m) => m.status === "online");
  const away   = team.filter((m) => m.status === "away");
  const offline = team.filter((m) => m.status === "offline");

  return (
    <>
      <TopBar title="Team Presence" subtitle={`${online.length} online now`} />
      <PresenceHeartbeat />

      <div className="page-content">
        {team.length === 0 ? (
          <div className="card-base p-8 text-center">
            <p className="text-sm text-muted-foreground">No team members yet. Sync from Airtable to populate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Online */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <h2 className="heading-sm text-foreground">Online <span className="text-muted-foreground">({online.length})</span></h2>
              </div>
              <div className="space-y-2">
                {online.map((m) => (
                  <PresenceCard key={m.userId} member={m} isCurrentUser={m.userId === session.user.id} />
                ))}
                {online.length === 0 && <p className="text-sm text-muted-foreground py-2">No one online</p>}
              </div>
            </div>

            {/* Away */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <h2 className="heading-sm text-foreground">Away <span className="text-muted-foreground">({away.length})</span></h2>
              </div>
              <div className="space-y-2">
                {away.map((m) => (
                  <PresenceCard key={m.userId} member={m} isCurrentUser={m.userId === session.user.id} />
                ))}
                {away.length === 0 && <p className="text-sm text-muted-foreground py-2">No one away</p>}
              </div>
            </div>

            {/* Offline */}
            <div className="opacity-60">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <h2 className="heading-sm text-foreground">Offline <span className="text-muted-foreground">({offline.length})</span></h2>
              </div>
              <div className="space-y-2">
                {offline.map((m) => (
                  <PresenceCard key={m.userId} member={m} isCurrentUser={m.userId === session.user.id} />
                ))}
                {offline.length === 0 && <p className="text-sm text-muted-foreground py-2">All present</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
