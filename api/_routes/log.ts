/// <reference types="node" />
// POST /api/log  — client error sink (replaces logClientError). Auth optional.
import { db, nowSec } from "../_lib/turso.js";
import { getSession } from "../_lib/auth.js";
import { json, methodGuard, readBody } from "../_lib/http.js";

const clamp = (s: unknown, n: number) => String(s ?? "").slice(0, n);

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const d = readBody(req);
    const message = clamp(d.message, 1000);
    if (!message) return json(res, 200, { ok: false });
    const session = await getSession(req).catch(() => null);
    await db().execute({
      sql: `INSERT INTO error_logs (uid, level, context, message, stack, url, user_agent, meta, client_at, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [
        session?.uid || null, clamp(d.level, 16) || "error", clamp(d.context, 120), message,
        clamp(d.stack, 4000) || null, clamp(d.url, 500) || null, clamp(d.userAgent, 300) || null,
        d.meta ? JSON.stringify(d.meta).slice(0, 2000) : null, clamp(d.at, 40) || null, nowSec(),
      ],
    });
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 200, { ok: false }); // logging must never throw
  }
}
