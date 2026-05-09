"use client";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, ExternalLink, CheckCircle, Clock, Pause, XCircle, Eye } from "lucide-react";

interface Folio {
  id: string; name: string; group: string; category: string;
  status: string; description: string; manager: string;
  vsfs: number; asfs: number; active: number; tmLink: string; catIds: string[];
}
interface Category { id: string; code: string; group: string; }

const GROUP_COLORS: Record<string, { dot: string; bg: string; border: string }> = {
  "1.0": { dot: "hsl(200 80% 50%)", bg: "hsl(200 80% 50% / 0.06)", border: "hsl(200 80% 50%)" },
  "2.0": { dot: "hsl(270 70% 55%)", bg: "hsl(270 70% 55% / 0.06)", border: "hsl(270 70% 55%)" },
  "3.0": { dot: "hsl(var(--crimson))", bg: "hsl(var(--crimson) / 0.05)", border: "hsl(var(--crimson))" },
  "4.0": { dot: "hsl(38 90% 48%)", bg: "hsl(38 90% 48% / 0.06)", border: "hsl(38 90% 48%)" },
  "5.0": { dot: "hsl(142 71% 38%)", bg: "hsl(142 71% 38% / 0.06)", border: "hsl(142 71% 38%)" },
  "6.0": { dot: "hsl(190 80% 42%)", bg: "hsl(190 80% 42% / 0.05)", border: "hsl(190 80% 42%)" },
  "7.0": { dot: "hsl(0 0% 40%)", bg: "hsl(0 0% 40% / 0.04)", border: "hsl(0 0% 40%)" },
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  "Active":    { label:"Active",    color:"hsl(142 71% 30%)", bg:"hsl(142 71% 38%/0.1)", icon: CheckCircle },
  "Complete":  { label:"Complete",  color:"hsl(220 57% 35%)", bg:"hsl(220 57% 25%/0.1)", icon: CheckCircle },
  "On Hold":   { label:"On Hold",   color:"hsl(38 70% 36%)",  bg:"hsl(38 90%50%/0.1)",   icon: Pause },
  "Cancelled": { label:"Cancelled", color:"hsl(0 60% 40%)",   bg:"hsl(0 72%51%/0.1)",    icon: XCircle },
  "Prospect":  { label:"Prospect",  color:"hsl(var(--muted-foreground))", bg:"hsl(var(--muted))", icon: Eye },
  "Unknown":   { label:"Unknown",   color:"hsl(var(--muted-foreground))", bg:"hsl(var(--muted))", icon: Clock },
};

function getGroupKey(group: string) { return group.split(" ")[0] || ""; }

