// Free Reddit fetching — NO API key, NO Apify.
//
// Reddit closed self-service API registration in late 2025 and now also 403s its public
// `.json` endpoints for most non-browser clients. What still works, unauthenticated, is the
// Atom/RSS feed (search.rss). We parse that. It's rate-limited, so we send a browser-like
// User-Agent, sleep between requests, and back off on 429. Fine for personal, low-volume use.
//
// NOTE: Reddit blocks many datacenter IP ranges. RSS works reliably from a residential IP
// (your machine). If a GitHub Actions run gets 403s, run `npm run scan` locally on a cron
// instead — same code, same result, still free. See README.

export interface RawPost {
  id: string;         // reddit fullname, e.g. "t3_abc123" (globally unique)
  author: string;
  title: string;
  text: string;       // selftext (may be empty for link posts)
  createdUtc: number; // unix seconds
  postUrl: string;    // permalink on reddit.com
  subreddit: string;
}

export interface RedditQuery {
  keyword: string;
  subreddit?: string; // if set, restrict search to r/<subreddit>
  limit?: number;     // max posts to keep per query (default 25)
}

// Reddit 403s script-style UAs on these endpoints; a browser-like UA is accepted.
const UA =
  process.env.REDDIT_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Undo XML/HTML entity encoding (the feed double-encodes selftext).
function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#32;/g, " ").replace(/&#x200B;/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&"); // do &amp; LAST so we don't double-decode
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tag(entry: string, name: string): string {
  const m = entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : "";
}

function attr(entry: string, name: string, attribute: string): string {
  const m = entry.match(new RegExp(`<${name}[^>]*\\b${attribute}="([^"]*)"`));
  return m ? m[1] : "";
}

// Extract the real post body: it sits between the SC_OFF / SC_ON markers; everything after
// SC_ON is Reddit's "submitted by … to r/… [link] [comments]" footer, which we drop.
function extractBody(contentXml: string): string {
  const html = decodeEntities(contentXml);
  const m = html.match(/<!--\s*SC_OFF\s*-->([\s\S]*?)<!--\s*SC_ON\s*-->/);
  const bodyHtml = m ? m[1] : "";
  return decodeEntities(stripTags(bodyHtml)).trim();
}

function subredditFromUrl(url: string): string {
  const m = url.match(/reddit\.com\/r\/([^/]+)\//i);
  return m ? m[1] : "";
}

/** Fetch one RSS URL with a browser UA, retrying once on 429. Returns "" on failure. */
async function getRss(url: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/atom+xml, application/xml, text/xml" } });
    if (res.status === 429) {
      const wait = 5000 * (attempt + 1);
      console.warn(`[reddit] 429 on ${url} — waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      console.error(`[reddit] ${res.status} on ${url}${res.status === 403 ? " (IP likely blocked — try running locally, see README)" : ""}`);
      return "";
    }
    return res.text();
  }
  return "";
}

/**
 * Search Reddit for posts matching a query via the RSS feed. Newest-first, normalized.
 * Never throws — returns [] on any failure so one bad query can't kill a scan.
 */
export async function searchReddit(q: RedditQuery): Promise<RawPost[]> {
  const limit = Math.min(Math.max(q.limit ?? 25, 1), 100);
  const params = new URLSearchParams({ q: q.keyword, sort: "new", limit: String(limit) });

  let base: string;
  if (q.subreddit && q.subreddit.trim()) {
    params.set("restrict_sr", "1");
    base = `https://www.reddit.com/r/${encodeURIComponent(q.subreddit.trim())}/search.rss`;
  } else {
    base = `https://www.reddit.com/search.rss`;
  }

  const xml = await getRss(`${base}?${params.toString()}`);
  if (!xml) return [];

  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const posts: RawPost[] = [];

  for (const entry of entries) {
    const id = tag(entry, "id") || "";
    if (!id.startsWith("t3_")) continue; // only link/self posts

    const postUrl = attr(entry, "link", "href");
    const author = tag(entry, "author").match(/<name>([\s\S]*?)<\/name>/)?.[1]?.replace(/^\/u\//, "") || "unknown";
    const title = decodeEntities(tag(entry, "title"));
    const published = tag(entry, "published") || tag(entry, "updated");
    const contentXml = tag(entry, "content");

    if (author === "[deleted]") continue;

    posts.push({
      id,
      author,
      title,
      text: extractBody(contentXml),
      createdUtc: published ? Math.floor(Date.parse(published) / 1000) || 0 : 0,
      postUrl,
      subreddit: subredditFromUrl(postUrl) || (q.subreddit || ""),
    });
  }

  return posts.slice(0, limit);
}

/** Politeness delay to space out consecutive Reddit calls within a scan. */
export const politeDelay = () => sleep(2000);
