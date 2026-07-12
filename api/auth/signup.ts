/// <reference types="node" />
// POST /api/auth/signup  { name, email, password } -> { token, user }
import { db, nowSec } from "../_lib/turso.js";
import { hashPassword, signToken, newUid, findUserByEmail, publicUser, ADMIN_EMAIL } from "../_lib/auth.js";
import { json, methodGuard, readBody, isEmail } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const { name, email, password } = readBody(req);
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!isEmail(cleanEmail)) return json(res, 400, { error: "invalid_email" });
    if (!password || String(password).length < 6) return json(res, 400, { error: "weak_password" });

    if (await findUserByEmail(cleanEmail)) return json(res, 409, { error: "email_in_use" });

    const uid = newUid();
    const displayName = String(name || "").trim() || cleanEmail.split("@")[0];
    await db().execute({
      sql: `INSERT INTO users (uid, email, password_hash, name, plan, status, role, joined_at, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [
        uid, cleanEmail, hashPassword(String(password)), displayName,
        "free", "active", cleanEmail === ADMIN_EMAIL ? "admin" : "user",
        new Date().toISOString().split("T")[0], nowSec(),
      ],
    });

    const row = { uid, email: cleanEmail, name: displayName, photo_url: null, plan: "free",
      status: "active", role: cleanEmail === ADMIN_EMAIL ? "admin" : "user",
      team_role: null, parent_uid: null, reddit: null, gmail: null, razorpay: null };
    const token = await signToken({ uid, email: cleanEmail });
    return json(res, 200, { token, user: publicUser(row) });
  } catch (err) {
    console.error("[auth/signup]", err);
    return json(res, 500, { error: "server_error" });
  }
}
