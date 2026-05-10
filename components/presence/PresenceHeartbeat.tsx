"use client";
import { useEffect, useRef } from "react";

const HEARTBEAT_MS = 30_000;

function ping(status: "online" | "offline") {
  return fetch("/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).catch(() => {});
}

export function PresenceHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    ping("online");
    intervalRef.current = setInterval(() => ping("online"), HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.hidden) ping("offline");
      else ping("online");
    };
    const onUnload = () => ping("offline");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  return null;
}
