// Server-side Apify scraping — the production home for lead scanning.
//
// Moved here from the client (src/lib/apify.ts) so the Apify token never ships in the
// browser bundle. The token is read from the APIFY_TOKEN secret; actor ids and limits
// are plain env config. Both the `scrapeLeads` callable and the scheduled auto-scan use
// this module, so normalization stays in one place.

export interface RawPost {
  id: string;
  author: string;
  title: string;
  text: string;        // plain text
  createdUtc: number;  // Unix timestamp in seconds (0 if unknown)
  source: string;      // platform key
  postUrl: string;
  subreddit?: string;
}

export type ApifyPlatform = "reddit" | "twitter" | "linkedin";

export interface ScanConfig {
  token: string;
  actors: Record<ApifyPlatform, string>;
  maxItems: number;
  maxCostUsd: number;
}

/** Build config from process.env + the resolved secret token. */
export function scanConfigFromEnv(token: string): ScanConfig {
  const e = process.env;
  return {
    token,
    actors: {
      reddit: e.APIFY_ACTOR_REDDIT || "trudax~reddit-scraper-lite",
      twitter: e.APIFY_ACTOR_TWITTER || "kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest",
      linkedin: e.APIFY_ACTOR_LINKEDIN || "harvestapi~linkedin-post-search",
    },
    maxItems: Number(e.APIFY_MAX_ITEMS) || 10,
    maxCostUsd: Number(e.APIFY_MAX_COST_USD) || 0.3,
  };
}

// Build the actor-specific input payload. Field names match each actor's input schema.
function buildInput(platform: ApifyPlatform, keyword: string, timeframe: string, maxItems: number): object {
  switch (platform) {
    case "reddit":
      return {
        searches: [keyword],
        maxItems,
        sort: "new",
        time: timeframe === "day" ? "day" : timeframe === "month" ? "month" : "week",
        searchPosts: true,
        searchComments: false,
        searchCommunities: false,
        searchUsers: false,
      };
    case "twitter":
      return { searchTerms: [keyword], maxItems, queryType: "Latest", lang: "en" };
    case "linkedin":
      return { searchQueries: [keyword], maxPosts: maxItems };
  }
}

// --- defensive field extraction (actors disagree on field names) ---
const NESTED_NAME_KEYS = ["name", "username", "userName", "fullName", "full_name", "firstName", "screen_name", "handle"];

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
    if (v && typeof v === "object") {
      const nested = pick(v as Record<string, unknown>, NESTED_NAME_KEYS);
      if (nested) return nested;
    }
  }
  return "";
}

// Bot-protection pages sometimes leak through as "items" — drop them.
const BOT_BLOCK = /not a bot|security service to protect|verif(y|ying) you are (a )?human|enable javascript and cookies|just a moment/i;

function coerceUnix(v: unknown, depth = 0): number {
  if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
    const num = Number(v);
    if (!Number.isNaN(num) && num > 0) return num > 1e12 ? Math.floor(num / 1000) : num;
  }
  if (v && typeof v === "object" && depth < 1) {
    const o = v as Record<string, unknown>;
    return coerceUnix(o.timestamp ?? o.date ?? o.time ?? o.value, depth + 1);
  }
  return 0;
}

function toUnix(obj: Record<string, unknown>): number {
  return coerceUnix(
    obj.createdUtc ?? obj.created_utc ?? obj.createdAt ?? obj.created_at ??
    obj.date ?? obj.timestamp ?? obj.postedAt ?? obj.time ?? obj.publishedAt,
  );
}

function normalize(platform: ApifyPlatform, raw: Record<string, unknown>, idx: number): RawPost | null {
  const title = pick(raw, ["title", "questionTitle", "question", "headline"]);
  const text = pick(raw, [
    "text", "body", "content", "selftext", "description",
    "fullText", "full_text", "postText", "answer", "snippet",
  ]);
  if (!title && !text) return null;
  if (BOT_BLOCK.test(`${title} ${text}`)) return null;

  const postUrl = pick(raw, ["url", "postUrl", "post_url", "link", "permalink", "linkedinUrl", "twitterUrl", "tweetUrl"]);
  const id = pick(raw, ["id", "objectID", "postId", "tweetId", "parsedId"]) || postUrl || `${platform}_${idx}`;

  return {
    id: String(id),
    author: pick(raw, ["author", "username", "userName", "authorName", "author_name", "user", "from"]) || `${platform}-user`,
    title,
    text: text || title,
    createdUtc: toUnix(raw),
    source: platform,
    postUrl: postUrl || "",
    subreddit: pick(raw, ["subreddit", "community", "communityName"]) || undefined,
  };
}

/**
 * Run the platform's actor synchronously and return normalized posts.
 * Returns [] (never throws) when the token is missing or the run fails.
 */
export async function searchApifyPosts(
  platform: ApifyPlatform,
  keyword: string,
  timeframe: string,
  cfg: ScanConfig,
): Promise<RawPost[]> {
  if (!cfg.token) {
    console.warn("[scan] APIFY_TOKEN is not set — skipping scrape for", platform);
    return [];
  }

  const actorId = cfg.actors[platform];
  const url =
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(cfg.token)}&maxItems=${cfg.maxItems}&maxTotalChargeUsd=${cfg.maxCostUsd}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildInput(platform, keyword, timeframe, cfg.maxItems)),
    });
    if (!res.ok) {
      console.error(`[scan] ${platform} actor ${actorId} returned ${res.status}`, await res.text().catch(() => ""));
      return [];
    }
    const data = await res.json();
    const items: Record<string, unknown>[] = Array.isArray(data) ? data : (data?.items ?? []);
    return items
      .map((item, i) => normalize(platform, item, i))
      .filter((p): p is RawPost => p !== null);
  } catch (err) {
    console.error(`[scan] ${platform} run failed:`, err);
    return [];
  }
}
