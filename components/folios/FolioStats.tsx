"use client";
import { TrendingUp, CheckCircle, PauseCircle, Eye, DollarSign, BarChart2 } from "lucide-react";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

interface Stats { active: number; complete: number; onHold: number; prospect: number; total: number; totalValue: number; avgComplete: number; }

export function FolioStats({ stats }: { stats: Stats }) {
  const items = [
    { label: "Active",       value: String(stats.active),         icon: TrendingUp,  color: "hsl(142 71% 38%)", bg: "hsl(142 71% 38% / 0.08)" },
    { label: "Complete",     value: String(stats.complete),       icon: CheckCircle, color: "hsl(220 57% 40%)", bg: "hsl(220 57% 25% / 0.08)" },
    { label: "On Hold",      value: String(stats.onHold),         icon: PauseCircle, color: "hsl(38 90% 42%)",  bg: "hsl(38 90% 50% / 0.08)" },
    { label: "Prospects",    value: String(stats.prospect),       icon: Eye,         color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))" },
    { label: "Pipeline",     value: fmt(stats.totalValue),        icon: DollarSign,  color: "hsl(var(--crimson))", bg: "hsl(var(--crimson) / 0.06)" },
    { label: "Avg Progress", value: `${stats.avgComplete}%`,      icon: BarChart2,   color: "hsl(var(--foreground))", bg: "hsl(var(--muted))" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="card-base p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps">{label}</span>
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: bg }}>
              <Icon size={13} style={{ color }} />
            </div>
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.7rem", lineHeight: 1, color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}
