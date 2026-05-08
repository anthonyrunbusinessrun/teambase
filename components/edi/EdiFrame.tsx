"use client";
import { useState } from "react";
import { RefreshCw, ExternalLink, Maximize2 } from "lucide-react";

const EDI_URL = "https://boss-edi-frontend-production.up.railway.app/";

export function EdiFrame() {
  const [key, setKey] = useState(0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card"
        style={{ flexShrink: 0 }}>
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded"
          style={{ background: "hsl(var(--muted))", fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "hsl(var(--muted-foreground))" }}>
          🔒 {EDI_URL}
        </div>
        <button onClick={() => setKey(k => k + 1)} className="btn-outline" style={{ padding: "0.35rem 0.75rem", fontSize: "0.65rem" }}>
          <RefreshCw size={12} /> Reload
        </button>
        <a href={EDI_URL} target="_blank" rel="noopener noreferrer" className="btn-outline" style={{ padding: "0.35rem 0.75rem", fontSize: "0.65rem" }}>
          <ExternalLink size={12} /> Open Tab
        </a>
      </div>

      {/* iframe */}
      <iframe
        key={key}
        src={EDI_URL}
        title="EDI Command Center"
        style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="fullscreen"
      />
    </div>
  );
}
