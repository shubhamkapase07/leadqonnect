// GET /api/assignments/owned -> Assignment[]  (assignments I created, to watch assignee progress)
import { db } from "../_lib/turso.js";
import { getSession } from "../_lib/auth.js";
import { toAssignment } from "../_lib/shapes.js";
import { json, methodGuard } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const rows = await db().execute({
      sql: "SELECT * FROM assignments WHERE owner_uid = ?",
      args: [session.uid],
    });
    return json(res, 200, rows.rows.map(toAssignment));
  } catch (err) {
    console.error("[assignments/owned]", err);
    return json(res, 500, { error: "server_error" });
  }
}
