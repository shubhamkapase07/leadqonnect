/// <reference types="node" />
// GET /api/team/roster?leaderUid=... -> TeamRosterUser[]  (everyone whose parent_uid == leaderUid)
import { db } from "../../_lib/turso.js";
import { getSession } from "../../_lib/auth.js";
import { toRosterUser } from "../../_lib/shapes.js";
import { json, methodGuard } from "../../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const leaderUid = String(req.query?.leaderUid || "");
    if (!leaderUid) return json(res, 400, { error: "leaderUid_required" });
    const rows = await db().execute({
      sql: "SELECT uid, name, email, role, team_role, parent_uid, plan FROM users WHERE parent_uid = ?",
      args: [leaderUid],
    });
    return json(res, 200, rows.rows.map(toRosterUser));
  } catch (err) {
    console.error("[team/roster]", err);
    return json(res, 500, { error: "server_error" });
  }
}
