// Lead scraping client — calls the server-side `scrapeLeads` Cloud Function.
//
// The actual Apify integration (token, actors, normalization) lives in
// functions/src/scan.ts. The token never reaches the browser; this module is just a thin
// typed wrapper around the callable so the rest of the app keeps the same API it had when
// scraping ran client-side.

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

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

export type ApifyPlatform = 'reddit' | 'twitter' | 'linkedin';

/**
 * Scrape one platform for one keyword via the backend proxy.
 * Returns [] (never throws) when scanning is unconfigured or the run fails, so the caller
 * can treat "no results" uniformly.
 */
export async function searchApifyPosts(
  platform: ApifyPlatform,
  keyword: string,
  timeframe = 'week',
): Promise<RawPost[]> {
  try {
    const call = httpsCallable<
      { platform: ApifyPlatform; keyword: string; timeframe: string },
      { ok: boolean; posts: RawPost[] }
    >(functions, 'scrapeLeads');
    const res = await call({ platform, keyword, timeframe });
    return Array.isArray(res.data?.posts) ? res.data.posts : [];
  } catch (err) {
    console.error(`[scrapeLeads] ${platform} failed:`, err);
    return [];
  }
}
