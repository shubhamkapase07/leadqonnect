// GET /api/user?uid=... -> TeamRosterUser  (basic roster projection of any user; used to watch a team leader)
import { db } from "./_lib/turso.js";
import { getSession } from "./_lib/auth.js";
import { toRosterUser } from "./_lib/shapes.js";
import { json, methodGuard } from "./_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const uid = String(req.query?.uid || "");
    if (!uid) return json(res, 400, { error: "uid_required" });
    const rows = await db().execute({
      sql: "SELECT uid, name, email, role, team_role, parent_uid, plan FROM users WHERE uid = ?",
      args: [uid],
    });
    if (!rows.rows.length) return json(res, 200, null);
    return json(res, 200, toRosterUser(rows.rows[0]));
  } catch (err) {
    console.error("[user]", err);
    return json(res, 500, { error: "server_error" });
  }
}
