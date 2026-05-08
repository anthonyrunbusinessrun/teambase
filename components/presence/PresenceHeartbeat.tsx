"use client";

import { useEffect } from "react";

export function PresenceHeartbeat() {
  useEffect(() => {
    const sendHeartbeat = () => {
      fetch("/api/presence", { method: "POST" }).catch(() => {});
    };

    sendHeartbeat(); // immediate on mount
    const id = setInterval(sendHeartbeat, 30_000);

    // Mark offline on unload
    const handleUnload = () => {
      navigator.sendBeacon("/api/presence/offline");
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  return null;
}
