/**
 * BOSS Airtable — direct REST, hardcoded fallback key.
 */
const HARDCODED_KEY  = process.env.AIRTABLE_API_KEY_BACKUP || "";
const HARDCODED_BASE = "app8QxH2cjt0fueuW";
const FOLIOS_TABLE   = "tblhifrn7wgf31Ryx";
const FOLIOS_VIEW    = "viwp5Ojc7265hG56y";

function key()  { return (process.env.AIRTABLE_API_KEY||"").replace(/\s+/g,"") || HARDCODED_KEY; }
function base() { return (process.env.AIRTABLE_BASE_ID||"").replace(/\s+/g,"") || HARDCODED_BASE; }

async function atGet(path: string, params: Record<string,string> = {}) {
  const url = new URL(`https://api.airtable.com/v0/${path}`);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Airtable ${res.status}: ${txt.slice(0,200)}`);
  }
  return res.json();
}

export interface RawRecord {
  id: string; createdTime: string; fields: Record<string,unknown>;
}

export async function fetchTableRecords(tableId: string, viewId?: string, maxRecords = 500): Promise<RawRecord[]> {
  const all: RawRecord[] = [];
  let offset: string | undefined;
  do {
    const params: Record<string,string> = { pageSize: "100" };
    if (viewId) params.view = viewId;
    if (maxRecords) params.maxRecords = String(maxRecords);
    if (offset) params.offset = offset;
    const data = await atGet(`${base()}/${tableId}`, params);
    for (const r of (data.records||[])) all.push({ id: r.id, fields: r.fields, createdTime: r.createdTime });
    offset = data.offset;
  } while (offset);
  return all;
}

export interface AirtableTableMeta {
  id: string; name: string;
  fields: Array<{ id: string; name: string; type: string }>;
}

export async function getAllTables(): Promise<AirtableTableMeta[]> {
  try {
    const data = await atGet(`meta/bases/${base()}/tables`);
    return (data.tables||[]).map((t: any) => ({
      id: t.id, name: t.name,
      fields: (t.fields||[]).map((f: any) => ({ id: f.id, name: f.name, type: f.type })),
    }));
  } catch(err) {
    console.error("[BOSS] getAllTables:", err);
    return [];
  }
}

export interface NormalizedFolio {
  id: string; name: string; client: string; status: string; category: string;
  startDate: string | null; endDate: string | null; manager: string;
  contractValue: number | null; percentComplete: number | null;
  type: string; priority: string; tags: string[]; description: string;
}

function pick(f: Record<string,unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = f[k];
    if (v!==undefined && v!==null && v!=="") {
      if (Array.isArray(v)) return v.map(String).join(", ");
      return String(v);
    }
  }
  return "";
}
function pickNum(f: Record<string,unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = f[k];
    if (typeof v==="number" && !isNaN(v)) return v;
    if (typeof v==="string" && v.trim()) {
      const n = parseFloat(v.replace(/[$,%]/g,""));
      if (!isNaN(n)) return n;
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

export function normalizeFolio(id: string, f: Record<string,unknown>): NormalizedFolio {
  return {
    id,
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
    tags:            Array.isArray(f.Tags)?f.Tags.map(String):Array.isArray(f.Labels)?f.Labels.map(String):[],
    description:     pick(f,"Description","Notes","Details","Summary","Scope","Overview") || "",
  };
}

export async function getFolios(): Promise<NormalizedFolio[]> {
  try {
    console.log(`[BOSS] getFolios — key:${key().slice(0,20)}... base:${base()}`);
    const records = await fetchTableRecords(FOLIOS_TABLE, FOLIOS_VIEW);
    console.log(`[BOSS] Got ${records.length} folios. Fields: ${Object.keys(records[0]?.fields||{}).join(", ")}`);
    return records.map(r => normalizeFolio(r.id, r.fields));
  } catch(err) {
    console.error("[BOSS] getFolios:", err);
    return [];
  }
}

export async function getFolioStats(folios: NormalizedFolio[]) {
  return {
    active:     folios.filter(f=>f.status==="Active").length,
    complete:   folios.filter(f=>f.status==="Complete").length,
    onHold:     folios.filter(f=>f.status==="On Hold").length,
    prospect:   folios.filter(f=>f.status==="Prospect").length,
    total:      folios.length,
    totalValue: folios.reduce((s,f)=>s+(f.contractValue||0),0),
    avgComplete: folios.length
      ? Math.round(folios.reduce((s,f)=>s+(f.percentComplete||0),0)/folios.length)
      : 0,
  };
}
