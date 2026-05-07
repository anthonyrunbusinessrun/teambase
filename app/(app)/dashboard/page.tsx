import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { tasks, presence, users } from "@/lib/db/schema";
import { eq, and, ne, desc, count } from "drizzle-orm";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import { ChevronRight, Bell } from "lucide-react";

async function getDashboardData(userId: string) {
  const [myTasks, onlineCount, recentTasks] = await Promise.all([
    // My open tasks count
    db
      .select({ count: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedTo, userId),
          ne(tasks.status, "done"),
          ne(tasks.status, "cancelled")
        )
      ),
    // Online team count
    db
      .select({ count: count() })
      .from(presence)
      .where(eq(presence.status, "online")),
    // Recent tasks
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        assigneeName: users.fullName,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(and(ne(tasks.status, "done"), ne(tasks.status, "cancelled")))
      .orderBy(desc(tasks.createdAt))
      .limit(5),
  ]);

  return {
    myTaskCount: myTasks[0]?.count ?? 0,
    onlineCount: onlineCount[0]?.count ?? 0,
    recentTasks,
  };
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { myTaskCount, onlineCount, recentTasks } =
    await getDashboardData(session.user.id);

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <TopBar
        right={
          <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <Bell size={20} strokeWidth={1.5} />
          </button>
        }
      />

      <main className="px-5 pt-2 pb-6">
        {/* Greeting */}
        <section className="mb-8">
          <p className="text-sm text-muted-foreground mb-1">{greeting},</p>
          <h1 className="text-3xl font-light tracking-tight text-foreground">
            {firstName}
          </h1>
        </section>

        {/* Quick stats */}
        <section className="grid grid-cols-2 gap-3 mb-8">
          <Link href="/tasks" className="card-interactive p-4 block">
            <p className="text-3xl font-light text-foreground mb-1">
              {myTaskCount}
            </p>
            <p className="text-xs text-muted-foreground">Open tasks</p>
          </Link>
          <Link href="/presence" className="card-interactive p-4 block">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl font-light text-foreground">
                {onlineCount}
              </span>
              {onlineCount > 0 && (
                <span className="status-dot status-dot-online" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Online now</p>
          </Link>
        </section>

        {/* Recent tasks */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Recent tasks
            </h2>
            <Link
              href="/tasks"
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              See all
            </Link>
          </div>

          {recentTasks.length === 0 ? (
            <div className="card-base p-6 text-center">
              <p className="text-sm text-muted-foreground">No open tasks</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="card-interactive flex items-center gap-3 p-4 block"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate mb-0.5">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xs text-muted-foreground">
                        {STATUS_LABEL[task.status] ?? task.status}
                      </span>
                      {task.assigneeName && (
                        <>
                          <span className="text-2xs text-muted-foreground">·</span>
                          <span className="text-2xs text-muted-foreground truncate">
                            {task.assigneeName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-2xs font-medium uppercase tracking-wide ${
                      PRIORITY_COLOR[task.priority] ?? ""
                    }`}
                  >
                    {task.priority}
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-muted-foreground flex-shrink-0"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
