/// <reference types="node" />
// POST /api/referrals  { action: 'track'|'claim'|'dashboard', code? }
// Refer & earn (replaces trackReferralClick / claimReferral / getReferralDashboard).
import { randomBytes } from "node:crypto";
import { db, nowSec } from "./_lib/turso.js";
import { getSession, findUserByUid } from "./_lib/auth.js";
import { json, methodGuard, readBody } from "./_lib/http.js";

const RATE = 0.3;
const PRICE_CENTS: Record<string, number> = { premium: 4900, agency: 14900 };

async function userByCode(code: string) {
  const r = await db().execute({ sql: "SELECT * FROM users WHERE referral_code = ? LIMIT 1", args: [code] });
  return r.rows[0] as any | undefined;
}
async function uniqueCode(seed: string): Promise<string> {
  const base = (seed || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "user";
  for (let i = 0; i < 6; i++) {
    const code = `${base}${randomBytes(3).toString("hex")}`;
    if (!(await userByCode(code))) return code;
  }
  return "ref" + randomBytes(6).toString("hex");
}

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const { action, code } = readBody(req);
    const clean = String(code || "").trim().toLowerCase();

    // track — no auth (visitor isn't signed in). Count a click for a real code.
    if (action === "track") {
      if (!clean) return json(res, 200, { ok: false });
      const owner = await userByCode(clean);
      if (!owner) return json(res, 200, { ok: false });
      await db().execute({
        sql: `INSERT INTO referrals (code, owner_uid, clicks, updated_at) VALUES (?,?,1,?)
              ON CONFLICT (code) DO UPDATE SET clicks = clicks + 1, updated_at = excluded.updated_at`,
        args: [clean, owner.uid, nowSec()],
      });
      return json(res, 200, { ok: true });
    }

    // claim + dashboard require auth.
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });

    if (action === "claim") {
      if (!clean) return json(res, 400, { error: "code_required" });
      const referrer = await userByCode(clean);
      if (!referrer) return json(res, 200, { ok: false, reason: "unknown_code" });
      if (referrer.uid === session.uid) return json(res, 200, { ok: false, reason: "self" });
      const me = await findUserByUid(session.uid);
      if (me?.referred_by) return json(res, 200, { ok: false, reason: "already" });
      await db().execute({
        sql: "UPDATE users SET referred_by=?, referred_by_uid=? WHERE uid=?",
        args: [clean, referrer.uid, session.uid],
      });
      return json(res, 200, { ok: true });
    }

    if (action === "dashboard") {
      const me = await findUserByUid(session.uid);
      let refCode = me?.referral_code as string | undefined;
      if (!refCode) {
        refCode = await uniqueCode(me?.name || me?.email || "user");
        await db().execute({ sql: "UPDATE users SET referral_code=? WHERE uid=?", args: [refCode, session.uid] });
      }
      const clicksRow = await db().execute({ sql: "SELECT clicks FROM referrals WHERE code=?", args: [refCode] });
      const clicks = Number(clicksRow.rows[0]?.clicks) || 0;
      const referred = await db().execute({ sql: "SELECT plan FROM users WHERE referred_by=?", args: [refCode] });
      let signups = 0, conversions = 0, monthlyCommissionCents = 0;
      for (const r of referred.rows as any[]) {
        signups++;
        const price = PRICE_CENTS[r.plan];
        if (price) { conversions++; monthlyCommissionCents += Math.round(price * RATE); }
      }
      return json(res, 200, { code: refCode, clicks, signups, conversions, monthlyCommissionCents });
    }

    return json(res, 400, { error: "unknown_action" });
  } catch (err) {
    console.error("[referrals]", err);
    return json(res, 500, { error: "server_error" });
  }
}
