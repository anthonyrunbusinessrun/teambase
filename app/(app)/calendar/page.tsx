import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { calendarEvents, tasks, users } from "@/lib/db/schema";
import { and, gte, lte, ne, isNotNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { CalendarView } from "@/components/calendar/CalendarView";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Fetch events for current month +/- 1
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const [events, tasksDue] = await Promise.all([
    db.select({
      id: calendarEvents.id, title: calendarEvents.title,
      description: calendarEvents.description, startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt, allDay: calendarEvents.allDay,
      color: calendarEvents.color, taskId: calendarEvents.taskId,
      createdBy: calendarEvents.createdBy,
    }).from(calendarEvents)
      .where(and(gte(calendarEvents.startAt, from), lte(calendarEvents.startAt, to))),
    db.select({
      id: tasks.id, title: tasks.title, dueDate: tasks.dueDate,
      status: tasks.status, priority: tasks.priority,
    }).from(tasks)
      .where(and(isNotNull(tasks.dueDate), ne(tasks.status, "done"), ne(tasks.status, "cancelled")))
      .limit(100),
  ]);

  // Map tasks to calendar items
  const taskEvents = tasksDue
    .filter(t => t.dueDate)
    .map(t => ({
      id: `task-${t.id}`, title: `📋 ${t.title}`,
      description: `Task due · Priority: ${t.priority}`,
      startAt: t.dueDate!, endAt: t.dueDate!,
      allDay: false, color: t.priority === "urgent" ? "crimson" : t.priority === "high" ? "amber" : "blue",
      isTask: true, taskId: t.id,
    }));

  return (
    <CalendarView
      events={[...events.map(e => ({ ...e, isTask: false, taskId: e.taskId || null })), ...taskEvents]}
      currentUser={{ id: session.user.id, name: session.user.name || "" }}
    />
  );
}
