"use server";

import { db } from "@/lib/db";
import { tasks, taskComments } from "@/lib/db/schema";
import { createTaskSchema, updateTaskSchema, createCommentSchema } from "@/lib/validations/task";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { CreateTaskInput, UpdateTaskInput, CreateCommentInput } from "@/lib/validations/task";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function parseDueDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export async function createTask(input: CreateTaskInput) {
  const user = await getUser();
  const data = createTaskSchema.parse(input);

  const [task] = await db.insert(tasks).values({
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    assignedTo: data.assignedTo ?? null,
    createdBy: user.id,
    dueDate: parseDueDate(data.dueDate),
  }).returning();

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true, task };
}

export async function updateTask(input: UpdateTaskInput) {
  const user = await getUser();
  const data = updateTaskSchema.parse(input);
  const { id, ...rest } = data;

  await db.update(tasks).set({
    ...rest,
    dueDate: rest.dueDate !== undefined ? parseDueDate(rest.dueDate) : undefined,
    completedAt: rest.status === "done" ? new Date() : undefined,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id));

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTask(taskId: string) {
  await getUser();
  await db.delete(tasks).where(eq(tasks.id, taskId));
  revalidatePath("/tasks");
  return { success: true };
}

export async function addComment(input: CreateCommentInput) {
  const user = await getUser();
  const data = createCommentSchema.parse(input);

  const [comment] = await db.insert(taskComments).values({
    taskId: data.taskId,
    authorId: user.id,
    body: data.body,
  }).returning();

  revalidatePath(`/tasks/${data.taskId}`);
  return { success: true, comment };
}
