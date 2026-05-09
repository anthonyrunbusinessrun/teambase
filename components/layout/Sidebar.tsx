"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CheckSquare, Globe, LogOut,
  FolderOpen, User, Radio, Settings, Database,
} from "lucide-react";
import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { NavDeadline } from "./NavDeadline";

interface Task { id: string; title: string; dueDate: string; priority: string; }
interface Props {
  open: boolean;
  onClose: () => void;
  upcomingTasks?: Task[];
}

const NAV = [
  { href: "/dashboard",  label: "Dashboard",   icon: LayoutDashboard },
  { href: "/clocks",     label: "World Clocks", icon: Globe },
  { href: "/tasks",      label: "Tasks",        icon: CheckSquare },
  { href: "/presence",   label: "Team",         icon: Users },
] as const;

const BOSS_NAV = [
  { href: "/folios",        label: "Folios",      icon: FolderOpen },
  { href: "/folios/tables", label: "All Tables",  icon: Database },
  { href: "/edi",           label: "EDI Command", icon: Radio },
] as const;

export function Sidebar({ open, onClose, upcomingTasks = [] }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  // Close when route changes
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      {/* Logo */}
      <div className="px-5 pt-5 pb-3">
        <div className="sidebar-logo">TeamBase</div>
        <p style={{
          fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600,
          fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.28)", marginTop: 2,
        }}>Ray Land Inc</p>
      </div>
      <div style={{ height: 2, background: "hsl(var(--crimson))", margin: "0 1.25rem", borderRadius: 1, opacity: 0.7 }} />

      {/* Deadline countdown */}
      {upcomingTasks.length > 0 && (
        <div className="px-3 pt-3 pb-1">
          <NavDeadline tasks={upcomingTasks} />
        </div>
      )}

      <nav className="flex-1 py-2 overflow-y-auto">
        <p className="sidebar-section-label">Operations</p>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`sidebar-nav-item ${active(href) ? "active" : ""}`}>
            <Icon size={15} strokeWidth={active(href) ? 2 : 1.5} />{label}
          </Link>
        ))}

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0.5rem 1.25rem" }} />
        <p className="sidebar-section-label">BOSS</p>
        {BOSS_NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`sidebar-nav-item ${active(href) ? "active" : ""}`}>
            <Icon size={15} strokeWidth={active(href) ? 2 : 1.5} />{label}
          </Link>
        ))}

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0.5rem 1.25rem" }} />
        <p className="sidebar-section-label">Account</p>
        <Link href="/profile" className={`sidebar-nav-item ${active("/profile") ? "active" : ""}`}>
          <User size={15} strokeWidth={active("/profile") ? 2 : 1.5} /> My Profile
        </Link>
        <Link href="/settings" className={`sidebar-nav-item ${active("/settings") ? "active" : ""}`}>
          <Settings size={15} strokeWidth={active("/settings") ? 2 : 1.5} /> Settings
        </Link>
      </nav>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "0.5rem 0" }}>
        <button onClick={signOut} className="sidebar-nav-item w-full text-left">
          <LogOut size={15} strokeWidth={1.5} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
