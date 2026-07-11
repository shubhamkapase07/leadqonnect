# LeadQonnect — setup guide

Everything needed to run and deploy LeadQonnect, in one place. Each integration is
independent — set up only the ones you need.

- [1. Prerequisites](#1-prerequisites)
- [2. Front-end environment (`.env.local`)](#2-front-end-environment-envlocal)
- [3. Database — Cloud Firestore](#3-database--cloud-firestore)
- [4. Cloud Functions config & deploy](#4-cloud-functions-config--deploy)
- [5. Lead scanning — Apify](#5-lead-scanning--apify)
- [6. Connect Reddit (OAuth)](#6-connect-reddit-oauth)
- [7. Connect Gmail (OAuth)](#7-connect-gmail-oauth)
- [8. AI lead qualification (Claude)](#8-ai-lead-qualification-claude)
- [9. Razorpay billing (subscriptions)](#9-razorpay-billing-subscriptions)
- [10. Local development](#10-local-development)

---

## 1. Prerequisites

| What | Why | Notes |
|------|-----|-------|
| Node + npm | Build the Vite app and Cloud Functions | `npm install` in both `/` and `/functions` |
| Firebase project | Auth, Firestore, Functions, Hosting | https://console.firebase.google.com |
| Firebase **Blaze** plan | Cloud Functions require pay-as-you-go | Free quota covers low usage; needed for Reddit/Gmail/AI/Razorpay |
| `firebase-tools` | Deploy from the CLI | `npm install -g firebase-tools && firebase login` |

Two env files drive configuration (both gitignored — never commit real credentials):

- **`.env.local`** (project root) — front-end (`VITE_*`) values, baked into the client bundle.
- **`functions/.env`** — non-secret Functions config. **Secrets** are never put in a file;
  they're set with `firebase functions:secrets:set <NAME>`.

Copy the templates to start:
```bash
cp .env.example .env.local
cp functions/.env.example functions/.env
```

> ⚠️ `VITE_*` vars ship inside the client bundle — only put values there that are safe to be
> public (Firebase config, OAuth **client IDs**, Razorpay **key ID**). Client **secrets** and
> API keys live only in Functions secrets.

---

## 2. Front-end environment (`.env.local`)

```ini
# Firebase (required for auth + database)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Lead scanning (Apify) — see §5
VITE_APIFY_TOKEN=apify_api_your_token_here

# Reddit OAuth (client id is public) — see §6
VITE_REDDIT_CLIENT_ID=your_reddit_client_id
VITE_REDDIT_REDIRECT_URI=https://leadqonnect.web.app/redditCallback

# Gmail OAuth (client id is public) — see §7
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=https://leadqonnect.web.app/gmailCallback
```

> Each `VITE_*_REDIRECT_URI` must be **byte-for-byte identical** to the matching Functions
> redirect URI and the value registered on the provider's OAuth app, or the provider rejects
> the request.

---

## 3. Database — Cloud Firestore

Workspace data persists to **Cloud Firestore** per signed-in user, so leads, campaigns, and
conversations survive a cache clear and sync across devices/browsers.

### Data model
```
users/{uid}                         ← profile: name, email, plan, status, role, reddit{...}, gmail{...}
users/{uid}/leads/{leadId}          ← one doc per lead
users/{uid}/campaigns/{campaignId}  ← one doc per campaign
users/{uid}/conversations/{leadId}  ← one doc per conversation thread
redditTokens/{uid}                  ← Reddit OAuth tokens (server-only, never client-readable)
gmailTokens/{uid}                   ← Gmail OAuth tokens (server-only, never client-readable)
```

### How it works ([src/lib/db.ts](src/lib/db.ts) + [AppContext](src/context/AppContext.tsx))
- **On login**, the app loads `leads`/`campaigns`/`conversations` from Firestore and adopts
  remote data as the source of truth when present.
- **On every change**, state is **diff-synced** back — only changed/deleted docs are written,
  via batched writes. No full rewrites.
- **First run / migration**: if the account has no remote data, whatever's in `localStorage`
  is uploaded on the first sync, so existing local data carries over.
- **`localStorage` stays** as an offline cache; Firestore is the cross-device store.
- **Demo mode** never touches Firestore — it stays local-only.

### Deploy the security rules
The rules ([firestore.rules](firestore.rules)) enforce: a user can read/write only their own
`users/{uid}` doc and subcollections; admins can manage all user docs; `redditTokens` and
`gmailTokens` are server-only.

```bash
firebase deploy --only firestore:rules
```

> ⚠️ This **replaces** the rules currently in the Firebase console. Review them first if you'd
> added custom rules of your own. No indexes are required (single-collection reads only).

### Caveats
- **Shared-browser migration**: first login on a browser that already holds another user's
  `localStorage` could migrate that data into the new account (a single-tenant assumption).
  For kiosks, clear site data between users.
- **Scale**: per-doc storage scales to thousands of leads. The Spark (free) tier covers light
  usage; heavy scanning that writes many leads counts toward quotas (Blaze recommended past
  testing).

---

## 4. Cloud Functions config & deploy

The Reddit, Gmail, AI, and Razorpay integrations all run through the Firebase Cloud Functions
in [`/functions`](functions/src/index.ts) (browsers can't hold client secrets or bypass CORS).

**`functions/.env`** (non-secret config):
```ini
# Reddit
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_REDIRECT_URI=https://leadqonnect.web.app/redditCallback
APP_URL=http://localhost:5173            # where users return after connecting

# Gmail
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_REDIRECT_URI=https://leadqonnect.web.app/gmailCallback

# AI qualification (model is non-secret)
LEAD_AI_MODEL=claude-opus-4-8

# Razorpay (key id is public)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_PLAN_ID_PRO=plan_xxxxxxxxxxxxxx
RAZORPAY_PLAN_ID_AGENCY=plan_xxxxxxxxxxxxxx
```

**Secrets** (set once each, never committed):
```bash
cd functions
firebase functions:secrets:set REDDIT_CLIENT_SECRET
firebase functions:secrets:set GOOGLE_CLIENT_SECRET
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET   # any strong random string
```

**Deploy** (builds the app into `/dist` and ships everything):
```bash
npm install            # in /functions, first time
npm run build          # in project root — builds the client into /dist
firebase deploy --only functions,hosting,firestore:rules
```

> Hosting must be deployed too: the stable callback URLs (`/redditCallback`, `/gmailCallback`,
> `/razorpayWebhook`) are hosting **rewrites** in [firebase.json](firebase.json) that route to
> the matching functions — that's why redirect URIs are clean `web.app` URLs.

---

## 5. Lead scanning — Apify

Scanning uses **Apify** actors for Reddit, Twitter/X, LinkedIn, and Quora. It needs no personal
login and is independent of the Reddit/Gmail account connections below.

1. Create an account at https://console.apify.com (no card; ~$5/mo free credits).
2. **Settings → API & Integrations** → copy your Personal API token.
3. Set `VITE_APIFY_TOKEN` in `.env.local`.

> ⚠️ `VITE_APIFY_TOKEN` ships in the client bundle — use it for dev/testing only. For
> production, proxy these calls through a backend (e.g. a Firebase Function).

Optional tuning (defaults shown), in `.env.local`:
```ini
# Items per platform per keyword per scan, and a hard per-run USD ceiling.
# Apify's own default cap is $0.10, which the browser-based Reddit actor exceeds
# mid-run and then aborts with no data — so cap a bit higher.
VITE_APIFY_MAX_ITEMS=10
VITE_APIFY_MAX_COST_USD=0.3

# Override the default Store actor per platform if one is renamed/deprecated.
# Verified working on the free tier (2026-06), except Quora (bot-protected — swap in a
# paid/residential actor for real results).
VITE_APIFY_ACTOR_REDDIT=trudax~reddit-scraper-lite
VITE_APIFY_ACTOR_TWITTER=kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest
VITE_APIFY_ACTOR_LINKEDIN=harvestapi~linkedin-post-search
VITE_APIFY_ACTOR_QUORA=crawlerbros~quora-search-scraper
```

---

## 6. Connect Reddit (OAuth)

Lets users **reply, comment, and DM leads from their own Reddit account**.

**Flow:** user clicks **Connect Reddit** (Settings → Connected Accounts) → Reddit consent with a
one-time `state` nonce (CSRF) → `redditCallback` function exchanges the code, stores tokens
privately in `redditTokens/{uid}`, writes display info (`reddit: { username, avatar }`) onto
`users/{uid}` → the live snapshot shows "Connected as u/…" → replies/DMs call the
`redditPostComment` / `redditSendMessage` functions, which refresh the token if expired and call
the Reddit API server-side.

1. **Register a Reddit app** — https://www.reddit.com/prefs/apps → **create another app…**,
   type **web app**, redirect uri `https://leadqonnect.web.app/redditCallback`. Note the
   **client id** (under the app name) and **secret**.
2. Set `REDDIT_CLIENT_ID` / `REDDIT_REDIRECT_URI` in `functions/.env`, the secret via
   `firebase functions:secrets:set REDDIT_CLIENT_SECRET`, and `VITE_REDDIT_*` in `.env.local`.
3. Deploy functions + hosting (see §4).

- Scopes: `identity submit privatemessages read` (sign-in, post/comment, DM).
- DMs can fail if the recipient disables messages — the UI surfaces that.
- Reddit posting is rate-limited, especially for new/low-karma accounts.
- Gated behind the **Pro** plan (`capabilities.engagement`).

---

## 7. Connect Gmail (OAuth)

Lets users **send email to leads from their own Gmail address**, send-only.

**Flow:** mirrors Reddit — **Connect Gmail** → Google consent (scope
`openid email https://www.googleapis.com/auth/gmail.send` only) → `gmailCallback` stores tokens
privately in `gmailTokens/{uid}`, writes `gmail: { email, avatar }` onto `users/{uid}` → sending
calls the `gmailSendEmail` callable, which refreshes the token if expired and calls the Gmail API
server-side.

> Scope is **send-only**: the app can send as the user but **cannot read or modify their inbox**.

1. **Create a Google Cloud OAuth client** — https://console.cloud.google.com:
   - **APIs & Services → Library** → enable the **Gmail API**.
   - **OAuth consent screen** → User type **External**; add scope `.../auth/gmail.send`. In
     **Testing** mode you can add up to **100 test users** with no Google review.
   - **Credentials → Create credentials → OAuth client ID** → type **Web application**,
     authorized redirect URI `https://leadqonnect.web.app/gmailCallback`. Note the **client id**
     and **client secret**.
2. Set `GOOGLE_CLIENT_ID` / `GOOGLE_REDIRECT_URI` in `functions/.env`, the secret via
   `firebase functions:secrets:set GOOGLE_CLIENT_SECRET`, and `VITE_GOOGLE_*` in `.env.local`.
3. Deploy functions + hosting (see §4).

Call it from code:
```ts
const { sendGmail } = useApp();
await sendGmail('lead@example.com', 'Quick question', 'Hi there, ...');
```

- **`gmail.send` is a restricted scope** — usable with up to 100 users in Testing mode without
  verification. >100 real users requires publishing the consent screen and passing Google's
  security assessment (CASA).
- Gmail enforces per-user sending limits (consumer Gmail ~500 recipients/day).
- Gated behind the **Pro** plan (`capabilities.engagement`).

---

## 8. AI lead qualification (Claude)

LeadQonnect scores every lead on three **deterministic** dimensions, and can optionally run a
more accurate **AI qualification** pass via Claude.

### Deterministic scoring (always on, free, instant)
At scan time every lead is scored by [src/lib/scoring.ts](src/lib/scoring.ts) from the post's
text vs. the campaign — pure functions, same post → same scores:
- **Match** — depth of fit against the campaign's keywords + service/industry terms.
- **Intent** — buying/hiring language ("looking for", "need", "hire", "budget", "$") minus
  low-intent signals (tutorials, "open to work", self-promo).
- **Quality** — specificity/length, questions, B2B/decision-maker language, minus spam.

`sentiment` (high/medium/low) is derived from the intent score.

### AI qualification (optional, precise, paid)
Clicking **AI Qualify** (or moving a lead into the CRM) calls the `qualifyLeadAI` function, which
sends the lead + campaign to **Claude** and returns calibrated scores, a one-line rationale, an
inferred company/industry/budget, and a recommended next step (via structured outputs → always
valid JSON). With no key configured or on failure, it **falls back** to the deterministic scores.

It does **not** fabricate decision-maker names, emails, or funding — it only fills
company/industry/budget when reasonably inferable, leaving the rest blank.

### Enable it
Requires the Cloud Functions deployed (§4).
1. Get an Anthropic API key → https://console.anthropic.com → API Keys.
2. `cd functions && firebase functions:secrets:set ANTHROPIC_API_KEY`
3. (Optional) Pick the model in `functions/.env`:
   ```ini
   LEAD_AI_MODEL=claude-opus-4-8      # default — most precise
   # LEAD_AI_MODEL=claude-sonnet-4-6  # cheaper middle ground
   # LEAD_AI_MODEL=claude-haiku-4-5   # ~5x cheaper, still solid
   ```
4. `firebase deploy --only functions`

**Cost:** one Claude call per lead you qualify (scanning stays free/deterministic). A few cents
per lead at most with `claude-opus-4-8`; `claude-haiku-4-5` cuts it ~5x. You control spend by
choosing which leads to qualify.

---

## 9. Razorpay billing (subscriptions)

Recurring billing on the paid tiers (Pro → `premium`, and `agency`), in **USD** ($49/mo and
$149/mo). Money never touches the browser: the app creates a subscription server-side, opens
Razorpay's hosted Checkout, verifies the signed result in a function, then flips the user's
`plan` via the Admin SDK (clients are blocked by security rules from setting `plan`).

| Piece | Where | Job |
|-------|-------|-----|
| `createRazorpaySubscription` (callable) | [functions/src/index.ts](functions/src/index.ts) | Creates the subscription, returns `subscriptionId` + public `keyId`. |
| `verifyRazorpaySubscription` (callable) | same | Verifies the `payment_id\|subscription_id` HMAC signature, then activates the plan. |
| `razorpayWebhook` (HTTP) | same | Source of truth over time — renewals keep the plan active; halt/cancel/expiry downgrade to `free`. |
| `subscribeToPlan(tier)` | [src/context/AppContext.tsx](src/context/AppContext.tsx) | Orchestrates create → Checkout → verify on the client. |
| Checkout loader | [src/lib/razorpay.ts](src/lib/razorpay.ts) | Loads `checkout.js`, opens the sheet, resolves with the signed result. |

1. **API keys** — Razorpay Dashboard → **Settings → API Keys** → *Generate Key* → **Key ID**
   (`rzp_test_…`/`rzp_live_…`) and **Key Secret** (shown once).
   > USD subscriptions require **international payments** enabled (Dashboard → Settings →
   > Configuration). Until that's live you can only test with INR plans.
2. **Create the plans** (USD, monthly) — in the dashboard (**Subscriptions → Plans → Create
   Plan**, Monthly, USD, $49 and $149) **or** via the helper:
   ```bash
   cd functions
   RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=yyy node scripts/create-razorpay-plans.mjs
   ```
   It prints `RAZORPAY_PLAN_ID_PRO=…` and `RAZORPAY_PLAN_ID_AGENCY=…`.
3. **Configure** — `RAZORPAY_KEY_ID` + the two plan ids in `functions/.env`; the secrets via
   `firebase functions:secrets:set RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`.
4. **Deploy** — `firebase deploy --only functions,firestore:rules,hosting`.
5. **Register the webhook** — Dashboard → **Settings → Webhooks → Add New Webhook**:
   - **URL:** `https://leadqonnect.web.app/razorpayWebhook` (hosting rewrite; the raw
     `https://us-central1-leadqonnect.cloudfunctions.net/razorpayWebhook` also works).
   - **Secret:** the same value as `RAZORPAY_WEBHOOK_SECRET`.
   - **Active events:** `subscription.activated`, `subscription.charged`,
     `subscription.authenticated`, `subscription.resumed`, `subscription.halted`,
     `subscription.cancelled`, `subscription.completed`, `subscription.expired`,
     `subscription.paused`.

**Testing:** use `rzp_test_…` keys and Razorpay's
[test cards](https://razorpay.com/docs/payments/payments/test-card-details/) (e.g.
`4111 1111 1111 1111`, any future expiry/CVV). The user's `plan` flips to `premium`/`agency` and
the UI updates live via the Firestore snapshot. Cancel in the dashboard to confirm the webhook
downgrades to `free`.

**Going live:** swap to live keys, recreate the plans in live mode, update `RAZORPAY_PLAN_ID_*`,
register a live-mode webhook, redeploy.

---

## 10. Local development

```bash
npm install        # project root
npm run dev        # Vite dev server at http://localhost:5173
```

- For OAuth flows (Reddit/Gmail), set `APP_URL=http://localhost:5173` in `functions/.env`. The
  simplest path is to **deploy the functions** and run the Vite app locally pointing at the
  deployed callbacks (providers allow `http://localhost` redirect URIs, but deploying avoids the
  emulator setup).
- Scanning (Apify) and AI qualification work locally as long as the relevant env/secret is set
  and (for AI) the functions are deployed.
