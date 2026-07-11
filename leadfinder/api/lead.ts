// POST /api/lead — update a lead's workflow status/note from the dashboard.
// Body: { id: string, status?: string, note?: string }
import { updateLead } from "../src/turso.js";
import { checkAuth } from "./_auth.js";

const VALID_STATUS = new Set(["new", "contacted", "dismissed", "won"]);

export default async function handler(req: any, res: any) {
  if (!checkAuth(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { id, status, note } = body;
    if (!id) { res.status(400).json({ error: "id required" }); return; }
    if (status !== undefined && !VALID_STATUS.has(status)) {
      res.status(400).json({ error: "invalid status" });
      return;
    }
    const ok = await updateLead(String(id), { status, note });
    res.status(ok ? 200 : 404).json({ ok });
  } catch (err) {
    console.error("[api/lead]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}
