"use client";
import { useState, useEffect, useRef, useCallback, memo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Send, Smile, X, Hash, Lock, UserPlus,
  Paperclip, FileText, Check, Bell, ChevronRight,
  MessageSquare, Search, Loader2, MoreHorizontal,
  Pencil, Trash2, LayoutList,
} from "lucide-react";
import {
  createChannel, toggleReaction, inviteToChannel,
  acceptInvite, declineInvite, toggleDMReaction,
  deleteChannel, renameChannel,
} from "@/lib/actions/channels";
import { TopBar } from "@/components/layout/TopBar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Channel { id: string; name: string; description: string | null; emoji: string | null; type: string; createdBy: string; }
interface Invite  { id: string; channelId: string; channelName: string; channelEmoji: string; inviterName: string; }
interface Msg {
  id: string; body: string; reactions: string | null; attachments: string | null;
  createdAt: Date | string; deletedAt?: Date | string | null;
  userId?: string; userName?: string | null; userAvatar?: string | null; edited?: boolean | null;
  fromUserId?: string; fromName?: string | null; fromAvatar?: string | null;
}
interface AppUser { id: string; name: string | null; avatarUrl: string | null; }
type View = { type: "channel"; id: string } | { type: "dm"; userId: string } | null;

const EMOJI_QUICK = ["👍","❤️","😂","🎉","🔥","✅","👀","💯"];

