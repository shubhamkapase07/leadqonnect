// Lead scraping client — calls the backend /api/scan endpoint (free Reddit RSS engine).
// Kept the filename + searchApifyPosts signature so the rest of the app is unchanged.

import { apiPost } from './api';

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
 * Scrape one platform for one keyword via the backend. Returns [] (never throws) when a run
 * fails, so callers can treat "no results" uniformly. Reddit is free; twitter/linkedin
 * currently return [] (no free source).
 */
export async function searchApifyPosts(
  platform: ApifyPlatform,
  keyword: string,
  timeframe = 'week',
): Promise<RawPost[]> {
  try {
    const res = await apiPost<{ ok: boolean; posts: RawPost[] }>('/api/scan', { platform, keyword, timeframe });
    return Array.isArray(res?.posts) ? res.posts : [];
  } catch (err) {
    console.error(`[scan] ${platform} failed:`, err);
    return [];
  }
}
