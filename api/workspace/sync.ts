// POST /api/workspace/sync  { collection, sets: [{id, item}], deletes: [id] } -> { ok }
// Applies a diff for one workspace collection (the client computes what changed).
import { db, nowSec } from "../_lib/turso.js";
import { getSession } from "../_lib/auth.js";
import { json, methodGuard, readBody } from "../_lib/http.js";

const VALID = new Set(["leads", "campaigns", "conversations", "sequences"]);

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });

    const { collection, sets, deletes } = readBody(req);
    if (!VALID.has(collection)) return json(res, 400, { error: "invalid_collection" });

    const client = db();
    const stmts: { sql: string; args: any[] }[] = [];

    for (const s of (Array.isArray(sets) ? sets : [])) {
      if (!s || s.id == null) continue;
      stmts.push({
        sql: `INSERT INTO workspace_docs (user_id, collection, doc_id, json, updated_at)
              VALUES (?,?,?,?,?)
              ON CONFLICT (user_id, collection, doc_id)
              DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
        args: [session.uid, collection, String(s.id), JSON.stringify(s.item), nowSec()],
      });
    }
    for (const id of (Array.isArray(deletes) ? deletes : [])) {
      if (id == null) continue;
      stmts.push({
        sql: "DELETE FROM workspace_docs WHERE user_id = ? AND collection = ? AND doc_id = ?",
        args: [session.uid, collection, String(id)],
      });
    }

    if (stmts.length) await client.batch(stmts, "write");
    return json(res, 200, { ok: true, applied: stmts.length });
  } catch (err) {
    console.error("[workspace/sync]", err);
    return json(res, 500, { error: "server_error" });
  }
}
