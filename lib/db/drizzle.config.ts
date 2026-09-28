import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

// Load .env automatically if available in root or current directory
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in .env to run migrations.");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("supabase") || process.env.DATABASE_URL.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  },
});
