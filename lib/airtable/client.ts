import Airtable from "airtable";
import { env } from "@/lib/env";

// ── Singleton client ──────────────────────────────────────────────────────

let _base: Airtable.Base | null = null;

function getBase(): Airtable.Base {
  if (!_base) {
    Airtable.configure({
      apiKey: env.AIRTABLE_API_KEY,
      requestTimeout: 30000,
    });
    _base = Airtable.base(env.AIRTABLE_BASE_ID);
  }
  return _base;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface AirtableRecord<T extends Record<string, unknown>> {
  id: string;
  fields: T;
  createdTime: string;
}

export interface FetchOptions {
  maxRecords?: number;
  filterByFormula?: string;
  sort?: Array<{ field: string; direction?: "asc" | "desc" }>;
  fields?: string[];
  view?: string;
}

// ── Core fetch with retry + pagination ───────────────────────────────────

const RETRY_DELAYS = [500, 1000, 2000]; // ms

async function withRetry<T>(
  fn: () => Promise<T>,
  attempt = 0
): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    const isRateLimit = error?.statusCode === 429;
    const isRetryable = isRateLimit || error?.statusCode === 503;

    if (isRetryable && attempt < RETRY_DELAYS.length) {
      const delay = isRateLimit
        ? RETRY_DELAYS[attempt] * 2 // back off harder on rate limits
        : RETRY_DELAYS[attempt];
      await new Promise((r) => setTimeout(r, delay));
      return withRetry(fn, attempt + 1);
    }

    throw new AirtableError(
      error?.message ?? "Airtable request failed",
      error?.statusCode
    );
  }
}

export class AirtableError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "AirtableError";
  }
}

// ── Generic table fetcher ─────────────────────────────────────────────────

export async function fetchAll<T extends Record<string, unknown>>(
  tableName: string,
  options: FetchOptions = {}
): Promise<AirtableRecord<T>[]> {
  return withRetry(async () => {
    const records: AirtableRecord<T>[] = [];
    const base = getBase();

    await new Promise<void>((resolve, reject) => {
      base(tableName)
        .select({
          maxRecords: options.maxRecords ?? 1000,
          filterByFormula: options.filterByFormula,
          sort: options.sort,
          fields: options.fields,
          view: options.view,
          pageSize: 100,
        })
        .eachPage(
          (pageRecords, fetchNextPage) => {
            for (const record of pageRecords) {
              records.push({
                id: record.id,
                fields: record.fields as T,
                createdTime: record._rawJson.createdTime,
              });
            }
            fetchNextPage();
          },
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
    });

    return records;
  });
}

export async function fetchOne<T extends Record<string, unknown>>(
  tableName: string,
  recordId: string
): Promise<AirtableRecord<T>> {
  return withRetry(async () => {
    const base = getBase();
    const record = await base(tableName).find(recordId);
    return {
      id: record.id,
      fields: record.fields as T,
      createdTime: record._rawJson.createdTime,
    };
  });
}

export async function createRecord<T extends Record<string, unknown>>(
  tableName: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  return withRetry(async () => {
    const base = getBase();
    const record = await base(tableName).create(fields as Record<string, unknown>);
    return {
      id: record.id,
      fields: record.fields as T,
      createdTime: record._rawJson.createdTime,
    };
  });
}

export async function updateRecord<T extends Record<string, unknown>>(
  tableName: string,
  recordId: string,
  fields: Partial<T>
): Promise<AirtableRecord<T>> {
  return withRetry(async () => {
    const base = getBase();
    const record = await base(tableName).update(recordId, fields as Record<string, unknown>);
    return {
      id: record.id,
      fields: record.fields as T,
      createdTime: record._rawJson.createdTime,
    };
  });
}
