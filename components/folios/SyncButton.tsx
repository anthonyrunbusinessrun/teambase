"use client";
import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface SyncButtonProps { large?: boolean; }

export function SyncButton({ large }: SyncButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle"|"loading"|"ok"|"err">("idle");
  const [result, setResult] = useState<string>("");

  async function handleSync() {
    setState("loading");
    setResult("");
    try {
      const res = await fetch("/api/airtable/sync-all");
      const data = await res.json();
      if (data.ok) {
        const total = Object.values(data.synced as Record<string,number>).reduce((a,b)=>a+b,0);
        setResult(`Synced ${total} records across ${Object.keys(data.synced).length} tables`);
        setState("ok");
        setTimeout(() => { setState("idle"); router.refresh(); }, 2000);
      } else {
        setResult(data.error || "Sync failed");
        setState("err");
        setTimeout(() => setState("idle"), 4000);
      }
    } catch(e) {
      setResult(String(e));
      setState("err");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  if (large) return (
    <div className="space-y-2">
      <button onClick={handleSync} disabled={state==="loading"} className="btn-primary">
        <RefreshCw size={14} className={state==="loading"?"animate-spin":""} />
        {state==="loading"?"Syncing from Airtable…":"Sync Now from BOSS Airtable"}
      </button>
      {result && (
        <p className="label-caps" style={{
          color: state==="ok"?"hsl(142 71% 38%)":"hsl(var(--crimson))",
          fontSize:"0.65rem"
        }}>{result}</p>
      )}
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {result && state!=="loading" && (
        <span className="label-caps" style={{
          color: state==="ok"?"hsl(142 71% 38%)":"hsl(var(--crimson))",
          fontSize:"0.58rem", maxWidth:"160px"
        }}>{result}</span>
      )}
      <button
        onClick={handleSync}
        disabled={state==="loading"}
        className="btn-outline"
        style={{ padding:"0.35rem 0.75rem", fontSize:"0.65rem" }}
        title="Sync from BOSS Airtable"
      >
        {state==="loading" ? <RefreshCw size={11} className="animate-spin" /> :
         state==="ok"      ? <CheckCircle size={11} /> :
         state==="err"     ? <AlertCircle size={11} /> :
                             <RefreshCw size={11} />}
        {state==="loading" ? "Syncing…" :
         state==="ok"      ? "Done!" :
         state==="err"     ? "Error" : "Sync"}
      </button>
    </div>
  );
}
