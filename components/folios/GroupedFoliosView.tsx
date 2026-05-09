"use client";
import { useState, useMemo } from "react";
import { Search, ExternalLink, ChevronDown, ChevronRight, Layers, X } from "lucide-react";

interface Folio {
  id: string; name: string; group: string; category: string;
  status: string; description: string; manager: string;
  vsfs: number; asfs: number; active: number; tmLink: string;
}

const GROUP_META: Record<string, { color: string; emoji: string }> = {
  "1.0 INBOX":     { color:"hsl(200 80% 48%)",   emoji:"📥" },
  "2.0 INTERNAL":  { color:"hsl(270 65% 55%)",   emoji:"🏢" },
  "3.0 PROJECTS":  { color:"hsl(352 80% 42%)",   emoji:"📁" },
  "4.0 ENTITIES":  { color:"hsl(38 90% 48%)",    emoji:"🏗️" },
  "5.0 FINANCIAL": { color:"hsl(142 71% 38%)",   emoji:"💰" },
  "6.0 ARCHIVE":   { color:"hsl(220 15% 55%)",   emoji:"🗄️" },
  "7.0 CONFIDENTIAL":{ color:"hsl(0 65% 45%)",  emoji:"🔒" },
};

const STATUS_COLOR: Record<string, string> = {
  "Active":"hsl(142 71% 38%)", "Complete":"hsl(220 57% 40%)",
  "On Hold":"hsl(38 70% 40%)", "Cancelled":"hsl(0 60% 45%)",
  "Prospect":"hsl(var(--muted-foreground))", "Unknown":"hsl(var(--muted-foreground))",
};

