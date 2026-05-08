"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateTask, addComment } from "@/lib/actions/tasks";
import { updateTaskSchema, type UpdateTaskInput } from "@/lib/validations/task";
import { format } from "date-fns";

interface Comment {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string | null;
  authorAvatar?: string | null;
}

interface TaskFormProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: "todo" | "in_progress" | "done" | "cancelled";
    priority: "low" | "medium" | "high" | "urgent";
    assignedTo: string | null;
    dueDate: string | null;
  };
  comments: Comment[];
  currentUserId: string;
}

const STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export function TaskForm({ task, comments, currentUserId }: TaskFormProps) {
  const [isPending, startTransition] = useTransition();
  const [commentText, setCommentText] = useState("");
  const [localComments, setLocalComments] = useState(comments);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch } = useForm<UpdateTaskInput>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      id: task.id,
      status: task.status,
      priority: task.priority,
    },
  });

  const onStatusChange = (status: string) => {
    startTransition(async () => {
      try {
        await updateTask({ id: task.id, status: status as UpdateTaskInput["status"] });
      } catch (e) {
        setError(String(e));
      }
    });
  };

  const onPriorityChange = (priority: string) => {
    startTransition(async () => {
      try {
        await updateTask({ id: task.id, priority: priority as UpdateTaskInput["priority"] });
      } catch (e) {
        setError(String(e));
      }
    });
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    const body = commentText.trim();
    setCommentText("");

    startTransition(async () => {
      try {
        const result = await addComment({ taskId: task.id, body });
        if (result.success) {
          setLocalComments((prev) => [
            ...prev,
            {
              id: result.comment.id,
              body: result.comment.body,
              createdAt: new Date(),
              authorName: "You",
              authorAvatar: null,
            },
          ]);
        }
      } catch (e) {
        setError(String(e));
      }
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      {/* Status + Priority selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-medium uppercase tracking-widest text-muted-foreground block mb-2">
            Status
          </label>
          <select
            className="w-full text-sm bg-card border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={task.status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={isPending}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-2xs font-medium uppercase tracking-widest text-muted-foreground block mb-2">
            Priority
          </label>
          <select
            className="w-full text-sm bg-card border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={task.priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            disabled={isPending}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comments */}
      <div>
        <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
          Comments · {localComments.length}
        </p>

        {localComments.length > 0 && (
          <div className="space-y-3 mb-4">
            {localComments.map((c) => (
              <div key={c.id} className="card-base p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-foreground">
                    {c.authorName}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {format(c.createdAt, "MMM d, HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Comment input */}
        <div className="flex gap-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="flex-1 text-sm bg-card border border-border rounded-xl px-3 py-2.5 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                submitComment();
              }
            }}
          />
          <button
            onClick={submitComment}
            disabled={isPending || !commentText.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl disabled:opacity-40 transition-opacity self-end"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
