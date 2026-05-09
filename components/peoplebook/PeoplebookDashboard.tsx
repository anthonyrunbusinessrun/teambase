"use client";
import { useState } from "react";
import {
  ExternalLink, User, Briefcase, ChevronDown, ChevronRight,
  Search, Star, Clock, CheckCircle, XCircle, AlertCircle, Key
} from "lucide-react";
import Link from "next/link";

interface Applicant {
  id: string;
  "Full Name"?: string;
  Email?: string;
  Phone?: string;
  Stage?: string;
  "Date Applied"?: string;
  Source?: string;
  "Visa / Work Authorization"?: string;
  [key: string]: unknown;
}
interface Role { id: string; "Role Title"?: string; Department?: string; Status?: string; }
interface Interview { id: string; Score?: number; Outcome?: string; }

const STAGE_META: Record<string, { color: string; bg: string; icon: any; order: number }> = {
  "New":       { color:"hsl(200 80% 42%)", bg:"hsl(200 80% 42%/0.1)", icon:AlertCircle, order:1 },
  "Reviewing": { color:"hsl(270 65% 52%)", bg:"hsl(270 65%52%/0.1)", icon:Star,         order:2 },
  "Interview": { color:"hsl(38 90% 48%)",  bg:"hsl(38 90%48%/0.1)",  icon:Clock,        order:3 },
  "Offer":     { color:"hsl(142 71% 38%)", bg:"hsl(142 71%38%/0.1)", icon:CheckCircle,  order:4 },
  "Hired":     { color:"hsl(142 71% 30%)", bg:"hsl(142 71%30%/0.08)",icon:CheckCircle,  order:5 },
  "Rejected":  { color:"hsl(0 60% 45%)",   bg:"hsl(0 60%45%/0.08)",  icon:XCircle,      order:6 },
};
const DEPT_COLORS: Record<string, string> = {
  "Operations":"hsl(var(--crimson))","Technology":"hsl(200 80% 42%)",
  "Administration":"hsl(270 65% 52%)","Maintenance":"hsl(38 90% 48%)",
  "Compliance":"hsl(142 71% 38%)","Management":"hsl(220 57% 40%)",
};

