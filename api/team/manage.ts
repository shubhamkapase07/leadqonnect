/// <reference types="node" />
// POST /api/team/manage  { action: 'create'|'delete'|'reset', ... }
// Team member (child account) provisioning. Replaces the Admin-SDK Cloud Functions — now we
// just create/delete rows in the users table with parent_uid = the caller.
import { randomBytes } from "node:crypto";
import { db, nowSec } from "../_lib/turso.js";
import { getSession, findUserByEmail, findUserByUid, hashPassword, newUid } from "../_lib/auth.js";
import { json, methodGuard, readBody, isEmail } from "../_lib/http.js";

const tempPassword = () => "Lq-" + randomBytes(6).toString("hex");

async function assertIsMyChild(parentUid: string, childUid: string) {
  const row = await findUserByUid(childUid);
  if (!row || row.parent_uid !== parentUid) {
    throw Object.assign(new Error("not_your_teammate"), { code: 403 });
  }
}

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const body = readBody(req);

    if (body.action === "create") {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const role = String(body.role || "Member").trim();
      if (!name || !isEmail(email)) return json(res, 400, { error: "name_and_email_required" });
      if (await findUserByEmail(email)) return json(res, 409, { error: "already-exists" });

      const uid = newUid();
      const pw = tempPassword();
      await db().execute({
        sql: `INSERT INTO users (uid, email, password_hash, name, role, parent_uid, plan, status, must_change_password, joined_at, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        args: [uid, email, hashPassword(pw), name, role, session.uid, "free", "active", 1,
               new Date().toISOString().split("T")[0], nowSec()],
      });
      return json(res, 200, { ok: true, uid, email, tempPassword: pw });
    }

    if (body.action === "delete") {
      const uid = String(body.uid || "");
      if (!uid) return json(res, 400, { error: "uid_required" });
      await assertIsMyChild(session.uid, uid);
      await db().execute({ sql: "DELETE FROM users WHERE uid = ?", args: [uid] });
      return json(res, 200, { ok: true });
    }

    if (body.action === "reset") {
      const uid = String(body.uid || "");
      if (!uid) return json(res, 400, { error: "uid_required" });
      await assertIsMyChild(session.uid, uid);
      const pw = tempPassword();
      await db().execute({
        sql: "UPDATE users SET password_hash = ?, must_change_password = 1 WHERE uid = ?",
        args: [hashPassword(pw), uid],
      });
      return json(res, 200, { ok: true, tempPassword: pw });
    }

    return json(res, 400, { error: "unknown_action" });
  } catch (err: any) {
    if (err?.code === 403) return json(res, 403, { error: "not_your_teammate" });
    console.error("[team/manage]", err);
    return json(res, 500, { error: "server_error" });
  }
}
