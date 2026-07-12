/// <reference types="node" />
// GET /api/workspace/load -> { leads, campaigns, conversations, sequences }
// Returns all of the signed-in user's workspace docs (parsed JSON), like loadWorkspace().
import { db, parseJson } from "../_lib/turso.js";
import { getSession } from "../_lib/auth.js";
import { json, methodGuard } from "../_lib/http.js";

const COLLECTIONS = ["leads", "campaigns", "conversations", "sequences"] as const;

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });

    const rows = await db().execute({
      sql: "SELECT collection, json FROM workspace_docs WHERE user_id = ?",
      args: [session.uid],
    });

    const out: Record<string, any[]> = { leads: [], campaigns: [], conversations: [], sequences: [] };
    for (const r of rows.rows as any[]) {
      const coll = String(r.collection);
      if (out[coll]) out[coll].push(parseJson(r.json, {}));
    }
    return json(res, 200, out);
  } catch (err) {
    console.error("[workspace/load]", err);
    return json(res, 500, { error: "server_error" });
  }
}

export { COLLECTIONS };
