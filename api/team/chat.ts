// Team chat channel (keyed by leader uid = teamId).
//   GET  /api/team/chat?teamId=... -> TeamChatMessage[] (oldest first)
//   POST /api/team/chat  { teamId, text } -> { ok, id }   (sender taken from the token)
import { randomUUID } from "node:crypto";
import { db, nowSec } from "../_lib/turso.js";
import { getSession, findUserByUid } from "../_lib/auth.js";
import { toChatMessage } from "../_lib/shapes.js";
import { json, methodGuard, readBody } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["GET", "POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });

    if (req.method === "GET") {
      const teamId = String(req.query?.teamId || "");
      if (!teamId) return json(res, 400, { error: "teamId_required" });
      const rows = await db().execute({
        sql: "SELECT * FROM team_chat_messages WHERE team_id = ? ORDER BY created_at ASC LIMIT 500",
        args: [teamId],
      });
      return json(res, 200, rows.rows.map(toChatMessage));
    }

    // POST — send a message
    const { teamId, text } = readBody(req);
    if (!teamId || !String(text || "").trim()) return json(res, 400, { error: "teamId_and_text_required" });
    const me = await findUserByUid(session.uid);
    const id = "m_" + randomUUID().replace(/-/g, "").slice(0, 16);
    await db().execute({
      sql: `INSERT INTO team_chat_messages (id, team_id, sender_uid, sender_name, text, created_at)
            VALUES (?,?,?,?,?,?)`,
      args: [id, String(teamId), session.uid, me?.name || me?.email || "Teammate", String(text).slice(0, 4000), Date.now()],
    });
    return json(res, 200, { ok: true, id });
  } catch (err) {
    console.error("[team/chat]", err);
    return json(res, 500, { error: "server_error" });
  }
}
