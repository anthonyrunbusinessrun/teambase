"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/clocks", label: "Clocks", icon: Globe },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/presence", label: "Team", icon: Users },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors min-w-[60px]",
              "text-muted-foreground hover:text-foreground",
              isActive && "text-foreground"
            )}
          >
            <Icon
              size={22}
              strokeWidth={isActive ? 2 : 1.5}
              className={cn(
                "transition-all",
                isActive && "text-accent scale-[1.08]"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium tracking-wide transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