export function GroupedFoliosView({ folios, categories }: { folios: Folio[]; categories: Category[] }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => setCollapsed(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  const filtered = useMemo(() => {
    if (!search) return folios;
    const q = search.toLowerCase();
    return folios.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.group.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.manager.toLowerCase().includes(q)
    );
  }, [folios, search]);

  // Build group → subGroup → folios hierarchy
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, Folio[]>> = {};
    for (const f of filtered) {
      const g = f.group || "Unknown";
      if (!map[g]) map[g] = {};
      const sub = f.category || "General";
      if (!map[g][sub]) map[g][sub] = [];
      map[g][sub].push(f);
    }
    // Sort groups numerically
    return Object.entries(map).sort(([a],[b]) => {
      const na = parseFloat(a); const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const totalActive = folios.filter(f => f.status === "Active").length;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search folios, groups, managers…"
            className="field-input pl-9"
          />
        </div>
        <div className="label-caps flex-shrink-0" style={{ fontSize: "0.65rem" }}>
          {filtered.length}/{folios.length} · {totalActive} active
        </div>
      </div>

      {/* Groups */}
      {grouped.map(([groupName, subGroups]) => {
        const gk = getGroupKey(groupName);
        const colors = GROUP_COLORS[gk] || { dot:"hsl(var(--muted-foreground))", bg:"hsl(var(--muted)/0.3)", border:"hsl(var(--border))" };
        const groupIsCollapsed = collapsed.has(groupName);
        const totalInGroup = Object.values(subGroups).flat().length;
        const activeInGroup = Object.values(subGroups).flat().filter(f => f.status==="Active").length;

        return (
          <div key={groupName} className="card-base overflow-hidden"
            style={{ borderLeft: `3px solid ${colors.border}` }}>

            {/* Group header */}
            <button
              onClick={() => toggle(groupName)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
              style={{ background: colors.bg }}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors.dot }} />
              <span className="heading-md flex-1 text-foreground" style={{ fontSize: "1rem" }}>
                {groupName}
              </span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="label-caps">{totalInGroup} folios · {activeInGroup} active</span>
                {groupIsCollapsed
                  ? <ChevronRight size={16} className="text-muted-foreground" />
                  : <ChevronDown size={16} className="text-muted-foreground" />}
              </div>
            </button>

            {/* Sub-groups */}
            {!groupIsCollapsed && Object.entries(subGroups)
              .sort(([a],[b]) => a.localeCompare(b))
              .map(([subName, subFolios]) => {
                const subKey = `${groupName}::${subName}`;
                const subCollapsed = collapsed.has(subKey);
                const hasSubCat = subName !== "General" && subName !== "";

                return (
                  <div key={subKey} className="border-t border-border">
                    {/* Sub-category header */}
                    {hasSubCat && (
                      <button
                        onClick={() => toggle(subKey)}
                        className="w-full flex items-center gap-2 px-6 py-2 text-left hover:bg-muted/10 transition-colors"
                        style={{ background: "hsl(var(--muted)/0.15)" }}
                      >
                        <span className="w-1 h-4 rounded-sm flex-shrink-0" style={{ background: colors.dot, opacity: 0.5 }} />
                        <span className="heading-sm text-foreground" style={{ fontSize: "0.8rem" }}>{subName}</span>
                        <span className="label-caps ml-1" style={{ color:"hsl(var(--muted-foreground))" }}>
                          ({subFolios.length})
                        </span>
                        {subCollapsed
                          ? <ChevronRight size={13} className="ml-auto text-muted-foreground" />
                          : <ChevronDown size={13} className="ml-auto text-muted-foreground" />}
                      </button>
                    )}

                    {/* Folio rows */}
                    {!subCollapsed && (
                      <div>
                        {subFolios.map(folio => {
                          const badge = STATUS_BADGE[folio.status] || STATUS_BADGE.Unknown;
                          const Icon = badge.icon;
                          return (
                            <div key={folio.id}
                              className="flex items-start gap-3 px-6 py-3 border-t border-border hover:bg-muted/10 transition-colors"
                              style={{ paddingLeft: hasSubCat ? "2.5rem" : "1.5rem" }}>

                              {/* Status dot */}
                              <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{ background: badge.bg }}>
                                <Icon size={11} style={{ color: badge.color }} />
                              </div>

                              {/* Folio details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground text-sm leading-tight"
                                      style={{ fontFamily:"'Barlow',sans-serif" }}>
                                      {folio.name}
                                    </p>
                                    {folio.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed"
                                        style={{ fontFamily:"'Barlow',sans-serif", maxWidth:"60ch" }}>
                                        {folio.description.slice(0, 120)}{folio.description.length > 120 ? "…" : ""}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                      {folio.manager && folio.manager !== "—" && (
                                        <span className="label-caps" style={{ fontSize:"0.58rem" }}>
                                          👤 {folio.manager}
                                        </span>
                                      )}
                                      {folio.asfs > 0 && (
                                        <span className="label-caps" style={{ fontSize:"0.58rem" }}>
                                          ⚡ {folio.asfs} action{folio.asfs!==1?"s":""}
                                        </span>
                                      )}
                                      {folio.active > 0 && (
                                        <span className="label-caps" style={{ fontSize:"0.58rem", color:"hsl(142 71% 38%)" }}>
                                          ● {folio.active} active
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: status badge + link */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="label-caps px-2 py-0.5 rounded whitespace-nowrap"
                                      style={{ background:badge.bg, color:badge.color, fontSize:"0.58rem" }}>
                                      {badge.label}
                                    </span>
                                    {folio.tmLink && (
                                      <a href={folio.tmLink} target="_blank" rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                        title="Open in Teamwork">
                                        <ExternalLink size={12} />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
