import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let apiKey = (searchParams.get("key") || "").replace(/\s+/g, "");

  if (!apiKey) {
    // Try env var
    apiKey = (process.env.AIRTABLE_API_KEY || "").replace(/\s+/g, "");
  }
  if (!apiKey) {
    // Try DB
    try {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "airtable_api_key"));
      if (row?.value) apiKey = row.value;
    } catch {}
  }

  if (!apiKey) return NextResponse.json({ ok: false, error: "No API key — enter one in Settings" });

  const baseId = "app8QxH2cjt0fueuW";
  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      return NextResponse.json({ ok: false, status: res.status, error: err.error?.message || JSON.stringify(err) });
    }
    const data = await res.json();
    const tables = (data.tables||[]).map((t: any) => ({ id: t.id, name: t.name }));
    return NextResponse.json({ ok: true, tables: tables.length, tableList: tables, keyLen: apiKey.length });
  } catch(e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
