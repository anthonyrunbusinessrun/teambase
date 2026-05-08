"use client";
import { useState, useEffect } from "react";
import { Key, CheckCircle, AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";

export function AirtableKeyForm() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [state, setState] = useState<"idle"|"testing"|"syncing"|"ok"|"err">("idle");
  const [msg, setMsg] = useState("");
  const [connected, setConnected] = useState<boolean|null>(null);
  const [tableCount, setTableCount] = useState(0);
  const [recordCount, setRecordCount] = useState(0);

  // Test current connection on mount
  useEffect(() => {
    fetch("/api/airtable/test-key")
      .then(r => r.json())
      .then(d => {
        setConnected(d.ok);
        if (d.ok) setTableCount(d.tables);
      })
      .catch(() => setConnected(false));
  }, []);

  async function handleTestAndSync() {
    const useKey = key.trim() || undefined;
    setState("testing");
    setMsg("Testing connection…");
    try {
      const url = useKey ? `/api/airtable/test-key?key=${encodeURIComponent(useKey)}` : "/api/airtable/test-key";
      const testRes = await fetch(url);
      const testData = await testRes.json();
      if (!testData.ok) {
        setMsg(`Connection failed (${testData.status || "401"}): ${testData.error || "Invalid key"}`);
        setState("err");
        setConnected(false);
        return;
      }
      setConnected(true);
      setTableCount(testData.tables);
      setMsg(`✓ Connected — ${testData.tables} tables found. Syncing all data…`);
      setState("syncing");

      const syncUrl = useKey ? `/api/airtable/sync-all?key=${encodeURIComponent(useKey)}` : "/api/airtable/sync-all";
      const syncRes = await fetch(syncUrl);
      const syncData = await syncRes.json();

      if (syncData.ok) {
        const total = Object.values(syncData.synced as Record<string,number>).reduce((a,b)=>a+b,0);
        setRecordCount(total);
        setMsg(`✅ Synced ${total} records from ${Object.keys(syncData.synced).length} tables!`);
        setState("ok");
        setTimeout(() => router.refresh(), 500);
      } else {
        setMsg(`Sync error: ${syncData.error}`);
        setState("err");
      }
    } catch(e) {
      setMsg(`Error: ${String(e)}`);
      setState("err");
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="flex items-center gap-3 p-3 rounded"
        style={{ background: "hsl(var(--muted)/0.5)" }}>
        {connected === null
          ? <RefreshCw size={14} className="animate-spin text-muted-foreground" />
          : connected
          ? <Wifi size={14} style={{ color: "hsl(142 71% 38%)" }} />
          : <WifiOff size={14} style={{ color: "hsl(var(--crimson))" }} />}
        <div>
          <p className="label-caps" style={{ fontSize:"0.65rem" }}>
            {connected === null ? "Checking connection…"
              : connected ? `Connected · ${tableCount} tables · ${recordCount > 0 ? recordCount + " records synced" : "click Sync All"}`
              : "Not connected — API key expired or missing"}
          </p>
          <p className="label-caps" style={{ fontSize:"0.56rem", color:"hsl(var(--muted-foreground))" }}>
            Base: app8QxH2cjt0fueuW
          </p>
        </div>
      </div>

      {/* Key input */}
      <div>
        <label className="field-label flex items-center gap-1">
          <Key size={10} /> New Airtable Personal Access Token (PAT)
        </label>
        <input
          type="password"
          className="field-input font-mono text-sm"
          value={key}
          onChange={e => { setKey(e.target.value); setState("idle"); setMsg(""); }}
          placeholder="patXXXXXXXXXXXXXXXX.XXXXXXXX…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="label-caps mt-1.5" style={{ fontSize:"0.58rem", lineHeight:1.4 }}>
          Get from: airtable.com → Account icon → Developer Hub → Personal Access Tokens<br/>
          Required scopes: <code>data.records:read</code> · <code>schema.bases:read</code>
        </p>
      </div>

      <button
        onClick={handleTestAndSync}
        disabled={state==="testing" || state==="syncing"}
        className="btn-primary w-full justify-center"
        style={{ padding:"0.625rem" }}
      >
        {state==="testing" || state==="syncing"
          ? <><RefreshCw size={14} className="animate-spin" /> {state==="testing" ? "Testing…" : "Syncing all tables…"}</>
          : connected
          ? <><RefreshCw size={14} /> Sync All Tables Now</>
          : <><Key size={14} /> Test & Sync with New Key</>}
      </button>

      {msg && state !== "testing" && state !== "syncing" && (
        <div className="flex items-start gap-2.5 p-3 rounded" style={{
          background: state==="ok" ? "hsl(142 71% 38% / 0.08)" : "hsl(var(--crimson) / 0.08)"
        }}>
          {state==="ok"
            ? <CheckCircle size={14} style={{ color:"hsl(142 71% 38%)", marginTop:1, flexShrink:0 }} />
            : <AlertCircle size={14} style={{ color:"hsl(var(--crimson))", marginTop:1, flexShrink:0 }} />}
          <p className="text-sm" style={{ fontFamily:"'Barlow',sans-serif",
            color: state==="ok" ? "hsl(142 71% 38%)" : "hsl(var(--crimson))" }}>
            {msg}
          </p>
        </div>
      )}
    </div>
  );
}
