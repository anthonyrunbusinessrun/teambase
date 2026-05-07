"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft size={22} strokeWidth={1.5} />
    </button>
  );
}
