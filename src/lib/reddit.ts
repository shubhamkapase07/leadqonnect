// Hacker News Algolia API — free, no auth, CORS-enabled.
// https://hn.algolia.com/api/v1/
// Reddit blocked all server-side requests via Cloudflare TLS fingerprinting.

export interface RawPost {
  id: string;
  author: string;
  title: string;
  text: string;        // plain text, HTML stripped
  createdUtc: number;  // Unix timestamp in seconds
  source: string;
  postUrl: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sinceTimestamp(timeframe: string): number {
  const now = Math.floor(Date.now() / 1000);
  if (timeframe === 'day') return now - 86_400;
  if (timeframe === 'month') return now - 2_592_000;
  return now - 604_800; // week
}

async function hnFetch(
  endpoint: 'search' | 'search_by_date',
  params: Record<string, string>
): Promise<any[]> {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://hn.algolia.com/api/v1/${endpoint}?${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.hits ?? [];
  } catch {
    return [];
  }
}

export async function searchRedditPosts(keyword: string, timeframe = 'week'): Promise<RawPost[]> {
  const since = sinceTimestamp(timeframe);
  const timeFilter = `created_at_i>${since}`;
  const seen = new Set<string>();
  const results: RawPost[] = [];

  const add = (hits: any[], isComment: boolean) => {
    for (const hit of hits) {
      const id: string = hit.objectID;
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const rawText = isComment ? (hit.comment_text || '') : (hit.story_text || '');
      const text = stripHtml(rawText);
      const title = isComment
        ? (hit.story_title || hit.title || '')
        : (hit.title || '');

      results.push({
        id,
        author: hit.author || 'hn-user',
        title,
        text: text || title,
        createdUtc: hit.created_at_i || 0,
        source: 'hackernews',
        postUrl: `https://news.ycombinator.com/item?id=${id}`,
      });
    }
  };

  // Ask HN stories: hiring/seeking for this keyword
  const [hiringStories, seekingStories, freelancerComments, generalStories] = await Promise.all([
    hnFetch('search_by_date', {
      query: `${keyword} hiring`,
      tags: 'ask_hn',
      numericFilters: timeFilter,
      hitsPerPage: '20',
    }),
    hnFetch('search_by_date', {
      query: `seeking ${keyword}`,
      tags: 'ask_hn',
      numericFilters: timeFilter,
      hitsPerPage: '20',
    }),
    // Comments in "Freelancer? Seeking freelancer?" and "Who is hiring?" threads
    hnFetch('search_by_date', {
      query: keyword,
      tags: 'comment',
      numericFilters: timeFilter,
      hitsPerPage: '40',
    }),
    // General stories: freelance / contractor / agency
    hnFetch('search_by_date', {
      query: `${keyword} freelance contractor agency recommend`,
      numericFilters: timeFilter,
      hitsPerPage: '20',
    }),
  ]);

  add(hiringStories, false);
  add(seekingStories, false);
  add(freelancerComments, true);
  add(generalStories, false);

  return results;
}
