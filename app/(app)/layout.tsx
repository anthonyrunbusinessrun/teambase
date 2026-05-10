import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { PresenceHeartbeat } from "@/components/presence/PresenceHeartbeat";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Minimal query — just tasks for deadline countdown
  let upcomingTasks: any[] = [];
  try {
    const sql = getPg();
    const rows = await sql`
      SELECT id, title, due_date as "dueDate", priority
      FROM tasks
      WHERE status NOT IN ('done','cancelled')
        AND due_date IS NOT NULL
        AND due_date > NOW()
      ORDER BY due_date ASC LIMIT 3
    `;
    upcomingTasks = rows.map((r: any) => ({ ...r, dueDate: r.dueDate?.toISOString() }));
  } catch {}

  return (
    <>
      <PresenceHeartbeat />
      <ClientLayout upcomingTasks={upcomingTasks}>{children}</ClientLayout>
    </>
  );
}
