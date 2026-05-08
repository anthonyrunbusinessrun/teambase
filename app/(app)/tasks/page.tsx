import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { tasks, users } from "@/lib/db/schema";
import { ne, desc, eq } from "drizzle-orm";
import { TopBar } from "@/components/layout/TopBar";
import { TaskCard } from "@/components/tasks/TaskCard";
import Link from "next/link";
import { Plus } from "lucide-react";

export const metadata = { title: "Tasks" };

async function getTasks() {
  return db.select({
    id: tasks.id, title: tasks.title, status: tasks.status,
    priority: tasks.priority, dueDate: tasks.dueDate, createdAt: tasks.createdAt,
    assigneeName: users.name, assigneeAvatar: users.avatarUrl,
  })
  .from(tasks).leftJoin(users, eq(tasks.assignedTo, users.id))
  .where(ne(tasks.status, "cancelled"))
  .orderBy(desc(tasks.createdAt)).limit(100);
}

export default async function TasksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const allTasks = await getTasks();
  const inProgress = allTasks.filter((t) => t.status === "in_progress");
  const todo = allTasks.filter((t) => t.status === "todo");
  const done = allTasks.filter((t) => t.status === "done");

  return (
    <>
      <TopBar
        title="Tasks"
        subtitle={`${allTasks.filter(t => t.status !== "done").length} open`}
        right={
          <Link href="/tasks/new" className="btn-primary">
            <Plus size={14} /> New Task
          </Link>
        }
      />
      <div className="page-content">
        {allTasks.length === 0 ? (
          <div className="card-base p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">No tasks yet.</p>
            <Link href="/tasks/new" className="btn-outline">Create First Task</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* In Progress */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-5 rounded-sm" style={{ background: "hsl(var(--navy))" }} />
                <h2 className="heading-sm">In Progress <span className="text-muted-foreground">({inProgress.length})</span></h2>
              </div>
              <div className="space-y-2">
                {inProgress.map((t) => <TaskCard key={t.id} task={t} />)}
                {inProgress.length === 0 && <p className="text-sm text-muted-foreground py-2">Nothing in progress</p>}
              </div>
            </div>

            {/* To Do */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-5 rounded-sm" style={{ background: "hsl(var(--crimson))" }} />
                <h2 className="heading-sm">To Do <span className="text-muted-foreground">({todo.length})</span></h2>
              </div>
              <div className="space-y-2">
                {todo.map((t) => <TaskCard key={t.id} task={t} />)}
                {todo.length === 0 && <p className="text-sm text-muted-foreground py-2">All clear</p>}
              </div>
            </div>

            {/* Done */}
            <div className="opacity-60">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-5 rounded-sm bg-green-500" />
                <h2 className="heading-sm">Done <span className="text-muted-foreground">({done.length})</span></h2>
              </div>
              <div className="space-y-2">
                {done.map((t) => <TaskCard key={t.id} task={t} />)}
                {done.length === 0 && <p className="text-sm text-muted-foreground py-2">Nothing completed yet</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
