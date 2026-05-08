import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { tasks, presence, users } from "@/lib/db/schema";
import { eq, and, ne, desc, count } from "drizzle-orm";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import { ChevronRight, Plus, TrendingUp, Clock } from "lucide-react";

async function getDashboardData(userId: string) {
  const [myTasks, onlineCount, recentTasks] = await Promise.all([
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.assignedTo, userId), ne(tasks.status, "done"), ne(tasks.status, "cancelled"))
    ),
    db.select({ count: count() }).from(presence).where(eq(presence.status, "online")),
    db.select({
      id: tasks.id, title: tasks.title, status: tasks.status,
      priority: tasks.priority, dueDate: tasks.dueDate, assigneeName: users.name,
    })
    .from(tasks).leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(and(ne(tasks.status, "done"), ne(tasks.status, "cancelled")))
    .orderBy(desc(tasks.createdAt)).limit(8),
  ]);
  return {
    myTaskCount: myTasks[0]?.count ?? 0,
    onlineCount: onlineCount[0]?.count ?? 0,
    recentTasks,
  };
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "hsl(0 72% 51%)", high: "hsl(25 90% 50%)",
  medium: "hsl(38 90% 50%)", low: "hsl(var(--muted-foreground))",
};
const STATUS_LABEL: Record<string, string> = {
  todo: "To Do", in_progress: "In Progress", done: "Done", cancelled: "Cancelled",
};

function timeUntil(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff < 0) return "Overdue";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { myTaskCount, onlineCount, recentTasks } = await getDashboardData(session.user.id);
  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  // Find next upcoming deadline (not done)
  const nextDeadline = recentTasks
    .filter(t => t.dueDate && t.dueDate > new Date())
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={`${greeting}, ${firstName}`}
        right={
          <Link href="/tasks/new" className="btn-primary">
            <Plus size={14} /> New Task
          </Link>
        }
      />

      <div className="page-content space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "My Open Tasks",  value: myTaskCount,  href: "/tasks",    color: "hsl(var(--crimson))" },
            { label: "Online Now",     value: onlineCount,  href: "/presence", color: "hsl(142 71% 38%)" },
            { label: "In Progress",    value: recentTasks.filter(t => t.status === "in_progress").length, href: "/tasks", color: "hsl(var(--navy))" },
            { label: "Total Open",     value: recentTasks.length, href: "/tasks", color: "hsl(var(--muted-foreground))" },
          ].map(({ label, value, href, color }) => (
            <Link key={label} href={href} className="card-interactive p-4 block group">
              <div className="flex items-start justify-between">
                <div>
                  <div className="stat-number" style={{ color }}>{value}</div>
                  <p className="label-caps mt-1">{label}</p>
                </div>
                <TrendingUp size={16} className="text-muted-foreground group-hover:text-foreground transition-colors mt-1" />
              </div>
            </Link>
          ))}
        </div>

        {/* Next deadline timer */}
        {nextDeadline?.dueDate && (
          <div className="card-accent p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--crimson) / 0.1)" }}>
              <Clock size={20} style={{ color: "hsl(var(--crimson))" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="label-caps" style={{ color: "hsl(var(--crimson))" }}>Next Deadline</p>
              <p className="font-medium text-foreground truncate mt-0.5" style={{ fontFamily: "'Barlow', sans-serif" }}>
                {nextDeadline.title}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.5rem", lineHeight: 1, color: "hsl(var(--foreground))" }}>
                {timeUntil(nextDeadline.dueDate)}
              </div>
              <p className="label-caps mt-0.5">
                {nextDeadline.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        )}

        {/* Recent tasks — NO onClick, use Link wrapping */}
        <div className="card-base overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="heading-sm text-foreground">Recent Tasks</h2>
            <Link href="/tasks" className="label-caps" style={{ color: "hsl(var(--crimson))" }}>View All →</Link>
          </div>

          {recentTasks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No open tasks yet.</p>
              <Link href="/tasks/new" className="btn-primary inline-flex"><Plus size={13} /> Create First Task</Link>
            </div>
          ) : (
            <div>
              {recentTasks.map((task) => {
                const isOverdue = task.dueDate && task.dueDate < new Date();
                const isUrgent = task.dueDate && !isOverdue &&
                  (task.dueDate.getTime() - Date.now()) < 86400000 * 2;
                return (
                  <Link key={task.id} href={`/tasks/${task.id}`}
                    className="flex items-center gap-0 border-b border-border last:border-0 hover:bg-muted/20 transition-colors block">
                    {/* Priority stripe */}
                    <span className="w-1 self-stretch flex-shrink-0"
                      style={{ background: PRIORITY_COLOR[task.priority] }} />
                    <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" style={{ fontFamily: "'Barlow', sans-serif" }}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="label-caps">{STATUS_LABEL[task.status]}</span>
                          {task.assigneeName && (
                            <span className="label-caps text-muted-foreground">→ {task.assigneeName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {task.dueDate && (
                          <div className="text-right hidden sm:block">
                            <div className="label-caps" style={{
                              color: isOverdue ? "hsl(0 72% 51%)" : isUrgent ? "hsl(38 90% 50%)" : "hsl(var(--muted-foreground))",
                              fontSize: "0.65rem", fontWeight: 700,
                            }}>
                              {isOverdue ? "⚠ Overdue" : isUrgent ? "⏰ " + timeUntil(task.dueDate) : timeUntil(task.dueDate)}
                            </div>
                            <div className="label-caps" style={{ fontSize: "0.58rem" }}>
                              {task.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          </div>
                        )}
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
