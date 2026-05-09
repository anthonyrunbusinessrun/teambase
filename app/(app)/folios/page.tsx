import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { airtableFolios } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { TopBar } from "@/components/layout/TopBar";
import { GroupedFoliosView } from "@/components/folios/GroupedFoliosView";
import { SyncButton } from "@/components/folios/SyncButton";
import Link from "next/link";
import { Key } from "lucide-react";

export const metadata = { title: "Folios — BOSS" };
export const dynamic = "force-dynamic";

export default async function FoliosPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const rows = await db.select().from(airtableFolios)
    .orderBy(desc(airtableFolios.synced_at)).limit(500).catch(() => []);

  const folios = rows.map(r => {
    // Parse rawFields to get real VSFs, ASFs, Active, tmLink, group
    let vsfs = 0, asfs = 0, active = 0, tmLink = "";
    try {
      const raw = JSON.parse(r.rawFields || "{}") as Record<string,unknown>;
      vsfs   = typeof raw.VSFs === "number" ? raw.VSFs : 0;
      asfs   = typeof raw.ASFs === "number" ? raw.ASFs : 0;
      active = typeof raw.Active === "number" ? raw.Active : (r.status==="Active" ? 1 : 0);
      tmLink = (raw.Teamwork as any)?.url || raw["TM Link"] as string || "";
    } catch {}
    return {
      id: r.id,
      name: r.name || "Untitled",
      group: r.type || "",           // "3.0 PROJECTS" stored in type column
      category: r.category || "",   // "3.5 Active" resolved from linked Category
      status: r.status || "Unknown",
      description: r.description || "",
      manager: r.manager || "",
      vsfs, asfs, active, tmLink,
    };
  });

  const hasData = folios.length > 0;

  // Stats
  const totalActive = folios.filter(f => f.status === "Active").length;
  const groups = Array.from(new Set(folios.map(f => f.group).filter(Boolean)));

  return (
    <>
      <TopBar
        title="Folios — BOSS"
        subtitle={hasData
          ? `${folios.length} folios · ${totalActive} active · ${groups.length} groups`
          : "No data — click Sync"}
        right={<SyncButton />}
      />
      <div className="page-content">
        {!hasData ? (
          <div className="card-base p-10 text-center">
            <div className="heading-md mb-2">No Folios Synced</div>
            <p className="text-sm text-muted-foreground mb-5">
              Sync your BOSS Airtable base to see folios organized by group.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <SyncButton large />
              <Link href="/settings" className="btn-outline">
                <Key size={13} /> Update API Key
              </Link>
            </div>
          </div>
        ) : (
          <GroupedFoliosView folios={folios} />
        )}
      </div>
    </>
  );
}
