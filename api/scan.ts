/// <reference types="node" />
// POST /api/scan  { platform, keyword, timeframe } -> { ok, posts }
// Replaces the Apify-backed `scrapeLeads` callable. Reddit uses the free RSS fetcher.
// Twitter/LinkedIn have no free source, so they return [] (Free plan is Reddit-only anyway).
import { getSession } from "./_lib/auth.js";
import { searchReddit } from "./_lib/reddit.js";
import { json, methodGuard, readBody } from "./_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });

    const { platform, keyword, timeframe } = readBody(req);
    if (!keyword || !String(keyword).trim()) return json(res, 400, { error: "keyword_required" });

    if (platform === "reddit") {
      const posts = await searchReddit(String(keyword).trim(), timeframe || "week");
      return json(res, 200, { ok: true, posts });
    }
    // No free data source for twitter/linkedin — return empty rather than fabricating.
    return json(res, 200, { ok: true, posts: [] });
  } catch (err) {
    console.error("[scan]", err);
    return json(res, 200, { ok: false, posts: [] }); // never break the client's scan loop
  }
}
