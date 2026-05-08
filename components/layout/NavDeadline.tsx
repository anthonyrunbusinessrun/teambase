"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { AlarmClock } from "lucide-react";

interface Task { id: string; title: string; dueDate: string; priority: string; }

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatCountdown(ms: number) {
  if (ms <= 0) return { display: "OVERDUE", urgent: true, overdue: true };
  const totalSec = Math.floor(ms / 1000);
  const d  = Math.floor(totalSec / 86400);
  const h  = Math.floor((totalSec % 86400) / 3600);
  const m  = Math.floor((totalSec % 3600) / 60);
  const s  = totalSec % 60;
  if (d > 0) return { display: `${d}d ${pad(h)}h ${pad(m)}m`, urgent: d < 2, overdue: false };
  return { display: `${pad(h)}:${pad(m)}:${pad(s)}`, urgent: true, overdue: false };
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

  const { display, urgent, overdue } = formatCountdown(next.due - now);
  const color = overdue ? "hsl(0 72% 51%)" : urgent ? "hsl(38 90% 48%)" : "hsl(var(--muted-foreground))";
  const bg    = overdue ? "hsl(0 72% 51% / 0.1)" : urgent ? "hsl(38 90% 50% / 0.08)" : "hsl(var(--muted)/0.5)";

  return (
    <Link href={`/tasks/${next.id}`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors"
      style={{ background: bg }} title={`Deadline: ${next.title}`}>
      <AlarmClock size={12} style={{ color, flexShrink: 0 }} />
      <div style={{ lineHeight: 1 }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: "0.85rem", color,
          letterSpacing: overdue ? "0.04em" : "0.02em",
        }}>
          {display}
        </div>
        <div className="label-caps truncate" style={{ maxWidth: 72, fontSize: "0.5rem", opacity: 0.7 }}>
          {next.title.slice(0, 16)}{next.title.length > 16 ? "…" : ""}
        </div>
      </div>
    </Link>
  );
}
