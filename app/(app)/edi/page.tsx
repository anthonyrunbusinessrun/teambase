"use client";
import { TopBar } from "@/components/layout/TopBar";
import { useState } from "react";
import { ExternalLink, RefreshCw, Maximize2 } from "lucide-react";

const EDI_URL = "https://boss-edi-frontend-production.up.railway.app/";

export default function EDIPage() {
  const [key, setKey] = useState(0);

  return (
    <>
      <TopBar
        title="EDI Command Center"
        subtitle="BOSS EDI Operations"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setKey(k => k + 1)}
              className="btn-outline"
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.65rem" }}
            >
              <RefreshCw size={11} /> Reload
            </button>
            <a
              href={EDI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.65rem" }}
            >
              <ExternalLink size={11} /> Open Full
            </a>
          </div>
        }
      />
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
        <iframe
          key={key}
          src={EDI_URL}
          title="EDI Command Center"
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            background: "hsl(var(--background))",
          }}
          allow="fullscreen"
          loading="lazy"
        />
      </div>
    </>
  );
}
