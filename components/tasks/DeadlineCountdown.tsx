"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface Props {
  dueDate: Date | string | null;
  size?: "sm" | "lg";
}

const TIMEZONES = [
  { label: "Austin",   tz: "America/Chicago",  flag: "🇺🇸" },
  { label: "Manila",   tz: "Asia/Manila",       flag: "🇵🇭" },
  { label: "Saipan",   tz: "Pacific/Saipan",    flag: "🏝️" },
  { label: "UTC",      tz: "UTC",               flag: "🌐" },
];

function formatCountdown(ms: number): string {
  if (ms < 0) return "Overdue";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatInTz(date: Date, tz: string): string {
  return date.toLocaleString("en-US", {
    timeZone: tz, month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export function DeadlineCountdown({ dueDate, size = "sm" }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return null;

  const ms = due.getTime() - now.getTime();
  const isOverdue = ms < 0;
  const isUrgent  = ms < 3600000 * 24;   // < 1 day
  const isWarn    = ms < 3600000 * 72;   // < 3 days

  const pillClass = isOverdue ? "deadline-pill deadline-pill-past"
    : isUrgent ? "deadline-pill deadline-pill-urgent"
    : isWarn   ? "deadline-pill deadline-pill-warn"
    : "deadline-pill deadline-pill-ok";

  if (size === "sm") {
    return (
      <span className={pillClass}>
        <Clock size={9} />
        {formatCountdown(ms)}
      </span>
    );
  }

  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock size={14} style={{ color: isOverdue ? "hsl(0 72% 50%)" : "hsl(var(--crimson))" }} />
        <span className="heading-sm">Deadline Countdown</span>
        <span className={pillClass}>{formatCountdown(ms)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TIMEZONES.map(({ label, tz, flag }) => (
          <div key={tz} className="flex items-start gap-2 p-2 rounded" style={{ background: "hsl(var(--muted) / 0.5)" }}>
            <span className="text-sm">{flag}</span>
            <div>
              <div className="label-caps" style={{ fontSize: "0.58rem" }}>{label}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem", lineHeight: 1.2 }}>
                {formatInTz(due, tz)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
