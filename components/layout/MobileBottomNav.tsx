"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CheckSquare, Globe } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home",   icon: LayoutDashboard },
  { href: "/clocks",    label: "Clocks", icon: Globe },
  { href: "/tasks",     label: "Tasks",  icon: CheckSquare },
  { href: "/presence",  label: "Team",   icon: Users },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-bottom-nav">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              padding: "8px 16px",
              color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
              textDecoration: "none",
              flex: 1,
              justifyContent: "center",
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2 : 1.5} color={isActive ? "#ad0000" : undefined} />
            <span style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
