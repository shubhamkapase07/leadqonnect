// POST /api/auth/login  { email, password } -> { token, user }
// Auto-creates the bootstrap admin account on first login (mirrors the old app behavior).
import { db, nowSec } from "../_lib/turso.js";
import { hashPassword, verifyPassword, signToken, newUid, findUserByEmail, publicUser, ADMIN_EMAIL } from "../_lib/auth.js";
import { json, methodGuard, readBody } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const { email, password } = readBody(req);
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !password) return json(res, 400, { error: "missing_credentials" });

    let row = await findUserByEmail(cleanEmail);

    // Bootstrap admin: create it on first login if it doesn't exist yet.
    if (!row && cleanEmail === ADMIN_EMAIL) {
      const uid = newUid();
      await db().execute({
        sql: `INSERT INTO users (uid, email, password_hash, name, plan, status, role, joined_at, created_at)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [uid, cleanEmail, hashPassword(String(password)), "Admin", "free", "active", "admin",
               new Date().toISOString().split("T")[0], nowSec()],
      });
      row = await findUserByEmail(cleanEmail);
    }

    if (!row || !verifyPassword(String(password), row.password_hash)) {
      return json(res, 401, { error: "invalid_credentials" });
    }
    if (row.status === "suspended") return json(res, 403, { error: "suspended" });

    const token = await signToken({ uid: row.uid, email: row.email });
    return json(res, 200, { token, user: publicUser(row) });
  } catch (err) {
    console.error("[auth/login]", err);
    return json(res, 500, { error: "server_error" });
  }
}
