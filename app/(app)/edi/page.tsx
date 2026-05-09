"use client";
import { TopBar } from "@/components/layout/TopBar";
import { useState } from "react";
import { RefreshCw, ExternalLink, Maximize2, Minimize2, Globe } from "lucide-react";

const EDI_URL = "https://boss-edi-frontend-production.up.railway.app/";

export default function EDIPage() {
  const [key, setKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>
      <TopBar
        title="EDI Command Center"
        subtitle="BOSS Electronic Data Interchange"
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setKey(k => k+1)}
              className="btn-outline"
              style={{ padding:"0.3rem 0.6rem", fontSize:"0.62rem" }}
              title="Reload"
            >
              <RefreshCw size={11} /> <span className="hidden sm:inline">Reload</span>
            </button>
            <button
              onClick={() => setFullscreen(f => !f)}
              className="btn-outline"
              style={{ padding:"0.3rem 0.6rem", fontSize:"0.62rem" }}
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              <span className="hidden sm:inline ml-1">{fullscreen ? "Exit" : "Full"}</span>
            </button>
            <a
              href={EDI_URL} target="_blank" rel="noopener noreferrer"
              className="btn-primary"
              style={{ padding:"0.3rem 0.6rem", fontSize:"0.62rem" }}
            >
              <ExternalLink size={11} /> <span className="hidden sm:inline">Open</span>
            </a>
          </div>
        }
      />

      {/* Iframe container — fills remaining height, works on mobile */}
      <div style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        ...(fullscreen ? {
          position: "fixed" as const,
          inset: 0,
          zIndex: 100,
          background: "white",
        } : {}),
      }}>
        <iframe
          key={key}
          src={EDI_URL}
          title="EDI Command Center"
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "white",
          }}
          allow="fullscreen; clipboard-read; clipboard-write"
          loading="lazy"
        />

        {/* Mobile overlay hint */}
        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            style={{
              position: "absolute", top: 12, right: 12,
              background: "rgba(0,0,0,0.6)", color: "white",
              border: "none", borderRadius: 6, padding: "6px 12px",
              fontSize: "0.7rem", cursor: "pointer", zIndex: 101,
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}
          >
            <Minimize2 size={12} style={{ display:"inline", marginRight:4 }} /> Exit
          </button>
        )}
      </div>
    </div>
  );
}
