/// <reference types="node" />
// GET /api/assignments/assigned-to-me -> Assignment[]
// Leads assigned to me, matched by uid OR by email (covers invites not yet linked to a uid).
import { db } from "../_lib/turso.js";
import { getSession, findUserByUid } from "../_lib/auth.js";
import { toAssignment } from "../_lib/shapes.js";
import { json, methodGuard } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const me = await findUserByUid(session.uid);
    const email = (me?.email || session.email || "").toLowerCase();

    const rows = await db().execute({
      sql: "SELECT * FROM assignments WHERE assignee_uid = ? OR assignee_email = ?",
      args: [session.uid, email],
    });
    return json(res, 200, rows.rows.map(toAssignment));
  } catch (err) {
    console.error("[assignments/assigned-to-me]", err);
    return json(res, 500, { error: "server_error" });
  }
}
