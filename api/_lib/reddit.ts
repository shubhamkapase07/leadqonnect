// Free Reddit fetching via the public RSS feed (no API key, no Apify). Returns posts in the
// app's RawPost shape. Reddit 403s its .json endpoints and blocks generic UAs, so we use a
// browser-like User-Agent against search.rss. See leadfinder/ for the standalone version.

export interface RawPost {
  id: string;
  author: string;
  title: string;
  text: string;
  createdUtc: number;
  source: string;
  postUrl: string;
  subreddit?: string;
}

const UA = process.env.REDDIT_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#32;/g, " ").replace(/&#x200B;/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}
const stripTags = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function tag(entry: string, name: string): string {
  const m = entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : "";
}
function attr(entry: string, name: string, a: string): string {
  const m = entry.match(new RegExp(`<${name}[^>]*\\b${a}="([^"]*)"`));
  return m ? m[1] : "";
}
function extractBody(contentXml: string): string {
  const html = decodeEntities(contentXml);
  const m = html.match(/<!--\s*SC_OFF\s*-->([\s\S]*?)<!--\s*SC_ON\s*-->/);
  return decodeEntities(stripTags(m ? m[1] : "")).trim();
}
const subredditFromUrl = (url: string) => (url.match(/reddit\.com\/r\/([^/]+)\//i) || [])[1] || "";

/** Search Reddit for a keyword via RSS. Never throws — returns [] on failure. */
export async function searchReddit(keyword: string, timeframe = "week", limit = 25): Promise<RawPost[]> {
  const params = new URLSearchParams({ q: keyword, sort: "new", limit: String(limit) });
  // timeframe maps to Reddit's `t` param on relevance sorts; for sort=new it's advisory.
  if (["day", "week", "month"].includes(timeframe)) params.set("t", timeframe);

  try {
    const res = await fetch(`https://www.reddit.com/search.rss?${params.toString()}`, {
      headers: { "User-Agent": UA, Accept: "application/atom+xml, application/xml, text/xml" },
    });
    if (!res.ok) {
      console.error(`[reddit] ${res.status} on search.rss${res.status === 403 ? " (IP likely blocked)" : ""}`);
      return [];
    }
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    const posts: RawPost[] = [];
    for (const entry of entries) {
      const id = tag(entry, "id");
      if (!id.startsWith("t3_")) continue;
      const postUrl = attr(entry, "link", "href");
      const author = (tag(entry, "author").match(/<name>([\s\S]*?)<\/name>/)?.[1] || "unknown").replace(/^\/u\//, "");
      if (author === "[deleted]") continue;
      const published = tag(entry, "published") || tag(entry, "updated");
      posts.push({
        id,
        author,
        title: decodeEntities(tag(entry, "title")),
        text: extractBody(tag(entry, "content")),
        createdUtc: published ? Math.floor(Date.parse(published) / 1000) || 0 : 0,
        source: "reddit",
        postUrl,
        subreddit: subredditFromUrl(postUrl),
      });
    }
    return posts.slice(0, limit);
  } catch (err) {
    console.error("[reddit] fetch failed:", err);
    return [];
  }
}
