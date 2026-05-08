import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { tasks, users } from "@/lib/db/schema";
import { and, ne, eq, asc, isNotNull } from "drizzle-orm";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Get upcoming task deadlines for the navbar countdown
  let upcomingTasks: Array<{ id: string; title: string; dueDate: string; priority: string }> = [];
  try {
    const rows = await db.select({
      id: tasks.id, title: tasks.title,
      dueDate: tasks.dueDate, priority: tasks.priority,
    })
    .from(tasks)
    .where(and(
      ne(tasks.status, "done"),
      ne(tasks.status, "cancelled"),
      isNotNull(tasks.dueDate),
    ))
    .orderBy(asc(tasks.dueDate))
    .limit(5);

    upcomingTasks = rows
      .filter(r => r.dueDate)
      .map(r => ({
        id: r.id, title: r.title, priority: r.priority,
        dueDate: r.dueDate!.toISOString(),
      }));
  } catch { /* ignore */ }

  return (
    <div className="app-layout">
      <Sidebar upcomingTasks={upcomingTasks} />
      <div className="main-content">{children}</div>
    </div>
  );
}
