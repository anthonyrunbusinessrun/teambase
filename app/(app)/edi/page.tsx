"use client";
import { TopBar } from "@/components/layout/TopBar";
import { useState, useEffect } from "react";
import { RefreshCw, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

const EDI_URL = "https://boss-edi-frontend-production.up.railway.app/";

export default function EDIPage() {
  const [key, setKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // Auto-fullscreen on mobile
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setFullscreen(true);
    }
  }, []);

  if (fullscreen) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#000",
        display: "flex", flexDirection: "column",
      }}>
        {/* Slim control bar */}
        <div style={{
          height: 44, background: "hsl(var(--charcoal))",
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              fontFamily: "'Dancing Script', cursive",
              fontSize: "1.1rem", fontWeight: 700,
              color: "hsl(var(--crimson))",
            }}>TeamBase</div>
            <span style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 600, fontSize: "0.65rem",
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
            }}>· EDI Command</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setKey(k => k + 1)} style={{
              background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4,
              padding: "5px 10px", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: "0.65rem", fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              <RefreshCw size={11} /> Reload
            </button>
            <button onClick={() => setFullscreen(false)} style={{
              background: "hsl(var(--crimson))", border: "none", borderRadius: 4,
              padding: "5px 10px", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: "0.65rem", fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              <Minimize2 size={11} /> Exit
            </button>
            <a href={EDI_URL} target="_blank" rel="noopener noreferrer" style={{
              background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 4,
              padding: "5px 10px", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, textDecoration: "none",
              fontSize: "0.65rem", fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              <ExternalLink size={11} /> Open
            </a>
          </div>
        </div>

        {/* Full iframe */}
        <iframe
          key={key + "-fs"}
          src={EDI_URL}
          title="EDI Command Center"
          style={{ flex: 1, width: "100%", border: "none", background: "white" }}
          allow="fullscreen; clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <TopBar
        title="EDI Command Center"
        subtitle="BOSS Electronic Data Interchange"
        right={
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setKey(k => k + 1)} className="btn-outline"
              style={{ padding: "0.28rem 0.6rem", fontSize: "0.62rem" }}>
              <RefreshCw size={11} />
              <span className="hidden sm:inline" style={{ marginLeft: 4 }}>Reload</span>
            </button>
            <button onClick={() => setFullscreen(true)} className="btn-outline"
              style={{ padding: "0.28rem 0.6rem", fontSize: "0.62rem" }}>
              <Maximize2 size={11} />
              <span className="hidden sm:inline" style={{ marginLeft: 4 }}>Fullscreen</span>
            </button>
            <a href={EDI_URL} target="_blank" rel="noopener noreferrer" className="btn-primary"
              style={{ padding: "0.28rem 0.6rem", fontSize: "0.62rem" }}>
              <ExternalLink size={11} />
              <span className="hidden sm:inline" style={{ marginLeft: 4 }}>Open</span>
            </a>
          </div>
        }
      />
      <div style={{ flex: 1, position: "relative", minHeight: 400 }}>
        <iframe
          key={key}
          src={EDI_URL}
          title="EDI Command Center"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="fullscreen; clipboard-read; clipboard-write"
          loading="lazy"
        />
      </div>
    </div>
  );
}
