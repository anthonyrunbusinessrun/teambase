import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { airtableFolios, airtableCache } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { TopBar } from "@/components/layout/TopBar";
import { GroupedFoliosView } from "@/components/folios/GroupedFoliosView";
import { SyncButton } from "@/components/folios/SyncButton";
import Link from "next/link";
import { Key, RefreshCw } from "lucide-react";

export const metadata = { title: "Folios — BOSS" };
export const dynamic = "force-dynamic";

// Get categories from cache
async function getCategories() {
  try {
    const rows = await db.select().from(airtableCache)
      .where(require("drizzle-orm").eq(airtableCache.tableName, "Categories"));
    return rows.map(r => {
      try {
        const f = JSON.parse(r.fields) as Record<string,unknown>;
        return {
          id: r.recordId,
          code: String(f["Value Code/Title"] || ""),
          group: String(f.Group || ""),
        };
      } catch { return null; }
    }).filter(Boolean) as Array<{id:string;code:string;group:string}>;
  } catch { return []; }
}

async function getFoliosFromDB() {
  try {
    const rows = await db.select().from(airtableFolios)
      .orderBy(desc(airtableFolios.synced_at)).limit(500);
    return rows.map(r => ({
      id: r.id,
      name: r.name || "Untitled",
      group: r.type || "",        // we store Group in the type field
      category: r.category || "", // sub-category like "3.9 Archive"
      status: r.status || "Unknown",
      description: r.description || "",
      manager: r.manager || "",
      vsfs: 0, asfs: 0,
      active: r.status === "Active",
      rawFields: r.rawFields || "{}",
    }));
  } catch { return []; }
}

export default async function FoliosPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const [folios, categories] = await Promise.all([getFoliosFromDB(), getCategories()]);

  // Parse raw fields to get Group directly
  const enrichedFolios = folios.map(f => {
    try {
      const raw = JSON.parse(f.rawFields) as Record<string,unknown>;
      const groupArr = Array.isArray(raw.Group) ? raw.Group as string[] : [];
      const groupVal = groupArr[0] || f.group || "";
      const vsfs = typeof raw.VSFs === "number" ? raw.VSFs : 0;
      const asfs = typeof raw.ASFs === "number" ? raw.ASFs : 0;
      const active = typeof raw.Active === "number" ? raw.Active : 0;
      const tmLink = (raw.Teamwork as any)?.url || raw["TM Link"] as string || "";
      const catIds = Array.isArray(raw.Category) ? raw.Category as string[] : [];
      return { ...f, group: groupVal, vsfs, asfs, active, tmLink, catIds };
    } catch { return { ...f, vsfs: 0, asfs: 0, active: 0, tmLink: "", catIds: [] }; }
  });

  const hasData = enrichedFolios.length > 0;

  return (
    <>
      <TopBar
        title="Folios — BOSS"
        subtitle={hasData ? `${enrichedFolios.length} folios · ${categories.length} categories` : "No data synced"}
        right={<SyncButton />}
      />
      <div className="page-content space-y-4">
        {!hasData ? (
          <div className="card-base p-10 text-center">
            <div className="heading-md mb-2">No Folios Synced</div>
            <p className="text-sm text-muted-foreground mb-5">
              Connect your Airtable BOSS base to see your folios organized by group.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <SyncButton large />
              <Link href="/settings" className="btn-outline">
                <Key size={13} /> Update API Key
              </Link>
            </div>
          </div>
        ) : (
          <GroupedFoliosView folios={enrichedFolios} categories={categories} />
        )}
      </div>
    </>
  );
}
