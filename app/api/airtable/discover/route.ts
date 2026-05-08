import { NextRequest, NextResponse } from "next/server";

const BASE_ID  = process.env.AIRTABLE_BASE_ID!;
const API_KEY  = process.env.AIRTABLE_API_KEY!;

async function airtable(path: string, params?: Record<string,string>) {
  const url = new URL(`https://api.airtable.com/v0/${path}`);
  if (params) Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  // No auth check — this is temporary discovery, remove after
  try {
    // 1. List all tables
    const meta = await airtable(`meta/bases/${BASE_ID}/tables`);
    const tableList = (meta.tables || []).map((t: any) => ({
      id: t.id, name: t.name,
      fields: (t.fields || []).map((f: any) => ({ id: f.id, name: f.name, type: f.type }))
    }));

    // 2. Sample first 3 records from Folios table specifically
    const foliosRaw = await airtable(`${BASE_ID}/tblhifrn7wgf31Ryx`, {
      maxRecords: "3", view: "viwp5Ojc7265hG56y"
    });

    return NextResponse.json({
      baseId: BASE_ID,
      tables: tableList,
      foliosSample: foliosRaw.records?.slice(0, 2) ?? [],
      foliosError: foliosRaw.error ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
