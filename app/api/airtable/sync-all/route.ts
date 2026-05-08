import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { airtableFolios, airtableCache, appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE_ID   = process.env.AIRTABLE_BASE_ID  || "app8QxH2cjt0fueuW";
const FOLIOS_TABLE = "tblhifrn7wgf31Ryx";
const FOLIOS_VIEW  = "viwp5Ojc7265hG56y";

async function resolveKey(override?: string): Promise<string> {
  if (override) return override.replace(/\s+/g, "");
  const envKey = (process.env.AIRTABLE_API_KEY || "").replace(/\s+/g, "");
  if (envKey) return envKey;
  // Fallback: read from DB settings
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "airtable_api_key"));
    if (row?.value) return row.value;
  } catch {}
  return "";
}

async function atFetch(path: string, params: Record<string,string> = {}, apiKey: string) {
  const url = new URL(`https://api.airtable.com/v0/${path}`);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Airtable ${res.status}: ${txt.slice(0,300)}`);
  }
  return res.json();
}

async function fetchAll(tableId: string, apiKey: string, viewId?: string) {
  const all: Array<{ id: string; fields: Record<string,unknown>; createdTime: string }> = [];
  let offset: string | undefined;
  do {
    const params: Record<string,string> = { pageSize: "100" };
    if (viewId) params.view = viewId;
    if (offset) params.offset = offset;
    const data = await atFetch(`${BASE_ID}/${tableId}`, params, apiKey);
    for (const r of (data.records||[])) all.push({ id: r.id, fields: r.fields, createdTime: r.createdTime });
    offset = data.offset;
  } while (offset);
  return all;
}

function pick(f: Record<string,unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = f[k];
    if (v !== undefined && v !== null && v !== "" && v !== "Untitled") {
      if (Array.isArray(v)) {
        const joined = v.map(String).filter(s => s && s !== "Untitled").join(", ");
        if (joined) return joined;
        continue;
      }
      const s = String(v).trim();
      if (s && s !== "Untitled" && s !== "-") return s;
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
  const apiKey = await resolveKey(overrideKey);

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: "No Airtable API key configured. Go to /settings and enter your PAT key.",
    }, { status: 400 });
  }

  // Save key to DB if provided via ?key= param
  if (overrideKey) {
    await db.insert(appSettings).values({
      key: "airtable_api_key", value: overrideKey.replace(/\s+/g,""), updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value: overrideKey.replace(/\s+/g,""), updatedAt: new Date() },
    });
  }

  const results: Record<string,number> = {};
  const errors: string[] = [];

  // Discover all tables
  let tables: Array<{id:string;name:string}> = [];
  try {
    const meta = await atFetch(`meta/bases/${BASE_ID}/tables`, {}, apiKey);
    tables = (meta.tables||[]).map((t: any) => ({ id: t.id, name: t.name }));
    console.log(`[Sync] ${tables.length} tables:`, tables.map(t=>t.name).join(", "));
  } catch(e) {
    return NextResponse.json({ ok: false, error: String(e), hint: "Check your API key in /settings" }, { status: 401 });
  }

  // Sync Folios (priority)
  try {
    const records = await fetchAll(FOLIOS_TABLE, apiKey, FOLIOS_VIEW);
    const fieldNames = Object.keys(records[0]?.fields||{});
    console.log(`[Sync] Folios: ${records.length} records. Fields: ${fieldNames.join(", ")}`);

    for (const r of records) {
      const f = r.fields;
      const row = {
        id: r.id, baseId: BASE_ID, tableId: FOLIOS_TABLE,
        name:            pick(f,"Name","Folio Name","Project Name","Project","Title","Record Name") || r.id,
        client:          pick(f,"Client","Client Name","Account","Company","Customer","Organization"),
        status:          normStatus(pick(f,"Status","Stage","Phase","State")),
        category:        pick(f,"Category","Type","Folio Type","Service Type","Service","Division","Segment"),
        startDate:       pick(f,"Start Date","Start","Date Started","Contract Start","Begin Date") || null,
        endDate:         pick(f,"End Date","End","Due Date","Contract End","Completion Date","Deadline","Close Date") || null,
        manager:         pick(f,"Project Manager","Manager","Account Manager","Lead","Owner","Assigned To","Salesperson"),
        contractValue:   pickNum(f,"Contract Value","Value","Budget","Revenue","Total","Amount","Annual Value","MRR","ARR","Deal Value","Price"),
        percentComplete: pickNum(f,"% Complete","Percent Complete","Progress","Completion","Done %"),
        type:            pick(f,"Type","Folio Type","Category","Service","Project Type","Engagement Type"),
        priority:        pick(f,"Priority","Urgency","Importance"),
        description:     pick(f,"Description","Notes","Details","Summary","Scope","Overview","Notes/Comments"),
        tags:            JSON.stringify(
          Array.isArray(f.Tags)?f.Tags.map(String).filter(Boolean):
          Array.isArray(f.Labels)?f.Labels.map(String).filter(Boolean):[]
        ),
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
      const records = await fetchAll(t.id, apiKey);
      for (const r of records) {
        await db.insert(airtableCache).values({
          id: `${BASE_ID}:${t.id}:${r.id}`,
          baseId: BASE_ID, tableName: t.name, recordId: r.id,
          fields: JSON.stringify(r.fields), syncedAt: new Date(),
        }).onConflictDoUpdate({
          target: airtableCache.id,
          set: { fields: JSON.stringify(r.fields), syncedAt: new Date() },
        });
      }
      results[t.name] = records.length;
    } catch(e) {
      errors.push(`${t.name}: ${String(e).slice(0,100)}`);
    }
  }

  return NextResponse.json({
    ok: true, keyLen: apiKey.length, base: BASE_ID,
    tables: tables.map(t=>t.name), synced: results, errors,
  });
}