export function GroupedFoliosView({ folios }: { folios: Folio[] }) {
  const [selectedGroup, setSelectedGroup] = useState<string|null>(null);
  const [selectedFolio, setSelectedFolio] = useState<Folio|null>(null);
  const [search, setSearch] = useState("");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  // Build groups
  const groups = useMemo(() => {
    const map: Record<string, {folios:Folio[]; cats: Record<string,Folio[]>}> = {};
    const q = search.toLowerCase();
    const filtered = search
      ? folios.filter(f => f.name.toLowerCase().includes(q)||f.group.toLowerCase().includes(q)||f.category.toLowerCase().includes(q)||f.description.toLowerCase().includes(q))
      : folios;

    for (const f of filtered) {
      const g = f.group || "Ungrouped";
      if (!map[g]) map[g] = { folios:[], cats:{} };
      map[g].folios.push(f);
      const cat = f.category || "General";
      if (!map[g].cats[cat]) map[g].cats[cat] = [];
      map[g].cats[cat].push(f);
    }
    return Object.entries(map).sort(([a],[b]) => {
      const na=parseFloat(a), nb=parseFloat(b);
      return !isNaN(na)&&!isNaN(nb) ? na-nb : a.localeCompare(b);
    });
  }, [folios, search]);

  // Auto-select first group if none selected
  const activeGroup = selectedGroup || groups[0]?.[0] || null;
  const activeData = groups.find(([g])=>g===activeGroup);

  const toggleCat = (key: string) => setCollapsedCats(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  return (
    <div style={{ display:"flex", gap:"0.75rem", minHeight:"70vh" }}>

      {/* ── Left nav: group list ── */}
      <div className="card-base flex-shrink-0 overflow-hidden"
        style={{ width:200, alignSelf:"flex-start", position:"sticky", top:70 }}>
        <div className="px-3 py-2.5 border-b border-border">
          <p className="heading-sm" style={{ fontSize:"0.75rem" }}>Groups</p>
        </div>
        <nav className="py-1">
          {groups.map(([g, data]) => {
            const meta = GROUP_META[g] || { color:"hsl(var(--muted-foreground))", emoji:"📂" };
            const isActive = g === activeGroup;
            return (
              <button key={g} onClick={() => { setSelectedGroup(g); setSelectedFolio(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                style={{
                  background: isActive ? `${meta.color}18` : "transparent",
                  borderLeft: `3px solid ${isActive ? meta.color : "transparent"}`,
                }}>
                <span style={{ fontSize:"0.9rem", lineHeight:1 }}>{meta.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p style={{
                    fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                    fontSize:"0.72rem", letterSpacing:"0.04em",
                    color: isActive ? meta.color : "hsl(var(--foreground))",
                    lineHeight:1.2,
                  }}>
                    {g}
                  </p>
                  <p className="label-caps" style={{ fontSize:"0.55rem", opacity:0.6 }}>
                    {data.folios.length} folios
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Main: category + folio list ── */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search folios…" className="field-input pl-9" />
        </div>

        {activeData ? (() => {
          const [groupName, data] = activeData;
          const meta = GROUP_META[groupName] || { color:"hsl(var(--crimson))", emoji:"📂" };
          const sortedCats = Object.entries(data.cats).sort(([a],[b])=>a.localeCompare(b));
          return (
            <div className="card-base overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border"
                style={{ background:`${meta.color}0D` }}>
                <span style={{ fontSize:"1.2rem" }}>{meta.emoji}</span>
                <div>
                  <h2 className="heading-md text-foreground" style={{ fontSize:"1.1rem" }}>{groupName}</h2>
                  <p className="label-caps" style={{ color:"hsl(var(--muted-foreground))" }}>
                    {data.folios.length} folios · {data.folios.filter(f=>f.status==="Active").length} active
                  </p>
                </div>
              </div>

              {sortedCats.map(([catName, catFolios]) => {
                const catKey = `${groupName}::${catName}`;
                const isCollapsed = collapsedCats.has(catKey);
                return (
                  <div key={catName} className="border-b border-border last:border-0">
                    {/* Category header */}
                    <button onClick={()=>toggleCat(catKey)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors"
                      style={{ background:"hsl(var(--muted)/0.2)" }}>
                      <span className="w-1 h-4 rounded-full flex-shrink-0" style={{ background:meta.color, opacity:0.6 }} />
                      <span className="heading-sm flex-1 text-foreground" style={{ fontSize:"0.85rem" }}>{catName}</span>
                      <span className="label-caps" style={{ color:"hsl(var(--muted-foreground))", fontSize:"0.58rem" }}>
                        {catFolios.length} folio{catFolios.length!==1?"s":""}
                      </span>
                      {isCollapsed ? <ChevronRight size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                    </button>

                    {/* Folio rows */}
                    {!isCollapsed && catFolios.map(folio => {
                      const isSelected = selectedFolio?.id === folio.id;
                      const statusColor = STATUS_COLOR[folio.status] || STATUS_COLOR.Unknown;
                      return (
                        <button key={folio.id}
                          onClick={() => setSelectedFolio(isSelected ? null : folio)}
                          className="w-full flex items-center gap-3 px-6 py-3 text-left border-t border-border hover:bg-muted/10 transition-colors"
                          style={{ background: isSelected ? `${meta.color}0A` : "transparent" }}>
                          {/* Status dot */}
                          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                            style={{ background:statusColor }} />
                          {/* Name + description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate"
                              style={{ fontFamily:"'Barlow',sans-serif" }}>{folio.name}</p>
                            {folio.description && !isSelected && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5"
                                style={{ fontFamily:"'Barlow',sans-serif", maxWidth:"50ch" }}>
                                {folio.description.slice(0,100)}
                              </p>
                            )}
                          </div>
                          {/* Stats */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {folio.asfs > 0 && (
                              <span className="label-caps" style={{ fontSize:"0.58rem" }}>
                                ⚡{folio.asfs}
                              </span>
                            )}
                            {folio.active > 0 && (
                              <span className="label-caps" style={{ fontSize:"0.58rem", color:statusColor }}>
                                ●{folio.active}
                              </span>
                            )}
                            {folio.tmLink && (
                              <a href={folio.tmLink} target="_blank" rel="noopener noreferrer"
                                onClick={e=>e.stopPropagation()}
                                className="text-muted-foreground hover:text-foreground" title="Teamwork">
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {/* Expanded folio detail panel */}
                    {!isCollapsed && selectedFolio && catFolios.some(f=>f.id===selectedFolio.id) && (
                      <div className="mx-4 mb-3 mt-1 card-base overflow-hidden border"
                        style={{ borderLeft:`3px solid ${meta.color}` }}>
                        <div className="flex items-start justify-between p-4 border-b border-border">
                          <div>
                            <div className="heading-sm text-foreground" style={{ fontSize:"1rem" }}>
                              {selectedFolio.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="label-caps px-2 py-0.5 rounded"
                                style={{ background:`${STATUS_COLOR[selectedFolio.status]}18`, color:STATUS_COLOR[selectedFolio.status], fontSize:"0.58rem" }}>
                                {selectedFolio.status}
                              </span>
                              <span className="label-caps" style={{ fontSize:"0.58rem" }}>{catName}</span>
                              {selectedFolio.manager && selectedFolio.manager !== "—" && (
                                <span className="label-caps" style={{ fontSize:"0.58rem" }}>👤 {selectedFolio.manager}</span>
                              )}
                            </div>
                          </div>
                          <button onClick={()=>setSelectedFolio(null)} className="text-muted-foreground hover:text-foreground">
                            <X size={14} />
                          </button>
                        </div>
                        {selectedFolio.description && (
                          <div className="p-4 border-b border-border">
                            <p className="text-xs text-muted-foreground mb-1 label-caps">Narrative</p>
                            <p className="text-sm" style={{ fontFamily:"'Barlow',sans-serif", lineHeight:1.6 }}>
                              {selectedFolio.description}
                            </p>
                          </div>
                        )}
                        <div className="px-4 py-3 flex items-center gap-6 flex-wrap">
                          <div><p className="label-caps" style={{ fontSize:"0.55rem" }}>Actions</p>
                            <p className="stat-number" style={{ fontSize:"1.4rem" }}>{selectedFolio.asfs}</p></div>
                          <div><p className="label-caps" style={{ fontSize:"0.55rem" }}>Active</p>
                            <p className="stat-number" style={{ fontSize:"1.4rem", color:STATUS_COLOR.Active }}>{selectedFolio.active}</p></div>
                          {selectedFolio.vsfs > 0 && (
                            <div><p className="label-caps" style={{ fontSize:"0.55rem" }}>VSFs</p>
                              <p className="stat-number" style={{ fontSize:"1.4rem" }}>{selectedFolio.vsfs}</p></div>
                          )}
                          {selectedFolio.tmLink && (
                            <a href={selectedFolio.tmLink} target="_blank" rel="noopener noreferrer" className="btn-outline ml-auto"
                              style={{ fontSize:"0.65rem", padding:"0.3rem 0.75rem" }}>
                              <ExternalLink size={11} /> Teamwork
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })() : (
          <div className="card-base p-8 text-center text-sm text-muted-foreground">Select a group to view folios</div>
        )}
      </div>
    </div>
  );
}
