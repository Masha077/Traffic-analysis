import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// Automatically load .env if available
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === "function") {
    try {
      (process as any).loadEnvFile(envPath);
    } catch {
      // ignore
    }
  }
}

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function getPool(): pg.Pool | null {
  if (!isDbAvailable()) {
    return null;
  }
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 4000,
      ssl: process.env.DATABASE_URL?.includes("supabase") || process.env.DATABASE_URL?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return poolInstance;
}

export function getDb(): NodePgDatabase<typeof schema> | null {
  if (!isDbAvailable()) {
    return null;
  }
  if (!dbInstance) {
    const pool = getPool();
    if (pool) {
      dbInstance = drizzle(pool, { schema });
    }
  }
  return dbInstance;
}

// Proxied db export for backward compatibility and clean ergonomics
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const activeDb = getDb();
    if (!activeDb) {
      throw new Error(
        "DATABASE_URL is not set or invalid. Please provide your Supabase connection string (starting with postgresql://) in .env to use the database.",
      );
    }
    return (activeDb as unknown as Record<string, unknown>)[prop as string];
  },
});

export const isDbAvailable = (): boolean =>
  Boolean(
    process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith("postgres://") ||
     process.env.DATABASE_URL.startsWith("postgresql://")),
  );

export * from "./schema";
