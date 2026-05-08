import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1,"Title is required").max(200,"Too long"),
  description: z.string().max(2000).optional(),
  status: z.enum(["todo","in_progress","done","cancelled"]).default("todo"),
  priority: z.enum(["low","medium","high","urgent"]).default("medium"),
  assignedTo: z.string().nullable().optional(),
  // Accept both "YYYY-MM-DD" and full ISO datetime
  dueDate: z.string().nullable().optional().transform(v => {
    if (!v || v.trim() === "") return null;
    // If it's just a date, append time
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v + "T23:59:00.000Z";
    return v;
  }),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().uuid(),
});

export const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().min(1).max(2000),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
