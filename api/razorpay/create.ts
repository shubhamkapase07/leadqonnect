/// <reference types="node" />
// POST /api/razorpay/create  { tier } -> { subscriptionId, keyId }
import { db } from "../_lib/turso.js";
import { getSession } from "../_lib/auth.js";
import { keyId, planIdForTier, razorpayApi } from "../_lib/razorpay.js";
import { json, methodGuard, readBody } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const { tier } = readBody(req);
    if (tier !== "pro" && tier !== "agency") return json(res, 400, { error: "bad_tier" });
    const planId = planIdForTier(tier);
    if (!planId) return json(res, 400, { error: "plan_not_configured" });

    const sub = await razorpayApi("/subscriptions", "POST", {
      plan_id: planId, total_count: 120, customer_notify: 1, notes: { uid: session.uid, tier },
    });

    const now = new Date().toISOString();
    await db().execute({
      sql: `INSERT INTO razorpay_subscriptions (id, user_id, tier, status, plan_id, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`,
      args: [sub.id, session.uid, tier, sub.status, planId, now, now],
    });
    await db().execute({
      sql: "UPDATE users SET razorpay = ? WHERE uid = ?",
      args: [JSON.stringify({ subscriptionId: sub.id, tier, status: sub.status, updatedAt: now }), session.uid],
    });

    return json(res, 200, { subscriptionId: sub.id, keyId: keyId() });
  } catch (err: any) {
    console.error("[razorpay/create]", err);
    return json(res, 500, { error: err?.message || "server_error" });
  }
}
