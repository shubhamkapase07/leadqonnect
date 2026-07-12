/// <reference types="node" />
// POST /api/enroll  { action: 'create'|'stop', ... }  — sequence enrollment writes.
import { db } from "../_lib/turso.js";
import { getSession } from "../_lib/auth.js";
import { json, methodGuard, readBody } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const body = readBody(req);

    if (body.action === "create") {
      const e = body.enrollment || {};
      await db().execute({
        sql: `INSERT INTO sequence_enrollments
                (id, user_id, lead_id, lead_author, sequence_id, sequence_name, channel, recipient,
                 current_step, total_steps, status, next_run_at, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT (id) DO UPDATE SET
                status=excluded.status, next_run_at=excluded.next_run_at, current_step=excluded.current_step,
                updated_at=excluded.updated_at`,
        args: [
          e.id, session.uid, e.leadId, e.leadAuthor || "", e.sequenceId, e.sequenceName || "",
          e.channel, e.to || "", e.currentStep || 0, e.totalSteps || 0, e.status || "active",
          e.nextRunAt || "", e.createdAt || new Date().toISOString(), new Date().toISOString(),
        ],
      });
      return json(res, 200, { ok: true });
    }

    if (body.action === "stop") {
      const r = await db().execute({
        sql: "UPDATE sequence_enrollments SET status='stopped', updated_at=? WHERE id=? AND user_id=?",
        args: [new Date().toISOString(), body.id, session.uid],
      });
      return json(res, 200, { ok: r.rowsAffected > 0 });
    }

    return json(res, 400, { error: "unknown_action" });
  } catch (err) {
    console.error("[enroll]", err);
    return json(res, 500, { error: "server_error" });
  }
}