export function PeoplebookDashboard({ applicants, roles, interviews, stages, openRoles, newApplicants, noKey }: {
  applicants: Applicant[]; roles: Role[]; interviews: Interview[];
  stages: Record<string,number>; openRoles: Role[];
  newApplicants: number; noKey?: boolean;
}) {
  const [tab, setTab] = useState<"pipeline"|"roles"|"applicants">("pipeline");
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState("All");
  const [expandedId, setExpandedId] = useState<string|null>(null);

  const rolesByDept: Record<string,Role[]> = {};
  for (const r of roles) {
    const d = r.Department||"Other";
    (rolesByDept[d]=rolesByDept[d]||[]).push(r);
  }

  const filtered = applicants.filter(a => {
    const q = search.toLowerCase();
    if (q && !(a["Full Name"]||"").toLowerCase().includes(q) && !(a.Email||"").toLowerCase().includes(q)) return false;
    if (selectedStage!=="All" && (a.Stage||"New")!==selectedStage) return false;
    return true;
  });

  const stageOrder = Object.entries(stages).sort(([a],[b])=>(STAGE_META[a]?.order||99)-(STAGE_META[b]?.order||99));

  if (noKey || applicants.length===0 && roles.length===0) {
    return (
      <div className="card-base p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
          style={{ background:"hsl(var(--crimson)/0.1)" }}>
          <Key size={22} style={{ color:"hsl(var(--crimson))" }} />
        </div>
        <div>
          <div className="heading-sm mb-2">Connect PeopleBook Airtable</div>
          <p className="text-sm text-muted-foreground" style={{ fontFamily:"'Barlow',sans-serif", maxWidth:400, margin:"0 auto" }}>
            Your Airtable API key needs access to the PeopleBook base (<code>appGGFKuFxQ3Z0Wuz</code>).
            Go to Settings and save your PAT to sync data.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/settings" className="btn-primary"><Key size={13}/> Update API Key</Link>
          <a href="https://www.peoplebook.app/" target="_blank" rel="noopener noreferrer"
            className="btn-outline"><ExternalLink size={13}/> Open PeopleBook Portal</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Total Applicants", value:applicants.length, color:"hsl(var(--foreground))" },
          { label:"New / Unreviewed", value:newApplicants,     color:"hsl(200 80% 42%)" },
          { label:"Open Roles",       value:openRoles.length,  color:"hsl(var(--crimson))" },
          { label:"In Interview",     value:stages["Interview"]||0, color:"hsl(38 90% 48%)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-base p-4">
            <div className="stat-number" style={{ color }}>{value}</div>
            <div className="label-caps mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card-base overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto" style={{ scrollbarWidth:"none" }}>
          {[
            { id:"pipeline", label:"Pipeline" },
            { id:"roles",    label:`Open Roles (${openRoles.length})` },
            { id:"applicants",label:`All Applicants (${applicants.length})` },
          ].map(t => (
            <button key={t.id} onClick={()=>setTab(t.id as any)}
              className="px-4 py-2.5 whitespace-nowrap border-b-2 transition-all flex-shrink-0"
              style={{
                fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                fontSize:"0.72rem", letterSpacing:"0.07em", textTransform:"uppercase",
                borderBottomColor: tab===t.id?"hsl(var(--crimson))":"transparent",
                color: tab===t.id?"hsl(var(--crimson))":"hsl(var(--muted-foreground))",
                background: tab===t.id?"hsl(var(--crimson)/0.04)":"transparent",
              }}>{t.label}</button>
          ))}
        </div>

        {/* Pipeline */}
        {tab==="pipeline" && (
          <div className="p-4 space-y-3">
            {stageOrder.length===0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">No applicants in pipeline.</p>
            ) : stageOrder.map(([stage, count]) => {
              const meta = STAGE_META[stage]||{color:"hsl(var(--muted-foreground))",bg:"hsl(var(--muted))",icon:User,order:99};
              const Icon = meta.icon;
              const list = applicants.filter(a=>(a.Stage||"New")===stage)
                .sort((a,b)=>(b["Date Applied"]||"").localeCompare(a["Date Applied"]||""));
              return (
                <div key={stage} className="card-base overflow-hidden" style={{ borderLeft:`3px solid ${meta.color}` }}>
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background:meta.bg }}>
                    <Icon size={14} style={{ color:meta.color, flexShrink:0 }} />
                    <span className="heading-sm flex-1" style={{ color:meta.color, fontSize:"0.9rem" }}>{stage}</span>
                    <span className="label-caps" style={{ fontSize:"0.62rem" }}>{count}</span>
                  </div>
                  {list.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-border hover:bg-muted/10">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background:meta.bg }}>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"0.8rem",color:meta.color }}>
                          {(a["Full Name"]||"?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{a["Full Name"]||"—"}</p>
                        <p className="label-caps" style={{ fontSize:"0.57rem" }}>
                          {a.Email||""}{a["Date Applied"]?` · ${a["Date Applied"]}`:""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {a["Visa / Work Authorization"] && (
                          <span className="label-caps px-1.5 py-0.5 rounded"
                            style={{ background:"hsl(142 71% 38%/0.1)",color:"hsl(142 71% 38%)",fontSize:"0.52rem" }}>
                            ✓ Auth
                          </span>
                        )}
                        {a.Source && <span className="label-caps hidden sm:inline" style={{ fontSize:"0.52rem",opacity:0.6 }}>{a.Source}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Roles */}
        {tab==="roles" && (
          <div className="p-4 space-y-4">
            {Object.entries(rolesByDept).sort(([a],[b])=>a.localeCompare(b)).map(([dept, dRoles]) => {
              const color = DEPT_COLORS[dept]||"hsl(var(--muted-foreground))";
              return (
                <div key={dept}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full" style={{ background:color }} />
                    <span className="heading-sm" style={{ fontSize:"0.85rem" }}>{dept}</span>
                    <span className="label-caps" style={{ color:"hsl(var(--muted-foreground))",fontSize:"0.58rem" }}>({dRoles.length})</span>
                  </div>
                  <div className="space-y-2 pl-4">
                    {dRoles.map(role => (
                      <div key={role.id} className="card-base flex items-center gap-3 p-3">
                        <Briefcase size={14} style={{ color, flexShrink:0 }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{role["Role Title"]||"Untitled Role"}</p>
                          <p className="label-caps" style={{ fontSize:"0.57rem" }}>{dept}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="label-caps px-2 py-0.5 rounded"
                            style={{
                              background: role.Status==="Open"?"hsl(142 71% 38%/0.1)":"hsl(var(--muted))",
                              color: role.Status==="Open"?"hsl(142 71% 38%)":"hsl(var(--muted-foreground))",
                              fontSize:"0.57rem",
                            }}>{role.Status||"Open"}</span>
                          <a href="https://www.peoplebook.app/" target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground" title="View on PeopleBook">
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* All applicants */}
        {tab==="applicants" && (
          <div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-muted/10">
              <div className="relative flex-1" style={{ minWidth:160 }}>
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search name or email…" className="field-input pl-8"
                  style={{ paddingTop:"0.3rem", paddingBottom:"0.3rem", fontSize:"0.82rem" }} />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {["All",...Object.keys(stages)].map(s => (
                  <button key={s} onClick={()=>setSelectedStage(s)}
                    className="label-caps px-2 py-0.5 rounded transition-all"
                    style={{
                      background:selectedStage===s?"hsl(var(--crimson))":"hsl(var(--muted))",
                      color:selectedStage===s?"white":"hsl(var(--muted-foreground))",
                      fontSize:"0.57rem",
                    }}>{s}</button>
                ))}
              </div>
              <span className="label-caps ml-auto" style={{ fontSize:"0.57rem" }}>{filtered.length}/{applicants.length}</span>
            </div>
            <div>
              {filtered.map(a => {
                const stage = a.Stage||"New";
                const meta = STAGE_META[stage]||STAGE_META.New;
                const Icon = meta.icon;
                const isExp = expandedId===a.id;
                const qa = Object.entries(a).filter(([k])=>k.startsWith("Q")&&k.includes("—"));
                return (
                  <div key={a.id} className="border-b border-border last:border-0">
                    <button onClick={()=>setExpandedId(isExp?null:a.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/10 transition-colors">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background:meta.bg }}>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"0.9rem",color:meta.color }}>
                          {(a["Full Name"]||"?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{a["Full Name"]||"—"}</p>
                          <span className="label-caps px-1.5 py-0.5 rounded flex items-center gap-1"
                            style={{ background:meta.bg, color:meta.color, fontSize:"0.52rem" }}>
                            <Icon size={9}/> {stage}
                          </span>
                        </div>
                        <p className="label-caps" style={{ fontSize:"0.57rem" }}>
                          {a.Email||""}{a.Phone?` · ${a.Phone}`:""}{a["Date Applied"]?` · ${a["Date Applied"]}`:""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {a["Visa / Work Authorization"] && (
                          <span className="label-caps hidden sm:inline" style={{ fontSize:"0.52rem",color:"hsl(142 71% 38%)" }}>✓ Auth</span>
                        )}
                        {isExp?<ChevronDown size={13}/>:<ChevronRight size={13}/>}
                      </div>
                    </button>
                    {isExp && (
                      <div className="px-4 pb-4 bg-muted/5 border-t border-border">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                          <div className="space-y-2">
                            <p className="label-caps" style={{ fontSize:"0.6rem",color:"hsl(var(--crimson))" }}>Contact</p>
                            {[["Email",a.Email],["Phone",a.Phone],["Source",a.Source],["Work Auth",a["Visa / Work Authorization"]],["Applied",a["Date Applied"]]]
                              .filter(([,v])=>v).map(([l,v])=>(
                              <div key={l as string}>
                                <span className="label-caps" style={{ fontSize:"0.55rem" }}>{l}: </span>
                                <span className="text-xs" style={{ fontFamily:"'Barlow',sans-serif" }}>{v as string}</span>
                              </div>
                            ))}
                          </div>
                          {qa.length>0 && (
                            <div className="space-y-2">
                              <p className="label-caps" style={{ fontSize:"0.6rem",color:"hsl(var(--crimson))" }}>Screening Answers</p>
                              {qa.slice(0,3).map(([k,v])=>(
                                <div key={k}>
                                  <p className="label-caps" style={{ fontSize:"0.52rem",opacity:0.7 }}>{k.split("—")[1]?.trim()||k}</p>
                                  <p className="text-xs" style={{ fontFamily:"'Barlow',sans-serif",lineHeight:1.5 }}>
                                    {String(v).slice(0,120)}{String(v).length>120?"…":""}
                                  </p>
                                </div>
                              ))}
                              {qa.length>3 && <p className="label-caps" style={{ fontSize:"0.52rem",opacity:0.5 }}>+{qa.length-3} more</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length===0 && <div className="p-8 text-center text-sm text-muted-foreground">No applicants match.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
