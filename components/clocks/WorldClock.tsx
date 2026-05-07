"use client";

import { useState, useEffect } from "react";
import { formatInTimeZone } from "date-fns-tz";

interface WorldClockProps {
  city: string;
  timezone: string;
  flag: string;
}

export function WorldClock({ city, timezone, flag }: WorldClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? formatInTimeZone(now, timezone, "HH:mm:ss")
    : "--:--:--";

  const date = now
    ? formatInTimeZone(now, timezone, "EEEE, MMM d")
    : "";

  const offset = now
    ? formatInTimeZone(now, timezone, "zzz")
    : "";

  const hour = now
    ? parseInt(formatInTimeZone(now, timezone, "H"), 10)
    : -1;

  const isDaytime = hour >= 7 && hour < 20;
  const isWorkHours = hour >= 9 && hour < 18;

  return (
    <div className="card-base p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={city}>
            {flag}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{city}</p>
            <p className="text-2xs text-muted-foreground">{offset}</p>
          </div>
        </div>

        {/* Work hours indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isWorkHours
                ? "bg-green-500"
                : isDaytime
                ? "bg-yellow-500"
                : "bg-slate-400"
            }`}
          />
          <span className="text-2xs text-muted-foreground">
            {isWorkHours ? "Work hours" : isDaytime ? "Daytime" : "After hours"}
          </span>
        </div>
      </div>

      {/* Time display */}
      <div className="tabular-nums">
        <p className="text-4xl font-light tracking-tight text-foreground">
          {time.slice(0, 5)}
          <span className="text-2xl text-muted-foreground">
            {time.slice(5)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">{date}</p>
      </div>
    </div>
  );
}
