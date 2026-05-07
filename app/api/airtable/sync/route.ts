import { NextRequest, NextResponse } from "next/server";
import { syncEmployees } from "@/lib/airtable/sync";

// This endpoint is called by Railway cron or an admin trigger.
// Protected by a pre-shared secret — never expose the Airtable key.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-sync-secret");
  const expectedSecret = process.env.SYNC_SECRET;

  if (!expectedSecret || authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const syncType = searchParams.get("type") ?? "employees";

  try {
    if (syncType === "employees") {
      const result = await syncEmployees();
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unknown sync type" }, { status: 400 });
  } catch (err) {
    console.error("[Airtable sync] Error:", err);
    return NextResponse.json(
      { error: "Sync failed", detail: String(err) },
      { status: 500 }
    );
  }
}
