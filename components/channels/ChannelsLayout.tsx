"use client";
import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash, Plus, Search, Send, Smile, MoreHorizontal, MessageSquare, Lock } from "lucide-react";
import { createChannel, joinChannel, sendMessage, toggleReaction, markChannelRead } from "@/lib/actions/channels";
import { TopBar } from "@/components/layout/TopBar";

interface Channel { id: string; name: string; description: string | null; emoji: string | null; type: string; }
interface Message { id: string; body: string; reactions: string | null; edited: boolean | null; createdAt: Date; userId: string; userName: string | null; userAvatar: string | null; deletedAt: Date | null; }
interface User { id: string; name: string | null; avatarUrl: string | null; }

const QUICK_EMOJIS = ["👍","❤️","😂","🎉","🔥","✅","👀","💯"];
const EVENT_COLORS: Record<string, string> = { crimson:"hsl(var(--crimson))", blue:"hsl(200 80% 42%)", green:"hsl(142 71% 38%)", amber:"hsl(38 90% 48%)", purple:"hsl(270 65% 52%)" };

function Avatar({ name, avatar, size=8 }: { name: string; avatar?: string | null; size?: number }) {
  const sz = `${size*4}px`;
  if (avatar?.startsWith("data:") || avatar?.startsWith("http")) {
    return <img src={avatar} alt={name} style={{ width:sz, height:sz, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />;
  }
  const colors = ["hsl(var(--crimson))", "hsl(200 80% 42%)", "hsl(142 71% 38%)", "hsl(38 90% 48%)", "hsl(270 65% 52%)"];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width:sz, height:sz, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:`${size*0.45}rem`, color:"white" }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

function MessageBubble({ msg, currentUserId, onReact }: { msg: Message; currentUserId: string; onReact: (id:string, emoji:string)=>void }) {
  const [showEmoji, setShowEmoji] = useState(false);
  const isOwn = msg.userId === currentUserId;
  const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
  const hasReactions = Object.keys(reactions).length > 0;

  if (msg.deletedAt) {
    return <div className="flex gap-2 px-4 py-1"><div className="text-xs italic" style={{ color:"hsl(var(--muted-foreground))", fontFamily:"'Barlow',sans-serif" }}>This message was deleted.</div></div>;
  }

  const time = new Date(msg.createdAt).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true });

  return (
    <div className="group flex gap-3 px-4 py-1.5 hover:bg-muted/10 relative rounded"
      onMouseEnter={() => setShowEmoji(true)} onMouseLeave={() => setShowEmoji(false)}>
      <Avatar name={msg.userName || "?"} avatar={msg.userAvatar} size={8} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.85rem" }}>{msg.userName || "Unknown"}</span>
          <span className="label-caps" style={{ fontSize:"0.55rem", opacity:0.5 }}>{time}{msg.edited ? " (edited)" : ""}</span>
        </div>
        <p className="text-sm" style={{ fontFamily:"'Barlow',sans-serif", lineHeight:1.6, wordBreak:"break-word" }}
          dangerouslySetInnerHTML={{ __html: msg.body.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/#(\w+)/g,'<span style="color:hsl(var(--crimson))">$&</span>') }} />
        {hasReactions && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(reactions).map(([emoji, uids]) => (
              <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                className="label-caps flex items-center gap-1 px-2 py-0.5 rounded-full transition-all"
                style={{ background: uids.includes(currentUserId) ? "hsl(var(--crimson)/0.15)" : "hsl(var(--muted))", border:`1px solid ${uids.includes(currentUserId) ? "hsl(var(--crimson)/0.4)" : "transparent"}`, fontSize:"0.7rem" }}>
                {emoji} {uids.length}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Emoji hover toolbar */}
      {showEmoji && (
        <div className="absolute right-4 -top-7 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg px-2 py-1 z-10">
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={() => onReact(msg.id, e)} className="text-base hover:scale-125 transition-transform px-0.5">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChannelsLayout({ currentUser, allChannels, memberOf, activeChannelId, initialMessages, allUsers }: {
  currentUser: { id:string; name:string; avatar?:string|null };
  allChannels: Channel[];
  memberOf: string[];
  activeChannelId: string | null;
  initialMessages: Message[];
  allUsers: User[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState(""); const [newDesc, setNewDesc] = useState(""); const [newEmoji, setNewEmoji] = useState("💬");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeChannel = allChannels.find(c => c.id === activeChannelId);
  const myChannels = allChannels.filter(c => memberOf.includes(c.id));
  const otherChannels = allChannels.filter(c => !memberOf.includes(c.id));
  const isMember = activeChannelId ? memberOf.includes(activeChannelId) : false;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length]);

  // Poll for new messages every 2s
  useEffect(() => {
    if (!activeChannelId) return;
    const poll = async () => {
      const last = messages[messages.length - 1];
      const since = last?.createdAt ? new Date(last.createdAt).toISOString() : "";
      try {
        const res = await fetch(`/api/channels/${activeChannelId}?since=${encodeURIComponent(since)}`);
        const data = await res.json();
        if (data.length > 0) setMessages(prev => {
          const ids = new Set(prev.map((m: Message) => m.id));
          return [...prev, ...data.filter((m: Message) => !ids.has(m.id))];
        });
      } catch {}
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [activeChannelId, messages.length]);

  const handleSend = async () => {
    if (!input.trim() || !activeChannelId || !isMember || sending) return;
    setSending(true);
    const body = input.trim();
    setInput("");
    // Optimistic
    const optimistic: Message = { id: "opt-" + Date.now(), body, reactions: "{}", edited: false, createdAt: new Date(), userId: currentUser.id, userName: currentUser.name, userAvatar: currentUser.avatar || null, deletedAt: null };
    setMessages(prev => [...prev, optimistic]);
    try { await sendMessage(activeChannelId, body); } catch {}
    setSending(false);
  };

  const handleReact = async (msgId: string, emoji: string) => {
    // Optimistic
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const r = JSON.parse(m.reactions || "{}") as Record<string, string[]>;
      if (!r[emoji]) r[emoji] = [];
      const idx = r[emoji].indexOf(currentUser.id);
      if (idx >= 0) r[emoji].splice(idx, 1); else r[emoji].push(currentUser.id);
      if (r[emoji].length === 0) delete r[emoji];
      return { ...m, reactions: JSON.stringify(r) };
    }));
    await toggleReaction(msgId, emoji);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
      {/* ── Channel Sidebar ── */}
      <div className="hidden sm:flex flex-col border-r border-border flex-shrink-0"
        style={{ width:220, background:"hsl(var(--card))" }}>
        <div className="px-4 py-3 border-b border-border">
          <div className="heading-sm text-foreground flex items-center justify-between">
            <span>Channels</span>
            <button onClick={() => setShowCreate(true)}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {myChannels.length > 0 && (
            <>
              <p className="label-caps px-4 py-1" style={{ fontSize:"0.6rem", opacity:0.5 }}>Your Channels</p>
              {myChannels.map(ch => (
                <button key={ch.id} onClick={() => router.push(`/channels?c=${ch.id}`)}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-muted/30 transition-colors"
                  style={{ background: activeChannelId===ch.id ? "hsl(var(--crimson)/0.08)" : "transparent",
                    borderLeft: `2px solid ${activeChannelId===ch.id ? "hsl(var(--crimson))" : "transparent"}` }}>
                  <span style={{ fontSize:"0.9rem" }}>{ch.emoji || "💬"}</span>
                  <span className="truncate" style={{ fontFamily:"'Barlow',sans-serif", fontWeight:activeChannelId===ch.id?600:400, fontSize:"0.82rem", color:activeChannelId===ch.id?"hsl(var(--crimson))":"hsl(var(--foreground))" }}>
                    #{ch.name}
                  </span>
                </button>
              ))}
            </>
          )}
          {otherChannels.length > 0 && (
            <>
              <p className="label-caps px-4 py-2 mt-2" style={{ fontSize:"0.6rem", opacity:0.5 }}>More Channels</p>
              {otherChannels.map(ch => (
                <button key={ch.id} onClick={() => router.push(`/channels?c=${ch.id}`)}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-muted/30 transition-colors opacity-60">
                  <span style={{ fontSize:"0.9rem" }}>{ch.emoji || "💬"}</span>
                  <span className="truncate" style={{ fontFamily:"'Barlow',sans-serif", fontSize:"0.82rem" }}>#{ch.name}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Huddle quick-launch */}
        <div className="px-4 py-3 border-t border-border">
          <button onClick={() => router.push("/huddle")}
            className="w-full btn-outline" style={{ fontSize:"0.65rem", padding:"0.4rem" }}>
            🎙️ Start Huddle
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <TopBar
          title={activeChannel ? `${activeChannel.emoji || "💬"} #${activeChannel.name}` : "Channels"}
          subtitle={activeChannel?.description || "Select a channel"}
          right={
            activeChannelId && !isMember ? (
              <button onClick={() => { startTransition(async () => { await joinChannel(activeChannelId); router.refresh(); }); }}
                className="btn-primary" style={{ fontSize:"0.72rem" }}>
                + Join Channel
              </button>
            ) : undefined
          }
        />

        {!activeChannelId ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8 text-center">
            <div style={{ fontSize:"4rem" }}>💬</div>
            <div className="heading-md">Welcome to Channels</div>
            <p className="text-sm text-muted-foreground max-w-sm" style={{ fontFamily:"'Barlow',sans-serif" }}>
              Select a channel from the sidebar or create a new one to start messaging your team.
            </p>
            <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={14}/> Create Channel</button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth:"thin" }}>
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div style={{ fontSize:"3rem", marginBottom:8 }}>{activeChannel?.emoji || "💬"}</div>
                  <div className="heading-sm mb-2">Beginning of #{activeChannel?.name}</div>
                  <p className="text-sm text-muted-foreground">{activeChannel?.description}</p>
                </div>
              )}
              {messages.filter(m=>!m.deletedAt).map(msg => (
                <MessageBubble key={msg.id} msg={msg} currentUserId={currentUser.id} onReact={handleReact} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {isMember ? (
              <div className="border-t border-border p-4">
                <div className="card-base flex items-end gap-2 p-2 focus-within:ring-1 ring-crimson">
                  <button onClick={() => setShowEmojiPicker(p=>!p)} className="p-1.5 hover:bg-muted rounded transition-colors flex-shrink-0">
                    <Smile size={18} className="text-muted-foreground" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-20 left-4 card-base p-2 grid grid-cols-8 gap-1 shadow-xl z-20">
                      {["😀","😂","❤️","🔥","👍","✅","🎉","💯","🚀","👀","💬","🙌","⚡","🎯","💡","🏆","📌","⚠️","🔴","🟢","📅","⏰","🔔","💼","📊","📋","🗓️","🤝"].map(e => (
                        <button key={e} onClick={() => { setInput(p=>p+e); setShowEmojiPicker(false); inputRef.current?.focus(); }} className="text-lg hover:scale-125 transition-transform">{e}</button>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message #${activeChannel?.name}…`}
                    rows={1}
                    style={{ flex:1, background:"transparent", border:"none", outline:"none", resize:"none", fontFamily:"'Barlow',sans-serif", fontSize:"0.9rem", maxHeight:120, lineHeight:1.5 }}
                    onInput={e => { const el = e.currentTarget; el.style.height="auto"; el.style.height=Math.min(el.scrollHeight, 120)+"px"; }}
                  />
                  <button onClick={handleSend} disabled={!input.trim() || sending}
                    className="btn-primary flex-shrink-0 p-2" style={{ padding:"0.4rem" }}>
                    <Send size={16} />
                  </button>
                </div>
                <p className="label-caps mt-1 ml-2" style={{ fontSize:"0.55rem", opacity:0.4 }}>Enter to send · Shift+Enter for new line</p>
              </div>
            ) : (
              <div className="border-t border-border p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Join this channel to send messages</p>
                <button onClick={() => startTransition(async () => { await joinChannel(activeChannelId!); router.refresh(); })} className="btn-primary">+ Join Channel</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 w-full max-w-md">
            <h2 className="heading-md mb-4">Create Channel</h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div>
                  <label className="field-label">Emoji</label>
                  <input type="text" value={newEmoji} onChange={e=>setNewEmoji(e.target.value)} className="field-input w-16 text-center text-xl" maxLength={2} />
                </div>
                <div className="flex-1">
                  <label className="field-label">Channel Name</label>
                  <input type="text" value={newName} onChange={e=>setNewName(e.target.value.toLowerCase().replace(/\s+/g,"-"))} className="field-input" placeholder="e.g. general, projects" />
                </div>
              </div>
              <div>
                <label className="field-label">Description (optional)</label>
                <input type="text" value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="field-input" placeholder="What's this channel about?" />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="btn-outline">Cancel</button>
                <button
                  onClick={async () => {
                    if (!newName) return;
                    const id = await createChannel(newName, newDesc, newEmoji);
                    setShowCreate(false); setNewName(""); setNewDesc(""); setNewEmoji("💬");
                    router.push(`/channels?c=${id}`);
                  }}
                  className="btn-primary">Create Channel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
