import { TopBar } from "@/components/layout/TopBar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PeoplebookDashboard } from "@/components/peoplebook/PeoplebookDashboard";
import { ExternalLink } from "lucide-react";

export const metadata = { title: "PeopleBook" };
export const dynamic = "force-dynamic";

const PB_BASE = "appGGFKuFxQ3Z0Wuz";

async function getKey(): Promise<string> {
  // 1. Try env var (stripped of whitespace)
  const envKey = (process.env.AIRTABLE_API_KEY || "").replace(/\s+/g, "");
  if (envKey) return envKey;
  // 2. Fall back to DB-stored key (saved via /settings page)
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "airtable_api_key"));
    if (row?.value) return row.value;
  } catch {}
  return "";
}

async function atFetch(key: string, table: string, max = 200) {
  if (!key) return [];
  const res = await fetch(
    `https://api.airtable.com/v0/${PB_BASE}/${encodeURIComponent(table)}?maxRecords=${max}`,
    { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" }
  );
  if (!res.ok) {
    console.error(`[PeopleBook] ${table} fetch failed: ${res.status}`);
    return [];
  }
  const d = await res.json();
  return (d.records || []).map((r: any) => ({ id: r.id, ...r.fields }));
}

export default async function PeoplebookPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const key = await getKey();

  const [applicants, roles, interviews] = await Promise.all([
    atFetch(key, "Applicants"),
    atFetch(key, "Roles"),
    atFetch(key, "Interviews"),
  ]);

  const stages: Record<string, number> = {};
  for (const a of applicants as any[]) {
    const s = (a as any).Stage || "New";
    stages[s] = (stages[s] || 0) + 1;
  }

  const openRoles = (roles as any[]).filter((r: any) => !r.Status || r.Status === "Open");
  const newApplicants = (applicants as any[]).filter((a: any) => !a.Stage || a.Stage === "New").length;

  return (
    <>
      <TopBar
        title="PeopleBook"
        subtitle={`${applicants.length} applicants · ${openRoles.length} open roles`}
        right={
          <a
            href="https://www.peoplebook.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ fontSize: "0.72rem", padding: "0.4rem 1rem" }}
          >
            <ExternalLink size={13} /> Open PeopleBook
          </a>
        }
      />
      <div className="page-content space-y-5">
        <PeoplebookDashboard
          applicants={applicants as any}
          roles={roles as any}
          interviews={interviews as any}
          stages={stages}
          openRoles={openRoles as any}
          newApplicants={newApplicants}
          noKey={!key}
        />
      </div>
    </>
  );
}
