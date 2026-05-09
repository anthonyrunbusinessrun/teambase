"use client";
import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";

interface Task { id: string; title: string; dueDate: string; priority: string; }

export function ClientLayout({
  children,
  upcomingTasks,
}: {
  children: React.ReactNode;
  upcomingTasks: Task[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (listen for pathname change via popstate)
  useEffect(() => {
    const close = () => setSidebarOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  // Expose toggle for TopBar via custom event
  useEffect(() => {
    const handler = () => setSidebarOpen(o => !o);
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        upcomingTasks={upcomingTasks}
      />
      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[49]"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="main-content" style={{ display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
