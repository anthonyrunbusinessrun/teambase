"use client";
import { useState, useEffect } from "react";

interface Props {
  city: string; timezone: string; flag: string; region: string;
}

export function WorldClock({ city, timezone, flag, region }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now ? now.toLocaleTimeString("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "--:--:--";
  const date = now ? now.toLocaleDateString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }) : "";
  const hour = now ? parseInt(now.toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", hour12: false }), 10) : -1;

  const isWork  = hour >= 9 && hour < 18;
  const isDay   = hour >= 7 && hour < 20;
  const statusColor = isWork ? "hsl(142 71% 38%)" : isDay ? "hsl(38 90% 50%)" : "hsl(var(--muted-foreground))";
  const statusLabel = isWork ? "Business Hours" : isDay ? "Daytime" : "After Hours";

  return (
    <div className="card-accent p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-full opacity-5"
        style={{ background: "repeating-linear-gradient(-45deg, hsl(var(--crimson)), hsl(var(--crimson)) 2px, transparent 2px, transparent 8px)" }} />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" role="img" aria-label={city}>{flag}</span>
          <div>
            <div className="heading-sm text-foreground" style={{ fontSize: "1.1rem" }}>{city}</div>
            <div className="label-caps" style={{ fontSize: "0.58rem", color: "hsl(var(--muted-foreground))" }}>{region}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
          <span className="label-caps" style={{ fontSize: "0.55rem", color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>
        <div className="flex items-baseline gap-1">
          <span style={{ fontSize: "clamp(2.8rem, 5vw, 4rem)", lineHeight: 1, color: "hsl(var(--foreground))", letterSpacing: "0.01em" }}>
            {time.slice(0, 5)}
          </span>
          <span style={{ fontSize: "1.4rem", color: "hsl(var(--crimson))", lineHeight: 1 }}>
            {time.slice(5)}
          </span>
        </div>
        <div className="label-caps mt-2" style={{ letterSpacing: "0.1em" }}>{date}</div>
      </div>
    </div>
  );
}
