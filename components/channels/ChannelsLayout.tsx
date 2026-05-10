"use client";
import {
  useState, useEffect, useRef, useTransition, memo, useCallback
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Send, Smile, X, Hash, Lock, UserPlus,
  Paperclip, FileText, File, Check, Bell,
  ChevronRight, MessageSquare, Search, AlertCircle,
  Loader2,
} from "lucide-react";
import {
  createChannel, toggleReaction,
  inviteToChannel, acceptInvite, declineInvite,
  toggleDMReaction,
} from "@/lib/actions/channels";
import { TopBar } from "@/components/layout/TopBar";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Channel { id: string; name: string; description: string | null; emoji: string | null; type: string; createdBy: string; }
interface Invite  { id: string; channelId: string; channelName: string; channelEmoji: string; inviterName: string; }
interface AnyMsg  {
  id: string; body: string; reactions: string | null; attachments: string | null;
  createdAt: Date; deletedAt?: Date | null;
  // Channel msg fields
  userId?: string; userName?: string | null; userAvatar?: string | null; edited?: boolean | null;
  // DM fields
  fromUserId?: string; fromName?: string | null; fromAvatar?: string | null;
}
interface AppUser { id: string; name: string | null; avatarUrl: string | null; }
type View = { type: "channel"; id: string } | { type: "dm"; userId: string } | null;

