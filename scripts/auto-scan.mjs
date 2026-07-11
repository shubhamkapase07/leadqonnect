// Scheduled auto-scan (replaces the scheduledScan Cloud Function). Runs on GitHub Actions cron.
// For every campaign with autoScan=true belonging to a paid user, scrape Reddit (free engine),
// score deterministically, dedupe, and write new leads into that user's workspace.
// Run: node --env-file-if-exists=.env.local --import tsx scripts/auto-scan.mjs
import { db, nowSec } from "../api/_lib/turso.ts";
import { searchReddit } from "../api/_lib/reddit.ts";
import { scoreLead } from "../api/_lib/scoring.ts";

const PAID = new Set(["premium", "agency", "trial"]);
const relTime = (utc) => {
  if (!utc) return "recently";
  const d = Math.floor(Date.now() / 1000 - utc);
  if (d < 60) return "Just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

const client = db();

// All campaigns across all users.
const campRows = await client.execute("SELECT user_id, doc_id, json FROM workspace_docs WHERE collection='campaigns'");
let scanned = 0, added = 0;

// Cache user plans.
const planCache = new Map();
async function planOf(uid) {
  if (planCache.has(uid)) return planCache.get(uid);
  const r = await client.execute({ sql: "SELECT plan FROM users WHERE uid=?", args: [uid] });
  const plan = r.rows[0]?.plan || "free";
  planCache.set(uid, plan);
  return plan;
}

for (const row of campRows.rows) {
  const uid = row.user_id;
  let c;
  try { c = JSON.parse(row.json); } catch { continue; }
  if (!c.autoScan || c.status === "paused") continue;
  if (!(c.platforms?.length) || !(c.keywords?.length)) continue;
  if (!PAID.has(await planOf(uid))) continue;
  if (!c.platforms.includes("reddit")) continue; // only reddit has a free source

  // Existing lead ids for dedupe.
  const existing = await client.execute({ sql: "SELECT doc_id FROM workspace_docs WHERE user_id=? AND collection='leads'", args: [uid] });
  const seen = new Set(existing.rows.map((r) => String(r.doc_id)));
  const sets = [];

  for (const keyword of c.keywords) {
    let posts = [];
    try { posts = await searchReddit(keyword, c.autoScanTimeframe || "week"); } catch { continue; }
    for (const post of posts) {
      const id = `l_reddit_${post.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const scores = scoreLead(`${post.title}\n${post.text}`, {
        keywords: c.keywords, serviceOffered: c.serviceOffered, industry: c.industry, geography: c.geography,
      });
      if (scores.sentiment === "low") continue; // matches the app's non-strict default
      const lead = {
        id, platform: "reddit", author: post.author, handle: post.author, title: post.title,
        content: post.text || post.title, timestamp: relTime(post.createdUtc), createdUtc: post.createdUtc,
        sentiment: scores.sentiment, keywords: [keyword], subreddit: post.subreddit || null, status: "potential",
        campaignId: c.id, postUrl: post.postUrl, intentScore: scores.intentScore,
        leadQualityScore: scores.leadQualityScore, industryMatchScore: scores.industryMatchScore,
        geography: c.geography || "Remote", createdAt: new Date().toISOString(), source: "auto",
      };
      sets.push({ sql: `INSERT INTO workspace_docs (user_id, collection, doc_id, json, updated_at) VALUES (?,?,?,?,?)
                        ON CONFLICT (user_id, collection, doc_id) DO NOTHING`,
                  args: [uid, "leads", id, JSON.stringify(lead), nowSec()] });
    }
  }
  if (sets.length) { await client.batch(sets, "write"); added += sets.length; }
  scanned++;
}

console.log(`[auto-scan] done — ${scanned} campaigns scanned, ${added} new leads.`);
process.exit(0);
