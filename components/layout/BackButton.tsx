"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return (
    <button onClick={() => router.back()}
      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
      <ArrowLeft size={14} /> Back
    </button>
  );
}
