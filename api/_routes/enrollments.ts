/// <reference types="node" />
// GET /api/enrollments -> SequenceEnrollment[]  (the signed-in user's enrollments)
import { db } from "../_lib/turso.js";
import { getSession } from "../_lib/auth.js";
import { toEnrollment } from "../_lib/shapes.js";
import { json, methodGuard } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const rows = await db().execute({
      sql: "SELECT * FROM sequence_enrollments WHERE user_id = ?",
      args: [session.uid],
    });
    return json(res, 200, rows.rows.map(toEnrollment));
  } catch (err) {
    console.error("[enrollments]", err);
    return json(res, 500, { error: "server_error" });
  }
}
