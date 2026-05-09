import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { airtableFolios, airtableCache, appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE_ID      = "app8QxH2cjt0fueuW";
const FOLIOS_TABLE = "tblhifrn7wgf31Ryx";
const FOLIOS_VIEW  = "viwp5Ojc7265hG56y";

async function resolveKey(override?: string): Promise<string> {
  if (override) return override.replace(/\s+/g,"");
  const envKey = (process.env.AIRTABLE_API_KEY||"").replace(/\s+/g,"");
  if (envKey) return envKey;
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key,"airtable_api_key"));
    if (row?.value) return row.value;
  } catch {}
  return "";
}

async function atFetch(path: string, params: Record<string,string>={}, key: string) {
  const url = new URL(`https://api.airtable.com/v0/${path}`);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` }, cache: "no-store",
  });
  if (!res.ok) throw new Error(`AT ${res.status}: ${await res.text().catch(()=>"")}`);
  return res.json();
}

async function fetchAll(tableId: string, key: string, viewId?: string) {
  const all: Array<{id:string;fields:Record<string,unknown>;createdTime:string}> = [];
  let offset: string|undefined;
  do {
    const p: Record<string,string> = { pageSize:"100" };
    if (viewId) p.view = viewId;
    if (offset) p.offset = offset;
    const d = await atFetch(`${BASE_ID}/${tableId}`, p, key);
    for (const r of d.records||[]) all.push({id:r.id,fields:r.fields,createdTime:r.createdTime});
    offset = d.offset;
  } while (offset);
  return all;
}

function str(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join(", ");
  if (typeof v==="object") return (v as any).label||"";
  return String(v).trim();
}
function num(f: Record<string,unknown>, ...keys: string[]): string|null {
  for (const k of keys) {
    const v = f[k];
    if (typeof v==="number" && !isNaN(v)) return String(v);
    if (typeof v==="string" && v.trim()) { const n=parseFloat(v.replace(/[$,%]/g,"")); if(!isNaN(n)) return String(n); }
  }
  return null;
}
function normStatus(s:string) {
  const l=(s||"").toLowerCase();
  if(l.includes("active")||l.includes("progress")||l.includes("current")||l.includes("open")) return "Active";
  if(l.includes("complete")||l.includes("done")||l.includes("finish")||l.includes("close")||l.includes("win")) return "Complete";
  if(l.includes("hold")||l.includes("pause")||l.includes("wait")) return "On Hold";
  if(l.includes("cancel")||l.includes("void")||l.includes("lost")) return "Cancelled";
  if(l.includes("prospect")||l.includes("pending")||l.includes("proposal")||l.includes("lead")) return "Prospect";
  return s||"Unknown";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const overrideKey = searchParams.get("key")||undefined;
  const key = await resolveKey(overrideKey);
  if (!key) return NextResponse.json({ok:false,error:"No API key. Go to /settings."},{status:400});

  if (overrideKey) {
    await db.insert(appSettings).values({key:"airtable_api_key",value:overrideKey,updatedAt:new Date()})
      .onConflictDoUpdate({target:appSettings.key,set:{value:overrideKey,updatedAt:new Date()}});
  }

  const results: Record<string,number> = {};
  const errors: string[] = [];

  // Discover tables
  let tables: Array<{id:string;name:string}> = [];
  try {
    const meta = await atFetch(`meta/bases/${BASE_ID}/tables`,{},key);
    tables = (meta.tables||[]).map((t:any)=>({id:t.id,name:t.name}));
  } catch(e) {
    return NextResponse.json({ok:false,error:String(e),hint:"Check API key in /settings"},{status:401});
  }

  // Sync Folios with real field names
  try {
    const records = await fetchAll(FOLIOS_TABLE, key, FOLIOS_VIEW);
    console.log(`[Sync] Folios: ${records.length}. Fields: ${Object.keys(records[0]?.fields||{}).join(", ")}`);
    for (const r of records) {
      const f = r.fields;
      // Real field names from Airtable BOSS base
      const group    = Array.isArray(f.Group) ? f.Group[0] as string : str(f.Group);
      const category = Array.isArray(f.Category) ? (f.Category as string[]).join(",") : str(f.Category);
      const row = {
        id: r.id, baseId: BASE_ID, tableId: FOLIOS_TABLE,
        name:            str(f.Folio) || str(f.Name) || str(f["Record Name"]) || r.id,
        client:          str(f.Client) || str(f.Account) || "",
        status:          normStatus(str(f.Status) || (f.Active ? "Active" : "Unknown")),
        category:        str(f["Value Code/Title"]) || category || "",
        startDate:       str(f["Start Date"]) || str(f.Start) || null,
        endDate:         str(f["End Date"]) || str(f.End) || null,
        manager:         str(f["Project Manager"]) || str(f.Manager) || str(f.Owner) || "",
        contractValue:   num(f,"Contract Value","Value","Budget","Revenue","Total","Amount"),
        percentComplete: num(f,"% Complete","Percent Complete","Progress"),
        type:            group || str(f.Type) || str(f["Folio Type"]) || "",
        priority:        str(f.Priority) || "",
        description:     str(f.Narrative) || str(f.Description) || str(f.Notes) || "",
        tags:            JSON.stringify(Array.isArray(f.Tags)?f.Tags.map(String):[]),
        rawFields:       JSON.stringify(f),
        airtableCreatedAt: r.createdTime,
        synced_at:       new Date(),
        locallyModified: false,
        pendingDelete:   false,
      };
      await db.insert(airtableFolios).values(row).onConflictDoUpdate({
        target: airtableFolios.id, set:{...row, synced_at:new Date()},
      });
    }
    results.folios = records.length;
  } catch(e) { errors.push(`Folios: ${e}`); console.error("[Sync] Folios:",e); }

  // All other tables
  for (const t of tables) {
    if (t.id===FOLIOS_TABLE) continue;
    try {
      const records = await fetchAll(t.id, key);
      for (const r of records) {
        await db.insert(airtableCache).values({
          id:`${BASE_ID}:${t.id}:${r.id}`, baseId:BASE_ID,
          tableName:t.name, recordId:r.id,
          fields:JSON.stringify(r.fields), syncedAt:new Date(),
        }).onConflictDoUpdate({target:airtableCache.id,set:{fields:JSON.stringify(r.fields),syncedAt:new Date()}});
      }
      results[t.name] = records.length;
    } catch(e) { errors.push(`${t.name}: ${String(e).slice(0,80)}`); }
  }

  return NextResponse.json({ok:true,keyLen:key.length,base:BASE_ID,tables:tables.map(t=>t.name),synced:results,errors});
}
