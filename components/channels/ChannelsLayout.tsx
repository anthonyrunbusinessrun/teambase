"use client";
import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Send, Smile, X, Hash, Lock, Mail, Users,
  Paperclip, FileText, Image as ImageIcon, File,
  Check, Bell, UserPlus, ChevronRight, Trash2, LogOut,
  MessageSquare, Search,
} from "lucide-react";
import {
  createChannel, sendMessage, toggleReaction, inviteToChannel,
  acceptInvite, declineInvite, leaveChannel,
  sendDM, markDMRead, toggleDMReaction,
} from "@/lib/actions/channels";
import { TopBar } from "@/components/layout/TopBar";

// ── Types ────────────────────────────────────────────────────────────────────
interface Channel { id: string; name: string; description: string | null; emoji: string | null; type: string; createdBy: string; }
interface Invite  { id: string; channelId: string; channelName: string; channelEmoji: string; inviterName: string; }
interface Message {
  id: string; body: string; reactions: string | null; attachments: string | null;
  edited: boolean | null; createdAt: Date; userId: string;
  userName: string | null; userAvatar: string | null; deletedAt: Date | null;
}
interface DM {
  id: string; body: string; fromUserId: string; toUserId: string;
  attachments: string | null; reactions: string | null; read: boolean | null;
  createdAt: Date; fromName: string | null; fromAvatar: string | null;
}
interface AppUser { id: string; name: string | null; avatarUrl: string | null; }

type View = { type: "channel"; id: string } | { type: "dm"; userId: string } | null;

const QUICK_EMOJIS = ["👍","❤️","😂","🎉","🔥","✅","👀","💯","🚀","😎"];
const EMOJI_PICKER = ["😀","😂","❤️","🔥","👍","✅","🎉","💯","🚀","👀","💬","🙌","⚡","🎯","💡","🏆","📌","⚠️","🔴","🟢","📅","⏰","🔔","💼","📊","📋","🗓️","🤝","😎","🤔","💪","🙏","✨","🎨","🎭","🌟","⭐","🏅","🎖️","🎗️","🎈","🎁","🎊","🥳","🤩"];

