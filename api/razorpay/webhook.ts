// POST /api/razorpay/webhook — source of truth over time (renewals keep plan active;
// halts/cancellations downgrade to free). Requires the RAW body for signature verification,
// so the default JSON body parser is disabled and we buffer the stream ourselves.
import { createHmac } from "node:crypto";
import { db } from "../_lib/turso.js";
import { appPlanForTier } from "../_lib/razorpay.js";

export const config = { api: { bodyParser: false } };

const ACTIVATE = new Set(["subscription.authenticated", "subscription.activated", "subscription.charged", "subscription.resumed"]);
const DOWNGRADE = new Set(["subscription.halted", "subscription.cancelled", "subscription.completed", "subscription.expired", "subscription.paused"]);

function readRaw(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") { res.status(405).send("method_not_allowed"); return; }
  try {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const raw = await readRaw(req);
    if (!signature || !raw.length) { res.status(400).send("missing signature/body"); return; }

    const expected = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "").update(raw).digest("hex");
    if (expected !== signature) { res.status(400).send("invalid signature"); return; }

    const event = JSON.parse(raw.toString("utf8"));
    const sub = event?.payload?.subscription?.entity;
    const subId: string | undefined = sub?.id;
    if (subId) {
      const idx = await db().execute({ sql: "SELECT * FROM razorpay_subscriptions WHERE id=?", args: [subId] });
      const row: any = idx.rows[0];
      const uid = row?.user_id || sub?.notes?.uid;
      const tier = row?.tier || sub?.notes?.tier;
      if (uid && (tier === "pro" || tier === "agency")) {
        let plan: string | undefined;
        if (ACTIVATE.has(event.event)) plan = appPlanForTier(tier);
        else if (DOWNGRADE.has(event.event)) plan = "free";
        if (plan) {
          const now = new Date().toISOString();
          await db().execute({
            sql: "UPDATE users SET plan=?, razorpay=? WHERE uid=?",
            args: [plan, JSON.stringify({ subscriptionId: subId, tier, status: sub?.status || event.event, updatedAt: now }), uid],
          });
          await db().execute({
            sql: `INSERT INTO razorpay_subscriptions (id, user_id, tier, status, updated_at) VALUES (?,?,?,?,?)
                  ON CONFLICT (id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`,
            args: [subId, uid, tier, sub?.status || event.event, now],
          });
        }
      }
    }
    res.status(200).send("ok");
  } catch (err) {
    console.error("[razorpay/webhook]", err);
    res.status(500).send("error");
  }
}
