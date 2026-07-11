// Turso / libSQL client + lead persistence.
// Used by both the scanner (Node, via tsx) and the Vercel API functions.

import { createClient, type Client } from "@libsql/client";

export interface LeadRow {
  id: string;
  source: string;
  source_id: string;
  keyword: string;
  subreddit: string;
  author: string;
  title: string;
  body: string;
  url: string;
  created_utc: number;
  intent_score: number;
  quality_score: number;
  match_score: number;
  sentiment: string;
  reasons: string[];
  ai_used: boolean;
  ai_summary: string;
  ai_angle: string;
}

let _client: Client | null = null;

/** Lazily create a single shared client from env. Throws a clear error if unconfigured. */
export function db(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  _client = createClient({ url, authToken });
  return _client;
}

const now = () => Math.floor(Date.now() / 1000);

/**
 * Insert a lead if new; if it already exists (same source+source_id) do nothing.
 * Returns true when a NEW row was created (so callers can count fresh leads).
 * Dedupe is enforced by the UNIQUE(source, source_id) constraint.
 */
export async function insertLeadIfNew(lead: LeadRow): Promise<boolean> {
  const res = await db().execute({
    sql: `INSERT INTO leads (
            id, source, source_id, keyword, subreddit, author, title, body, url,
            created_utc, fetched_at,
            intent_score, quality_score, match_score, sentiment, reasons,
            ai_used, ai_summary, ai_angle, status, note, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT (source, source_id) DO NOTHING`,
    args: [
      lead.id, lead.source, lead.source_id, lead.keyword, lead.subreddit,
      lead.author, lead.title, lead.body, lead.url,
      lead.created_utc, now(),
      lead.intent_score, lead.quality_score, lead.match_score, lead.sentiment,
      JSON.stringify(lead.reasons ?? []),
      lead.ai_used ? 1 : 0, lead.ai_summary, lead.ai_angle, "new", "", now(),
    ],
  });
  return res.rowsAffected > 0;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db().execute({
    sql: `INSERT INTO meta (key, value) VALUES (?, ?)
          ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

export async function getMeta(key: string): Promise<string | null> {
  const res = await db().execute({ sql: `SELECT value FROM meta WHERE key = ?`, args: [key] });
  return res.rows.length ? String(res.rows[0].value) : null;
}

// --- Read/query helpers for the dashboard ----------------------------------------------------

export interface ListLeadsOpts {
  status?: string;      // filter by workflow status
  minIntent?: number;   // minimum intent score
  source?: string;      // filter by platform
  search?: string;      // substring match in title/body/author
  limit?: number;       // page size (default 200)
  sort?: "intent" | "recent"; // ranking
}

/** List leads for the dashboard, filtered + ranked. Uses parameterized SQL (no injection). */
export async function listLeads(opts: ListLeadsOpts = {}): Promise<any[]> {
  const where: string[] = [];
  const args: any[] = [];

  if (opts.status && opts.status !== "all") { where.push("status = ?"); args.push(opts.status); }
  if (opts.source && opts.source !== "all") { where.push("source = ?"); args.push(opts.source); }
  if (typeof opts.minIntent === "number") { where.push("intent_score >= ?"); args.push(opts.minIntent); }
  if (opts.search) {
    where.push("(lower(title) LIKE ? OR lower(body) LIKE ? OR lower(author) LIKE ?)");
    const like = `%${opts.search.toLowerCase()}%`;
    args.push(like, like, like);
  }

  const order = opts.sort === "recent"
    ? "created_utc DESC"
    : "intent_score DESC, quality_score DESC, created_utc DESC";
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);

  const sql = `SELECT * FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT ?`;
  const res = await db().execute({ sql, args: [...args, limit] });

  return res.rows.map((r: any) => ({
    ...r,
    ai_used: !!r.ai_used,
    reasons: safeJson(r.reasons),
  }));
}

/** Update a lead's workflow status and/or note. */
export async function updateLead(id: string, patch: { status?: string; note?: string }): Promise<boolean> {
  const sets: string[] = [];
  const args: any[] = [];
  if (patch.status !== undefined) { sets.push("status = ?"); args.push(patch.status); }
  if (patch.note !== undefined) { sets.push("note = ?"); args.push(patch.note); }
  if (!sets.length) return false;
  sets.push("updated_at = ?"); args.push(now());
  const res = await db().execute({
    sql: `UPDATE leads SET ${sets.join(", ")} WHERE id = ?`,
    args: [...args, id],
  });
  return res.rowsAffected > 0;
}

function safeJson(v: unknown): any {
  try { return JSON.parse(String(v ?? "[]")); } catch { return []; }
}
