"use client";
import { useEffect } from "react";

export function PresenceHeartbeat() {
  useEffect(() => {
    // Initial heartbeat
    fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "online" }) }).catch(() => {});
    
    // Heartbeat every 60s (was 30s) — halves the server load
    const id = setInterval(() => {
      fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "online" }) }).catch(() => {});
    }, 60000);

    // Mark offline on unload
    const offline = () => {
      navigator.sendBeacon?.("/api/presence", JSON.stringify({ status: "offline" }));
    };
    window.addEventListener("beforeunload", offline);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) offline();
      else fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "online" }) }).catch(() => {});
    });

    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", offline);
    };
  }, []);

  return null;
}
