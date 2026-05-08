import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { DeadlineCountdown } from "./DeadlineCountdown";

interface Task {
  id: string; title: string; status: string; priority: string;
  dueDate: Date | null; assigneeName: string | null; assigneeAvatar: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "hsl(0 72% 51%)", high: "hsl(25 90% 50%)",
  medium: "hsl(38 90% 50%)", low: "hsl(var(--muted-foreground))",
};

export function TaskCard({ task }: { task: Task }) {
  return (
    <Link href={`/tasks/${task.id}`} className="card-interactive flex items-center overflow-hidden block">
      <span className="w-1 self-stretch flex-shrink-0" style={{ background: PRIORITY_COLORS[task.priority] }} />
      <div className="flex items-center gap-2 px-3 py-2.5 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {task.assigneeName && (
              <span className="label-caps" style={{ fontSize: "0.58rem" }}>{task.assigneeName}</span>
            )}
            {task.dueDate && (
              <>
                <span className="label-caps" style={{ fontSize: "0.58rem", color: "hsl(var(--muted-foreground))" }}>
                  {format(new Date(task.dueDate), "MMM d")}
                </span>
                <DeadlineCountdown dueDate={task.dueDate} size="sm" />
              </>
            )}
          </div>
        </div>
        <ChevronRight size={13} className="text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  );
}
