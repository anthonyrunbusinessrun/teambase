"use client";
import { useState, useEffect } from "react";
import { Circle, Minus, Clock } from "lucide-react";

interface Member {
  id: string; name: string | null; email: string;
  avatarUrl: string | null; role: string | null;
  status: string | null; lastSeenAt: Date | null;
  positionTitle: string | null;
}

const STATUS = {
  online:  { color: "hsl(142 71% 38%)", label: "Online",  icon: Circle  },
  away:    { color: "hsl(38 90% 48%)",  label: "Away",    icon: Minus   },
  offline: { color: "hsl(var(--muted-foreground))", label: "Offline", icon: Clock },
};

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  if (avatar?.startsWith("data:") || avatar?.startsWith("http")) {
    return <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />;
  }
  const palette = ["hsl(352 80% 42%)", "hsl(200 80% 42%)", "hsl(142 71% 38%)", "hsl(38 90% 48%)", "hsl(270 65% 52%)"];
  const color = palette[(name?.charCodeAt(0) || 0) % palette.length];
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: color, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "white" }}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

export function PresenceList({ members: initialMembers, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Poll presence data every 15 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/presence/all", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setMembers(data);
          setLastRefresh(new Date());
        }
      } catch {}
    };
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  const online  = members.filter(m => m.status === "online");
  const away    = members.filter(m => m.status === "away");
  const offline = members.filter(m => !m.status || m.status === "offline");

  const Section = ({ title, list }: { title: string; list: Member[] }) => {
    if (!list.length) return null;
    return (
      <div>
        <p className="label-caps mb-3 flex items-center gap-2" style={{ fontSize: "0.62rem" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[title.toLowerCase() as keyof typeof STATUS]?.color || "hsl(var(--muted-foreground))" }} />
          {title} · {list.length}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {list.map(m => {
            const st = STATUS[m.status as keyof typeof STATUS] || STATUS.offline;
            const isMe = m.id === currentUserId;
            return (
              <div key={m.id} className="card-base p-4 flex items-center gap-3"
                style={{ borderLeft: `3px solid ${st.color}` }}>
                <div className="relative flex-shrink-0">
                  <Avatar name={m.name || m.email} avatar={m.avatarUrl} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card"
                    style={{ background: st.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate" style={{ fontFamily: "'Barlow',sans-serif" }}>
                    {m.name || m.email}{isMe ? " (you)" : ""}
                  </p>
                  {m.positionTitle && (
                    <p className="label-caps truncate" style={{ fontSize: "0.58rem", color: "hsl(var(--crimson))" }}>{m.positionTitle}</p>
                  )}
                  <p className="label-caps" style={{ fontSize: "0.55rem", opacity: 0.55 }}>
                    {m.status === "online" ? "Active now" : timeAgo(m.lastSeenAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="label-caps" style={{ fontSize: "0.6rem", opacity: 0.5 }}>
          Updated {timeAgo(lastRefresh)} · refreshes every 15s
        </p>
      </div>
      <Section title="Online" list={online} />
      <Section title="Away" list={away} />
      <Section title="Offline" list={offline} />
    </div>
  );
}
