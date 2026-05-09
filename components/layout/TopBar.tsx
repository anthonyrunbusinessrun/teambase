"use client";
import { NavClock } from "./NavClock";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function TopBar({ title, subtitle, left, right, className }: TopBarProps) {
  const handleMenuToggle = () => {
    window.dispatchEvent(new Event("sidebar-toggle"));
  };

  return (
    <header className={cn("top-header", className)}>
      {/* Hamburger — mobile only, integrated into header */}
      <button
        onClick={handleMenuToggle}
        className="mobile-nav-toggle flex items-center justify-center w-8 h-8 rounded flex-shrink-0 mr-1"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "hsl(var(--foreground))" }}
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {left && <div className="flex items-center mr-2 flex-shrink-0">{left}</div>}

      {/* Title */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {title && (
          <div className="min-w-0">
            <h1 style={{
              fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
              letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1,
              fontSize: "clamp(0.9rem, 2vw, 1.05rem)", color: "hsl(var(--foreground))",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {title}
            </h1>
            {subtitle && (
              <p className="label-caps mt-0.5 truncate hidden sm:block">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      {/* Right side: actions + clock */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {right && <div className="flex items-center gap-2">{right}</div>}
        {right && <div className="h-4 w-px bg-border hidden sm:block" />}
        <NavClock />
      </div>
    </header>
  );
}
