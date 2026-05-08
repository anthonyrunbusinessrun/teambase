import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tasks, taskComments, users } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { TopBar } from "@/components/layout/TopBar";
import { BackButton } from "@/components/layout/BackButton";
import { TaskForm } from "@/components/tasks/TaskForm";
import { DeadlineCountdown } from "@/components/tasks/DeadlineCountdown";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return notFound();

  const { id } = await params;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return notFound();

  const rawComments = await db
    .select({
      id: taskComments.id, body: taskComments.body, createdAt: taskComments.createdAt,
      authorName: users.name, authorAvatar: users.avatarUrl,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.authorId, users.id))
    .where(eq(taskComments.taskId, id))
    .orderBy(asc(taskComments.createdAt));

  const comments = rawComments.map(c => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    authorName: c.authorName || "Unknown",
    authorAvatar: c.authorAvatar || null,
  }));

  // Map DB task to form-compatible shape
  const taskForForm = {
    id: task.id,
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    assignedTo: task.assignedTo,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
  };

  return (
    <>
      <TopBar title={task.title} subtitle={`${task.status.replace("_", " ")} · ${task.priority}`} left={<BackButton />} />
      <div className="page-content">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <TaskForm task={taskForForm} comments={comments} currentUserId={session.user.id} />
          </div>
          <div className="space-y-4">
            {task.dueDate && <DeadlineCountdown dueDate={task.dueDate} size="lg" />}
            <div className="card-base p-4">
              <h3 className="heading-sm mb-3">Details</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Created", new Date(task.createdAt).toLocaleDateString()],
                  ["Updated", new Date(task.updatedAt).toLocaleDateString()],
                  ["ID", task.id.slice(0, 8) + "…"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="label-caps">{k}</span>
                    <span style={{ fontFamily: "'Barlow', sans-serif" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
