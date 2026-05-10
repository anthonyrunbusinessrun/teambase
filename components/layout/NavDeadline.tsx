"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Timer } from "lucide-react";

interface Task { id: string; title: string; dueDate: string; priority: string; }

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatCountdown(ms: number) {
  if (ms <= 0) return { display: "OVERDUE", overdue: true };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return { display: `${d}d ${pad(h)}h ${pad(m)}m`, overdue: false };
  return { display: `${pad(h)}:${pad(m)}:${pad(sec)}`, overdue: false };
}

export function NavDeadline({ tasks }: { tasks: Task[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const next = tasks
    .map(t => ({ ...t, due: new Date(t.dueDate).getTime() }))
    .filter(t => !isNaN(t.due))
    .sort((a, b) => a.due - b.due)[0];

  if (!next) return null;

  const { display, overdue } = formatCountdown(next.due - now);

  return (
    <Link
      href={`/tasks/${next.id}`}
      className="flex items-center gap-2.5 rounded-lg transition-all hover:opacity-80 active:scale-95"
      style={{
        padding: "7px 12px",
        background: overdue ? "hsl(var(--crimson)/0.18)" : "hsl(var(--crimson)/0.1)",
        border: `1px solid ${overdue ? "hsl(var(--crimson)/0.5)" : "hsl(var(--crimson)/0.25)"}`,
      }}
      title={`Deadline: ${next.title}`}
    >
      <Timer
        size={16}
        style={{ color: "hsl(var(--crimson))", flexShrink: 0, strokeWidth: 2.5 }}
      />
      <div style={{ lineHeight: 1.1 }}>
        {/* Countdown — large and bold */}
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800,
          fontSize: "1.05rem",
          color: "hsl(var(--crimson))",
          letterSpacing: "0.05em",
        }}>
          {display}
        </div>
        {/* Task title — smaller but still crimson */}
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 600,
          fontSize: "0.6rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "hsl(var(--crimson)/0.65)",
          marginTop: 2,
          maxWidth: 90,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {next.title}
        </div>
      </div>
    </Link>
  );
}
