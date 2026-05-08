import { TopBar } from "@/components/layout/TopBar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { airtableCache, airtableFolios } from "@/lib/db/schema";
import { SyncButton } from "@/components/folios/SyncButton";
import { BackButton } from "@/components/layout/BackButton";
import { count } from "drizzle-orm";

export const metadata = { title: "All BOSS Tables" };

export default async function AllTablesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const cacheRows = await db.select().from(airtableCache).limit(2000);
  const [folioCount] = await db.select({ count: count() }).from(airtableFolios);

  const tableMap: Record<string, Array<{ recordId: string; fields: Record<string, unknown> }>> = {};
  for (const row of cacheRows) {
    if (!tableMap[row.tableName]) tableMap[row.tableName] = [];
    try { tableMap[row.tableName].push({ recordId: row.recordId, fields: JSON.parse(row.fields) }); } catch {}
  }

  const tableNames = Object.keys(tableMap).sort();

  return (
    <>
      <TopBar title="All BOSS Tables" subtitle={`${tableNames.length + (folioCount.count > 0 ? 1 : 0)} tables synced`}
        left={<BackButton />} right={<SyncButton />} />
      <div className="page-content space-y-6">
        {/* Folios table summary */}
        {folioCount.count > 0 && (
          <div className="card-accent p-4">
            <div className="label-caps mb-1" style={{ color: "hsl(var(--crimson))" }}>Folios (Priority Table)</div>
            <p className="heading-sm">{folioCount.count} records synced</p>
            <a href="/folios" className="label-caps mt-1 inline-block" style={{ color: "hsl(var(--crimson))" }}>View Folios Dashboard →</a>
          </div>
        )}

        {tableNames.length === 0 && folioCount.count === 0 ? (
          <div className="card-base p-8 text-center">
            <p className="heading-sm mb-2">No Tables Synced</p>
            <p className="text-sm text-muted-foreground mb-4">Sync to pull all BOSS Airtable tables.</p>
            <SyncButton large />
          </div>
        ) : tableNames.map(name => {
          const rows = tableMap[name];
          const fields = rows.length > 0 ? Object.keys(rows[0].fields) : [];
          return (
            <div key={name} className="card-base overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <h2 className="heading-sm">{name}</h2>
                  <p className="label-caps">{rows.length} records · {fields.length} fields</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr>{fields.slice(0, 7).map(f => <th key={f}>{f}</th>)}</tr></thead>
                  <tbody>
                    {rows.slice(0, 8).map(row => (
                      <tr key={row.recordId}>
                        {fields.slice(0, 7).map(f => (
                          <td key={f} className="text-sm max-w-40 truncate">
                            {(() => {
                              const v = row.fields[f];
                              if (v == null) return "—";
                              if (Array.isArray(v)) return v.map(String).join(", ") || "—";
                              if (typeof v === "object") return JSON.stringify(v).slice(0, 50);
                              return String(v).slice(0, 80) || "—";
                            })()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
