/**
 * Airtable REST API client — direct fetch, no SDK type issues.
 */

function baseId(): string { return (process.env.AIRTABLE_BASE_ID || "").replace(/\s+/g, ""); }
function apiKey(): string { return (process.env.AIRTABLE_API_KEY || "").replace(/\s+/g, ""); }

export interface AirtableRecord<T extends Record<string, unknown>> {
  id: string;
  fields: T;
  createdTime: string;
}

async function req(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${baseId()}/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Airtable ${res.status}: ${err}`);
  }
  return res.json();
}

export async function fetchAll<T extends Record<string, unknown>>(
  tableName: string,
  options: { maxRecords?: number; filterByFormula?: string; sort?: Array<{ field: string; direction?: "asc" | "desc" }>; fields?: string[]; view?: string } = {}
): Promise<AirtableRecord<T>[]> {
  const all: AirtableRecord<T>[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (options.view)            params.set("view", options.view);
    if (options.maxRecords)      params.set("maxRecords", String(options.maxRecords));
    if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
    if (options.fields)          options.fields.forEach(f => params.append("fields[]", f));
    if (options.sort)            options.sort.forEach((s, i) => { params.set(`sort[${i}][field]`, s.field); if (s.direction) params.set(`sort[${i}][direction]`, s.direction); });
    if (offset)                  params.set("offset", offset);

    const data = await req(`${encodeURIComponent(tableName)}?${params}`);
    for (const r of data.records || []) all.push({ id: r.id, fields: r.fields as T, createdTime: r.createdTime });
    offset = data.offset;
  } while (offset);
  return all;
}

export async function createRecord<T extends Record<string, unknown>>(
  tableName: string, fields: Partial<T>
): Promise<AirtableRecord<T>> {
  const data = await req(encodeURIComponent(tableName), { method: "POST", body: JSON.stringify({ fields }) });
  return { id: data.id, fields: data.fields as T, createdTime: data.createdTime };
}

export async function updateRecord<T extends Record<string, unknown>>(
  tableName: string, recordId: string, fields: Partial<T>
): Promise<AirtableRecord<T>> {
  const data = await req(`${encodeURIComponent(tableName)}/${recordId}`, { method: "PATCH", body: JSON.stringify({ fields }) });
  return { id: data.id, fields: data.fields as T, createdTime: data.createdTime };
}

export class AirtableError extends Error {
  constructor(message: string, public statusCode?: number) { super(message); this.name = "AirtableError"; }
}
