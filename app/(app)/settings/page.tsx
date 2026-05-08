import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { AirtableKeyForm } from "@/components/settings/AirtableKeyForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const currentKey = process.env.AIRTABLE_API_KEY || "";
  const maskedKey = currentKey.length > 10
    ? currentKey.slice(0, 10) + "..." + currentKey.slice(-4)
    : "(not set)";

  return (
    <>
      <TopBar title="Settings" subtitle="Integrations & API keys" />
      <div className="page-content">
        <div className="max-w-lg space-y-5">
          <div className="card-base p-5">
            <h2 className="heading-sm mb-1">Airtable Integration</h2>
            <p className="text-sm text-muted-foreground mb-4" style={{ fontFamily: "'Barlow', sans-serif" }}>
              Connect your BOSS Airtable base to sync Folios and all tables into TeamBase.
            </p>
            <div className="mb-4 p-3 rounded" style={{ background: "hsl(var(--muted))" }}>
              <p className="label-caps">Current API Key</p>
              <p className="text-sm font-mono mt-1">{maskedKey}</p>
              <p className="label-caps mt-2" style={{ color: "hsl(var(--crimson))" }}>
                Base ID: app8QxH2cjt0fueuW
              </p>
            </div>
            <AirtableKeyForm />
          </div>
        </div>
      </div>
    </>
  );
}
