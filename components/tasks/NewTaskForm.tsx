"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTask } from "@/lib/actions/tasks";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validations/task";
import { useRouter } from "next/navigation";
import { Timer, Clock } from "lucide-react";

const ZONES = [
  { city: "Austin",    tz: "America/Chicago",     flag: "🇺🇸" },
  { city: "New York",  tz: "America/New_York",    flag: "🇺🇸" },
  { city: "London",    tz: "Europe/London",        flag: "🇬🇧" },
  { city: "Dubai",     tz: "Asia/Dubai",           flag: "🇦🇪" },
  { city: "Manila",    tz: "Asia/Manila",          flag: "🇵🇭" },
  { city: "Saipan",    tz: "Pacific/Saipan",       flag: "🇲🇵" },
  { city: "UTC",       tz: "UTC",                  flag: "🌐" },
];

function previewDue(dateStr: string, timeStr: string) {
  if (!dateStr) return null;
  const combined = timeStr ? `${dateStr}T${timeStr}:00` : `${dateStr}T23:59:00`;
  const d = new Date(combined);
  if (isNaN(d.getTime())) return null;
  return ZONES.map(({ city, tz, flag }) => ({
    city, flag,
    local: d.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: true
    }),
    offset: (() => {
      const f = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "short" });
      const parts = f.formatToParts(d);
      return parts.find(p => p.type === "timeZoneName")?.value || tz;
    })(),
  }));
}

interface Props { users: Array<{ id: string; name: string }> }

export function NewTaskForm({ users }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("17:00");

  const { register, handleSubmit, formState: { errors } } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { status: "todo", priority: "medium" },
  });

  const preview = previewDue(dueDate, dueTime);

  const onSubmit = (data: CreateTaskInput) => {
    setError(null);
    // Build proper datetime if date is set
    if (dueDate && dueTime) {
      data.dueDate = `${dueDate}T${dueTime}:00.000Z`;
    } else if (dueDate) {
      data.dueDate = `${dueDate}T23:59:00.000Z`;
    }
    startTransition(async () => {
      try {
        const result = await createTask(data);
        if (result.success) router.push(`/tasks/${result.task.id}`);
        else setError("Failed to create task");
      } catch (e) {
        setError(String(e));
        console.error(e);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="field-label">Title *</label>
        <input type="text" placeholder="Task title" autoFocus className="field-input" {...register("title")} />
        {errors.title && <p className="label-caps mt-1" style={{ color: "hsl(var(--crimson))" }}>{errors.title.message}</p>}
      </div>

      <div>
        <label className="field-label">Description</label>
        <textarea placeholder="Details…" rows={3} className="field-input resize-none" {...register("description")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Status</label>
          <select className="field-input" {...register("status")}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label className="field-label">Priority</label>
          <select className="field-input" {...register("priority")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <label className="field-label">Assign To</label>
        <select className="field-input" {...register("assignedTo")}>
          <option value="">Unassigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name || u.id}</option>)}
        </select>
      </div>

      {/* Deadline with timezone countdown */}
      <div className="card-base overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2" style={{ background: "hsl(var(--muted)/0.3)" }}>
          <Timer size={13} style={{ color: "hsl(var(--crimson))" }} />
          <span className="heading-sm" style={{ fontSize: "0.85rem" }}>Deadline</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Date</label>
              <input type="date" className="field-input"
                {...register("dueDate")}
                onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Time (Local)</label>
              <input type="time" className="field-input"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)} />
            </div>
          </div>

          {preview && (
            <div className="rounded overflow-hidden border border-border">
              <div className="px-3 py-1.5 border-b border-border flex items-center gap-1.5"
                style={{ background: "hsl(var(--muted)/0.4)" }}>
                <Clock size={10} style={{ color: "hsl(var(--crimson))" }} />
                <span className="label-caps" style={{ fontSize: "0.58rem" }}>Deadline in all team timezones</span>
              </div>
              {preview.map(({ city, flag, local, offset }) => (
                <div key={city} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-0"
                  style={{ background: "hsl(var(--card))" }}>
                  <span className="label-caps flex items-center gap-1.5" style={{ fontSize: "0.65rem" }}>
                    {flag} {city}
                    <span style={{ opacity: 0.5 }}>({offset})</span>
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem" }}>{local}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="card-accent p-3">
          <p className="text-sm" style={{ color: "hsl(var(--crimson))" }}>{error}</p>
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn-primary w-full justify-center py-3">
        {isPending ? "Creating…" : "Create Task"}
      </button>
    </form>
  );
}