function viewKey(v: View) {
  if (!v) return "";
  return v.type === "channel" ? `ch:${(v as any).id}` : `dm:${(v as any).userId}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, avatar, size=8 }: { name:string; avatar?:string|null; size?:number }) {
  const sz = `${size*4}px`;
  // Only use avatar if it's a URL (not base64 — those are huge and slow)
  if (avatar?.startsWith("http")) {
    return <img src={avatar} alt={name} style={{ width:sz, height:sz, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} loading="lazy" />;
  }
  // Initials fallback — fast, no network request
  const colors = ["hsl(352 80% 42%)","hsl(200 80% 42%)","hsl(142 71% 38%)","hsl(38 90% 48%)","hsl(270 65% 52%)"];
  const bg = colors[(name?.charCodeAt(0)||0) % colors.length];
  return (
    <div style={{ width:sz, height:sz, borderRadius:"50%", background:bg, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:`${size*0.45}rem`, color:"white", letterSpacing:"-0.02em" }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

// ─── Message ─────────────────────────────────────────────────────────────────
const MsgRow = memo(function MsgRow({ msg, meId, onReact }: { msg:Msg; meId:string; onReact:(id:string,e:string)=>void }) {
  const [hover, setHover] = useState(false);
  const name   = msg.fromName  || msg.userName  || "Unknown";
  const avatar = msg.fromAvatar || msg.userAvatar || null;
  const reactions = JSON.parse(msg.reactions || "{}") as Record<string,string[]>;
  const atts = JSON.parse(msg.attachments || "[]") as any[];
  const isOpt = msg.id.startsWith("opt-");
  const time  = new Date(msg.createdAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true});

  if (msg.deletedAt) return (
    <div className="px-4 py-1 text-xs italic text-muted-foreground">This message was deleted.</div>
  );

  return (
    <div className="group flex gap-3 px-4 py-1.5 hover:bg-muted/10 rounded relative"
      style={{ opacity: isOpt ? 0.55 : 1 }}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      <Avatar name={name} avatar={avatar} size={8} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.85rem" }}>{name}</span>
          <span style={{ fontSize:"0.52rem", opacity:0.5, fontFamily:"'Barlow Condensed',sans-serif" }}>
            {time}{isOpt ? " · sending…" : ""}
          </span>
        </div>
        <p className="text-sm break-words" style={{ fontFamily:"'Barlow',sans-serif", lineHeight:1.6 }}
          dangerouslySetInnerHTML={{ __html: (msg.body||"")
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
            .replace(/\*(.*?)\*/g,"<em>$1</em>")
          }} />
        {atts.map((a,i) => a.isImage
          ? <img key={i} src={a.url} alt={a.name} className="mt-1.5 rounded max-h-48 max-w-xs border border-border cursor-pointer" onClick={()=>window.open(a.url,"_blank")} />
          : <a key={i} href={a.url} download={a.name} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-2 px-3 py-1.5 rounded border border-border hover:bg-muted/20 inline-flex max-w-xs">
              <FileText size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-xs truncate" style={{ fontFamily:"'Barlow',sans-serif" }}>{a.name}</span>
            </a>
        )}
        {Object.keys(reactions).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(reactions).map(([e,uids]) => (
              <button key={e} onClick={()=>onReact(msg.id,e)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-all"
                style={{ background:uids.includes(meId)?"hsl(var(--crimson)/0.12)":"hsl(var(--muted))", border:`1px solid ${uids.includes(meId)?"hsl(var(--crimson)/0.35)":"transparent"}`, fontSize:"0.75rem" }}>
                {e} <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.72rem" }}>{uids.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {hover && !isOpt && (
        <div className="absolute right-4 -top-8 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg px-2 py-1 z-20">
          {EMOJI_QUICK.map(e => (
            <button key={e} onClick={()=>onReact(msg.id,e)} className="text-base hover:scale-125 transition-transform px-0.5">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Main Layout ──────────────────────────────────────────────────────────────
export function ChannelsLayout({ currentUser, allChannels, memberOf, activeView, initialMessages, allUsers, pendingInvites }: {
  currentUser: { id:string; name:string; avatar?:string|null };
  allChannels: Channel[];
  memberOf: string[];
  activeView: View;
  initialMessages: Msg[];
  allUsers: AppUser[];
  pendingInvites: Invite[];
}) {
  const router = useRouter();
  const [,startTransition] = useTransition();

  // Core state
  const [msgs, setMsgs]           = useState<Msg[]>(initialMessages);
  const [channelList, setChannelList] = useState<Channel[]>(allChannels);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [sendErr, setSendErr]     = useState<string|null>(null);
  const [atts, setAtts]           = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // Sidebar modals
  const [showCreate, setShowCreate]   = useState(false);
  const [showInvite, setShowInvite]   = useState<string|null>(null);
  const [showDMPick, setShowDMPick]   = useState(false);
  const [showRename, setShowRename]   = useState<Channel|null>(null);
  const [showMenu, setShowMenu]       = useState<string|null>(null);
  const [invites, setInvites]         = useState(pendingInvites);
  const [localMember, setLocalMember] = useState(new Set(memberOf));

  // Form state
  const [newName, setNewName]       = useState(""); const [newEmoji, setNewEmoji] = useState("💬"); const [newDesc, setNewDesc] = useState(""); const [newPriv, setNewPriv] = useState(false);
  const [renName, setRenName]       = useState(""); const [renEmoji, setRenEmoji] = useState(""); const [renDesc, setRenDesc] = useState("");
  const [invSearch, setInvSearch]   = useState(""); const [invSent, setInvSent]   = useState<string|null>(null);
  const [dmSearch, setDmSearch]     = useState("");
  const [showEmoji, setShowEmoji]   = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  const endRef  = useRef<HTMLDivElement>(null);
  const taRef   = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const vKey    = viewKey(activeView);
  const msgsRef = useRef<Msg[]>(msgs);
  msgsRef.current = msgs;

  // Derived
  const activeChannel = activeView?.type==="channel" ? channelList.find(c=>c.id===(activeView as any).id) : null;
  const dmUser        = activeView?.type==="dm"      ? allUsers.find(u=>u.id===(activeView as any).userId) : null;
  const isMember      = activeView?.type==="channel" ? localMember.has((activeView as any).id) : true;
  const myChannels    = channelList.filter(c => localMember.has(c.id));

  // Sync server-provided messages when channel changes
  useEffect(() => {
    setMsgs(initialMessages);
    setSendErr(null);
  }, [vKey]); // eslint-disable-line

  // Scroll to bottom when messages appear
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  // Poll for new messages — 5s visible, paused when hidden
  useEffect(() => {
    if (!activeView) return;
    const key = vKey;
    const tick = async () => {
      if (document.hidden) return; // Don't poll when tab is hidden
      const curr = msgsRef.current;
      const real = curr.filter(m => !m.id.startsWith("opt-"));
      const last = real[real.length-1];
      const since = last?.createdAt ? new Date(last.createdAt).toISOString() : new Date(0).toISOString();
      const url = activeView.type==="channel"
        ? `/api/channels/${(activeView as any).id}?since=${encodeURIComponent(since)}`
        : `/api/dm/${(activeView as any).userId}?since=${encodeURIComponent(since)}`;
      try {
        const res = await fetch(url, { cache:"no-store" });
        if (!res.ok) return;
        const fresh: Msg[] = await res.json();
        if (!fresh.length) return;
        setMsgs(prev => {
          if (viewKey(activeView) !== key) return prev;
          const ids = new Set(prev.filter(m=>!m.id.startsWith("opt-")).map(m=>m.id));
          const news = fresh.filter(m=>!ids.has(m.id));
          if (!news.length) return prev;
          return [...prev.filter(m=>!m.id.startsWith("opt-")), ...news];
        });
      } catch {}
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [vKey]); // eslint-disable-line

  // Navigate to channel/DM
  const go = useCallback((v: View) => {
    if (!v) return;
    setSendErr(null);
    const url = v.type==="channel" ? `/channels?c=${(v as any).id}` : `/channels?dm=${(v as any).userId}`;
    router.push(url);
  }, [router]);

  // Send message
  const send = async () => {
    if ((!input.trim() && !atts.length) || !activeView || sending) return;
    setSending(true); setSendErr(null);
    const body = input.trim(); const myAtts = [...atts];
    setInput(""); setAtts([]);

    const optId = `opt-${Date.now()}`;
    const opt: Msg = {
      id:optId, body, attachments:JSON.stringify(myAtts), reactions:"{}",
      createdAt:new Date(), userId:currentUser.id, userName:currentUser.name,
      userAvatar:currentUser.avatar||null, fromUserId:currentUser.id,
      fromName:currentUser.name, fromAvatar:currentUser.avatar||null,
    };
    setMsgs(p => [...p, opt]);

    try {
      const payload = activeView.type==="channel"
        ? { channelId:(activeView as any).id, body, attachments:myAtts }
        : { toUserId:(activeView as any).userId, body, attachments:myAtts };
      const res = await fetch("/api/messages", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(()=>({error:"Send failed"}));
        throw new Error(e.error || "Send failed");
      }
      // Remove optimistic after poll picks it up
      setTimeout(()=>setMsgs(p=>p.filter(m=>m.id!==optId)), 4000);
    } catch(err:any) {
      setSendErr(err.message || "Failed to send. Please try again.");
      setMsgs(p=>p.filter(m=>m.id!==optId));
      setInput(body); setAtts(myAtts);
    }
    setSending(false);
  };

  // React to message
  const react = async (msgId:string, emoji:string) => {
    if (msgId.startsWith("opt-")) return;
    setMsgs(p => p.map(m => {
      if (m.id!==msgId) return m;
      const r = JSON.parse(m.reactions||"{}") as Record<string,string[]>;
      if (!r[emoji]) r[emoji]=[];
      const i = r[emoji].indexOf(currentUser.id);
      if (i>=0) r[emoji].splice(i,1); else r[emoji].push(currentUser.id);
      if (!r[emoji].length) delete r[emoji];
      return {...m, reactions:JSON.stringify(r)};
    }));
    if (activeView?.type==="channel") await toggleReaction(msgId,emoji);
    else await toggleDMReaction(msgId,emoji);
  };

  // File attach
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files||[]);
    if (!files.length) return;
    setUploading(true);
    const fd = new FormData(); files.forEach(f=>fd.append("files",f));
    try {
      const res = await fetch("/api/upload/attachment",{method:"POST",body:fd});
      const d = await res.json();
      if (d.ok) setAtts(p=>[...p,...d.attachments]);
      else setSendErr(d.error||"Upload failed");
    } catch(err){ setSendErr(String(err)); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value="";
  };

  // Accept invite
  const accept = async (inv:Invite) => {
    const cid = await acceptInvite(inv.id);
    setInvites(p=>p.filter(i=>i.id!==inv.id));
    setLocalMember(p=>new Set([...p,cid]));
    go({type:"channel",id:cid});
  };

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden sm:flex flex-col border-r border-border flex-shrink-0"
        style={{ width:220, background:"hsl(var(--card))" }}>

        {/* Pending invites */}
        {invites.length>0 && (
          <div className="p-3 border-b border-border" style={{ background:"hsl(var(--crimson)/0.05)" }}>
            <p className="label-caps mb-2 flex items-center gap-1" style={{ color:"hsl(var(--crimson))",fontSize:"0.58rem" }}>
              <Bell size={10}/> {invites.length} invite{invites.length>1?"s":""}
            </p>
            {invites.map(inv=>(
              <div key={inv.id} className="mb-2">
                <p className="text-xs mb-1" style={{ fontFamily:"'Barlow',sans-serif" }}>
                  <strong>{inv.inviterName}</strong> → {inv.channelEmoji} #{inv.channelName}
                </p>
                <div className="flex gap-1">
                  <button onClick={()=>accept(inv)} className="btn-primary" style={{ fontSize:"0.58rem",padding:"0.2rem 0.6rem" }}>
                    <Check size={9}/> Accept
                  </button>
                  <button onClick={async()=>{await declineInvite(inv.id);setInvites(p=>p.filter(i=>i.id!==inv.id));}}
                    className="btn-outline" style={{ fontSize:"0.58rem",padding:"0.2rem 0.6rem" }}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="heading-sm" style={{ fontSize:"0.85rem" }}>Channels</span>
          <button onClick={()=>setShowCreate(true)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted"><Plus size={14}/></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-1">
          {myChannels.length>0 && (
            <>
              <p className="label-caps px-4 py-1 mt-1" style={{ fontSize:"0.52rem",opacity:0.45 }}>Channels</p>
              {myChannels.map(ch => {
                const isActive = activeView?.type==="channel" && (activeView as any).id===ch.id;
                return (
                  <div key={ch.id} className="flex items-center group relative">
                    <button onClick={()=>go({type:"channel",id:ch.id})}
                      className="flex-1 flex items-center gap-2 px-4 py-1.5 text-left hover:bg-muted/30 transition-colors min-w-0"
                      style={{ background:isActive?"hsl(var(--crimson)/0.08)":"transparent", borderLeft:`2px solid ${isActive?"hsl(var(--crimson))":"transparent"}` }}>
                      <span style={{ fontSize:"0.85rem",flexShrink:0 }}>{ch.emoji||"💬"}</span>
                      <span className="truncate" style={{ fontFamily:"'Barlow',sans-serif", fontWeight:isActive?600:400, fontSize:"0.82rem", color:isActive?"hsl(var(--crimson))":"hsl(var(--foreground))" }}>
                        #{ch.name}
                      </span>
                      {ch.type==="private" && <Lock size={9} className="text-muted-foreground flex-shrink-0"/>}
                    </button>
                    {isActive && (
                      <div className="flex items-center pr-1">
                        <button onClick={()=>setShowInvite(ch.id)} title="Invite" className="p-1 opacity-0 group-hover:opacity-100"><UserPlus size={11} className="text-muted-foreground"/></button>
                        <div className="relative">
                          <button onClick={e=>{e.stopPropagation();setShowMenu(showMenu===ch.id?null:ch.id);}} className="p-1 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal size={11} className="text-muted-foreground"/>
                          </button>
                          {showMenu===ch.id && (
                            <div className="absolute left-0 top-6 z-30 card-base border border-border shadow-xl rounded-lg overflow-hidden min-w-[140px]" onClick={e=>e.stopPropagation()}>
                              <button onClick={()=>{setRenName(ch.name);setRenEmoji(ch.emoji||"💬");setRenDesc(ch.description||"");setShowRename(ch);setShowMenu(null);}}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 text-left"><Pencil size={12}/>Rename</button>
                              <button onClick={async()=>{if(confirm(`Delete #${ch.name}? Cannot be undone.`)){await deleteChannel(ch.id);setChannelList(p=>p.filter(x=>x.id!==ch.id));setShowMenu(null);setLocalMember(p=>{const n=new Set(p);n.delete(ch.id);return n;});if(activeView?.type==="channel"&&(activeView as any).id===ch.id){go(null as any);}}}}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 text-left" style={{ color:"hsl(var(--crimson))" }}><Trash2 size={12}/>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* DMs */}
          <div className="flex items-center justify-between px-4 py-1 mt-3">
            <p className="label-caps" style={{ fontSize:"0.52rem",opacity:0.45 }}>Direct Messages</p>
            <button onClick={()=>setShowDMPick(true)} className="hover:opacity-70"><Plus size={11} className="text-muted-foreground"/></button>
          </div>
          {allUsers.filter(u=>u.id!==currentUser.id).slice(0,12).map(u=>{
            const isActive = activeView?.type==="dm" && (activeView as any).userId===u.id;
            return (
              <button key={u.id} onClick={()=>go({type:"dm",userId:u.id})}
                className="w-full flex items-center gap-2.5 px-4 py-1.5 hover:bg-muted/30 transition-colors"
                style={{ background:isActive?"hsl(var(--crimson)/0.08)":"transparent", borderLeft:`2px solid ${isActive?"hsl(var(--crimson))":"transparent"}` }}>
                <Avatar name={u.name||"?"} avatar={u.avatarUrl} size={5}/>
                <span className="truncate" style={{ fontFamily:"'Barlow',sans-serif", fontSize:"0.82rem", color:isActive?"hsl(var(--crimson))":"hsl(var(--foreground))" }}>
                  {u.name}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button onClick={()=>router.push("/huddle")} className="w-full btn-outline" style={{ fontSize:"0.63rem",padding:"0.35rem" }}>
            🎙️ Start Huddle
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <TopBar
          title={activeChannel ? `${activeChannel.emoji||"💬"} #${activeChannel.name}` : dmUser ? `💬 ${dmUser.name}` : "Channels"}
          subtitle={activeChannel?.description || (dmUser?"Direct Message":"Pick a channel or start a DM")}
          left={
            <button
              onClick={() => setShowMobileNav(true)}
              className="sm:hidden flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-muted/30"
              style={{ marginRight: 4 }}
              aria-label="Switch channel"
            >
              <LayoutList size={18} style={{ color: "hsl(var(--crimson))" }} />
            </button>
          }
          right={activeView?.type==="channel" && isMember ? (
            <button onClick={()=>setShowInvite((activeView as any).id)} className="btn-outline" style={{ fontSize:"0.68rem" }}>
              <UserPlus size={12}/> Invite
            </button>
          ) : undefined}
        />

        {!activeView ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <div style={{ fontSize:"4rem" }}>💬</div>
            <div className="heading-md">Welcome to Channels</div>
            <p className="text-sm text-muted-foreground max-w-sm" style={{ fontFamily:"'Barlow',sans-serif" }}>
              Select a channel or start a Direct Message.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={()=>setShowCreate(true)} className="btn-primary"><Hash size={14}/>New Channel</button>
              <button onClick={()=>setShowDMPick(true)} className="btn-outline"><MessageSquare size={14}/>New DM</button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth:"thin" }}>
              {msgs.length===0 && (
                <div className="text-center py-16 px-8">
                  <div style={{ fontSize:"3rem",marginBottom:12 }}>{activeChannel?.emoji||"💬"}</div>
                  <div className="heading-sm mb-2">
                    {activeView.type==="channel" ? `Start of #${activeChannel?.name}` : `Start of your DM with ${dmUser?.name}`}
                  </div>
                  {activeChannel?.description && <p className="text-sm text-muted-foreground">{activeChannel.description}</p>}
                </div>
              )}
              {msgs.map(m=><MsgRow key={m.id} msg={m} meId={currentUser.id} onReact={react}/>)}
              <div ref={endRef}/>
            </div>

            {/* Input area */}
            {isMember ? (
              <div className="border-t border-border">
                {/* Pending attachments */}
                {atts.length>0 && (
                  <div className="flex gap-2 flex-wrap px-3 pt-3">
                    {atts.map((a,i)=>(
                      <div key={i} className="relative group">
                        {a.isImage
                          ? <img src={a.url} alt={a.name} className="w-14 h-14 object-cover rounded border border-border"/>
                          : <div className="w-14 h-14 rounded border border-border flex flex-col items-center justify-center" style={{ background:"hsl(var(--muted))" }}>
                              <FileText size={18} className="text-muted-foreground"/>
                              <span className="label-caps truncate w-full text-center px-0.5" style={{ fontSize:"0.42rem" }}>{a.name}</span>
                            </div>
                        }
                        <button onClick={()=>setAtts(p=>p.filter((_,j)=>j!==i))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={9}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-3">
                  {sendErr && (
                    <div className="flex items-center gap-2 mb-2 px-1 py-1.5 rounded" style={{ background:"hsl(var(--crimson)/0.08)" }}>
                      <span className="text-xs" style={{ color:"hsl(var(--crimson))",fontFamily:"'Barlow',sans-serif" }}>{sendErr}</span>
                    </div>
                  )}
                  <div className="card-base flex items-end gap-2 p-2" style={{ border:"1px solid hsl(var(--border))" }}>
                    {/* Emoji */}
                    <div className="relative">
                      <button onClick={()=>setShowEmoji(p=>!p)} className="p-1.5 hover:bg-muted rounded transition-colors flex-shrink-0">
                        <Smile size={18} className="text-muted-foreground"/>
                      </button>
                      {showEmoji && (
                        <div className="absolute bottom-10 left-0 card-base border border-border p-2 grid grid-cols-8 gap-0.5 shadow-xl z-30" style={{ width:280 }}>
                          {["😀","😂","❤️","🔥","👍","✅","🎉","💯","🚀","👀","💬","🙌","⚡","🎯","💡","🏆","📌","⚠️","📅","⏰","🔔","💼","📊","📋","🤝","😎","🤔","💪","🙏","✨","🌟","⭐","🥳","🤩","🎨","🎭"].map(e=>(
                            <button key={e} onClick={()=>{setInput(p=>p+e);setShowEmoji(false);taRef.current?.focus();}} className="text-lg hover:scale-125 transition-transform p-0.5 text-center">{e}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* File attach */}
                    <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={handleFile}/>
                    <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="p-1.5 hover:bg-muted rounded transition-colors flex-shrink-0" title="Attach file">
                      {uploading ? <Loader2 size={18} className="text-muted-foreground animate-spin"/> : <Paperclip size={18} className="text-muted-foreground"/>}
                    </button>
                    {/* Textarea */}
                    <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                      placeholder={activeView.type==="channel"?`Message #${activeChannel?.name}…`:`Message ${dmUser?.name}…`}
                      rows={1} style={{ flex:1, background:"transparent", border:"none", outline:"none", resize:"none", fontFamily:"'Barlow',sans-serif", fontSize:"0.9rem", maxHeight:120, lineHeight:1.5, padding:"2px 0" }}
                      onInput={e=>{const el=e.currentTarget;el.style.height="auto";el.style.height=Math.min(el.scrollHeight,120)+"px";}}
                    />
                    {/* Send */}
                    <button onClick={send} disabled={(!input.trim()&&!atts.length)||sending}
                      className="btn-primary flex-shrink-0" style={{ padding:"0.4rem", opacity:sending?0.6:1 }}>
                      {sending?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}
                    </button>
                  </div>
                  <p className="label-caps mt-1 ml-1" style={{ fontSize:"0.5rem",opacity:0.35 }}>Enter to send · Shift+Enter for new line</p>
                </div>
              </div>
            ) : (
              <div className="border-t border-border p-5 text-center">
                <p className="text-sm text-muted-foreground mb-1">You're not a member of this channel.</p>
                <p className="label-caps" style={{ fontSize:"0.6rem" }}>Ask a member to invite you.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Channel Modal ─── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setShowCreate(false)}>
          <div className="card-base p-6 w-full max-w-md space-y-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="heading-md">Create Channel</h2><button onClick={()=>setShowCreate(false)}><X size={18}/></button></div>
            <div className="flex gap-3">
              <div><label className="field-label">Emoji</label><input type="text" value={newEmoji} onChange={e=>setNewEmoji(e.target.value)} className="field-input w-14 text-center text-xl" maxLength={2}/></div>
              <div className="flex-1"><label className="field-label">Name</label><input autoFocus type="text" value={newName} onChange={e=>setNewName(e.target.value.toLowerCase().replace(/\s+/g,"-"))} className="field-input" placeholder="e.g. project-alpha"/></div>
            </div>
            <div><label className="field-label">Description</label><input type="text" value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="field-input" placeholder="What's this channel about?"/></div>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newPriv} onChange={e=>setNewPriv(e.target.checked)}/><div><span className="text-sm font-medium flex items-center gap-1"><Lock size={12}/>Private</span><p className="label-caps" style={{ fontSize:"0.55rem" }}>Invite-only</p></div></label>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setShowCreate(false)} className="btn-outline">Cancel</button>
              <button onClick={async()=>{
                if(!newName)return;
                const id=await createChannel(newName,newDesc,newEmoji,newPriv);
                const newCh: Channel = { id, name:newName.toLowerCase().replace(/\s+/g,"-"), description:newDesc||null, emoji:newEmoji||"💬", type:newPriv?"private":"public", createdBy:currentUser.id };
                setChannelList(p=>[...p,newCh].sort((a,b)=>a.name.localeCompare(b.name)));
                setLocalMember(p=>new Set([...p,id]));
                setShowCreate(false);setNewName("");setNewDesc("");setNewEmoji("💬");setNewPriv(false);
                go({type:"channel",id});
              }} className="btn-primary" disabled={!newName}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ─── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>{setShowInvite(null);setInvSearch("");}}>
          <div className="card-base p-6 w-full max-w-sm space-y-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="heading-md">Invite to Channel</h2><button onClick={()=>setShowInvite(null)}><X size={18}/></button></div>
            <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input autoFocus type="text" value={invSearch} onChange={e=>setInvSearch(e.target.value)} className="field-input pl-9" placeholder="Search teammates…"/></div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {allUsers.filter(u=>u.id!==currentUser.id&&(!invSearch||(u.name||"").toLowerCase().includes(invSearch.toLowerCase()))).map(u=>(
                <div key={u.id} className="flex items-center gap-3 py-2 px-1 rounded hover:bg-muted/20">
                  <Avatar name={u.name||"?"} avatar={u.avatarUrl} size={8}/>
                  <span className="flex-1 text-sm" style={{ fontFamily:"'Barlow',sans-serif" }}>{u.name}</span>
                  <button onClick={async()=>{await inviteToChannel(showInvite,u.id);setInvSent(u.id);setTimeout(()=>setInvSent(null),2000);}} className="btn-primary" style={{ fontSize:"0.62rem",padding:"0.28rem 0.7rem" }}>
                    {invSent===u.id?<><Check size={11}/>Sent!</>:<><UserPlus size={11}/>Invite</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Rename Modal ─── */}
      {showRename && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setShowRename(null)}>
          <div className="card-base p-6 w-full max-w-md space-y-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="heading-md">Edit Channel</h2><button onClick={()=>setShowRename(null)}><X size={18}/></button></div>
            <div className="flex gap-3">
              <div><label className="field-label">Emoji</label><input type="text" value={renEmoji} onChange={e=>setRenEmoji(e.target.value)} className="field-input w-14 text-center text-xl" maxLength={2}/></div>
              <div className="flex-1"><label className="field-label">Name</label><input autoFocus type="text" value={renName} onChange={e=>setRenName(e.target.value.toLowerCase().replace(/\s+/g,"-"))} className="field-input"/></div>
            </div>
            <div><label className="field-label">Description</label><input type="text" value={renDesc} onChange={e=>setRenDesc(e.target.value)} className="field-input"/></div>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setShowRename(null)} className="btn-outline">Cancel</button>
              <button onClick={async()=>{
                if(!renName)return;
                await renameChannel(showRename.id,renName,renEmoji,renDesc);
                setChannelList(p=>p.map(ch=>ch.id===showRename.id?{...ch,name:renName,emoji:renEmoji,description:renDesc||null}:ch));
                setShowRename(null);
              }} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Channel Drawer ─── */}
      {showMobileNav && (
        <div className="fixed inset-0 z-50 sm:hidden flex flex-col" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowMobileNav(false)}>
          <div className="mt-auto rounded-t-2xl overflow-hidden flex flex-col"
            style={{ background: "hsl(var(--card))", maxHeight: "80vh" }}
            onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "hsl(var(--border))" }} />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="heading-sm" style={{ fontSize: "1rem" }}>Channels & DMs</h2>
              <button onClick={() => setShowMobileNav(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/30">
                <X size={18} />
              </button>
            </div>
            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 pb-6">
              {myChannels.length > 0 && (
                <>
                  <p className="label-caps px-5 pt-4 pb-2" style={{ fontSize: "0.6rem", opacity: 0.5 }}>Channels</p>
                  {myChannels.map(ch => {
                    const isActive = activeView?.type === "channel" && (activeView as any).id === ch.id;
                    return (
                      <button key={ch.id}
                        onClick={() => { go({ type: "channel", id: ch.id }); setShowMobileNav(false); }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors active:bg-muted/20"
                        style={{ background: isActive ? "hsl(var(--crimson)/0.08)" : "transparent", borderLeft: `3px solid ${isActive ? "hsl(var(--crimson))" : "transparent"}` }}>
                        <span style={{ fontSize: "1.2rem" }}>{ch.emoji || "💬"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ fontFamily: "'Barlow',sans-serif", color: isActive ? "hsl(var(--crimson))" : "hsl(var(--foreground))" }}>
                            #{ch.name}
                          </p>
                          {ch.description && (
                            <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "'Barlow',sans-serif" }}>{ch.description}</p>
                          )}
                        </div>
                        {ch.type === "private" && <Lock size={12} className="text-muted-foreground flex-shrink-0" />}
                        {isActive && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "hsl(var(--crimson))" }} />}
                      </button>
                    );
                  })}
                </>
              )}
              {/* DMs */}
              {allUsers.filter(u => u.id !== currentUser.id).length > 0 && (
                <>
                  <p className="label-caps px-5 pt-4 pb-2" style={{ fontSize: "0.6rem", opacity: 0.5 }}>Direct Messages</p>
                  {allUsers.filter(u => u.id !== currentUser.id).slice(0, 15).map(u => {
                    const isActive = activeView?.type === "dm" && (activeView as any).userId === u.id;
                    return (
                      <button key={u.id}
                        onClick={() => { go({ type: "dm", userId: u.id }); setShowMobileNav(false); }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors active:bg-muted/20"
                        style={{ background: isActive ? "hsl(var(--crimson)/0.08)" : "transparent", borderLeft: `3px solid ${isActive ? "hsl(var(--crimson))" : "transparent"}` }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                          style={{ background: "hsl(var(--crimson))", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800 }}>
                          {(u.name || "?")[0].toUpperCase()}
                        </div>
                        <p className="font-medium text-sm" style={{ fontFamily: "'Barlow',sans-serif", color: isActive ? "hsl(var(--crimson))" : "hsl(var(--foreground))" }}>
                          {u.name}
                        </p>
                        {isActive && <div className="ml-auto w-2 h-2 rounded-full" style={{ background: "hsl(var(--crimson))" }} />}
                      </button>
                    );
                  })}
                </>
              )}
              {/* Create new */}
              <div className="px-5 pt-4">
                <button onClick={() => { setShowCreate(true); setShowMobileNav(false); }}
                  className="w-full btn-primary justify-center" style={{ padding: "0.7rem" }}>
                  <Plus size={15} /> New Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DM Picker ─── */}
      {showDMPick && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>{setShowDMPick(false);setDmSearch("");}}>
          <div className="card-base p-6 w-full max-w-sm space-y-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="heading-md">New Direct Message</h2><button onClick={()=>setShowDMPick(false)}><X size={18}/></button></div>
            <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input autoFocus type="text" value={dmSearch} onChange={e=>setDmSearch(e.target.value)} className="field-input pl-9" placeholder="Who do you want to message?"/></div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {allUsers.filter(u=>u.id!==currentUser.id&&(!dmSearch||(u.name||"").toLowerCase().includes(dmSearch.toLowerCase()))).map(u=>(
                <button key={u.id} onClick={()=>{setShowDMPick(false);setDmSearch("");go({type:"dm",userId:u.id});}}
                  className="w-full flex items-center gap-3 py-2.5 px-2 rounded hover:bg-muted/20 text-left transition-colors">
                  <Avatar name={u.name||"?"} avatar={u.avatarUrl} size={9}/>
                  <span className="flex-1 text-sm font-medium" style={{ fontFamily:"'Barlow',sans-serif" }}>{u.name}</span>
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
