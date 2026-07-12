/// <reference types="node" />
// POST /api/razorpay/verify  { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
// Verifies the signed checkout result and activates the plan.
import { createHmac } from "node:crypto";
import { db } from "../../_lib/turso.js";
import { getSession } from "../../_lib/auth.js";
import { appPlanForTier } from "../../_lib/razorpay.js";
import { json, methodGuard, readBody } from "../../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = readBody(req);
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return json(res, 400, { error: "missing_fields" });
    }

    const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest("hex");
    if (expected !== razorpay_signature) return json(res, 403, { error: "bad_signature" });

    const idx = await db().execute({ sql: "SELECT * FROM razorpay_subscriptions WHERE id = ?", args: [razorpay_subscription_id] });
    const row: any = idx.rows[0];
    if (!row || row.user_id !== session.uid || (row.tier !== "pro" && row.tier !== "agency")) {
      return json(res, 403, { error: "not_your_subscription" });
    }

    const plan = appPlanForTier(row.tier);
    const now = new Date().toISOString();
    await db().execute({
      sql: "UPDATE users SET plan = ?, razorpay = ? WHERE uid = ?",
      args: [plan, JSON.stringify({ subscriptionId: razorpay_subscription_id, tier: row.tier, status: "active", lastPaymentId: razorpay_payment_id, activatedAt: now, updatedAt: now }), session.uid],
    });
    await db().execute({ sql: "UPDATE razorpay_subscriptions SET status='active', updated_at=? WHERE id=?", args: [now, razorpay_subscription_id] });

    return json(res, 200, { ok: true, plan });
  } catch (err: any) {
    console.error("[razorpay/verify]", err);
    return json(res, 500, { error: err?.message || "server_error" });
  }
}
