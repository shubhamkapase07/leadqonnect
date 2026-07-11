// One-time (idempotent) DB setup: applies db/schema.sql to your Turso database.
// Run:  npm run init-db
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "./turso.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");

// Drop full-line comments first, THEN split on ';' — otherwise a statement that
// begins with a comment line would be filtered out whole.
const schema = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const client = db();
for (const sql of statements) {
  await client.execute(sql);
}
console.log(`✅ Applied ${statements.length} statements to Turso.`);
process.exit(0);
