# LeadFinder — the free lead-finding engine

A self-contained, **₹0/month** version of LeadQonnect for finding *your own* leads.
It leaves the main Firebase app untouched and runs entirely on free tiers:

```
Reddit RSS (no key)  ->  Gemini scoring (free tier)  ->  Turso (free)  ->  Vercel dashboard (free)
        \___________________ orchestrated on GitHub Actions cron (free) ___________________/
```

- **No Apify.** Reddit is scraped via its public RSS feed (`search.rss`) — no API key, no approval.
- **No Firebase.** Leads live in Turso (libSQL/SQLite).
- **No paid AI.** Gemini free tier scores leads; a built-in deterministic scorer is the fallback.
- **No server.** A GitHub Actions cron runs the scan; Vercel hosts the dashboard.

---

## ⚠️ Read this first: Reddit + datacenter IPs

Reddit closed self-service API registration in late 2025 and now also **403s its `.json`
endpoints**. The **RSS feed still works** without a key — that's what this uses. But Reddit
**blocks many datacenter IP ranges**, and GitHub Actions runs on Azure datacenter IPs.

- RSS works reliably from a **residential IP** (your own machine).
- From **GitHub Actions it may work or may get 403s** depending on Reddit's current blocks.

**If GitHub Actions gets 403s, run the scan locally on a cron instead** — same command, same
result, still free (see *Option B* below). Start with GitHub Actions; fall back to local if needed.

---

## 1. One-time setup

### a. Turso (free DB)
```bash
# install CLI: https://docs.turso.tech/cli/installation
turso db create leadfinder
turso db show leadfinder --url          # -> TURSO_DATABASE_URL
turso db tokens create leadfinder       # -> TURSO_AUTH_TOKEN
```

### b. Gemini (free AI scoring — optional)
Get a key at <https://aistudio.google.com/apikey>. Leave it blank to use deterministic scoring only.

### c. Install + configure
```bash
cd leadfinder
npm install
cp .env.example .env          # fill in TURSO_* and (optionally) GEMINI_API_KEY
npm run init-db               # creates the tables
```

### d. Edit your watchlist
Open [`config/watch.json`](config/watch.json) and set:
- `campaign.serviceOffered` — what you offer (used to score fit).
- `queries` — your keywords. Add a `subreddit` to narrow a query (big precision win), and a `limit`.

Tip: targeted subreddits (e.g. `smallbusiness`, `forhire`, `Entrepreneur`) give far better leads
than site-wide search. For hiring intent, search terms like `"hiring"` inside `r/forhire`.

## 2. Run a scan

```bash
npm run scan
```
Fetches each query, scores every post, and inserts new leads (dedupes by post id). Re-running
only adds posts it hasn't seen.

## 3. Deploy the dashboard (Vercel)

1. Push this repo to GitHub.
2. In Vercel: **New Project → import the repo → set Root Directory to `leadfinder`.**
3. Add Environment Variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and (recommended)
   `DASHBOARD_TOKEN` — any random string; the dashboard will ask for it once and remember it.
   Without `DASHBOARD_TOKEN` the dashboard is open to anyone with the URL.
4. Deploy. Open the URL → ranked, filterable leads with one-click Contacted / Won / Dismiss.

## 4. Automate scanning

### Option A — GitHub Actions (try this first)
The workflow is at [`.github/workflows/leadfinder-scan.yml`](../.github/workflows/leadfinder-scan.yml)
(runs hourly). Add these repo secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `TURSO_DATABASE_URL` | your Turso URL |
| `TURSO_AUTH_TOKEN` | your Turso token |
| `GEMINI_API_KEY` | your Gemini key (optional) |
| `REDDIT_USER_AGENT` | a browser UA string, e.g. `Mozilla/5.0 … Chrome/124.0 Safari/537.36` |

Run it manually once from the **Actions** tab to confirm it isn't getting 403s.

### Option B — local cron (if Actions gets blocked, or you prefer it)
Runs from your residential IP, so Reddit won't block it. With `.env` filled in:
```bash
# macOS/Linux: run every hour
crontab -e
# add:
0 * * * * cd /path/to/leadfinder && /usr/bin/env npm run scan >> /tmp/leadfinder.log 2>&1
```

---

## Cost

**₹0/month** within free tiers (Turso, Gemini, Vercel, GitHub Actions). The only thing that
can hit a limit is Gemini's free RPM/RPD if you scan huge volumes — turn AI off (unset
`GEMINI_API_KEY`) and the deterministic scorer takes over at zero cost.

## Going commercial later

This engine is the piece you keep. When you monetize:
- Swap Reddit RSS → an approved data source (Apify actor / official agreement) — RSS is a
  personal-scale, grey-area approach that won't hold up commercially or at volume.
- Swap Gemini → Claude in [`src/gemini.ts`](src/gemini.ts) (only the fetch call changes) for
  better qualification.
- Point the main LeadQonnect React app at Turso instead of Firestore, and add auth/billing.

## Files

| Path | What |
|---|---|
| `src/reddit.ts` | Free Reddit RSS fetcher (no key) |
| `src/scoring.ts` | Deterministic scorer (fallback) |
| `src/gemini.ts` | Gemini free-tier scorer |
| `src/scan.ts` / `src/cli.ts` | Scan orchestrator + cron entry |
| `src/turso.ts` | DB client + queries |
| `db/schema.sql` | Turso schema |
| `api/*.ts` | Vercel dashboard API |
| `index.html` | Dashboard UI |
| `config/watch.json` | Your keyword watchlist |
