"use client";
import { useState, useEffect } from "react";

export function NavClock() {
  const [time, setTime] = useState("");
  const [tz, setTz] = useState("");

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const city = zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
    setTz(city.toUpperCase());

    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", {
        timeZone: zone, hour: "numeric", minute: "2-digit",
        second: "2-digit", hour12: true,
      }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const parts = time.split(" ");
  const clock = parts[0] || "--:--";
  const meridiem = parts[1] || "";

  return (
    <div className="flex items-center gap-2" title={tz}>
      <span className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: "hsl(142 71% 38%)", boxShadow: "0 0 0 3px hsl(142 71% 38%/0.2)" }} />
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: "1.15rem", letterSpacing: "0.02em", color: "hsl(var(--foreground))", display: "flex", alignItems: "baseline", gap: 3 }}>
          {clock}
          <span style={{ fontSize: "0.7rem", color: "hsl(var(--crimson))", fontWeight: 700 }}>{meridiem}</span>
        </div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, fontSize: "0.55rem", letterSpacing: "0.12em", color: "hsl(var(--muted-foreground))", marginTop: 1 }}>
          {tz}
        </div>
      </div>
    </div>
  );
}
