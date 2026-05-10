import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPg } from "@/lib/db/postgres";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

function timeUntil(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff < 0) return "Overdue";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return `${Math.floor((diff % 3600000) / 60000)}m`;
}

const PRIORITY_DOT: Record<string,string> = {
  urgent: "hsl(0 72% 51%)", high: "hsl(25 90% 50%)",
  medium: "hsl(38 90% 50%)", low: "hsl(var(--muted-foreground))",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const sql = getPg();
  const userId = session.user.id;

  // All queries in parallel — no joins, minimal columns
  const [myTaskRows, onlineRows, recentTaskRows] = await Promise.all([
    sql`SELECT COUNT(*) as n FROM tasks WHERE assigned_to=${userId} AND status NOT IN ('done','cancelled')`,
    sql`SELECT COUNT(*) as n FROM presence WHERE status='online'`,
    sql`SELECT id, title, status, priority, due_date as "dueDate" FROM tasks WHERE status NOT IN ('done','cancelled') ORDER BY created_at DESC LIMIT 8`,
  ]).catch(() => [[{n:0}],[{n:0}],[]]);

  const myCount   = Number((myTaskRows as any)[0]?.n || 0);
  const online    = Number((onlineRows as any)[0]?.n || 0);
  const tasks     = recentTaskRows as any[];
  const firstName = session.user.name?.split(" ")[0] || "there";
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const next      = tasks.filter(t=>t.dueDate && new Date(t.dueDate)>new Date())
    .sort((a,b)=>new Date(a.dueDate).getTime()-new Date(b.dueDate).getTime())[0];

  return (
    <>
      <TopBar title="Dashboard" subtitle={`${greeting}, ${firstName}`}
        right={<Link href="/tasks/new" className="btn-primary"><Plus size={14}/>New Task</Link>} />
      <div className="page-content space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:"My Open Tasks",  value:myCount,                                             href:"/tasks",    color:"hsl(var(--crimson))" },
            { label:"Online Now",     value:online,                                              href:"/presence", color:"hsl(142 71% 38%)" },
            { label:"In Progress",    value:tasks.filter(t=>t.status==="in_progress").length,    href:"/tasks",    color:"hsl(220 57% 40%)" },
            { label:"Total Open",     value:tasks.length,                                        href:"/tasks",    color:"hsl(var(--muted-foreground))" },
          ].map(s=>(
            <Link key={s.label} href={s.href} className="card-interactive p-4 block">
              <div className="stat-number" style={{ color:s.color }}>{s.value}</div>
              <p className="label-caps mt-1">{s.label}</p>
            </Link>
          ))}
        </div>

        {/* Next deadline */}
        {next?.dueDate && (
          <div className="card-accent p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background:"hsl(var(--crimson)/0.1)" }}>
              <span style={{ fontSize:"1.2rem" }}>⏰</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="label-caps" style={{ color:"hsl(var(--crimson))" }}>Next Deadline</p>
              <p className="font-medium text-foreground truncate mt-0.5" style={{ fontFamily:"'Barlow',sans-serif" }}>{next.title}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:"1.5rem", lineHeight:1 }}>{timeUntil(new Date(next.dueDate))}</div>
              <p className="label-caps mt-0.5">{new Date(next.dueDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</p>
            </div>
          </div>
        )}

        {/* Tasks table */}
        <div className="card-base overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="heading-sm">Recent Tasks</h2>
            <Link href="/tasks" className="label-caps" style={{ color:"hsl(var(--crimson))" }}>View All →</Link>
          </div>
          {tasks.length===0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No open tasks yet.</p>
              <Link href="/tasks/new" className="btn-primary inline-flex"><Plus size={13}/>Create Task</Link>
            </div>
          ) : tasks.map(t=>{
            const due = t.dueDate ? new Date(t.dueDate) : null;
            const over = due && due < new Date();
            return (
              <Link key={t.id} href={`/tasks/${t.id}`}
                className="flex items-center border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <span className="w-1 self-stretch flex-shrink-0" style={{ background:PRIORITY_DOT[t.priority]||"hsl(var(--muted))" }}/>
                <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ fontFamily:"'Barlow',sans-serif" }}>{t.title}</p>
                    <p className="label-caps mt-0.5 capitalize">{t.status.replace("_"," ")} · {t.priority}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {due && (
                      <span className="label-caps hidden sm:block" style={{ color:over?"hsl(0 72% 51%)":"hsl(var(--muted-foreground))", fontSize:"0.65rem" }}>
                        {over?"⚠ Overdue":timeUntil(due)}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-muted-foreground"/>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
