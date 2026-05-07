"use server";

import { db } from "@/lib/db";
import { tasks, taskComments } from "@/lib/db/schema";
import { createTaskSchema, updateTaskSchema, createCommentSchema } from "@/lib/validations/task";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import type { CreateTaskInput, UpdateTaskInput, CreateCommentInput } from "@/lib/validations/task";

async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function createTask(input: CreateTaskInput) {
  const user = await getCurrentUser();
  const data = createTaskSchema.parse(input);

  const [task] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assignedTo: data.assignedTo ?? null,
      createdBy: user.id,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    })
    .returning();

  revalidatePath("/tasks");
  return { success: true, task };
}

export async function updateTask(input: UpdateTaskInput) {
  const user = await getCurrentUser();
  const data = updateTaskSchema.parse(input);
  const { id, ...rest } = data;

  const [task] = await db
    .update(tasks)
    .set({
      ...rest,
      dueDate: rest.dueDate ? new Date(rest.dueDate) : undefined,
      completedAt: rest.status === "done" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();

  if (!task) throw new Error("Task not found");

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return { success: true, task };
}

export async function deleteTask(taskId: string) {
  const user = await getCurrentUser();

  const [existing] = await db
    .select({ createdBy: tasks.createdBy })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!existing) throw new Error("Task not found");

  // Only creator or admin can delete
  const session = await auth.api.getSession({ headers: await headers() });
  const isAdmin = session?.user && (session.user as { role?: string }).role === "admin";

  if (existing.createdBy !== user.id && !isAdmin) {
    throw new Error("Not authorized to delete this task");
  }

  await db.delete(tasks).where(eq(tasks.id, taskId));

  revalidatePath("/tasks");
  return { success: true };
}

export async function addComment(input: CreateCommentInput) {
  const user = await getCurrentUser();
  const data = createCommentSchema.parse(input);

  const [comment] = await db
    .insert(taskComments)
    .values({
      taskId: data.taskId,
      authorId: user.id,
      body: data.body,
    })
    .returning();

  revalidatePath(`/tasks/${data.taskId}`);
  return { success: true, comment };
}
