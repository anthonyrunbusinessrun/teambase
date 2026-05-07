"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTask } from "@/lib/actions/tasks";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validations/task";
import { useRouter } from "next/navigation";

interface NewTaskFormProps {
  users: Array<{ id: string; fullName: string }>;
}

export function NewTaskForm({ users }: NewTaskFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      status: "todo",
      priority: "medium",
    },
  });

  const onSubmit = (data: CreateTaskInput) => {
    startTransition(async () => {
      try {
        const result = await createTask(data);
        if (result.success) {
          router.push(`/tasks/${result.task.id}`);
        }
      } catch (e) {
        console.error(e);
      }
    });
  };

  const fieldClass =
    "w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  const labelClass =
    "text-xs font-medium text-muted-foreground block mb-1.5";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className={labelClass}>Title</label>
        <input
          type="text"
          placeholder="Task title"
          autoFocus
          className={fieldClass}
          {...register("title")}
        />
        {errors.title && (
          <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          placeholder="Add details…"
          rows={3}
          className={`${fieldClass} resize-none`}
          {...register("description")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Status</label>
          <select className={fieldClass} {...register("status")}>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Priority</label>
          <select className={fieldClass} {...register("priority")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Assign to</label>
        <select className={fieldClass} {...register("assignedTo")}>
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Due date</label>
        <input type="date" className={fieldClass} {...register("dueDate")} />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-medium transition-opacity disabled:opacity-50 mt-2"
      >
        {isPending ? "Creating…" : "Create task"}
      </button>
    </form>
  );
}
