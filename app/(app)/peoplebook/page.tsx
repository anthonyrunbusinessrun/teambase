import { TopBar } from "@/components/layout/TopBar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PeoplebookDashboard } from "@/components/peoplebook/PeoplebookDashboard";
import { ExternalLink, Users } from "lucide-react";

export const metadata = { title: "PeopleBook" };
export const dynamic = "force-dynamic";

const PAT = process.env.AIRTABLE_API_KEY || "";
const PB_BASE = "appGGFKuFxQ3Z0Wuz";
const PB_APPLICANTS = "Applicants";
const PB_ROLES = "Roles";
const PB_INTERVIEWS = "Interviews";

async function at(table: string, params = "") {
  const key = PAT.replace(/\s+/g,"");
  if (!key) return [];
  const res = await fetch(
    `https://api.airtable.com/v0/${PB_BASE}/${encodeURIComponent(table)}?maxRecords=200${params ? "&" + params : ""}`,
    { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" }
  );
  if (!res.ok) return [];
  const d = await res.json();
  return (d.records || []).map((r: any) => ({ id: r.id, ...r.fields }));
}

export default async function PeoplebookPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const [applicants, roles, interviews] = await Promise.all([
    at(PB_APPLICANTS),
    at(PB_ROLES),
    at(PB_INTERVIEWS),
  ]);

  // Stage pipeline counts
  const stages: Record<string, number> = {};
  for (const a of applicants) {
    const s = a.Stage || "New";
    stages[s] = (stages[s] || 0) + 1;
  }

  // Roles by department
  const byDept: Record<string, number> = {};
  for (const r of roles) {
    const d = r.Department || "Other";
    byDept[d] = (byDept[d] || 0) + 1;
  }

  const openRoles = roles.filter((r: any) => r.Status === "Open" || !r.Status);
  const newApplicants = applicants.filter((a: any) => a.Stage === "New" || !a.Stage);

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
            <ExternalLink size={13} />
            Open PeopleBook
          </a>
        }
      />
      <div className="page-content space-y-5">
        <PeoplebookDashboard
          applicants={applicants}
          roles={roles}
          interviews={interviews}
          stages={stages}
          openRoles={openRoles}
          newApplicants={newApplicants.length}
        />
      </div>
    </>
  );
}