// ── Attachment component ─────────────────────────────────────────────────────
function AttachmentPreview({ att }: { att: any }) {
  const isImage = att.isImage || att.type?.startsWith("image/");
  const isPdf   = att.isPdf   || att.type === "application/pdf";

  if (isImage) return (
    <div className="mt-2 relative group inline-block">
      <img src={att.url} alt={att.name} className="rounded max-w-xs max-h-48 object-cover cursor-pointer"
        onClick={() => window.open(att.url, "_blank")}
        style={{ border:"1px solid hsl(var(--border))" }} />
      <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <span style={{ fontSize:"0.58rem", color:"white", fontFamily:"'Barlow',sans-serif" }}>{att.name}</span>
      </div>
    </div>
  );

  const Icon = isPdf ? FileText : File;
  const color = isPdf ? "hsl(var(--crimson))" : "hsl(200 80% 42%)";

  return (
    <a href={att.url} download={att.name} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 mt-2 px-3 py-2 rounded hover:bg-muted/20 transition-colors border border-border"
      style={{ display:"inline-flex", maxWidth:280 }}>
      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
        style={{ background:`${color}18` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ fontFamily:"'Barlow',sans-serif" }}>{att.name}</p>
        <p className="label-caps" style={{ fontSize:"0.52rem" }}>{att.size} · click to download</p>
      </div>
    </a>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, avatar, size=8 }: { name: string; avatar?: string|null; size?: number }) {
  const sz = `${size*4}px`;
  if (avatar?.startsWith("data:") || avatar?.startsWith("http")) {
    return <img src={avatar} alt={name} style={{ width:sz, height:sz, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />;
  }
  const palette = ["hsl(352 80% 42%)","hsl(200 80% 42%)","hsl(142 71% 38%)","hsl(38 90% 48%)","hsl(270 65% 52%)"];
  const color = palette[(name?.charCodeAt(0)||0) % palette.length];
  return (
    <div style={{ width:sz, height:sz, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:`${size*0.45}rem`, color:"white" }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────────────────────
function MsgBubble({ msg, currentUserId, onReact }: {
  msg: Message|DM; currentUserId: string; onReact: (id:string,emoji:string)=>void;
}) {
  const [hover, setHover] = useState(false);
  if ((msg as Message).deletedAt) return (
    <div className="px-4 py-1 text-xs italic" style={{ color:"hsl(var(--muted-foreground))", fontFamily:"'Barlow',sans-serif" }}>
      This message was deleted.
    </div>
  );
  const reactions = JSON.parse(msg.reactions || "{}") as Record<string,string[]>;
  const attachments = JSON.parse(msg.attachments || "[]") as any[];
  const isOwn = (msg as DM).fromUserId
    ? (msg as DM).fromUserId === currentUserId
    : (msg as Message).userId === currentUserId;
  const name = (msg as DM).fromName || (msg as Message).userName || "Unknown";
  const avatar = (msg as DM).fromAvatar || (msg as Message).userAvatar;
  const time = new Date(msg.createdAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true});
  const hasBody = msg.body?.trim() && msg.body.trim() !== " ";

  return (
    <div className="group flex gap-3 px-4 py-1.5 hover:bg-muted/10 relative rounded"
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      <Avatar name={name} avatar={avatar} size={8} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.85rem" }}>{name}</span>
          <span className="label-caps" style={{ fontSize:"0.52rem", opacity:0.5 }}>{time}</span>
        </div>
        {hasBody && (
          <p className="text-sm" style={{ fontFamily:"'Barlow',sans-serif", lineHeight:1.6, wordBreak:"break-word" }}
            dangerouslySetInnerHTML={{ __html: msg.body
              .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
              .replace(/\*(.*?)\*/g,"<em>$1</em>")
              .replace(/#([a-z0-9-]+)/g,'<span style="color:hsl(var(--crimson))">$&</span>')
              .replace(/@(\w+)/g,'<span style="color:hsl(200 80% 42%)">@$1</span>')
            }} />
        )}
        {attachments.map((att, i) => <AttachmentPreview key={i} att={att} />)}
        {Object.keys(reactions).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(reactions).map(([e,uids]) => (
              <button key={e} onClick={()=>onReact(msg.id,e)}
                className="label-caps flex items-center gap-1 px-2 py-0.5 rounded-full transition-all"
                style={{ background:uids.includes(currentUserId)?"hsl(var(--crimson)/0.12)":"hsl(var(--muted))", border:`1px solid ${uids.includes(currentUserId)?"hsl(var(--crimson)/0.4)":"transparent"}`, fontSize:"0.7rem" }}>
                {e} {uids.length}
              </button>
            ))}
          </div>
        )}
      </div>
      {hover && (
        <div className="absolute right-4 -top-7 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg px-2 py-1 z-10">
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={()=>onReact(msg.id,e)} className="text-sm hover:scale-125 transition-transform px-0.5">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── File upload button ───────────────────────────────────────────────────────
function AttachButton({ onAttach, uploading }: { onAttach: (atts:any[])=>void; uploading:boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    try {
      const res = await fetch("/api/upload/attachment", { method:"POST", body:fd });
      const data = await res.json();
      if (data.ok) onAttach(data.attachments);
      else alert(data.error);
    } catch(err) { alert(String(err)); }
    if (ref.current) ref.current.value = "";
  };
  return (
    <>
      <input ref={ref} type="file" multiple className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        onChange={handleChange} />
      <button onClick={()=>ref.current?.click()} disabled={uploading}
        className="p-1.5 hover:bg-muted rounded transition-colors flex-shrink-0"
        title="Attach files (images, PDF, Word, Excel — max 10MB)">
        <Paperclip size={18} className="text-muted-foreground" />
      </button>
    </>
  );
}

// ── Pending attachments preview ──────────────────────────────────────────────
function PendingAttachments({ atts, onRemove }: { atts:any[]; onRemove:(i:number)=>void }) {
  if (!atts.length) return null;
  return (
    <div className="flex gap-2 flex-wrap px-2 pb-2 border-t border-border/50 pt-2">
      {atts.map((att, i) => (
        <div key={i} className="relative group">
          {att.isImage ? (
            <img src={att.url} alt={att.name} className="w-16 h-16 object-cover rounded border border-border" />
          ) : (
            <div className="w-16 h-16 rounded border border-border flex flex-col items-center justify-center gap-1"
              style={{ background:"hsl(var(--muted))" }}>
              <FileText size={20} className="text-muted-foreground" />
              <span className="label-caps text-center px-1 truncate w-full text-center" style={{ fontSize:"0.45rem" }}>{att.name}</span>
            </div>
          )}
          <button onClick={()=>onRemove(i)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-crimson">
            <X size={9} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export function ChannelsLayout({ currentUser, allChannels, memberOf, activeView, initialMessages, allUsers, pendingInvites }: {
  currentUser: { id:string; name:string; avatar?:string|null };
  allChannels: Channel[];
  memberOf: string[];
  activeView: View;
  initialMessages: (Message|DM)[];
  allUsers: AppUser[];
  pendingInvites: Invite[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view, setView] = useState<View>(activeView);
  const [messages, setMessages] = useState<(Message|DM)[]>(initialMessages);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState<string|null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteSent, setInviteSent] = useState<string|null>(null);
  const [newName, setNewName] = useState(""); const [newDesc, setNewDesc] = useState(""); const [newEmoji, setNewEmoji] = useState("💬"); const [newPrivate, setNewPrivate] = useState(false);
  const [dmSearch, setDmSearch] = useState("");
  const [localMemberOf, setLocalMemberOf] = useState(new Set(memberOf));
  const [localInvites, setLocalInvites] = useState(pendingInvites);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages.length]);

  // Poll messages every 2s
  useEffect(() => {
    if (!view) return;
    const poll = async () => {
      const last = messages[messages.length-1];
      const since = last?.createdAt ? new Date(last.createdAt).toISOString() : "";
      try {
        const url = view.type === "channel"
          ? `/api/channels/${view.id}?since=${encodeURIComponent(since)}`
          : `/api/dm/${view.userId}?since=${encodeURIComponent(since)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.length > 0) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            return [...prev, ...data.filter((m: any) => !ids.has(m.id))];
          });
        }
      } catch {}
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [view, messages.length]);

  // Reset messages when view changes
  useEffect(() => {
    if (!view) return;
    const fetchInit = async () => {
      const url = view.type === "channel"
        ? `/api/channels/${view.id}`
        : `/api/dm/${view.userId}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        setMessages(data);
      } catch {}
    };
    fetchInit();
  }, [view?.type === "channel" ? (view as any).id : (view as any)?.userId]);

  const handleSend = async () => {
    if ((!input.trim() && !attachments.length) || !view || sending) return;
    setSending(true);
    const body = input.trim();
    const atts = [...attachments];
    setInput(""); setAttachments([]);
    // Optimistic
    const opt: any = {
      id: "opt-"+Date.now(), body, reactions:"{}", attachments:JSON.stringify(atts),
      edited:false, createdAt:new Date(), userId:currentUser.id,
      userName:currentUser.name, userAvatar:currentUser.avatar||null, deletedAt:null,
      fromUserId:currentUser.id, toUserId: view.type==="dm"?(view as any).userId:undefined,
      fromName:currentUser.name, fromAvatar:currentUser.avatar||null, read:false,
    };
    setMessages(prev => [...prev, opt]);
    try {
      if (view.type === "channel") await sendMessage(view.id, body, atts);
      else await sendDM((view as any).userId, body, atts);
    } catch {}
    setSending(false);
  };

  const handleReact = async (msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const r = JSON.parse(m.reactions||"{}") as Record<string,string[]>;
      if (!r[emoji]) r[emoji] = [];
      const idx = r[emoji].indexOf(currentUser.id);
      if (idx>=0) r[emoji].splice(idx,1); else r[emoji].push(currentUser.id);
      if (r[emoji].length===0) delete r[emoji];
      return {...m, reactions:JSON.stringify(r)};
    }));
    if (view?.type==="channel") await toggleReaction(msgId, emoji);
    else await toggleDMReaction(msgId, emoji);
  };

  const handleAcceptInvite = async (inv: Invite) => {
    const channelId = await acceptInvite(inv.id);
    setLocalInvites(prev => prev.filter(i => i.id !== inv.id));
    setLocalMemberOf(prev => new Set([...prev, channelId]));
    setView({ type:"channel", id:channelId });
  };

  const handleInviteUser = async (userId: string) => {
    if (!showInvite) return;
    await inviteToChannel(showInvite, userId);
    setInviteSent(userId);
    setTimeout(()=>setInviteSent(null), 2000);
  };

  const activeChannel = view?.type==="channel" ? allChannels.find(c=>c.id===(view as any).id) : null;
  const dmUser = view?.type==="dm" ? allUsers.find(u=>u.id===(view as any).userId) : null;
  const isMember = view?.type==="channel" ? localMemberOf.has((view as any).id) : true;
  const myChannels = allChannels.filter(c => localMemberOf.has(c.id));
  const dmableUsers = allUsers.filter(u => u.id !== currentUser.id);
  const inviteableUsers = allUsers.filter(u => {
    if (!showInvite || u.id===currentUser.id) return false;
    const q = inviteSearch.toLowerCase();
    return !q || (u.name||"").toLowerCase().includes(q);
  });

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>

      {/* ── Sidebar ── */}
      <div className="hidden sm:flex flex-col border-r border-border flex-shrink-0"
        style={{ width:224, background:"hsl(var(--card))" }}>

        {/* Pending invites banner */}
        {localInvites.length > 0 && (
          <div className="p-3 border-b border-border" style={{ background:"hsl(var(--crimson)/0.06)" }}>
            <p className="label-caps mb-2 flex items-center gap-1" style={{ color:"hsl(var(--crimson))", fontSize:"0.6rem" }}>
              <Bell size={10}/> {localInvites.length} Pending Invite{localInvites.length>1?"s":""}
            </p>
            {localInvites.map(inv => (
              <div key={inv.id} className="mb-1.5">
                <p className="text-xs mb-1" style={{ fontFamily:"'Barlow',sans-serif" }}>
                  <strong>{inv.inviterName}</strong> invited you to {inv.channelEmoji} #{inv.channelName}
                </p>
                <div className="flex gap-1">
                  <button onClick={()=>handleAcceptInvite(inv)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background:"hsl(var(--crimson))", color:"white", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.62rem" }}>
                    <Check size={10}/> Accept
                  </button>
                  <button onClick={async()=>{await declineInvite(inv.id); setLocalInvites(p=>p.filter(i=>i.id!==inv.id));}}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background:"hsl(var(--muted))", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.62rem" }}>
                    <X size={10}/> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="heading-sm" style={{ fontSize:"0.85rem" }}>Channels</span>
          <button onClick={()=>setShowCreate(true)}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
            <Plus size={14}/>
          </button>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto py-1">
          {myChannels.length>0 && (
            <>
              <p className="label-caps px-4 py-1 mt-1" style={{ fontSize:"0.55rem", opacity:0.5 }}>Channels</p>
              {myChannels.map(ch => {
                const isActive = view?.type==="channel" && (view as any).id===ch.id;
                return (
                  <div key={ch.id} className="flex items-center group" style={{ position:"relative" }}>
                    <button onClick={()=>setView({type:"channel",id:ch.id})}
                      className="flex-1 flex items-center gap-2 px-4 py-1.5 text-left hover:bg-muted/30 transition-colors min-w-0"
                      style={{ background:isActive?"hsl(var(--crimson)/0.08)":"transparent", borderLeft:`2px solid ${isActive?"hsl(var(--crimson))":"transparent"}` }}>
                      <span style={{ fontSize:"0.85rem", flexShrink:0 }}>{ch.emoji||"💬"}</span>
                      <span className="truncate" style={{ fontFamily:"'Barlow',sans-serif", fontWeight:isActive?600:400, fontSize:"0.82rem", color:isActive?"hsl(var(--crimson))":"hsl(var(--foreground))" }}>
                        #{ch.name}
                      </span>
                      {ch.type==="private" && <Lock size={9} className="text-muted-foreground flex-shrink-0"/>}
                    </button>
                    {isActive && (
                      <button onClick={()=>setShowInvite(ch.id)} title="Invite members"
                        className="px-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <UserPlus size={12} className="text-muted-foreground hover:text-foreground"/>
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Direct Messages */}
          <div className="flex items-center justify-between px-4 py-1 mt-2">
            <p className="label-caps" style={{ fontSize:"0.55rem", opacity:0.5 }}>Direct Messages</p>
            <button onClick={()=>setShowDMPicker(true)} className="hover:opacity-80">
              <Plus size={11} className="text-muted-foreground"/>
            </button>
          </div>
          {dmableUsers.slice(0,8).map(u => {
            const isActive = view?.type==="dm" && (view as any).userId===u.id;
            return (
              <button key={u.id} onClick={()=>setView({type:"dm",userId:u.id})}
                className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-muted/30 transition-colors"
                style={{ background:isActive?"hsl(var(--crimson)/0.08)":"transparent", borderLeft:`2px solid ${isActive?"hsl(var(--crimson))":"transparent"}` }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background:"hsl(var(--crimson))", fontSize:"0.6rem", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, color:"white" }}>
                  {(u.name||"?")[0].toUpperCase()}
                </div>
                <span className="truncate" style={{ fontFamily:"'Barlow',sans-serif", fontSize:"0.82rem", color:isActive?"hsl(var(--crimson))":"hsl(var(--foreground))" }}>
                  {u.name||u.id}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-border">
          <button onClick={()=>router.push("/huddle")} className="w-full btn-outline" style={{ fontSize:"0.63rem", padding:"0.35rem" }}>
            🎙️ Start Huddle
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <TopBar
          title={activeChannel ? `${activeChannel.emoji||"💬"} #${activeChannel.name}` : dmUser ? `💬 ${dmUser.name}` : "Channels"}
          subtitle={activeChannel?.description || (dmUser ? "Direct Message" : "Select a channel or DM")}
          right={
            view?.type==="channel" && activeChannel && isMember ? (
              <button onClick={()=>setShowInvite((view as any).id)} className="btn-outline" style={{ fontSize:"0.68rem" }}>
                <UserPlus size={12}/> Invite
              </button>
            ) : undefined
          }
        />

        {!view ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center p-8">
            <div style={{ fontSize:"4rem" }}>💬</div>
            <div className="heading-md">Welcome to Channels</div>
            <p className="text-sm text-muted-foreground max-w-sm" style={{ fontFamily:"'Barlow',sans-serif" }}>
              Create channels for projects, topics, or teams. Direct message your teammates.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={()=>setShowCreate(true)} className="btn-primary"><Hash size={14}/> New Channel</button>
              <button onClick={()=>setShowDMPicker(true)} className="btn-outline"><MessageSquare size={14}/> Send DM</button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth:"thin" }}>
              {messages.length===0 && (
                <div className="text-center py-16">
                  <div style={{ fontSize:"3rem", marginBottom:8 }}>{view.type==="channel" ? (activeChannel?.emoji||"💬") : "💬"}</div>
                  <div className="heading-sm mb-2">
                    {view.type==="channel" ? `Beginning of #${activeChannel?.name}` : `Start of your DM with ${dmUser?.name}`}
                  </div>
                  {view.type==="channel" && activeChannel?.description && (
                    <p className="text-sm text-muted-foreground">{activeChannel.description}</p>
                  )}
                </div>
              )}
              {messages.map(msg => (
                <MsgBubble key={msg.id} msg={msg} currentUserId={currentUser.id} onReact={handleReact} />
              ))}
              <div ref={messagesEndRef}/>
            </div>

            {/* Input bar */}
            {isMember ? (
              <div className="border-t border-border">
                <PendingAttachments atts={attachments} onRemove={i=>setAttachments(p=>p.filter((_,j)=>j!==i))} />
                <div className="p-3">
                  <div className="card-base flex items-end gap-2 p-2" style={{ border:"1px solid hsl(var(--border))" }}>
                    <div className="relative">
                      <button onClick={()=>setShowEmoji(p=>!p)} className="p-1.5 hover:bg-muted rounded transition-colors">
                        <Smile size={18} className="text-muted-foreground"/>
                      </button>
                      {showEmoji && (
                        <div className="absolute bottom-10 left-0 card-base p-2 grid grid-cols-8 gap-0.5 shadow-xl z-20 border border-border"
                          style={{ width:280 }}>
                          {EMOJI_PICKER.map(e => (
                            <button key={e} onClick={()=>{setInput(p=>p+e);setShowEmoji(false);textareaRef.current?.focus();}}
                              className="text-lg hover:scale-125 transition-transform p-0.5 text-center">{e}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <AttachButton onAttach={atts=>setAttachments(p=>[...p,...atts])} uploading={uploading} />
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e=>setInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}}
                      placeholder={view.type==="channel" ? `Message #${activeChannel?.name}…` : `Message ${dmUser?.name}…`}
                      rows={1}
                      style={{ flex:1, background:"transparent", border:"none", outline:"none", resize:"none", fontFamily:"'Barlow',sans-serif", fontSize:"0.9rem", maxHeight:120, lineHeight:1.5 }}
                      onInput={e=>{const el=e.currentTarget;el.style.height="auto";el.style.height=Math.min(el.scrollHeight,120)+"px";}}
                    />
                    <button onClick={handleSend} disabled={(!input.trim()&&!attachments.length)||sending}
                      className="btn-primary flex-shrink-0" style={{ padding:"0.4rem" }}>
                      <Send size={16}/>
                    </button>
                  </div>
                  <p className="label-caps mt-1 ml-1" style={{ fontSize:"0.52rem", opacity:0.35 }}>
                    Enter to send · Shift+Enter for new line · 📎 attach files up to 10MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-t border-border p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">You're not a member of this channel</p>
                <p className="label-caps" style={{ fontSize:"0.6rem" }}>Ask a member to invite you</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Channel Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="heading-md">Create Channel</h2>
              <button onClick={()=>setShowCreate(false)}><X size={18}/></button>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="field-label">Emoji</label>
                <input type="text" value={newEmoji} onChange={e=>setNewEmoji(e.target.value)} className="field-input w-14 text-center text-xl" maxLength={2}/>
              </div>
              <div className="flex-1">
                <label className="field-label">Name</label>
                <input autoFocus type="text" value={newName} onChange={e=>setNewName(e.target.value.toLowerCase().replace(/\s+/g,"-"))} className="field-input" placeholder="project-updates"/>
              </div>
            </div>
            <div>
              <label className="field-label">Description</label>
              <input type="text" value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="field-input" placeholder="What's this channel about?"/>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newPrivate} onChange={e=>setNewPrivate(e.target.checked)} className="rounded"/>
              <div>
                <span className="text-sm font-medium flex items-center gap-1"><Lock size={12}/> Private channel</span>
                <p className="label-caps" style={{ fontSize:"0.55rem" }}>Members must be invited — not open to all</p>
              </div>
            </label>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setShowCreate(false)} className="btn-outline">Cancel</button>
              <button onClick={async()=>{
                if(!newName) return;
                const id = await createChannel(newName,newDesc,newEmoji,newPrivate);
                setLocalMemberOf(p=>new Set([...p,id]));
                setShowCreate(false); setNewName(""); setNewDesc(""); setNewEmoji("💬"); setNewPrivate(false);
                setView({type:"channel",id});
              }} className="btn-primary">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="heading-md">Invite to Channel</h2>
              <button onClick={()=>{setShowInvite(null);setInviteSearch("");}}><X size={18}/></button>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input type="text" value={inviteSearch} onChange={e=>setInviteSearch(e.target.value)} className="field-input pl-9" placeholder="Search teammates…"/>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {inviteableUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 py-2 px-1 rounded hover:bg-muted/20">
                  <Avatar name={u.name||"?"} avatar={u.avatarUrl} size={8}/>
                  <span className="flex-1 text-sm" style={{ fontFamily:"'Barlow',sans-serif" }}>{u.name}</span>
                  <button onClick={()=>handleInviteUser(u.id)}
                    className="btn-primary" style={{ fontSize:"0.62rem", padding:"0.28rem 0.75rem" }}>
                    {inviteSent===u.id ? <><Check size={11}/> Sent!</> : <><UserPlus size={11}/> Invite</>}
                  </button>
                </div>
              ))}
              {inviteableUsers.length===0 && <p className="text-sm text-muted-foreground text-center py-4">No users found</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── DM Picker Modal ── */}
      {showDMPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="heading-md">New Direct Message</h2>
              <button onClick={()=>{setShowDMPicker(false);setDmSearch("");}}><X size={18}/></button>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input autoFocus type="text" value={dmSearch} onChange={e=>setDmSearch(e.target.value)} className="field-input pl-9" placeholder="Search teammates…"/>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {dmableUsers.filter(u=>!dmSearch||(u.name||"").toLowerCase().includes(dmSearch.toLowerCase())).map(u=>(
                <button key={u.id} onClick={()=>{setShowDMPicker(false);setDmSearch("");setView({type:"dm",userId:u.id});}}
                  className="w-full flex items-center gap-3 py-2.5 px-2 rounded hover:bg-muted/20 text-left transition-colors">
                  <Avatar name={u.name||"?"} avatar={u.avatarUrl} size={9}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ fontFamily:"'Barlow',sans-serif" }}>{u.name}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground"/>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
