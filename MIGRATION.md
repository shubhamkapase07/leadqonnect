# LeadQonnect — Firebase → Turso + Vercel migration

The app no longer uses Firebase. Auth, data, real-time, scanning, AI, billing, and OAuth now
run on **Turso** (SQL) + **Vercel serverless functions** (`/api/*`), with scheduled jobs on
**GitHub Actions**. The React UI is unchanged.

## Architecture

| Concern | Before (Firebase) | Now |
|---|---|---|
| Auth | Firebase Auth | Custom JWT (`/api/auth/*`), scrypt passwords |
| Data | Firestore `users/{uid}/*` | Turso `workspace_docs` (JSON per doc) |
| Real-time | `onSnapshot` | Polling (`poll()` in `src/lib/api.ts`) |
| Scanning | Apify Cloud Function | Free Reddit RSS (`/api/scan`) |
| AI qualify | Claude Cloud Function | Gemini free tier (`/api/qualify`) |
| Reddit/Gmail | Cloud Functions | `/api/oauth/*` |
| Billing | Razorpay Cloud Functions | `/api/razorpay/*` |
| Scheduled | Cloud Scheduler | GitHub Actions (`.github/workflows/scheduled-jobs.yml`) |

Client seams (unchanged call sites): `src/lib/api.ts` (fetch + poll), `src/lib/auth-client.ts`,
`src/lib/db.ts`, `src/lib/apify.ts`, `src/lib/logger.ts`.

## Deploy

1. **Turso** is already initialized (run `npm run db:init` to re-apply `api/_lib/schema.sql`).
2. **Vercel**: import the repo (root directory = repo root). It auto-detects Vite + `api/`.
3. **Environment variables** (Vercel → Settings → Environment Variables):

**Required**
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `JWT_SECRET` — a long random string

**Recommended (free features)**
- `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-flash-latest` — AI lead qualification
- `REDDIT_USER_AGENT` — a browser-like UA for the scanner

**Optional (Pro features — dormant until set)**
- `APP_URL` — your deployed URL (e.g. `https://leadqonnect.vercel.app`); needed for OAuth callbacks
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `VITE_REDDIT_CLIENT_ID` — Reddit connect/engage
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` — Gmail connect/send
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID_PRO`, `RAZORPAY_PLAN_ID_AGENCY`, `RAZORPAY_WEBHOOK_SECRET` — billing

   OAuth redirect URIs to register: `${APP_URL}/api/oauth/reddit/callback` and `${APP_URL}/api/oauth/gmail/callback`.
   Razorpay webhook URL: `${APP_URL}/api/razorpay/webhook`.

4. **Scheduled jobs** (GitHub Actions): add the same secrets under repo Settings → Secrets → Actions
   (`TURSO_*`, `GEMINI_API_KEY`, `REDDIT_USER_AGENT`, and the OAuth ones for sequence sending).
   Reddit blocks datacenter IPs — if Actions gets 403s, run `npm run job:auto-scan` locally on a cron.

## Local dev
- Frontend: `npm run dev` (Vite, :5173). Set `VITE_API_BASE=http://localhost:3000` and run
  `vercel dev` in parallel to exercise the API, or just deploy previews.
- Secrets live in `.env.local` (gitignored). Server vars have NO `VITE_` prefix.

## Notes
- The old `functions/`, `firestore.rules`, `firebase.json` remain in the repo but are unused; delete when ready.
- Real-time features (team chat, assignments, plan changes) now poll every 3–20s instead of pushing live.
