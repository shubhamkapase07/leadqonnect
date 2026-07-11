// CLI entry — this is what the GitHub Actions cron (and `npm run scan`) runs.
// Reads config/watch.json, runs one scan, exits non-zero on hard failure.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runScan, type WatchConfig } from "./scan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = process.env.WATCH_CONFIG || join(__dirname, "..", "config", "watch.json");

function loadConfig(): WatchConfig {
  const raw = JSON.parse(readFileSync(configPath, "utf8"));
  const queries = (raw.queries || []).filter((q: any) => q && q.keyword);
  if (!queries.length) throw new Error(`No queries in ${configPath} — add at least one keyword.`);
  return {
    campaign: raw.campaign || {},
    queries: queries.map((q: any) => ({
      keyword: String(q.keyword),
      subreddit: q.subreddit ? String(q.subreddit) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    })),
  };
}

try {
  const config = loadConfig();
  await runScan(config);
  process.exit(0);
} catch (err) {
  console.error("[scan] fatal:", (err as Error).message);
  process.exit(1);
}
