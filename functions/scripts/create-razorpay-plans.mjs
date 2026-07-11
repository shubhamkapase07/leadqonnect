// One-time helper: create the LeadQonnect subscription plans (USD, monthly) in Razorpay
// and print their plan ids. Paste the printed ids into functions/.env as
// RAZORPAY_PLAN_ID_PRO / RAZORPAY_PLAN_ID_AGENCY, then deploy.
//
// Run from the functions/ directory:
//   RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=yyy node scripts/create-razorpay-plans.mjs
//
// Notes:
//  • USD amounts are in cents (4900 = $49.00).
//  • USD plans require international payments to be enabled on your Razorpay account.
//  • Re-running creates NEW plans each time — only run once per environment (test/live).

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!KEY_ID || !KEY_SECRET) {
  console.error('Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in the environment.');
  process.exit(1);
}

const PLANS = [
  { tier: 'PRO', name: 'LeadQonnect Pro', amount: 4900, description: 'Pro plan — full AI lead funnel, up to 3 team members.' },
  { tier: 'AGENCY', name: 'LeadQonnect Agency', amount: 14900, description: 'Agency plan — unlimited campaigns & team members.' },
];

const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');

async function createPlan(plan) {
  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      period: 'monthly',
      interval: 1,
      item: { name: plan.name, amount: plan.amount, currency: 'USD', description: plan.description },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${plan.tier}: ${res.status} ${JSON.stringify(json.error || json)}`);
  }
  return json.id;
}

try {
  console.log('Creating Razorpay USD subscription plans…\n');
  for (const plan of PLANS) {
    const id = await createPlan(plan);
    console.log(`RAZORPAY_PLAN_ID_${plan.tier}=${id}    ($${(plan.amount / 100).toFixed(2)}/mo)`);
  }
  console.log('\nDone. Copy the lines above into functions/.env, then redeploy.');
} catch (err) {
  console.error('\nFailed to create plans:', err.message);
  console.error('If this is a currency/international error, enable international payments on your Razorpay account first.');
  process.exit(1);
}
