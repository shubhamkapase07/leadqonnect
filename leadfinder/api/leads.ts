// GET /api/leads — ranked, filtered lead list for the dashboard.
// Query params: status, source, minIntent, search, sort (intent|recent), limit.
import { listLeads, getMeta } from "../src/turso.js";
import { checkAuth } from "./_auth.js";

export default async function handler(req: any, res: any) {
  if (!checkAuth(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  try {
    const q = req.query || {};
    const leads = await listLeads({
      status: q.status,
      source: q.source,
      search: q.search,
      minIntent: q.minIntent !== undefined ? Number(q.minIntent) : undefined,
      sort: q.sort === "recent" ? "recent" : "intent",
      limit: q.limit !== undefined ? Number(q.limit) : undefined,
    });
    const lastScanAt = await getMeta("last_scan_at");
    res.status(200).json({ leads, count: leads.length, lastScanAt: lastScanAt ? Number(lastScanAt) : null });
  } catch (err) {
    console.error("[api/leads]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}
