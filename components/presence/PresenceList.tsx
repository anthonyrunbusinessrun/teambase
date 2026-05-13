"use client";
import { useState, useEffect } from "react";
import { MapPin, Phone, MessageSquare, BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";

interface Member {
  id: string; name: string | null; email: string;
  avatarUrl: string | null; role: string | null;
  status: string | null; lastSeenAt: Date | null;
  positionTitle: string | null; bio: string | null;
  location: string | null; phone: string | null;
  motto: string | null; memberId: string | null;
}

const ST = {
  online:  { color: "hsl(142 71% 38%)", label: "Active now" },
  away:    { color: "hsl(38 90% 48%)",  label: "Away" },
  offline: { color: "hsl(var(--muted-foreground))", label: "Offline" },
} as const;

function timeAgo(d: Date | null) {
  if (!d) return "Never";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  if (avatar?.startsWith("http"))
    return <img src={avatar} alt={name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />;
  const colors = ["hsl(352 80% 42%)","hsl(200 80% 42%)","hsl(142 71% 38%)","hsl(38 90% 48%)","hsl(270 65% 52%)"];
  return (
    <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: colors[(name?.charCodeAt(0)||0) % colors.length], fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:"1.75rem", color:"white" }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

function Card({ m, isMe, onMsg }: { m: Member; isMe: boolean; onMsg: (id:string)=>void }) {
  const st = ST[m.status as keyof typeof ST] || ST.offline;
  const name = m.name || m.email.split("@")[0];

  return (
    <div className="card-base overflow-hidden" style={{ borderTop: `3px solid ${st.color}` }}>
      <div className="p-5">
        {/* Top row: avatar + identity */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative flex-shrink-0">
            <Avatar name={name} avatar={m.avatarUrl} />
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card"
              style={{ background: st.color }} />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:"1.2rem", lineHeight:1, color:"hsl(var(--foreground))" }}>
                {name}
                {isMe && <span style={{ fontSize:"0.6rem", color:"hsl(var(--crimson))", marginLeft:6 }}>(you)</span>}
              </h3>
            </div>
            {m.positionTitle && (
              <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.8rem", color:"hsl(var(--crimson))", letterSpacing:"0.03em" }}>
                {m.positionTitle}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {m.memberId && (
                <span className="flex items-center gap-1"
                  style={{ background:"hsl(var(--crimson)/0.07)", border:"1px solid hsl(var(--crimson)/0.2)", borderRadius:5, padding:"2px 8px", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:"0.7rem", color:"hsl(var(--crimson))", letterSpacing:"0.06em" }}>
                  <BadgeCheck size={11} strokeWidth={2.5} /> #{m.memberId}
                </span>
              )}
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:"0.68rem", letterSpacing:"0.05em", textTransform:"uppercase", color: st.color }}>
                {m.status === "online" ? "● Active now" : timeAgo(m.lastSeenAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Motto */}
        {m.motto && (
          <div className="mb-3 px-3 py-2.5 rounded-lg"
            style={{ background:"hsl(var(--muted)/0.5)", borderLeft:"3px solid hsl(var(--crimson)/0.35)" }}>
            <p style={{ fontFamily:"'Barlow',sans-serif", fontStyle:"italic", fontSize:"0.85rem", color:"hsl(var(--foreground)/0.85)", lineHeight:1.55 }}>
              "{m.motto}"
            </p>
          </div>
        )}

        {/* Bio */}
        {m.bio && (
          <p className="mb-3 text-sm" style={{ fontFamily:"'Barlow',sans-serif", color:"hsl(var(--muted-foreground))", lineHeight:1.6, fontSize:"0.83rem" }}>
            {m.bio}
          </p>
        )}

        {/* Meta */}
        {(m.location || m.phone) && (
          <div className="flex flex-wrap gap-3 mb-3">
            {m.location && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color:"hsl(var(--muted-foreground))", fontFamily:"'Barlow',sans-serif" }}>
                <MapPin size={12} /> {m.location}
              </span>
            )}
            {m.phone && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color:"hsl(var(--muted-foreground))", fontFamily:"'Barlow',sans-serif" }}>
                <Phone size={12} /> {m.phone}
              </span>
            )}
          </div>
        )}

        {/* Message button */}
        {!isMe && (
          <button onClick={() => onMsg(m.id)} className="btn-outline w-full justify-center"
            style={{ fontSize:"0.72rem", padding:"0.45rem" }}>
            <MessageSquare size={13} /> Message
          </button>
        )}
      </div>
    </div>
  );
}

export function PresenceList({ members: init, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [members, setMembers] = useState(init);
  const router = useRouter();

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/presence/all", { cache: "no-store" });
        if (r.ok) setMembers(await r.json());
      } catch {}
    };
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  const online  = members.filter(m => m.status === "online");
  const away    = members.filter(m => m.status === "away");
  const offline = members.filter(m => !m.status || m.status === "offline");

  const Section = ({ label, color, list }: { label:string; color:string; list:Member[] }) => {
    if (!list.length) return null;
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <h2 className="heading-sm" style={{ fontSize:"0.95rem" }}>{label}</h2>
          <span className="label-caps" style={{ fontSize:"0.6rem", opacity:0.5 }}>· {list.length}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map(m => (
            <Card key={m.id} m={m} isMe={m.id===currentUserId}
              onMsg={id => router.push(`/channels?dm=${id}`)} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Section label="Online"  color="hsl(142 71% 38%)" list={online} />
      <Section label="Away"    color="hsl(38 90% 48%)"  list={away} />
      <Section label="Offline" color="hsl(var(--muted-foreground))" list={offline} />
    </div>
  );
}
