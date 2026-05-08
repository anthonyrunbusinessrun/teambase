"use client";
import { useState, useMemo } from "react";
import type { NormalizedFolio } from "@/lib/airtable/boss";
import { Search, ChevronUp, ChevronDown, Star, LayoutList, Layers } from "lucide-react";

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Active:    { bg: "hsl(142 71% 38% / 0.12)", color: "hsl(142 71% 30%)" },
  Complete:  { bg: "hsl(220 57% 25% / 0.1)",  color: "hsl(220 57% 30%)" },
  "On Hold": { bg: "hsl(38 90% 50% / 0.12)",  color: "hsl(38 70% 36%)" },
  Prospect:  { bg: "hsl(var(--muted))",        color: "hsl(var(--muted-foreground))" },
  Cancelled: { bg: "hsl(0 72% 51% / 0.1)",    color: "hsl(0 60% 40%)" },
  Unknown:   { bg: "hsl(var(--muted))",        color: "hsl(var(--muted-foreground))" },
};

function fmt(n: number | null) {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function clean(s: string | null | undefined): string {
  if (!s || s === "—" || s.trim() === "") return "";
  // Remove "Untitled" noise
  if (s.toLowerCase().includes("untitled") || s === "-") return "";
  return s;
}

type SortKey = "name" | "client" | "status" | "contractValue" | "percentComplete" | "manager" | "category";

interface Props { folios: NormalizedFolio[]; categories: string[]; }

export function FoliosTable({ folios, categories }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [view, setView] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc"|"desc" }>({ key: "name", dir: "asc" });
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [mobile, setMobile] = useState(false);

  // Detect mobile
  if (typeof window !== "undefined") {
    // passive check
  }

  const statuses = ["All", "Active", "Complete", "On Hold", "Prospect", "Cancelled"];

  const filtered = useMemo(() => {
    let list = folios.filter(f => {
      const q = search.toLowerCase();
      if (q && !f.name.toLowerCase().includes(q) && !f.client.toLowerCase().includes(q) && !f.manager.toLowerCase().includes(q)) return false;
      if (statusFilter !== "All" && f.status !== statusFilter) return false;
      if (view === "active"  && f.status !== "Active") return false;
      if (view === "starred" && !starred.has(f.id)) return false;
      if (categories.includes(view) && f.category !== view) return false;
      return true;
    });

    list.sort((a, b) => {
      const av = sort.key === "contractValue" || sort.key === "percentComplete"
        ? (Number((a as any)[sort.key]) || 0)
        : String((a as any)[sort.key] ?? "").toLowerCase();
      const bv = sort.key === "contractValue" || sort.key === "percentComplete"
        ? (Number((b as any)[sort.key]) || 0)
        : String((b as any)[sort.key] ?? "").toLowerCase();
      const cmp = typeof av === "number" ? (av as number)-(bv as number) : (av as string).localeCompare(bv as string);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [folios, search, statusFilter, view, starred, sort, categories]);

  // By-category grouping
  const byCategory = useMemo(() => {
    if (view !== "by-category") return null;
    const map: Record<string, NormalizedFolio[]> = {};
    filtered.forEach(f => {
      const cat = clean(f.category) || clean(f.type) || "Other";
      (map[cat] = map[cat] || []).push(f);
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b));
  }, [filtered, view]);

  const toggleSort = (key: SortKey) =>
    setSort(prev => prev.key === key ? { key, dir: prev.dir==="asc"?"desc":"asc" } : { key, dir: "asc" });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort.key !== k ? <ChevronUp size={9} className="opacity-20" />
    : sort.dir==="asc" ? <ChevronUp size={9} /> : <ChevronDown size={9} />;

  const VIEWS = [
    { id:"all",         label:"All" },
    { id:"active",      label:"Active" },
    { id:"starred",     label:`★ (${starred.size})` },
    { id:"by-category", label:"By Category" },
    ...categories.slice(0,5).map(c => ({ id:c, label:c.length > 12 ? c.slice(0,12)+"…" : c })),
  ];

  const RowData = ({ folios }: { folios: NormalizedFolio[] }) => (
    <tbody>
      {folios.map(f => {
        const style = STATUS_STYLE[f.status] || STATUS_STYLE.Unknown;
        const pct = f.percentComplete || 0;
        const isStarred = starred.has(f.id);
        const displayName = clean(f.name) || "—";
        const displayClient = clean(f.client) || "—";
        const displayManager = clean(f.manager) || "—";
        return (
          <tr key={f.id}>
            <td style={{ width:32, padding:"0.5rem 0.5rem 0.5rem 0.75rem" }}>
              <button onClick={() => setStarred(prev => {
                const n = new Set(prev); isStarred ? n.delete(f.id) : n.add(f.id); return n;
              })}>
                <Star size={12}
                  fill={isStarred ? "hsl(var(--crimson))" : "none"}
                  color={isStarred ? "hsl(var(--crimson))" : "hsl(var(--muted-foreground))"}
                />
              </button>
            </td>
            <td>
              <div>
                <p className="font-medium text-foreground text-sm leading-tight">{displayName}</p>
                {clean(f.category) && (
                  <span className="label-caps" style={{ fontSize:"0.58rem", color:"hsl(var(--muted-foreground))" }}>
                    {f.category}
                  </span>
                )}
              </div>
            </td>
            <td className="hide-mobile text-sm text-muted-foreground">{displayClient}</td>
            <td>
              <span className="label-caps px-2 py-0.5 rounded whitespace-nowrap"
                style={{ ...style, fontSize:"0.58rem" }}>
                {f.status}
              </span>
            </td>
            <td className="hide-mobile text-sm text-muted-foreground">{displayManager}</td>
            <td className="hide-mobile text-sm font-medium">{fmt(f.contractValue)}</td>
            <td style={{ minWidth:80 }}>
              {pct > 0 ? (
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1" style={{ minWidth:36 }}>
                    <div className="h-full rounded-full"
                      style={{ width:`${Math.min(pct,100)}%`,
                        background: pct>=100 ? "hsl(142 71% 38%)" : "hsl(var(--crimson))" }} />
                  </div>
                  <span className="label-caps whitespace-nowrap" style={{ fontSize:"0.55rem" }}>{pct}%</span>
                </div>
              ) : <span className="text-muted-foreground text-sm">—</span>}
            </td>
          </tr>
        );
      })}
    </tbody>
  );

  const thead = (
    <thead>
      <tr>
        <th style={{ width:32 }}></th>
        {[
          { key:"name" as SortKey,            label:"Project" },
          { key:"client" as SortKey,          label:"Client",  cls:"hide-mobile" },
          { key:"status" as SortKey,          label:"Status" },
          { key:"manager" as SortKey,         label:"Manager", cls:"hide-mobile" },
          { key:"contractValue" as SortKey,   label:"Value",   cls:"hide-mobile" },
          { key:"percentComplete" as SortKey, label:"Progress" },
        ].map(({ key, label, cls="" }) => (
          <th key={key} className={cls}
            onClick={() => toggleSort(key)}
            style={{ cursor:"pointer", userSelect:"none" }}>
            <div className="flex items-center gap-1">{label}<SortIcon k={key} /></div>
          </th>
        ))}
      </tr>
    </thead>
  );

  return (
    <div className="card-base overflow-hidden">
      {/* Tab bar — scrollable on mobile */}
      <div className="folio-tabs flex border-b border-border">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className="px-3 py-2.5 whitespace-nowrap flex-shrink-0 border-b-2 transition-all"
            style={{
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
              fontSize:"0.7rem", letterSpacing:"0.07em", textTransform:"uppercase",
              borderBottomColor: view===v.id ? "hsl(var(--crimson))" : "transparent",
              color: view===v.id ? "hsl(var(--crimson))" : "hsl(var(--muted-foreground))",
              background: view===v.id ? "hsl(var(--crimson)/0.04)" : "transparent",
            }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/10">
        <div className="relative" style={{ flex:"1 1 160px", minWidth:140 }}>
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search…" value={search}
            onChange={e => setSearch(e.target.value)} className="field-input pl-8"
            style={{ paddingTop:"0.32rem", paddingBottom:"0.32rem", fontSize:"0.82rem" }} />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="label-caps px-2 py-0.5 rounded transition-all flex-shrink-0"
              style={{
                background: statusFilter===s ? "hsl(var(--crimson))" : "hsl(var(--muted))",
                color: statusFilter===s ? "white" : "hsl(var(--muted-foreground))",
                fontSize:"0.57rem",
              }}>
              {s}
            </button>
          ))}
        </div>
        <span className="label-caps ml-auto flex-shrink-0" style={{ fontSize:"0.58rem" }}>
          {filtered.length}/{folios.length}
        </span>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No folios match.</div>
        ) : view === "by-category" && byCategory ? (
          byCategory.map(([cat, rows]) => (
            <div key={cat}>
              <div className="px-4 py-2 flex items-center gap-2 border-b border-border"
                style={{ background:"hsl(var(--muted)/0.3)" }}>
                <span className="w-0.5 h-4 rounded-sm" style={{ background:"hsl(var(--crimson))" }} />
                <span className="heading-sm" style={{ fontSize:"0.85rem" }}>{cat}</span>
                <span className="label-caps ml-1" style={{ color:"hsl(var(--muted-foreground))" }}>
                  ({rows.length})
                </span>
              </div>
              <table className="data-table">{thead}<RowData folios={rows} /></table>
            </div>
          ))
        ) : (
          <table className="data-table">{thead}<RowData folios={filtered} /></table>
        )}
      </div>
    </div>
  );
}
