"use client";
import { useState, useEffect, useRef, useTransition } from "react";
import { Video, Phone, Mic, MicOff, VideoOff, PhoneOff, Plus, Users, Bell, MessageSquare, X, Send } from "lucide-react";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";

interface Room { id: string; name: string; status: string; startedAt: Date; createdBy: string; creatorName: string | null; }
interface AppUser { id: string; name: string | null; phone: string | null; }

export function HuddlePage({ rooms, currentUser, allUsers }: {
  rooms: Room[];
  currentUser: { id: string; name: string };
  allUsers: AppUser[];
}) {
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>("");
  const [inCall, setInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [joining, setJoining] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifySent, setNotifySent] = useState(false);
  const [twilioRoom, setTwilioRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const localStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (inCall) {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [inCall]);

  const formatDuration = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const joinRoom = async (rName: string, rId?: string) => {
    setJoining(true);
    try {
      // Get Twilio token
      const res = await fetch("/api/huddle/token", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ roomName: rName }) });
      const { token, identity } = await res.json();

      // Get local media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.warn("No camera/mic:", e);
      }

      // Load Twilio Video SDK dynamically
      try {
        const TwilioVideo = await import("twilio-video" as any);
        const room = await TwilioVideo.connect(token, {
          name: rName,
          audio: micOn,
          video: camOn,
        });
        setTwilioRoom(room);
        setParticipants(Array.from(room.participants.values()).map((p: any) => p.identity));

        room.on("participantConnected", (p: any) => {
          setParticipants(prev => [...prev, p.identity]);
          // Attach remote tracks
          p.tracks.forEach((pub: any) => { if (pub.track && remoteContainerRef.current) attachTrack(pub.track); });
          p.on("trackSubscribed", (track: any) => { if (remoteContainerRef.current) attachTrack(track); });
        });
        room.on("participantDisconnected", (p: any) => {
          setParticipants(prev => prev.filter(id => id !== p.identity));
        });
      } catch (e) {
        console.error("Twilio Video:", e);
        // Fallback: just show local preview
      }

      setActiveRoom(rId || rName);
      setRoomName(rName);
      setInCall(true);
    } catch (err) {
      console.error("Join room:", err);
    }
    setJoining(false);
  };

  const attachTrack = (track: any) => {
    if (!remoteContainerRef.current) return;
    const el = track.attach();
    el.style.width = "100%";
    el.style.borderRadius = "8px";
    remoteContainerRef.current.appendChild(el);
  };

  const leaveRoom = () => {
    if (twilioRoom) { twilioRoom.disconnect(); setTwilioRoom(null); }
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setInCall(false); setActiveRoom(null); setRoomName(""); setParticipants([]);
  };

  const toggleMic = () => {
    if (localStream.current) localStream.current.getAudioTracks().forEach(t => { t.enabled = !micOn; });
    if (twilioRoom) twilioRoom.localParticipant.audioTracks.forEach((pub: any) => { micOn ? pub.track.disable() : pub.track.enable(); });
    setMicOn(p => !p);
  };

  const toggleCam = () => {
    if (localStream.current) localStream.current.getVideoTracks().forEach(t => { t.enabled = !camOn; });
    if (twilioRoom) twilioRoom.localParticipant.videoTracks.forEach((pub: any) => { camOn ? pub.track.disable() : pub.track.enable(); });
    setCamOn(p => !p);
  };

  const sendNotification = async () => {
    if (!notifyPhone) return;
    const msg = notifyMsg || `${currentUser.name} started a huddle "${roomName}" on TeamBase. Join: ${window.location.origin}/huddle`;
    await fetch("/api/twilio/notify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sms", to: notifyPhone, message: msg }),
    });
    setNotifySent(true); setTimeout(() => setNotifySent(false), 3000);
  };

  // Active call UI
  if (inCall) {
    return (
      <div style={{ position:"fixed", inset:0, zIndex:150, display:"flex", flexDirection:"column", background:"hsl(var(--charcoal))" }}>
        {/* Call header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:"1.1rem", color:"white" }}>🎙️ {roomName}</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.7rem", color:"rgba(255,255,255,0.5)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
              {formatDuration(callDuration)} · {participants.length + 1} participant{participants.length !== 0 ? "s" : ""}
            </div>
          </div>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            {/* Notify via Twilio SMS */}
            <div style={{ display:"flex", gap:6 }}>
              <input type="tel" value={notifyPhone} onChange={e=>setNotifyPhone(e.target.value)} placeholder="Invite via SMS (+1...)" style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:6, padding:"4px 10px", color:"white", fontSize:"0.75rem", width:180 }} />
              <button onClick={sendNotification} style={{ background:notifySent?"hsl(142 71% 38%)":"hsl(var(--crimson))", border:"none", borderRadius:6, padding:"4px 12px", color:"white", cursor:"pointer", fontSize:"0.72rem", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:"0.06em" }}>
                {notifySent ? "✓ Sent!" : <><Bell size={12}/> Invite</>}
              </button>
            </div>
          </div>
        </div>

        {/* Video grid */}
        <div style={{ flex:1, display:"grid", gridTemplateColumns: participants.length > 0 ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr", gap:12, padding:16, overflow:"hidden" }}>
          {/* Local video */}
          <div style={{ position:"relative", background:"hsl(0 0% 8%)", borderRadius:12, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", minHeight:200 }}>
            <video ref={localVideoRef} muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)", display: camOn ? "block" : "none" }} />
            {!camOn && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <div style={{ width:60, height:60, borderRadius:"50%", background:"hsl(var(--crimson))", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:"1.5rem", color:"white" }}>
                  {currentUser.name[0].toUpperCase()}
                </div>
                <span style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.75rem" }}>{currentUser.name}</span>
              </div>
            )}
            <div style={{ position:"absolute", bottom:8, left:8, background:"rgba(0,0,0,0.6)", borderRadius:6, padding:"2px 8px", fontSize:"0.7rem", color:"white", fontFamily:"'Barlow Condensed',sans-serif" }}>
              {currentUser.name} (You){!micOn && " 🔇"}
            </div>
          </div>

          {/* Remote participants */}
          <div ref={remoteContainerRef} style={{ display:"contents" }} />

          {participants.length === 0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, background:"hsl(0 0% 8%)", borderRadius:12, padding:32 }}>
              <Users size={40} style={{ color:"rgba(255,255,255,0.3)" }} />
              <div style={{ textAlign:"center" }}>
                <p style={{ color:"rgba(255,255,255,0.6)", fontFamily:"'Barlow',sans-serif", fontSize:"0.9rem" }}>Waiting for others to join…</p>
                <p style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.75rem", marginTop:4 }}>Send an SMS invite with the form above</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls — fixed at bottom so always visible */}
        <div style={{ 
          display:"flex", alignItems:"center", justifyContent:"center", gap:16, 
          padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.15)",
          background:"hsl(0 0% 6%)", flexShrink:0,
        }}>
          <button onClick={toggleMic} title={micOn ? "Mute mic" : "Unmute mic"} style={{ width:52, height:52, borderRadius:"50%", background:micOn?"rgba(255,255,255,0.15)":"hsl(var(--crimson))", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", transition:"background 0.15s" }}>
            {micOn ? <Mic size={22}/> : <MicOff size={22}/>}
          </button>
          <button onClick={toggleCam} title={camOn ? "Turn off camera" : "Turn on camera"} style={{ width:52, height:52, borderRadius:"50%", background:camOn?"rgba(255,255,255,0.15)":"hsl(var(--crimson))", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", transition:"background 0.15s" }}>
            {camOn ? <Video size={22}/> : <VideoOff size={22}/>}
          </button>
          <button onClick={leaveRoom} title="End call" style={{ width:64, height:64, borderRadius:"50%", background:"hsl(0 72% 50%)", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"white", gap:2 }}>
            <PhoneOff size={22}/>
            <span style={{ fontSize:"0.5rem", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:"0.06em" }}>END</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1 }}>
      <TopBar
        title="Huddle"
        subtitle="Video & voice rooms"
        right={
          <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize:"0.72rem" }}>
            <Plus size={13}/> Start Huddle
          </button>
        }
      />
      <div className="page-content space-y-5">
        {/* Quick start */}
        <div className="card-base p-5 flex flex-col sm:flex-row items-center gap-5">
          <div style={{ fontSize:"3rem", flexShrink:0 }}>🎙️</div>
          <div className="flex-1">
            <div className="heading-sm mb-1">Start an instant huddle</div>
            <p className="text-sm text-muted-foreground" style={{ fontFamily:"'Barlow',sans-serif" }}>
              Start a video or voice call with your team. Invite anyone via SMS through Twilio.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0 flex-wrap justify-center">
            <button onClick={() => { setNewRoomName(`huddle-${Date.now().toString(36)}`); setShowCreate(true); }} className="btn-outline">
              <Phone size={14}/> Voice
            </button>
            <button onClick={() => { setNewRoomName(`video-${Date.now().toString(36)}`); setShowCreate(true); }} className="btn-primary">
              <Video size={14}/> Video Call
            </button>
          </div>
        </div>

        {/* Room list */}
        <div className="card-base overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="heading-sm">Recent Rooms</h2>
          </div>
          {rooms.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No huddles yet. Start one!</div>
          ) : (
            <div>
              {rooms.map(room => (
                <div key={room.id} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/10">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: room.status==="active" ? "hsl(142 71% 38%/0.15)" : "hsl(var(--muted))" }}>
                    {room.status==="active" ? <Video size={18} style={{ color:"hsl(142 71% 38%)" }}/> : <Phone size={18} className="text-muted-foreground"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{room.name}</p>
                    <p className="label-caps" style={{ fontSize:"0.58rem" }}>
                      Started by {room.creatorName} · {new Date(room.startedAt).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="label-caps px-2 py-0.5 rounded" style={{
                      background: room.status==="active" ? "hsl(142 71% 38%/0.1)" : "hsl(var(--muted))",
                      color: room.status==="active" ? "hsl(142 71% 38%)" : "hsl(var(--muted-foreground))",
                      fontSize:"0.58rem"
                    }}>{room.status==="active" ? "● Live" : "Ended"}</span>
                    <button onClick={() => joinRoom(room.name, room.id)} disabled={joining}
                      className="btn-outline" style={{ fontSize:"0.65rem", padding:"0.3rem 0.75rem" }}>
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Twilio SMS notifier */}
        <div className="card-base p-5">
          <div className="heading-sm mb-3 flex items-center gap-2"><Bell size={15} style={{ color:"hsl(var(--crimson))" }}/> Twilio Notifications</div>
          <p className="text-sm text-muted-foreground mb-4" style={{ fontFamily:"'Barlow',sans-serif" }}>
            Send SMS reminders for tasks or meetings via Twilio. Works with any phone number.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="field-label">Phone Number</label><input type="tel" value={notifyPhone} onChange={e=>setNotifyPhone(e.target.value)} className="field-input" placeholder="+1 (555) 000-0000" /></div>
              <div><label className="field-label">Custom Message (optional)</label><input type="text" value={notifyMsg} onChange={e=>setNotifyMsg(e.target.value)} className="field-input" placeholder="TeamBase notification…" /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={async () => {
                const msg = notifyMsg || "TeamBase: You have a pending task or meeting. Visit teambase.up.railway.app";
                await fetch("/api/twilio/notify", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ type:"sms", to:notifyPhone, message:msg }) });
                setNotifySent(true); setTimeout(()=>setNotifySent(false), 3000);
              }} className="btn-primary" disabled={!notifyPhone}>
                <Send size={13}/> {notifySent ? "✓ Sent!" : "Send SMS"}
              </button>
              <button onClick={async () => {
                const msg = notifyMsg || "Hello! You have a pending item on TeamBase. Please check your dashboard at teambase dot up dot railway dot app.";
                await fetch("/api/twilio/notify", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ type:"call", to:notifyPhone, message:msg }) });
                setNotifySent(true); setTimeout(()=>setNotifySent(false), 3000);
              }} className="btn-outline" disabled={!notifyPhone}>
                <Phone size={13}/> Make Call
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create room modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="heading-md">Start Huddle</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X size={18}/></button>
            </div>
            <div>
              <label className="field-label">Room Name</label>
              <input autoFocus type="text" value={newRoomName} onChange={e=>setNewRoomName(e.target.value.toLowerCase().replace(/\s+/g,"-"))} className="field-input" placeholder="e.g. design-review" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-outline flex-1">Cancel</button>
              <button onClick={async () => {
                setShowCreate(false);
                // Save room to DB
                await fetch("/api/huddle/room", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name: newRoomName }) }).catch(()=>{});
                await joinRoom(newRoomName);
              }} className="btn-primary flex-1" disabled={!newRoomName}>
                🎙️ Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
