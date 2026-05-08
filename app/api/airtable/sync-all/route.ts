import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { airtableFolios, airtableCache } from "@/lib/db/schema";

const HARDCODED_KEY  = process.env.AIRTABLE_API_KEY_BACKUP || "";
const HARDCODED_BASE = "app8QxH2cjt0fueuW";
const FOLIOS_TABLE   = "tblhifrn7wgf31Ryx";
const FOLIOS_VIEW    = "viwp5Ojc7265hG56y";

function getKey(override?: string) {
  if (override) return override.replace(/\s+/g,"");
  return (process.env.AIRTABLE_API_KEY||"").replace(/\s+/g,"") || HARDCODED_KEY;
}
function getBase() { return (process.env.AIRTABLE_BASE_ID||"").replace(/\s+/g,"") || HARDCODED_BASE; }

async function atFetch(path: string, params: Record<string,string> = {}, apiKey?: string) {
  const url = new URL(`https://api.airtable.com/v0/${path}`);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${getKey(apiKey)}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Airtable ${res.status}: ${txt.slice(0,300)}`);
  }
  return res.json();
}

async function fetchAll(tableId: string, viewId?: string, apiKey?: string) {
  const all: Array<{ id: string; fields: Record<string,unknown>; createdTime: string }> = [];
  let offset: string | undefined;
  do {
    const params: Record<string,string> = { pageSize: "100" };
    if (viewId) params.view = viewId;
    if (offset) params.offset = offset;
    const data = await atFetch(`${getBase()}/${tableId}`, params, apiKey);
    for (const r of (data.records||[])) all.push({ id: r.id, fields: r.fields, createdTime: r.createdTime });
    offset = data.offset;
  } while (offset);
  return all;
}

function pick(f: Record<string,unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = f[k];
    if (v !== undefined && v !== null && v !== "") {
      if (Array.isArray(v)) return v.map(String).join(", ");
      return String(v);
    }
  }
  return "";
}
function pickNum(f: Record<string,unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = f[k];
    if (typeof v === "number" && !isNaN(v)) return String(v);
    if (typeof v === "string" && v.trim()) {
      const n = parseFloat(v.replace(/[$,%]/g,""));
      if (!isNaN(n)) return String(n);
    }
  }
  return null;
}
function normStatus(s: string) {
  const l = (s||"").toLowerCase();
  if (l.includes("active")||l.includes("progress")||l.includes("current")||l.includes("open")) return "Active";
  if (l.includes("complete")||l.includes("done")||l.includes("finish")||l.includes("close")||l.includes("win")) return "Complete";
  if (l.includes("hold")||l.includes("pause")||l.includes("wait")) return "On Hold";
  if (l.includes("cancel")||l.includes("void")||l.includes("lost")) return "Cancelled";
  if (l.includes("prospect")||l.includes("pending")||l.includes("proposal")||l.includes("lead")) return "Prospect";
  return s || "Unknown";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const overrideKey = searchParams.get("key") || undefined;
  
  const results: Record<string,number> = {};
  const errors: string[] = [];
  const effectiveKey = getKey(overrideKey);

  // Test connection first
  let tables: Array<{id:string;name:string}> = [];
  try {
    const meta = await atFetch(`meta/bases/${getBase()}/tables`, {}, overrideKey);
    tables = (meta.tables||[]).map((t: any) => ({ id: t.id, name: t.name }));
    console.log(`[Sync] ${tables.length} tables:`, tables.map(t=>t.name).join(", "));
  } catch(e) {
    errors.push(`meta: ${e}`);
    // Return early if can't connect
    return NextResponse.json({
      ok: false,
      keyLen: effectiveKey.length,
      base: getBase(),
      error: "Cannot connect to Airtable. API key may be expired. Go to /settings to update it.",
      errors,
    });
  }

  // Sync Folios (priority)
  try {
    const records = await fetchAll(FOLIOS_TABLE, FOLIOS_VIEW, overrideKey);
    const fieldSample = Object.keys(records[0]?.fields||{}).join(", ");
    console.log(`[Sync] Folios: ${records.length}. Fields: ${fieldSample}`);
    
    for (const r of records) {
      const f = r.fields;
      const row = {
        id: r.id, baseId: getBase(), tableId: FOLIOS_TABLE,
        name:            pick(f,"Name","Folio Name","Project Name","Project","Title","Record Name") || "Untitled",
        client:          pick(f,"Client","Client Name","Account","Company","Customer","Organization") || "—",
        status:          normStatus(pick(f,"Status","Stage","Phase","State")),
        category:        pick(f,"Category","Type","Folio Type","Service Type","Service","Division","Department") || "",
        startDate:       pick(f,"Start Date","Start","Date Started","Contract Start","Begin Date") || null,
        endDate:         pick(f,"End Date","End","Due Date","Contract End","Completion Date","Deadline","Close Date") || null,
        manager:         pick(f,"Project Manager","Manager","Account Manager","Lead","Owner","Assigned To") || "—",
        contractValue:   pickNum(f,"Contract Value","Value","Budget","Revenue","Total","Amount","Annual Value","Deal Value","MRR","ARR"),
        percentComplete: pickNum(f,"% Complete","Percent Complete","Progress","Completion","Percent"),
        type:            pick(f,"Type","Folio Type","Category","Service","Project Type","Engagement Type") || "—",
        priority:        pick(f,"Priority","Urgency","Importance") || "—",
        description:     pick(f,"Description","Notes","Details","Summary","Scope","Overview") || "",
        tags:            JSON.stringify(Array.isArray(f.Tags)?f.Tags.map(String):Array.isArray(f.Labels)?f.Labels.map(String):[]),
        rawFields:       JSON.stringify(f),
        airtableCreatedAt: r.createdTime,
        synced_at:       new Date(),
        locallyModified: false,
        pendingDelete:   false,
      };
      await db.insert(airtableFolios).values(row).onConflictDoUpdate({
        target: airtableFolios.id,
        set: { ...row, synced_at: new Date() },
      });
    }
    results.folios = records.length;
  } catch(e) {
    errors.push(`Folios: ${e}`);
    console.error("[Sync] Folios:", e);
  }

  // Sync all other tables
  for (const t of tables) {
    if (t.id === FOLIOS_TABLE) continue;
    try {
      const records = await fetchAll(t.id, undefined, overrideKey);
      for (const r of records) {
        await db.insert(airtableCache).values({
          id: `${getBase()}:${t.id}:${r.id}`,
          baseId: getBase(), tableName: t.name, recordId: r.id,
          fields: JSON.stringify(r.fields), syncedAt: new Date(),
        }).onConflictDoUpdate({
          target: airtableCache.id,
          set: { fields: JSON.stringify(r.fields), syncedAt: new Date() },
        });
      }
      results[t.name] = records.length;
      console.log(`[Sync] ${t.name}: ${records.length}`);
    } catch(e) {
      errors.push(`${t.name}: ${String(e).slice(0,80)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    keyLen: effectiveKey.length,
    base: getBase(),
    tables: tables.map(t=>t.name),
    synced: results,
    errors,
  });
}
