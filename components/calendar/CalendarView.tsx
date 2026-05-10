"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Link as LinkIcon } from "lucide-react";
import { createEvent, deleteEvent } from "@/lib/actions/calendar";
import { TopBar } from "@/components/layout/TopBar";

interface CalEvent {
  id: string; title: string; description: string | null;
  startAt: Date; endAt: Date; allDay: boolean | null;
  color: string | null; isTask: boolean; taskId: string | null;
}

const COLOR_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  crimson: { bg:"hsl(352 80% 42%/0.12)", text:"hsl(352 80% 35%)", dot:"hsl(352 80% 42%)" },
  blue:    { bg:"hsl(200 80% 42%/0.12)", text:"hsl(200 80% 35%)", dot:"hsl(200 80% 42%)" },
  green:   { bg:"hsl(142 71% 38%/0.12)", text:"hsl(142 71% 30%)", dot:"hsl(142 71% 38%)" },
  amber:   { bg:"hsl(38 90% 48%/0.12)",  text:"hsl(38 90% 38%)",  dot:"hsl(38 90% 48%)" },
  purple:  { bg:"hsl(270 65% 52%/0.12)", text:"hsl(270 65% 42%)", dot:"hsl(270 65% 52%)" },
};
const COLORS = ["crimson","blue","green","amber","purple"] as const;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarView({ events, currentUser }: {
  events: CalEvent[];
  currentUser: { id: string; name: string };
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newColor, setNewColor] = useState<typeof COLORS[number]>("blue");
  const [newAllDay, setNewAllDay] = useState(false);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };

  // Group events by day
  const eventsByDay: Record<number, CalEvent[]> = {};
  for (const ev of events) {
    const d = new Date(ev.startAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  }

  const handleDayClick = (day: number) => {
    const d = new Date(year, month, day);
    setSelectedDate(d);
    const iso = d.toISOString().slice(0,10);
    setNewStart(iso + "T09:00");
    setNewEnd(iso + "T10:00");
    setShowAdd(true);
  };

  const handleAddEvent = async () => {
    if (!newTitle.trim()) return;
    await createEvent({ title:newTitle, description:newDesc, startAt:newStart, endAt:newEnd, allDay:newAllDay, color:newColor });
    setShowAdd(false); setNewTitle(""); setNewDesc(""); setSelectedDate(null);
    window.location.reload();
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith("task-")) return;
    await deleteEvent(id);
    setSelectedEvent(null);
    window.location.reload();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <TopBar
        title="Calendar"
        subtitle={`${MONTHS[month]} ${year}`}
        right={
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="btn-outline p-1.5"><ChevronLeft size={16}/></button>
            <button onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }} className="btn-outline" style={{ fontSize:"0.68rem", padding:"0.3rem 0.6rem" }}>Today</button>
            <button onClick={nextMonth} className="btn-outline p-1.5"><ChevronRight size={16}/></button>
            <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ fontSize:"0.72rem" }}><Plus size={13}/> Add Event</button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto page-content pt-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2 sticky top-0 bg-background py-2">
          {DAYS.map(d => (
            <div key={d} className="text-center label-caps" style={{ fontSize:"0.65rem" }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells */}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="min-h-24 rounded" style={{ background:"hsl(var(--muted)/0.2)" }} />)}
          
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const dayEvents = eventsByDay[day] || [];
            return (
              <div key={day}
                onClick={() => handleDayClick(day)}
                className="min-h-24 rounded p-1.5 cursor-pointer hover:bg-muted/20 transition-colors relative"
                style={{ background:"hsl(var(--card))", border:`1px solid ${isToday ? "hsl(var(--crimson))" : "hsl(var(--border))"}`, boxShadow: isToday ? "0 0 0 1px hsl(var(--crimson)/0.3)" : "none" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:"0.85rem", lineHeight:1, marginBottom:4,
                  color: isToday ? "hsl(var(--crimson))" : "hsl(var(--foreground))" }}>
                  {day}
                  {isToday && <span className="w-1.5 h-1.5 rounded-full inline-block ml-1 mb-0.5" style={{ background:"hsl(var(--crimson))" }} />}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0,3).map(ev => {
                    const cm = COLOR_MAP[ev.color||"blue"] || COLOR_MAP.blue;
                    return (
                      <div key={ev.id}
                        onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                        className="truncate rounded px-1.5 py-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background:cm.bg, color:cm.text, fontSize:"0.65rem", fontFamily:"'Barlow',sans-serif", fontWeight:500 }}>
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="label-caps" style={{ fontSize:"0.55rem", opacity:0.6 }}>+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Event Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="heading-md">Add Event</h2>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X size={18}/></button>
            </div>
            <div><label className="field-label">Title *</label><input autoFocus type="text" value={newTitle} onChange={e=>setNewTitle(e.target.value)} className="field-input" placeholder="Event title…" /></div>
            <div><label className="field-label">Description</label><textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="field-input resize-none" rows={2} placeholder="Optional details…" /></div>
            <div className="flex items-center gap-2 my-1">
              <input type="checkbox" id="allDay" checked={newAllDay} onChange={e=>setNewAllDay(e.target.checked)} />
              <label htmlFor="allDay" className="field-label" style={{ marginBottom:0 }}>All day</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="field-label">Start</label><input type={newAllDay?"date":"datetime-local"} value={newStart} onChange={e=>setNewStart(e.target.value)} className="field-input" /></div>
              <div><label className="field-label">End</label><input type={newAllDay?"date":"datetime-local"} value={newEnd} onChange={e=>setNewEnd(e.target.value)} className="field-input" /></div>
            </div>
            <div>
              <label className="field-label">Color</label>
              <div className="flex gap-2 mt-1">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{ background:COLOR_MAP[c].dot, outline: newColor===c ? `3px solid ${COLOR_MAP[c].dot}` : "3px solid transparent", outlineOffset:2 }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAdd(false)} className="btn-outline">Cancel</button>
              <button onClick={handleAddEvent} className="btn-primary"><Plus size={13}/> Add Event</button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="card-base p-6 w-full max-w-sm space-y-3" onClick={e=>e.stopPropagation()}>
            {(() => { const cm = COLOR_MAP[selectedEvent.color||"blue"]||COLOR_MAP.blue; return (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background:cm.dot }} />
                      <h3 className="heading-sm text-foreground">{selectedEvent.title}</h3>
                    </div>
                    <p className="label-caps" style={{ fontSize:"0.6rem" }}>
                      {new Date(selectedEvent.startAt).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:true})}
                    </p>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="text-muted-foreground hover:text-foreground"><X size={16}/></button>
                </div>
                {selectedEvent.description && <p className="text-sm" style={{ fontFamily:"'Barlow',sans-serif", color:"hsl(var(--muted-foreground))" }}>{selectedEvent.description}</p>}
                {selectedEvent.taskId && !selectedEvent.id.startsWith("task-") && (
                  <a href={`/tasks/${selectedEvent.taskId}`} className="label-caps flex items-center gap-1" style={{ color:"hsl(var(--crimson))", fontSize:"0.6rem" }}>
                    <LinkIcon size={10}/> View linked task
                  </a>
                )}
                {selectedEvent.isTask && (
                  <a href={`/tasks/${selectedEvent.taskId}`} className="btn-outline w-full justify-center text-sm">
                    View Task
                  </a>
                )}
                {!selectedEvent.isTask && !selectedEvent.id.startsWith("task-") && (
                  <button onClick={() => handleDelete(selectedEvent.id)} className="w-full label-caps text-center py-2 rounded hover:bg-muted/30 transition-colors" style={{ color:"hsl(0 60% 45%)", fontSize:"0.62rem" }}>
                    Delete Event
                  </button>
                )}
              </>
            );})()}
          </div>
        </div>
      )}
    </div>
  );
}
