import postgres from "postgres";

// Shared connection pool — reused across all API requests
const globalPg = globalThis as any;

export function getPg() {
  if (!globalPg._pg) {
    globalPg._pg = postgres(process.env.DATABASE_URL!, {
      ssl: "require",
      max: 10,           // Pool of 10 connections
      idle_timeout: 20,  // Close idle connections after 20s
      connect_timeout: 10,
    });
  }
  return globalPg._pg as postgres.Sql;
}