const QUICK_EMOJIS = ["👍","❤️","😂","🎉","🔥","✅","👀","💯"];
const EMOJI_PICKER = ["😀","😂","❤️","🔥","👍","✅","🎉","💯","🚀","👀","💬","🙌","⚡","🎯","💡","🏆","📌","⚠️","🔴","🟢","📅","⏰","🔔","💼","📊","📋","🗓️","🤝","😎","🤔","💪","🙏","✨","🎨","🌟","⭐","🥳","🤩"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function viewKey(v: View) {
  if (!v) return "";
  return v.type === "channel" ? `ch:${v.id}` : `dm:${v.userId}`;
}

function getApiUrl(v: View, since?: string) {
  if (!v) return "";
  const base = v.type === "channel" ? `/api/channels/${v.id}` : `/api/dm/${(v as any).userId}`;
  return since ? `${base}?since=${encodeURIComponent(since)}` : base;
}

function getSenderInfo(msg: AnyMsg) {
  return {
    name:   msg.fromName  || msg.userName  || "Unknown",
    avatar: msg.fromAvatar || msg.userAvatar || null,
    userId: msg.fromUserId || msg.userId || "",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ name, avatar, size = 8 }: { name: string; avatar?: string | null; size?: number }) {
  const sz = `${size * 4}px`;
  if (avatar?.startsWith("data:") || avatar?.startsWith("http")) {
    return <img src={avatar} alt={name} style={{ width: sz, height: sz, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  const palette = ["hsl(352 80% 42%)", "hsl(200 80% 42%)", "hsl(142 71% 38%)", "hsl(38 90% 48%)", "hsl(270 65% 52%)"];
  const color = palette[(name?.charCodeAt(0) || 0) % palette.length];
  return (
    <div style={{ width: sz, height: sz, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: `${size * 0.45}rem`, color: "white" }}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

function AttachmentView({ att }: { att: any }) {
  if (att.isImage || att.type?.startsWith("image/")) {
    return (
      <div className="mt-2 inline-block relative group">
        <img src={att.url} alt={att.name} onClick={() => window.open(att.url, "_blank")}
          className="rounded max-w-xs max-h-48 object-cover cursor-pointer"
          style={{ border: "1px solid hsl(var(--border))" }} />
        <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span style={{ fontSize: "0.55rem", color: "white" }}>{att.name} · {att.size}</span>
        </div>
      </div>
    );
  }
  const color = att.isPdf ? "hsl(var(--crimson))" : "hsl(200 80% 42%)";
  return (
    <a href={att.url} download={att.name} target="_blank" rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted/20 transition-colors"
      style={{ display: "inline-flex", maxWidth: 260 }}>
      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <FileText size={15} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ fontFamily: "'Barlow',sans-serif" }}>{att.name}</p>
        <p className="label-caps" style={{ fontSize: "0.5rem" }}>{att.size}</p>
      </div>
    </a>
  );
}

const MsgBubble = memo(function MsgBubble({ msg, currentUserId, onReact, isOptimistic }: {
  msg: AnyMsg; currentUserId: string; onReact: (id: string, emoji: string) => void; isOptimistic?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const { name, avatar, userId } = getSenderInfo(msg);
  const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
  const attachments = JSON.parse(msg.attachments || "[]") as any[];
  const hasBody = msg.body?.trim() && msg.body.trim() !== " ";
  const time = new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  if (msg.deletedAt) return (
    <div className="px-4 py-1 text-xs italic" style={{ color: "hsl(var(--muted-foreground))" }}>This message was deleted.</div>
  );

  return (
    <div className="group flex gap-3 px-4 py-1.5 rounded transition-colors hover:bg-muted/10 relative"
      style={{ opacity: isOptimistic ? 0.6 : 1 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Avatar name={name} avatar={avatar} size={8} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.85rem" }}>{name}</span>
          <span className="label-caps" style={{ fontSize: "0.52rem", opacity: 0.5 }}>{time}</span>
          {isOptimistic && <span className="label-caps" style={{ fontSize: "0.5rem", opacity: 0.4 }}>sending…</span>}
        </div>
        {hasBody && (
          <p className="text-sm break-words" style={{ fontFamily: "'Barlow',sans-serif", lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{
              __html: msg.body
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.*?)\*/g, "<em>$1</em>")
                .replace(/#([a-z0-9-]+)/g, '<span style="color:hsl(var(--crimson))">$&</span>')
                .replace(/@(\w+)/g, '<span style="color:hsl(200 80% 42%)">@$1</span>')
            }} />
        )}
        {attachments.map((att, i) => <AttachmentView key={i} att={att} />)}
        {Object.keys(reactions).length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {Object.entries(reactions).map(([emoji, uids]) => (
              <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-all"
                style={{
                  background: uids.includes(currentUserId) ? "hsl(var(--crimson)/0.12)" : "hsl(var(--muted))",
                  border: `1px solid ${uids.includes(currentUserId) ? "hsl(var(--crimson)/0.35)" : "transparent"}`,
                  fontSize: "0.78rem",
                }}>
                {emoji} <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.72rem" }}>{uids.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {hover && !isOptimistic && (
        <div className="absolute right-4 -top-8 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg px-2 py-1 z-20">
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={() => onReact(msg.id, e)} className="text-base hover:scale-125 transition-transform p-0.5">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
});

function AttachBtn({ onAttach }: { onAttach: (atts: any[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    try {
      const res = await fetch("/api/upload/attachment", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) onAttach(data.attachments);
      else alert(data.error || "Upload failed");
    } catch (e) { alert(String(e)); }
    setLoading(false);
    if (ref.current) ref.current.value = "";
  };
  return (
    <>
      <input ref={ref} type="file" multiple className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={handle} />
      <button onClick={() => ref.current?.click()} disabled={loading}
        className="p-1.5 hover:bg-muted rounded transition-colors flex-shrink-0" title="Attach files">
        {loading ? <Loader2 size={18} className="text-muted-foreground animate-spin" /> : <Paperclip size={18} className="text-muted-foreground" />}
      </button>
    </>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export function ChannelsLayout({ currentUser, allChannels, memberOf, activeView, initialMessages, allUsers, pendingInvites }: {
  currentUser: { id: string; name: string; avatar?: string | null };
  allChannels: Channel[];
  memberOf: string[];
  activeView: View;
  initialMessages: AnyMsg[];
  allUsers: AppUser[];
  pendingInvites: Invite[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── State ──
  const [messages, setMessages] = useState<AnyMsg[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [dmSearch, setDmSearch] = useState("");
  const [newName, setNewName] = useState(""); const [newDesc, setNewDesc] = useState(""); const [newEmoji, setNewEmoji] = useState("💬"); const [newPrivate, setNewPrivate] = useState(false);
  const [localMemberOf, setLocalMemberOf] = useState(new Set(memberOf));
  const [localInvites, setLocalInvites] = useState(pendingInvites);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeViewKey = viewKey(activeView);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestMsgs = useRef<AnyMsg[]>(messages);
  latestMsgs.current = messages;

  // ── Derived ──
  const myChannels = allChannels.filter(c => localMemberOf.has(c.id));
  const activeChannel = activeView?.type === "channel" ? allChannels.find(c => c.id === (activeView as any).id) : null;
  const dmUser = activeView?.type === "dm" ? allUsers.find(u => u.id === (activeView as any).userId) : null;
  const isMember = activeView?.type === "channel" ? localMemberOf.has((activeView as any).id) : true;

  // ── Sync initialMessages when URL changes (server pushed new data) ──
  useEffect(() => {
    setMessages(initialMessages);
    setLoading(false);
  }, [activeViewKey]); // eslint-disable-line

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Poll for new messages (stable interval, refs for latest state) ──
  useEffect(() => {
    if (!activeView) return;
    const key = activeViewKey;

    // Clear any existing interval
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      const msgs = latestMsgs.current;
      const realMsgs = msgs.filter(m => !m.id.startsWith("opt-"));
      const last = realMsgs[realMsgs.length - 1];
      const since = last?.createdAt ? new Date(last.createdAt).toISOString() : "";

      try {
        const res = await fetch(getApiUrl(activeView, since), { cache: "no-store" });
        if (!res.ok) return;
        const fresh: AnyMsg[] = await res.json();
        if (!fresh.length) return;
        setMessages(prev => {
          const ids = new Set(prev.filter(m => !m.id.startsWith("opt-")).map(m => m.id));
          const newOnes = fresh.filter(m => !ids.has(m.id));
          if (!newOnes.length) return prev;
          // Replace optimistic messages with real ones, append new
          return [...prev.filter(m => !m.id.startsWith("opt-")), ...newOnes];
        });
      } catch { /* ignore poll errors */ }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeViewKey]); // eslint-disable-line

  // ── Navigate — URL-based so server reloads correct messages ──
  const navigateTo = useCallback((v: View) => {
    if (!v) return;
    setMessages([]); setLoading(true); setSendError(null);
    const url = v.type === "channel"
      ? `/channels?c=${(v as any).id}`
      : `/channels?dm=${(v as any).userId}`;
    router.push(url);
  }, [router]);

  // ── Send ──
  const handleSend = async () => {
    if ((!input.trim() && !attachments.length) || !activeView || sending) return;
    setSending(true); setSendError(null);
    const body = input.trim();
    const atts = [...attachments];
    setInput(""); setAttachments([]);

    // Optimistic message
    const optId = `opt-${Date.now()}`;
    const opt: AnyMsg = {
      id: optId, body, attachments: JSON.stringify(atts), reactions: "{}",
      createdAt: new Date(),
      userId: currentUser.id, userName: currentUser.name, userAvatar: currentUser.avatar || null,
      fromUserId: currentUser.id, fromName: currentUser.name, fromAvatar: currentUser.avatar || null,
    };
    setMessages(prev => [...prev, opt]);

    try {
      const payload = activeView.type === "channel"
        ? { channelId: (activeView as any).id, body, attachments: atts }
        : { toUserId: (activeView as any).userId, body, attachments: atts };

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error || "Failed to send");
      }

      // Remove optimistic — poll will fetch real one in 3s
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== optId));
      }, 3500);
    } catch (err) {
      setSendError("Failed to send. Please try again.");
      setMessages(prev => prev.filter(m => m.id !== optId));
      setInput(body); setAttachments(atts);
    }
    setSending(false);
  };

  // ── React ──
  const handleReact = async (msgId: string, emoji: string) => {
    if (msgId.startsWith("opt-")) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const r = JSON.parse(m.reactions || "{}") as Record<string, string[]>;
      if (!r[emoji]) r[emoji] = [];
      const idx = r[emoji].indexOf(currentUser.id);
      if (idx >= 0) r[emoji].splice(idx, 1); else r[emoji].push(currentUser.id);
      if (r[emoji].length === 0) delete r[emoji];
      return { ...m, reactions: JSON.stringify(r) };
    }));
    if (activeView?.type === "channel") await toggleReaction(msgId, emoji);
    else await toggleDMReaction(msgId, emoji);
  };

  const handleAcceptInvite = async (inv: Invite) => {
    const channelId = await acceptInvite(inv.id);
    setLocalInvites(prev => prev.filter(i => i.id !== inv.id));
    setLocalMemberOf(prev => new Set([...prev, channelId]));
    navigateTo({ type: "channel", id: channelId });
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <div className="hidden sm:flex flex-col border-r border-border flex-shrink-0"
        style={{ width: 220, background: "hsl(var(--card))" }}>

        {/* Invites */}
        {localInvites.length > 0 && (
          <div className="p-3 border-b border-border" style={{ background: "hsl(var(--crimson)/0.05)" }}>
            <p className="label-caps mb-2 flex items-center gap-1" style={{ color: "hsl(var(--crimson))", fontSize: "0.58rem" }}>
              <Bell size={10} /> {localInvites.length} invite{localInvites.length > 1 ? "s" : ""}
            </p>
            {localInvites.map(inv => (
              <div key={inv.id} className="mb-2">
                <p className="text-xs mb-1" style={{ fontFamily: "'Barlow',sans-serif" }}>
                  <strong>{inv.inviterName}</strong> → {inv.channelEmoji} #{inv.channelName}
                </p>
                <div className="flex gap-1">
                  <button onClick={() => handleAcceptInvite(inv)} className="btn-primary" style={{ fontSize: "0.58rem", padding: "0.2rem 0.6rem" }}>
                    <Check size={9} /> Accept
                  </button>
                  <button onClick={async () => { await declineInvite(inv.id); setLocalInvites(p => p.filter(i => i.id !== inv.id)); }}
                    className="btn-outline" style={{ fontSize: "0.58rem", padding: "0.2rem 0.6rem" }}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Channels header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="heading-sm" style={{ fontSize: "0.85rem" }}>Channels</span>
          <button onClick={() => setShowCreate(true)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
            <Plus size={14} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-1">
          {myChannels.length > 0 && (
            <>
              <p className="label-caps px-4 py-1 mt-1" style={{ fontSize: "0.53rem", opacity: 0.45 }}>Your Channels</p>
              {myChannels.map(ch => {
                const isActive = activeView?.type === "channel" && (activeView as any).id === ch.id;
                return (
                  <div key={ch.id} className="flex items-center group">
                    <button onClick={() => navigateTo({ type: "channel", id: ch.id })}
                      className="flex-1 flex items-center gap-2 px-4 py-1.5 text-left hover:bg-muted/30 transition-colors min-w-0"
                      style={{ background: isActive ? "hsl(var(--crimson)/0.08)" : "transparent", borderLeft: `2px solid ${isActive ? "hsl(var(--crimson))" : "transparent"}` }}>
                      <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>{ch.emoji || "💬"}</span>
                      <span className="truncate" style={{ fontFamily: "'Barlow',sans-serif", fontWeight: isActive ? 600 : 400, fontSize: "0.82rem", color: isActive ? "hsl(var(--crimson))" : "hsl(var(--foreground))" }}>
                        #{ch.name}
                      </span>
                      {ch.type === "private" && <Lock size={9} className="text-muted-foreground flex-shrink-0" />}
                    </button>
                    {isActive && (
                      <button onClick={() => setShowInvite(ch.id)} title="Invite members" className="px-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <UserPlus size={12} className="text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* DMs */}
          <div className="flex items-center justify-between px-4 py-1 mt-3">
            <p className="label-caps" style={{ fontSize: "0.53rem", opacity: 0.45 }}>Direct Messages</p>
            <button onClick={() => setShowDMPicker(true)} className="hover:opacity-70 transition-opacity">
              <Plus size={11} className="text-muted-foreground" />
            </button>
          </div>
          {allUsers.filter(u => u.id !== currentUser.id).slice(0, 10).map(u => {
            const isActive = activeView?.type === "dm" && (activeView as any).userId === u.id;
            return (
              <button key={u.id} onClick={() => navigateTo({ type: "dm", userId: u.id })}
                className="w-full flex items-center gap-2.5 px-4 py-1.5 text-left hover:bg-muted/30 transition-colors"
                style={{ background: isActive ? "hsl(var(--crimson)/0.08)" : "transparent", borderLeft: `2px solid ${isActive ? "hsl(var(--crimson))" : "transparent"}` }}>
                <div className="relative">
                  <Avatar name={u.name || "?"} avatar={u.avatarUrl} size={5} />
                </div>
                <span className="truncate" style={{ fontFamily: "'Barlow',sans-serif", fontSize: "0.82rem", color: isActive ? "hsl(var(--crimson))" : "hsl(var(--foreground))" }}>
                  {u.name}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button onClick={() => router.push("/huddle")} className="w-full btn-outline" style={{ fontSize: "0.63rem", padding: "0.35rem" }}>
            🎙️ Start Huddle
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar
          title={activeChannel ? `${activeChannel.emoji || "💬"} #${activeChannel.name}` : dmUser ? `💬 ${dmUser.name}` : "Channels"}
          subtitle={activeChannel?.description || (dmUser ? "Direct Message" : "Pick a channel or start a DM")}
          right={
            activeView?.type === "channel" && isMember ? (
              <button onClick={() => setShowInvite((activeView as any).id)} className="btn-outline" style={{ fontSize: "0.68rem" }}>
                <UserPlus size={12} /> Invite
              </button>
            ) : undefined
          }
        />

        {!activeView ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <div style={{ fontSize: "4rem" }}>💬</div>
            <div>
              <div className="heading-md mb-1">Welcome to Channels</div>
              <p className="text-sm text-muted-foreground max-w-sm" style={{ fontFamily: "'Barlow',sans-serif" }}>
                Channels keep your team's conversations organized. Start a DM for 1-on-1 chats.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={() => setShowCreate(true)} className="btn-primary"><Hash size={14} /> New Channel</button>
              <button onClick={() => setShowDMPicker(true)} className="btn-outline"><MessageSquare size={14} /> New DM</button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages list */}
            <div className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: "thin" }}>
              {loading && (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading messages…</span>
                </div>
              )}
              {!loading && messages.length === 0 && (
                <div className="text-center py-16 px-8">
                  <div style={{ fontSize: "3rem", marginBottom: 12 }}>
                    {activeView.type === "channel" ? (activeChannel?.emoji || "💬") : "💬"}
                  </div>
                  <div className="heading-sm mb-2">
                    {activeView.type === "channel"
                      ? `This is the start of #${activeChannel?.name}`
                      : `Start of your conversation with ${dmUser?.name}`}
                  </div>
                  {activeView.type === "channel" && activeChannel?.description && (
                    <p className="text-sm text-muted-foreground">{activeChannel.description}</p>
                  )}
                </div>
              )}
              {!loading && messages.map(msg => (
                <MsgBubble key={msg.id} msg={msg} currentUserId={currentUser.id}
                  onReact={handleReact} isOptimistic={msg.id.startsWith("opt-")} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {isMember ? (
              <div className="border-t border-border">
                {/* Pending attachments */}
                {attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap px-3 pt-3 pb-0">
                    {attachments.map((att, i) => (
                      <div key={i} className="relative group">
                        {att.isImage
                          ? <img src={att.url} alt={att.name} className="w-14 h-14 object-cover rounded border border-border" />
                          : <div className="w-14 h-14 rounded border border-border flex flex-col items-center justify-center" style={{ background: "hsl(var(--muted))" }}>
                              <FileText size={18} className="text-muted-foreground" />
                              <span className="label-caps text-center px-0.5 truncate w-full" style={{ fontSize: "0.42rem" }}>{att.name}</span>
                            </div>
                        }
                        <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-card border border-border items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ display: "flex" }}>
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3">
                  {sendError && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <AlertCircle size={13} style={{ color: "hsl(var(--crimson))", flexShrink: 0 }} />
                      <span className="text-xs" style={{ color: "hsl(var(--crimson))", fontFamily: "'Barlow',sans-serif" }}>{sendError}</span>
                    </div>
                  )}
                  <div className="card-base flex items-end gap-2 p-2" style={{ border: "1px solid hsl(var(--border))" }}>
                    <div className="relative">
                      <button onClick={() => setShowEmoji(p => !p)} className="p-1.5 hover:bg-muted rounded flex-shrink-0 transition-colors">
                        <Smile size={18} className="text-muted-foreground" />
                      </button>
                      {showEmoji && (
                        <div className="absolute bottom-10 left-0 card-base border border-border p-2 grid grid-cols-8 gap-0.5 shadow-xl z-30" style={{ width: 280 }}>
                          {EMOJI_PICKER.map(e => (
                            <button key={e} onClick={() => { setInput(p => p + e); setShowEmoji(false); textareaRef.current?.focus(); }}
                              className="text-lg hover:scale-125 transition-transform p-0.5 text-center">{e}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <AttachBtn onAttach={atts => setAttachments(p => [...p, ...atts])} />
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder={activeView.type === "channel" ? `Message #${activeChannel?.name}…` : `Message ${dmUser?.name}…`}
                      rows={1}
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: "'Barlow',sans-serif", fontSize: "0.9rem", maxHeight: 120, lineHeight: 1.5, padding: "2px 0" }}
                      onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
                    />
                    <button onClick={handleSend} disabled={(!input.trim() && !attachments.length) || sending}
                      className="btn-primary flex-shrink-0" style={{ padding: "0.4rem", opacity: sending ? 0.6 : 1 }}>
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                  <p className="label-caps mt-1 ml-1" style={{ fontSize: "0.5rem", opacity: 0.35 }}>Enter to send · Shift+Enter for new line · 📎 files up to 10MB</p>
                </div>
              </div>
            ) : (
              <div className="border-t border-border p-5 text-center">
                <p className="text-sm text-muted-foreground mb-1">You're not a member of this channel.</p>
                <p className="label-caps" style={{ fontSize: "0.6rem" }}>Ask a member to invite you using the Invite button.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Channel Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="card-base p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="heading-md">Create Channel</h2>
              <button onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="field-label">Emoji</label>
                <input type="text" value={newEmoji} onChange={e => setNewEmoji(e.target.value)} className="field-input w-14 text-center text-xl" maxLength={2} />
              </div>
              <div className="flex-1">
                <label className="field-label">Channel Name</label>
                <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="field-input" placeholder="e.g. project-alpha" />
              </div>
            </div>
            <div>
              <label className="field-label">Description (optional)</label>
              <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="field-input" placeholder="What's this channel about?" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newPrivate} onChange={e => setNewPrivate(e.target.checked)} />
              <div>
                <span className="text-sm font-medium flex items-center gap-1"><Lock size={12} /> Private</span>
                <p className="label-caps" style={{ fontSize: "0.55rem" }}>Invite-only — not visible to the whole team</p>
              </div>
            </label>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="btn-outline">Cancel</button>
              <button onClick={async () => {
                if (!newName) return;
                const id = await createChannel(newName, newDesc, newEmoji, newPrivate);
                setLocalMemberOf(p => new Set([...p, id]));
                setShowCreate(false); setNewName(""); setNewDesc(""); setNewEmoji("💬"); setNewPrivate(false);
                navigateTo({ type: "channel", id });
              }} className="btn-primary" disabled={!newName}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowInvite(null); setInviteSearch(""); }}>
          <div className="card-base p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="heading-md">Invite to Channel</h2>
              <button onClick={() => { setShowInvite(null); setInviteSearch(""); }}><X size={18} /></button>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus type="text" value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} className="field-input pl-9" placeholder="Search teammates…" />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {allUsers
                .filter(u => u.id !== currentUser.id && (!inviteSearch || (u.name || "").toLowerCase().includes(inviteSearch.toLowerCase())))
                .map(u => (
                  <div key={u.id} className="flex items-center gap-3 py-2 px-1 rounded hover:bg-muted/20">
                    <Avatar name={u.name || "?"} avatar={u.avatarUrl} size={8} />
                    <span className="flex-1 text-sm" style={{ fontFamily: "'Barlow',sans-serif" }}>{u.name}</span>
                    <button onClick={async () => { await inviteToChannel(showInvite, u.id); setInviteSent(u.id); setTimeout(() => setInviteSent(null), 2000); }}
                      className="btn-primary" style={{ fontSize: "0.62rem", padding: "0.28rem 0.7rem" }}>
                      {inviteSent === u.id ? <><Check size={11} /> Sent!</> : <><UserPlus size={11} /> Invite</>}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DM Picker ── */}
      {showDMPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowDMPicker(false); setDmSearch(""); }}>
          <div className="card-base p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="heading-md">New Direct Message</h2>
              <button onClick={() => { setShowDMPicker(false); setDmSearch(""); }}><X size={18} /></button>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus type="text" value={dmSearch} onChange={e => setDmSearch(e.target.value)} className="field-input pl-9" placeholder="Who do you want to message?" />
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {allUsers
                .filter(u => u.id !== currentUser.id && (!dmSearch || (u.name || "").toLowerCase().includes(dmSearch.toLowerCase())))
                .map(u => (
                  <button key={u.id} onClick={() => { setShowDMPicker(false); setDmSearch(""); navigateTo({ type: "dm", userId: u.id }); }}
                    className="w-full flex items-center gap-3 py-2.5 px-2 rounded hover:bg-muted/20 text-left transition-colors">
                    <Avatar name={u.name || "?"} avatar={u.avatarUrl} size={9} />
                    <span className="flex-1 text-sm font-medium" style={{ fontFamily: "'Barlow',sans-serif" }}>{u.name}</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
