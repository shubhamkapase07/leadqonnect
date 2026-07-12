/// <reference types="node" />
// POST /api/assignments/mutate  { action: 'upsert'|'delete'|'status', ... }
// Cross-account lead assignment writes (replaces the Firestore assignment writes in db.ts).
import { db, nowSec } from "../../_lib/turso.js";
import { getSession } from "../../_lib/auth.js";
import { json, methodGuard, readBody } from "../../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const body = readBody(req);
    const action = body.action;

    if (action === "upsert") {
      const a = body.assignment || {};
      // owner is always the caller (don't trust client-supplied owner).
      const id = `${session.uid}__${a.leadId}`;
      await db().execute({
        sql: `INSERT INTO assignments
                (id, lead_id, owner_uid, owner_name, owner_email, assignee_email, assignee_uid,
                 assignee_name, lead, status, note, assigned_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT (id) DO UPDATE SET
                assignee_email=excluded.assignee_email, assignee_uid=excluded.assignee_uid,
                assignee_name=excluded.assignee_name, lead=excluded.lead, status=excluded.status,
                note=excluded.note, updated_at=excluded.updated_at`,
        args: [
          id, a.leadId, session.uid, a.ownerName || "", a.ownerEmail || "",
          (a.assigneeEmail || "").toLowerCase(), a.assigneeUid || "", a.assigneeName || "",
          JSON.stringify(a.lead || {}), a.status || "", a.note || "",
          a.assignedAt || new Date().toISOString(), a.updatedAt || new Date().toISOString(),
        ],
      });
      return json(res, 200, { ok: true, id });
    }

    if (action === "delete") {
      const id = `${session.uid}__${body.leadId}`;
      await db().execute({ sql: "DELETE FROM assignments WHERE id = ? AND owner_uid = ?", args: [id, session.uid] });
      return json(res, 200, { ok: true });
    }

    if (action === "status") {
      // Owner OR assignee may update workflow status/note.
      const patch: string[] = ["status = ?", "updated_at = ?"];
      const args: any[] = [body.status || "", new Date().toISOString()];
      if (body.note !== undefined) { patch.splice(1, 0, "note = ?"); args.splice(1, 0, body.note); }
      args.push(body.id, session.uid, session.uid, (session.email || "").toLowerCase());
      const r = await db().execute({
        sql: `UPDATE assignments SET ${patch.join(", ")} WHERE id = ? AND (owner_uid = ? OR assignee_uid = ? OR assignee_email = ?)`,
        args,
      });
      return json(res, r.rowsAffected ? 200 : 404, { ok: r.rowsAffected > 0 });
    }

    return json(res, 400, { error: "unknown_action" });
  } catch (err) {
    console.error("[assignments/mutate]", err);
    return json(res, 500, { error: "server_error" });
  }
}
