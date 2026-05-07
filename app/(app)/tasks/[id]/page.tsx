import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { tasks, taskComments, users } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { TaskForm } from "@/components/tasks/TaskForm";
import { BackButton } from "@/components/layout/BackButton";
import { format } from "date-fns";

interface Props {
  params: { id: string };
}

async function getTaskWithComments(id: string) {
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      createdBy: tasks.createdBy,
      assignedTo: tasks.assignedTo,
      assigneeName: users.fullName,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(eq(tasks.id, id));

  if (!task) return null;

  const comments = await db
    .select({
      id: taskComments.id,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
      authorName: users.fullName,
      authorAvatar: users.avatarUrl,
    })
    .from(taskComments)
    .innerJoin(users, eq(taskComments.authorId, users.id))
    .where(eq(taskComments.taskId, id))
    .orderBy(asc(taskComments.createdAt));

  return { task, comments };
}

export default async function TaskDetailPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const data = await getTaskWithComments(params.id);
  if (!data) notFound();

  const { task, comments } = data;

  return (
    <>
      <TopBar left={<BackButton />} />

      <main className="px-5 pt-2 pb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-light tracking-tight text-foreground mb-2">
            {task.title}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="capitalize">{task.status.replace("_", " ")}</span>
            <span>·</span>
            <span className="capitalize">{task.priority}</span>
            {task.dueDate && (
              <>
                <span>·</span>
                <span>Due {format(task.dueDate, "MMM d, yyyy")}</span>
              </>
            )}
          </div>
        </div>

        {task.description && (
          <div className="card-base p-4 mb-6">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        <TaskForm
          task={{
            id: task.id,
            title: task.title,
            description: task.description ?? "",
            status: task.status as "todo" | "in_progress" | "done" | "cancelled",
            priority: task.priority as "low" | "medium" | "high" | "urgent",
            assignedTo: task.assignedTo ?? null,
            dueDate: task.dueDate?.toISOString() ?? null,
          }}
          comments={comments}
          currentUserId={session.user.id}
        />
      </main>
    </>
  );
}
