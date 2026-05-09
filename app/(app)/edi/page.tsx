"use client";
import { TopBar } from "@/components/layout/TopBar";
import { useState } from "react";
import { RefreshCw, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

const EDI_URL = "https://boss-edi-frontend-production.up.railway.app/";

export default function EDIPage() {
  const [key, setKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  if (fullscreen) {
    return (
      <div style={{ position:"fixed", inset:0, zIndex:200, background:"#fff", display:"flex", flexDirection:"column" }}>
        <div style={{ height:40, background:"hsl(var(--charcoal))", display:"flex", alignItems:"center",
          justifyContent:"space-between", padding:"0 12px", flexShrink:0 }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.75rem",
            letterSpacing:"0.1em", textTransform:"uppercase", color:"white" }}>
            EDI Command Center
          </span>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setKey(k=>k+1)}
              style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:4,
                padding:"4px 10px", color:"white", cursor:"pointer", fontSize:"0.65rem",
                fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:"0.08em",
                textTransform:"uppercase", display:"flex", alignItems:"center", gap:4 }}>
              <RefreshCw size={10} /> Reload
            </button>
            <button onClick={() => setFullscreen(false)}
              style={{ background:"hsl(var(--crimson))", border:"none", borderRadius:4,
                padding:"4px 10px", color:"white", cursor:"pointer", fontSize:"0.65rem",
                fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:"0.08em",
                textTransform:"uppercase", display:"flex", alignItems:"center", gap:4 }}>
              <Minimize2 size={10} /> Exit
            </button>
          </div>
        </div>
        <iframe key={key + "-fs"} src={EDI_URL} title="EDI Command Center"
          style={{ flex:1, width:"100%", border:"none" }}
          allow="fullscreen; clipboard-read; clipboard-write" />
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <TopBar
        title="EDI Command Center"
        subtitle="BOSS Electronic Data Interchange"
        right={
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => setKey(k=>k+1)} className="btn-outline"
              style={{ padding:"0.28rem 0.6rem", fontSize:"0.62rem" }}>
              <RefreshCw size={11} />
              <span className="hidden sm:inline" style={{ marginLeft:4 }}>Reload</span>
            </button>
            <button onClick={() => setFullscreen(true)} className="btn-outline"
              style={{ padding:"0.28rem 0.6rem", fontSize:"0.62rem" }}>
              <Maximize2 size={11} />
              <span className="hidden sm:inline" style={{ marginLeft:4 }}>Full</span>
            </button>
            <a href={EDI_URL} target="_blank" rel="noopener noreferrer" className="btn-primary"
              style={{ padding:"0.28rem 0.6rem", fontSize:"0.62rem" }}>
              <ExternalLink size={11} />
              <span className="hidden sm:inline" style={{ marginLeft:4 }}>Open</span>
            </a>
          </div>
        }
      />
      {/* iframe fills rest of viewport below topbar (52px) */}
      <div style={{ flex:1, position:"relative", overflow:"hidden", minHeight:300 }}>
        <iframe
          key={key}
          src={EDI_URL}
          title="EDI Command Center"
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none", background:"white" }}
          allow="fullscreen; clipboard-read; clipboard-write"
          loading="lazy"
        />
      </div>
    </div>
  );
}
