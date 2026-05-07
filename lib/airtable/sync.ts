import { db } from "@/lib/db";
import { users, airtableSyncLogs } from "@/lib/db/schema";
import { fetchAll } from "./client";
import { TABLES, type AirtableEmployee } from "./tables";
import { eq } from "drizzle-orm";

// ── Employee sync ─────────────────────────────────────────────────────────

export async function syncEmployees(): Promise<{
  synced: number;
  errors: string[];
}> {
  const logId = crypto.randomUUID();
  const errors: string[] = [];
  let synced = 0;

  // Insert sync log
  await db.insert(airtableSyncLogs).values({
    id: logId,
    syncType: "employees",
    status: "running",
  });

  try {
    const records = await fetchAll<AirtableEmployee>(TABLES.EMPLOYEES, {
      fields: ["Name", "Email", "Role", "Department", "Timezone", "Avatar"],
    });

    for (const record of records) {
      const { fields } = record;
      const email = fields.Email;

      if (!email || typeof email !== "string") continue;

      try {
        const avatarUrl =
          Array.isArray(fields.Avatar) && fields.Avatar.length > 0
            ? fields.Avatar[0].thumbnails?.small?.url ?? fields.Avatar[0].url
            : null;

        await db
          .insert(users)
          .values({
            id: crypto.randomUUID(),
            email: email.toLowerCase(),
            emailVerified: true,
            fullName: String(fields.Name ?? email.split("@")[0]),
            avatarUrl,
            timezone: String(fields.Timezone ?? "UTC"),
            airtableEmployeeId: record.id,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: {
              fullName: String(fields.Name ?? ""),
              avatarUrl,
              timezone: String(fields.Timezone ?? "UTC"),
              airtableEmployeeId: record.id,
              updatedAt: new Date(),
            },
          });

        synced++;
      } catch (err) {
        errors.push(`Employee ${email}: ${String(err)}`);
      }
    }

    await db
      .update(airtableSyncLogs)
      .set({
        status: "success",
        recordsProcessed: String(synced),
        completedAt: new Date(),
      })
      .where(eq(airtableSyncLogs.id, logId));

    return { synced, errors };
  } catch (err) {
    await db
      .update(airtableSyncLogs)
      .set({
        status: "failed",
        errorMessage: String(err),
        completedAt: new Date(),
      })
      .where(eq(airtableSyncLogs.id, logId));

    throw err;
  }
}
