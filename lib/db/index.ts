import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { _db: DB | undefined };

export function getDb(): DB {
  if (!globalForDb._db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const conn = postgres(url, {
      max: process.env.NODE_ENV === "production" ? 10 : 1,
      ssl: process.env.NODE_ENV === "production" ? "require" : false,
    });
    globalForDb._db = drizzle(conn, { schema });
  }
  return globalForDb._db;
}

// Convenience: most files can import `db` directly.
// Accessing any method triggers the lazy init — safe at runtime, skipped at build time.
export const db = new Proxy({} as DB, {
  get(_, prop: string | symbol) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
