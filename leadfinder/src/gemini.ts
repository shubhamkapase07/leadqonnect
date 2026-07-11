// Gemini free-tier lead qualification.
//
// Free tier: https://aistudio.google.com/apikey — gemini-2.5-flash is generous for a
// personal cron. If GEMINI_API_KEY is unset, or a call fails/rate-limits, the scanner
// silently falls back to the deterministic scorer, so scans never break.
//
// COMMERCIAL NOTE: to swap to Claude later, replace only the fetch call below — the rest
// of the pipeline consumes this module's AiScore shape and doesn't care about the provider.

import type { CampaignContext } from "./scoring.js";

export interface AiScore {
  intent_score: number;   // 0-100 buying/hiring intent
  quality_score: number;  // 0-100 richness/specificity
  match_score: number;    // 0-100 fit vs what the user offers
  sentiment: "high" | "medium" | "low";
  summary: string;        // one-sentence what-they-want
  angle: string;          // one-sentence suggested outreach angle
  reasons: string[];
}

// "gemini-flash-latest" is an alias that tracks the current Flash model, so it won't get
// retired out from under us (older pinned versions like gemini-2.5-flash already 404 for new keys).
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export function aiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Structured-output schema so Gemini returns strict JSON we can trust.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    intent_score: { type: "integer" },
    quality_score: { type: "integer" },
    match_score: { type: "integer" },
    sentiment: { type: "string", enum: ["high", "medium", "low"] },
    summary: { type: "string" },
    angle: { type: "string" },
    reasons: { type: "array", items: { type: "string" } },
  },
  required: ["intent_score", "quality_score", "match_score", "sentiment", "summary", "angle", "reasons"],
};

function buildPrompt(title: string, body: string, ctx: CampaignContext): string {
  return [
    "You qualify social-media posts as sales leads for a service provider.",
    "",
    `The provider offers: ${ctx.serviceOffered || "(unspecified)"}`,
    ctx.industry && ctx.industry !== "general" ? `Target industry: ${ctx.industry}` : "",
    ctx.geography ? `Preferred geography: ${ctx.geography}` : "",
    `They are watching these keywords: ${(ctx.keywords || []).join(", ") || "(none)"}`,
    "",
    "Score the POST below from the provider's perspective:",
    "- intent_score: how ready this person is to hire/buy right now (0=no intent, 100=actively seeking a provider with budget).",
    "- quality_score: how specific and actionable the post is (0=vague/spam, 100=detailed real need).",
    "- match_score: how well the need fits what the provider offers (0=irrelevant, 100=perfect fit).",
    "- sentiment: overall buying signal strength (high/medium/low).",
    "- summary: one sentence on what they actually want.",
    "- angle: one sentence on how the provider should open the conversation.",
    "- reasons: 2-4 short bullet phrases justifying the scores.",
    "Be strict: self-promotion, job-seekers, tutorials, and idle curiosity score LOW on intent.",
    "",
    `POST TITLE: ${title}`,
    `POST BODY: ${body || "(no body text)"}`,
  ].filter(Boolean).join("\n");
}

const clampInt = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/** Score one post with Gemini. Returns null on any failure (caller falls back). */
export async function scoreWithGemini(
  title: string,
  body: string,
  ctx: CampaignContext,
): Promise<AiScore | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const payload = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(title, body, ctx) }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  try {
    let res: Response | null = null;
    // Free tier has a low requests-per-minute cap; on 429 wait and retry a couple times
    // (with backoff) before giving up to the deterministic fallback.
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (res.status !== 429) break;
      const wait = 8000 * (attempt + 1);
      console.warn(`[gemini] 429 rate-limited — waiting ${wait}ms (attempt ${attempt + 1}/3)`);
      await new Promise((r) => setTimeout(r, wait));
    }

    if (!res || !res.ok) {
      console.warn(`[gemini] ${res?.status ?? "no response"} — falling back to deterministic scoring`);
      return null;
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    return {
      intent_score: clampInt(parsed.intent_score),
      quality_score: clampInt(parsed.quality_score),
      match_score: clampInt(parsed.match_score),
      sentiment: ["high", "medium", "low"].includes(parsed.sentiment) ? parsed.sentiment : "low",
      summary: String(parsed.summary || "").slice(0, 500),
      angle: String(parsed.angle || "").slice(0, 500),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).slice(0, 5) : [],
    };
  } catch (err) {
    console.warn("[gemini] request failed — falling back to deterministic scoring:", (err as Error).message);
    return null;
  }
}
