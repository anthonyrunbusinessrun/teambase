import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  transparent?: boolean;
}

export function TopBar({ title, left, right, className, transparent }: TopBarProps) {
  return (
    <header
      className={cn(
        "top-bar",
        transparent && "border-transparent bg-transparent backdrop-blur-none",
        className
      )}
    >
      <div className="flex items-center w-full">
        {/* Left slot */}
        <div className="w-10 flex items-center">{left}</div>

        {/* Center title */}
        <div className="flex-1 text-center">
          {title && (
            <span className="text-[15px] font-medium tracking-tight text-foreground">
              {title}
            </span>
          )}
        </div>

        {/* Right slot */}
        <div className="w-10 flex items-center justify-end">{right}</div>
      </div>
    </header>
  );
}
