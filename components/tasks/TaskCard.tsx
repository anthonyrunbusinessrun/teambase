import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
}

interface TaskCardProps {
  task: Task;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-slate-300",
};

export function TaskCard({ task }: TaskCardProps) {
  const isOverdue =
    task.dueDate && task.dueDate < new Date() && task.status !== "done";

  return (
    <Link href={`/tasks/${task.id}`} className="card-interactive flex items-center gap-3 p-4 block">
      {/* Priority dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          PRIORITY_DOT[task.priority] ?? "bg-muted"
        }`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate mb-0.5">
          {task.title}
        </p>
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          {task.assigneeName && <span>{task.assigneeName}</span>}
          {task.dueDate && (
            <>
              {task.assigneeName && <span>·</span>}
              <span className={isOverdue ? "text-red-500" : ""}>
                {isOverdue ? "Overdue · " : ""}
                {format(task.dueDate, "MMM d")}
              </span>
            </>
          )}
        </div>
      </div>

      <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
    </Link>
  );
}
