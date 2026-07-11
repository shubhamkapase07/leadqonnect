// GET /api/admin/users -> AdminUser[]  (admin only; excludes the bootstrap admin, like before)
import { db } from "../_lib/turso.js";
import { getSession, findUserByUid, ADMIN_EMAIL } from "../_lib/auth.js";
import { toAdminUser } from "../_lib/shapes.js";
import { json, methodGuard } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const me = await findUserByUid(session.uid);
    const isAdmin = me && (me.role === "admin" || me.email === ADMIN_EMAIL);
    if (!isAdmin) return json(res, 403, { error: "forbidden" });

    const rows = await db().execute({ sql: "SELECT * FROM users WHERE email != ?", args: [ADMIN_EMAIL] });
    return json(res, 200, rows.rows.map(toAdminUser));
  } catch (err) {
    console.error("[admin/users]", err);
    return json(res, 500, { error: "server_error" });
  }
}
