import { NextRequest, NextResponse } from "next/server";
import { fetchAndCacheFolios, pushLocalChanges, syncGenericTable } from "@/lib/airtable/sync-folios";
import { syncEmployees } from "@/lib/airtable/sync";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-sync-secret");
  if (!process.env.SYNC_SECRET || authHeader !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const syncType = searchParams.get("type") ?? "folios";

  try {
    switch (syncType) {
      case "folios": {
        const result = await fetchAndCacheFolios();
        return NextResponse.json({ ok: true, type: "folios", ...result });
      }
      case "push": {
        const result = await pushLocalChanges();
        return NextResponse.json({ ok: true, type: "push", ...result });
      }
      case "employees": {
        const result = await syncEmployees();
        return NextResponse.json({ ok: true, type: "employees", ...result });
      }
      case "all": {
        const [folios, employees] = await Promise.all([
          fetchAndCacheFolios(),
          syncEmployees(),
        ]);
        return NextResponse.json({ ok: true, type: "all", folios, employees });
      }
      default:
        return NextResponse.json({ error: "Unknown sync type. Use: folios, push, employees, all" }, { status: 400 });
    }
  } catch (err) {
    console.error("[Sync] Error:", err);
    return NextResponse.json({ error: "Sync failed", detail: String(err) }, { status: 500 });
  }
}

// Auto-sync endpoint (no auth required, rate-limited by ISR)
export async function GET() {
  try {
    const result = await fetchAndCacheFolios();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
