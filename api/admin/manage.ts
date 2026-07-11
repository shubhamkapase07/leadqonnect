// POST /api/admin/manage  { action, userId, ... }  — admin user management (admin only).
// Replaces the Firestore admin writes in AppContext.
import { db } from "../_lib/turso.js";
import { getSession, findUserByUid, ADMIN_EMAIL } from "../_lib/auth.js";
import { json, methodGuard, readBody } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const me = await findUserByUid(session.uid);
    if (!me || (me.role !== "admin" && me.email !== ADMIN_EMAIL)) return json(res, 403, { error: "forbidden" });

    const { action, userId } = readBody(req);
    const body = readBody(req);
    if (!userId) return json(res, 400, { error: "userId_required" });
    const client = db();

    switch (action) {
      case "plan":
        await client.execute({ sql: "UPDATE users SET plan = ? WHERE uid = ?", args: [body.plan, userId] });
        break;
      case "delete":
        await client.execute({ sql: "DELETE FROM users WHERE uid = ?", args: [userId] });
        break;
      case "suspend": {
        const u = await findUserByUid(userId);
        const next = u?.status === "suspended" ? "active" : "suspended";
        await client.execute({ sql: "UPDATE users SET status = ? WHERE uid = ?", args: [next, userId] });
        break;
      }
      case "promote":
        await client.execute({ sql: "UPDATE users SET role = 'admin' WHERE uid = ?", args: [userId] });
        break;
      case "demote":
        await client.execute({ sql: "UPDATE users SET role = 'user' WHERE uid = ?", args: [userId] });
        break;
      case "teamRole": {
        const value = body.value; // 'leader' | 'member' | 'none'
        if (value === "leader") {
          await client.execute({ sql: "UPDATE users SET team_role='leader', parent_uid=NULL WHERE uid=?", args: [userId] });
        } else if (value === "member") {
          if (!body.leaderUid || body.leaderUid === userId) return json(res, 400, { error: "bad_leader" });
          await client.execute({ sql: "UPDATE users SET team_role='member', parent_uid=? WHERE uid=?", args: [body.leaderUid, userId] });
        } else {
          await client.execute({ sql: "UPDATE users SET team_role=NULL, parent_uid=NULL WHERE uid=?", args: [userId] });
        }
        break;
      }
      default:
        return json(res, 400, { error: "unknown_action" });
    }
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("[admin/manage]", err);
    return json(res, 500, { error: "server_error" });
  }
}
