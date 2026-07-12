/// <reference types="node" />
// Razorpay REST helpers (subscriptions). Requires env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
// RAZORPAY_PLAN_ID_PRO, RAZORPAY_PLAN_ID_AGENCY, RAZORPAY_WEBHOOK_SECRET.
export function keyId() { return process.env.RAZORPAY_KEY_ID || ""; }
export function planIdForTier(tier: string): string {
  if (tier === "agency") return process.env.RAZORPAY_PLAN_ID_AGENCY || "";
  if (tier === "pro") return process.env.RAZORPAY_PLAN_ID_PRO || "";
  return "";
}
export function appPlanForTier(tier: string): "premium" | "agency" {
  return tier === "agency" ? "agency" : "premium";
}

export async function razorpayApi(path: string, method: "GET" | "POST", body?: unknown) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Razorpay error: ${res.status} ${JSON.stringify(json?.error || json)}`);
  return json;
}
