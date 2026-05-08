"use client";
import { useState, useEffect } from "react";

export function NavClock() {
  const [time, setTime] = useState<string>("");
  const [tz, setTz] = useState<string>("");

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const city = zone.split("/").pop()?.replace(/_/g," ") ?? zone;
    setTz(city);

    function tick() {
      const now = new Date();
      const t = now.toLocaleTimeString("en-US", {
        timeZone: zone,
        hour: "numeric", minute: "2-digit", second: "2-digit",
        hour12: true,
      });
      setTime(t);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return (
    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.75rem",
      fontWeight:700, color:"hsl(var(--muted-foreground))", minWidth:80 }}>
      --:--
    </div>
  );

  // Split "11:42:05 AM" → time + meridiem
  const parts = time.split(" ");
  const clock = parts[0];
  const meridiem = parts[1] || "";

  return (
    <div className="flex items-center gap-1" title={`Your local time: ${tz}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
        style={{ background:"hsl(142 71% 38%)", animationDuration:"2s" }} />
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>
        <span style={{ fontWeight:800, fontSize:"0.85rem", color:"hsl(var(--foreground))" }}>{clock}</span>
        <span style={{ fontWeight:600, fontSize:"0.65rem", color:"hsl(var(--crimson))", marginLeft:2 }}>{meridiem}</span>
        <div className="label-caps" style={{ fontSize:"0.52rem", opacity:0.6, marginTop:1 }}>{tz}</div>
      </div>
    </div>
  );
}
