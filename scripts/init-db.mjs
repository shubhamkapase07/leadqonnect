// Apply api/_lib/schema.sql to the Turso database. Idempotent. Run: npm run db:init
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@libsql/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "..", "api", "_lib", "schema.sql"), "utf8");

// Strip full-line comments, then split on ';'.
const statements = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) { console.error("TURSO_DATABASE_URL not set"); process.exit(1); }

const client = createClient({ url, authToken });
for (const sql of statements) await client.execute(sql);
console.log(`✅ Applied ${statements.length} statements to Turso.`);
process.exit(0);
