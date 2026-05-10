import { db } from "@/lib/db";
import { twilioLogs } from "@/lib/db/schema";

const ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID  || "";
const AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN    || "";
const TWILIO_PHONE  = process.env.TWILIO_PHONE_NUMBER  || "+1";

async function twilioPost(endpoint: string, body: Record<string, string>) {
  const creds = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/${endpoint}.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    }
  );
  return res.json();
}

export async function sendSMS(to: string, body: string, userId?: string) {
  try {
    const data = await twilioPost("Messages", { To: to, From: TWILIO_PHONE, Body: body });
    await db.insert(twilioLogs).values({
      type: "sms", to, from: TWILIO_PHONE, body,
      status: data.status === "queued" || data.status === "sent" ? "sent" : "failed",
      twilioSid: data.sid, error: data.message, userId,
    });
    return { ok: true, sid: data.sid };
  } catch (err) {
    await db.insert(twilioLogs).values({ type: "sms", to, body, status: "failed", error: String(err), userId });
    return { ok: false, error: String(err) };
  }
}

export async function makeCall(to: string, message: string, userId?: string) {
  try {
    const twiml = `<Response><Say voice="alice">${message}</Say></Response>`;
    const data = await twilioPost("Calls", {
      To: to, From: TWILIO_PHONE,
      Twiml: twiml,
    });
    await db.insert(twilioLogs).values({
      type: "call", to, from: TWILIO_PHONE, body: message,
      status: data.status === "queued" ? "sent" : "failed",
      twilioSid: data.sid, error: data.message, userId,
    });
    return { ok: true, sid: data.sid };
  } catch (err) {
    await db.insert(twilioLogs).values({ type: "call", to, body: message, status: "failed", error: String(err), userId });
    return { ok: false, error: String(err) };
  }
}

// Task due notification
export async function notifyTaskDue(phone: string, taskTitle: string, hoursUntil: number, userId?: string) {
  const msg = hoursUntil <= 0
    ? `TeamBase Alert: "${taskTitle}" is OVERDUE. Please check your tasks at teambase.up.railway.app`
    : `TeamBase Reminder: "${taskTitle}" is due in ${hoursUntil} hour${hoursUntil !== 1 ? "s" : ""}. teambase.up.railway.app`;
  return sendSMS(phone, msg, userId);
}

// Meeting/huddle notification
export async function notifyHuddle(phone: string, roomName: string, creatorName: string, userId?: string) {
  return sendSMS(phone, `${creatorName} started a huddle "${roomName}" on TeamBase. Join: teambase.up.railway.app/huddle`, userId);
}
