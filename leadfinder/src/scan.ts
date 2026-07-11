// Scan orchestrator: for each watch query -> fetch Reddit -> score (Gemini or fallback)
// -> dedupe-insert into Turso. Pure logic; the CLI (cli.ts) wires it to config + env.

import { searchReddit, politeDelay, type RedditQuery } from "./reddit.js";
import { scoreLead, type CampaignContext } from "./scoring.js";
import { scoreWithGemini, aiEnabled } from "./gemini.js";
import { insertLeadIfNew, setMeta, type LeadRow } from "./turso.js";

export interface WatchConfig {
  campaign: {
    serviceOffered?: string;
    industry?: string;
    geography?: string;
  };
  queries: RedditQuery[];
}

export interface ScanResult {
  queriesRun: number;
  postsSeen: number;
  newLeads: number;
  aiScored: number;
}

/** Score one post — Gemini if enabled, else the deterministic scorer. */
async function scorePost(
  title: string,
  body: string,
  ctx: CampaignContext,
): Promise<Pick<LeadRow, "intent_score" | "quality_score" | "match_score" | "sentiment" | "reasons" | "ai_used" | "ai_summary" | "ai_angle">> {
  const text = `${title}\n${body}`.trim();

  const ai = await scoreWithGemini(title, body, ctx);
  if (ai) {
    return {
      intent_score: ai.intent_score,
      quality_score: ai.quality_score,
      match_score: ai.match_score,
      sentiment: ai.sentiment,
      reasons: ai.reasons,
      ai_used: true,
      ai_summary: ai.summary,
      ai_angle: ai.angle,
    };
  }

  const s = scoreLead(text, ctx);
  return {
    intent_score: s.intentScore,
    quality_score: s.leadQualityScore,
    match_score: s.industryMatchScore,
    sentiment: s.sentiment,
    reasons: s.reasons,
    ai_used: false,
    ai_summary: "",
    ai_angle: "",
  };
}

export async function runScan(config: WatchConfig): Promise<ScanResult> {
  const keywords = config.queries.map((q) => q.keyword);
  const result: ScanResult = { queriesRun: 0, postsSeen: 0, newLeads: 0, aiScored: 0 };

  console.log(`[scan] starting — ${config.queries.length} queries, AI scoring ${aiEnabled() ? "ON (Gemini)" : "OFF (deterministic)"}`);

  for (const q of config.queries) {
    result.queriesRun++;
    const posts = await searchReddit(q);
    result.postsSeen += posts.length;
    console.log(`[scan] "${q.keyword}"${q.subreddit ? ` in r/${q.subreddit}` : ""} -> ${posts.length} posts`);

    for (const p of posts) {
      const ctx: CampaignContext = {
        keywords,
        serviceOffered: config.campaign.serviceOffered,
        industry: config.campaign.industry,
        geography: config.campaign.geography,
      };
      const scored = await scorePost(p.title, p.text, ctx);
      if (scored.ai_used) result.aiScored++;

      const lead: LeadRow = {
        id: `reddit_${p.id}`,
        source: "reddit",
        source_id: p.id,
        keyword: q.keyword,
        subreddit: p.subreddit,
        author: p.author,
        title: p.title,
        body: p.text,
        url: p.postUrl,
        created_utc: p.createdUtc,
        ...scored,
      };

      const isNew = await insertLeadIfNew(lead);
      if (isNew) result.newLeads++;
    }

    // Be polite to Reddit's public endpoints between queries.
    await politeDelay();
  }

  await setMeta("last_scan_at", String(Math.floor(Date.now() / 1000)));
  await setMeta("last_scan_result", JSON.stringify(result));
  console.log(`[scan] done — ${result.newLeads} new leads from ${result.postsSeen} posts (${result.aiScored} AI-scored)`);
  return result;
}
