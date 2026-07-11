// GET /api/auth/me -> { user } | 401
// Reads fresh from the DB so plan/role/status/OAuth changes reflect on the client's poll.
import { getSession, findUserByUid, publicUser } from "../_lib/auth.js";
import { json, methodGuard } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const row = await findUserByUid(session.uid);
    if (!row) return json(res, 401, { error: "unauthenticated" });
    return json(res, 200, { user: publicUser(row) });
  } catch (err) {
    console.error("[auth/me]", err);
    return json(res, 500, { error: "server_error" });
  }
}
