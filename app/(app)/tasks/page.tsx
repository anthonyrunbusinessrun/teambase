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
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      assigneeName: users.fullName,
      assigneeAvatar: users.avatarUrl,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(ne(tasks.status, "cancelled"))
    .orderBy(desc(tasks.createdAt))
    .limit(100);
}

export default async function TasksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const allTasks = await getTasks();

  const todo = allTasks.filter((t) => t.status === "todo");
  const inProgress = allTasks.filter((t) => t.status === "in_progress");
  const done = allTasks.filter((t) => t.status === "done");

  return (
    <>
      <TopBar
        title="Tasks"
        right={
          <Link
            href="/tasks/new"
            className="p-1 text-accent hover:text-accent/80 transition-colors"
          >
            <Plus size={22} strokeWidth={1.5} />
          </Link>
        }
      />

      <main className="pb-6">
        {allTasks.length === 0 ? (
          <div className="px-5 pt-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">No tasks yet</p>
            <Link
              href="/tasks/new"
              className="inline-flex items-center gap-2 text-sm text-accent"
            >
              <Plus size={16} />
              Create your first task
            </Link>
          </div>
        ) : (
          <>
            {inProgress.length > 0 && (
              <section>
                <p className="section-label">In progress · {inProgress.length}</p>
                <div className="px-5 space-y-2">
                  {inProgress.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {todo.length > 0 && (
              <section>
                <p className="section-label">To do · {todo.length}</p>
                <div className="px-5 space-y-2">
                  {todo.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {done.length > 0 && (
              <section>
                <p className="section-label">Done · {done.length}</p>
                <div className="px-5 space-y-2 opacity-60">
                  {done.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
