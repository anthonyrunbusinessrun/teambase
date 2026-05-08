import { TopBar } from "@/components/layout/TopBar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { airtableFolios } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { FoliosTable } from "@/components/folios/FoliosTable";
import { FolioStats } from "@/components/folios/FolioStats";
import { getFolios, getFolioStats } from "@/lib/airtable/boss";
import type { NormalizedFolio } from "@/lib/airtable/boss";
import { SyncButton } from "@/components/folios/SyncButton";
import Link from "next/link";
import { Key } from "lucide-react";

export const metadata = { title: "Folios" };
export const dynamic = "force-dynamic";

async function getFromDB(): Promise<NormalizedFolio[]> {
  try {
    const rows = await db.select().from(airtableFolios)
      .orderBy(desc(airtableFolios.synced_at)).limit(500);
    if (!rows.length) return [];
    return rows.map(r => ({
      id: r.id, name: r.name || "Untitled", client: r.client || "—",
      status: r.status || "Unknown", category: r.category || "",
      startDate: r.startDate, endDate: r.endDate, manager: r.manager || "—",
      contractValue: r.contractValue ? parseFloat(r.contractValue) : null,
      percentComplete: r.percentComplete ? parseFloat(r.percentComplete) : null,
      type: r.type || "—", priority: r.priority || "—",
      tags: r.tags ? (() => { try { return JSON.parse(r.tags!); } catch { return []; } })() : [],
      description: r.description || "",
    }));
  } catch { return []; }
}

export default async function FoliosPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  let folios = await getFromDB();
  let source: "db" | "live" | "error" = "db";
  let errorMsg: string | null = null;

  if (folios.length === 0) {
    try {
      folios = await getFolios();
      source = folios.length > 0 ? "live" : "error";
      if (folios.length === 0) errorMsg = "No records returned — API key may be expired";
    } catch(e) {
      errorMsg = String(e);
      source = "error";
    }
  }

  const stats = await getFolioStats(folios);
  const categories = Array.from(new Set(
    folios.map(f => f.category || f.type || "").filter(Boolean)
  )).sort();

  return (
    <>
      <TopBar
        title="Folios — BOSS"
        subtitle={source === "db"
          ? `${stats.total} records synced · ${stats.active} active`
          : source === "live"
          ? `${stats.total} records live from Airtable`
          : "Airtable connection needed"}
        right={<SyncButton />}
      />
      <div className="page-content space-y-5">

        {/* API Key error state */}
        {(errorMsg || source === "error") && (
          <div className="card-accent p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--crimson) / 0.1)" }}>
              <Key size={20} style={{ color: "hsl(var(--crimson))" }} />
            </div>
            <div className="flex-1">
              <p className="heading-sm mb-1">Airtable API Key Needed</p>
              <p className="text-sm text-muted-foreground mb-3" style={{ fontFamily: "'Barlow', sans-serif" }}>
                {errorMsg || "Cannot connect to Airtable."} Your Personal Access Token may have expired.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Link href="/settings" className="btn-primary" style={{ fontSize: "0.72rem" }}>
                  <Key size={12} /> Update API Key in Settings
                </Link>
                <SyncButton />
              </div>
            </div>
          </div>
        )}

        {folios.length > 0 ? (
          <>
            <FolioStats stats={stats} />
            <FoliosTable folios={folios} categories={categories} />
          </>
        ) : !errorMsg ? (
          <div className="card-base p-12 text-center">
            <div className="heading-sm mb-2">No Folios Yet</div>
            <p className="text-sm text-muted-foreground mb-4">
              Click Sync to pull all data from your BOSS Airtable base.
            </p>
            <SyncButton large />
          </div>
        ) : null}
      </div>
    </>
  );
}
