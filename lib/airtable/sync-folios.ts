/**
 * Bidirectional Airtable <-> PostgreSQL sync for Folios.
 * 
 * Airtable → Postgres: fetchAndCacheFolios()
 * Postgres → Airtable: pushLocalChanges()
 */
import { db } from "@/lib/db";
import { airtableFolios, airtableSyncLogs, airtableCache } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchAll, createRecord, updateRecord } from "./client";

const BASE_ID = process.env.AIRTABLE_BASE_ID!;
// The specific Folios table and view from the provided URL
const FOLIOS_TABLE_ID = "tblhifrn7wgf31Ryx";
const FOLIOS_VIEW_ID  = "viwp5Ojc7265hG56y";

// ── Field name normalizer (handles whatever Airtable returns) ─────────────

function pick(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (fields[k] !== undefined && fields[k] !== null && fields[k] !== "") {
      const v = fields[k];
      if (Array.isArray(v)) return v.join(", ");
      return String(v);
    }
  }
  return "";
}

function pickNum(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = fields[k];
    if (typeof v === "number" && !isNaN(v)) return String(v);
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v.replace(/[$,]/g, ""));
      if (!isNaN(n)) return String(n);
    }
  }
  return "";
}

function normalizeStatus(s: string): string {
  const lower = (s || "").toLowerCase();
  if (lower.includes("active") || lower.includes("progress") || lower.includes("current")) return "Active";
  if (lower.includes("complete") || lower.includes("done") || lower.includes("finish")) return "Complete";
  if (lower.includes("hold") || lower.includes("pause")) return "On Hold";
  if (lower.includes("cancel")) return "Cancelled";
  if (lower.includes("prospect") || lower.includes("pending") || lower.includes("proposal")) return "Prospect";
  return s || "Unknown";
}

// ── PULL: Airtable → Postgres ─────────────────────────────────────────────

export async function fetchAndCacheFolios(): Promise<{ synced: number; errors: string[] }> {
  const logId = crypto.randomUUID();
  const errors: string[] = [];

  await db.insert(airtableSyncLogs).values({
    id: logId, syncType: "folios", status: "running",
  });

  try {
    const records = await fetchAll<Record<string, unknown>>(FOLIOS_TABLE_ID, {
      view: FOLIOS_VIEW_ID,
      maxRecords: 500,
    });

    let synced = 0;
    for (const record of records) {
      const f = record.fields;
      try {
        const row = {
          id: record.id,
          baseId: BASE_ID,
          tableId: FOLIOS_TABLE_ID,
          name: pick(f, "Name", "Folio Name", "Project Name", "Title"),
          client: pick(f, "Client", "Client Name", "Company", "Account"),
          status: normalizeStatus(pick(f, "Status", "Stage", "Phase")),
          category: pick(f, "Category", "Type", "Folio Type", "Service Type"),
          startDate: pick(f, "Start Date", "Start", "Date Started", "Contract Start"),
          endDate: pick(f, "End Date", "End", "Due Date", "Contract End", "Completion Date"),
          manager: pick(f, "Project Manager", "Manager", "Account Manager", "Lead", "Owner"),
          contractValue: pickNum(f, "Contract Value", "Value", "Budget", "Revenue", "Total", "Amount"),
          percentComplete: pickNum(f, "% Complete", "Percent Complete", "Progress", "Completion"),
          type: pick(f, "Type", "Folio Type", "Category", "Service"),
          priority: pick(f, "Priority", "Urgency", "Importance"),
          description: pick(f, "Description", "Notes", "Details", "Summary"),
          tags: JSON.stringify(Array.isArray(f.Tags) ? f.Tags : Array.isArray(f.Labels) ? f.Labels : []),
          rawFields: JSON.stringify(f),
          airtableCreatedAt: record.createdTime,
          synced_at: new Date(),
          locallyModified: false,
          pendingDelete: false,
        };

        await db.insert(airtableFolios).values(row)
          .onConflictDoUpdate({
            target: airtableFolios.id,
            set: { ...row, locallyModified: false, synced_at: new Date() },
          });

        // Also store in generic cache
        await db.insert(airtableCache).values({
          id: `${BASE_ID}:folios:${record.id}`,
          baseId: BASE_ID,
          tableName: "folios",
          recordId: record.id,
          fields: JSON.stringify(f),
          syncedAt: new Date(),
        }).onConflictDoUpdate({
          target: airtableCache.id,
          set: { fields: JSON.stringify(f), syncedAt: new Date() },
        });

        synced++;
      } catch (err) {
        errors.push(`Record ${record.id}: ${String(err)}`);
      }
    }

    await db.update(airtableSyncLogs).set({
      status: "success",
      recordsProcessed: String(synced),
      completedAt: new Date(),
    }).where(eq(airtableSyncLogs.id, logId));

    return { synced, errors };
  } catch (err) {
    await db.update(airtableSyncLogs).set({
      status: "failed", errorMessage: String(err), completedAt: new Date(),
    }).where(eq(airtableSyncLogs.id, logId));
    throw err;
  }
}

// ── PUSH: Postgres → Airtable (locally modified records) ─────────────────

export async function pushLocalChanges(): Promise<{ pushed: number; errors: string[] }> {
  const errors: string[] = [];
  let pushed = 0;

  // Find records that were modified locally
  const modified = await db.select().from(airtableFolios)
    .where(and(
      eq(airtableFolios.locallyModified, true),
      eq(airtableFolios.pendingDelete, false),
    ));

  for (const row of modified) {
    try {
      const fields: Record<string, unknown> = {};
      if (row.status)   fields.Status = row.status;
      if (row.priority) fields.Priority = row.priority;
      if (row.description) fields.Description = row.description;
      if (row.manager)  fields["Project Manager"] = row.manager;

      // Try to push back — uses raw field name map from rawFields
      if (row.rawFields) {
        const raw = JSON.parse(row.rawFields) as Record<string, unknown>;
        // Merge our changes on top of the original field names
        Object.assign(fields, {
          ...(raw.Status !== undefined    ? { Status: row.status } : {}),
          ...(raw.Priority !== undefined  ? { Priority: row.priority } : {}),
        });
      }

      await updateRecord<Record<string, unknown>>(FOLIOS_TABLE_ID, row.id, fields);

      await db.update(airtableFolios).set({
        locallyModified: false, synced_at: new Date(),
      }).where(eq(airtableFolios.id, row.id));

      pushed++;
    } catch (err) {
      errors.push(`${row.id}: ${String(err)}`);
    }
  }

  return { pushed, errors };
}

// ── Generic table sync ────────────────────────────────────────────────────

export async function syncGenericTable(tableNameOrId: string, label: string) {
  const records = await fetchAll<Record<string, unknown>>(tableNameOrId, { maxRecords: 500 });
  let synced = 0;
  for (const record of records) {
    await db.insert(airtableCache).values({
      id: `${BASE_ID}:${label}:${record.id}`,
      baseId: BASE_ID,
      tableName: label,
      recordId: record.id,
      fields: JSON.stringify(record.fields),
      syncedAt: new Date(),
    }).onConflictDoUpdate({
      target: airtableCache.id,
      set: { fields: JSON.stringify(record.fields), syncedAt: new Date() },
    });
    synced++;
  }
  return synced;
}
