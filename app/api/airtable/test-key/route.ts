import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const apiKey = (searchParams.get("key") || "").replace(/\s+/g, "");
  const baseId = "app8QxH2cjt0fueuW";
  
  if (!apiKey) return NextResponse.json({ ok: false, error: "No key provided" });
  
  try {
    // Test key via metadata endpoint
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      return NextResponse.json({ ok: false, status: res.status, error: err.error?.message || JSON.stringify(err) });
    }
    
    const data = await res.json();
    const tables = (data.tables || []).map((t: any) => ({ id: t.id, name: t.name }));
    return NextResponse.json({ ok: true, tables: tables.length, tableList: tables });
  } catch(e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
