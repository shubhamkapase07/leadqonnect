// Local dev server — serves the dashboard (index.html) and the /api/leads + /api/lead
// endpoints against your real Turso DB, so you can run the app locally without Vercel.
// Run:  npm run serve   (then open http://localhost:3000)
//
// This is a LOCAL convenience only; production uses the Vercel functions in api/.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listLeads, updateLead, getMeta } from "./turso.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
const PORT = Number(process.env.PORT) || 3000;
const TOKEN = process.env.DASHBOARD_TOKEN || "";

function authed(req: any): boolean {
  if (!TOKEN) return true;
  return req.headers["x-access-token"] === TOKEN;
}

function json(res: any, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/api/leads" && req.method === "GET") {
      if (!authed(req)) return json(res, 401, { error: "unauthorized" });
      const q = Object.fromEntries(url.searchParams);
      const leads = await listLeads({
        status: q.status,
        source: q.source,
        search: q.search,
        minIntent: q.minIntent !== undefined ? Number(q.minIntent) : undefined,
        sort: q.sort === "recent" ? "recent" : "intent",
        limit: q.limit !== undefined ? Number(q.limit) : undefined,
      });
      const lastScanAt = await getMeta("last_scan_at");
      return json(res, 200, { leads, count: leads.length, lastScanAt: lastScanAt ? Number(lastScanAt) : null });
    }

    if (url.pathname === "/api/lead" && req.method === "POST") {
      if (!authed(req)) return json(res, 401, { error: "unauthorized" });
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const { id, status, note } = JSON.parse(raw || "{}");
      if (!id) return json(res, 400, { error: "id required" });
      const ok = await updateLead(String(id), { status, note });
      return json(res, ok ? 200 : 404, { ok });
    }

    // everything else -> the dashboard
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
});

server.listen(PORT, () => console.log(`▶ LeadFinder dashboard running at http://localhost:${PORT}`));
