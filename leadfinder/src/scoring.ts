// Deterministic lead scoring — turns a lead's text + campaign context into explainable
// Intent / Quality / Match scores (0-100). No randomness: same input => same scores.
// Ported from the original LeadQonnect app; used as the always-available fallback when
// Gemini AI scoring is off or unavailable.

export interface CampaignContext {
  keywords: string[];
  serviceOffered?: string;
  industry?: string;
  geography?: string;
}

export interface LeadScores {
  intentScore: number;        // buying/hiring intent (0-100)
  leadQualityScore: number;   // richness/specificity of the post (0-100)
  industryMatchScore: number; // fit vs the campaign's target (0-100)
  sentiment: "high" | "medium" | "low";
  reasons: string[];
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "is", "are", "with", "my", "our",
  "your", "we", "i", "it", "this", "that", "be", "as", "at", "by", "from", "can", "do", "you",
]);

const HIGH_INTENT = [
  "looking for", "look for", "need help", "need a", "need an", "need someone", "need to hire",
  "hire", "hiring", "recommend", "recommendation", "recommendations", "anyone know", "any suggestions",
  "suggestions for", "seeking", "in the market", "alternatives to", "best tool", "best service",
  "best agency", "who can", "can someone", "help me", "looking to", "want to hire", "searching for",
  "where can i find", "need recommendations",
];
const BUY_SIGNALS = ["budget", "$", "willing to pay", "paid", "quote", "retainer", "contract", "hourly rate", "per month", "asap", "urgent", "deadline"];
const LOW_INTENT = [
  "just curious", "for fun", "someday", "thinking about", "how do i", "how to", "tutorial", "guide",
  "i built", "i made", "i created", "i launched", "showcase", "available for hire", "open to work",
  "for hire", "my portfolio", "check out my", "feedback on my",
];
const SPAM = ["dm me", "check out my", "subscribe", "upvote", "follow me", "promo code", "discount code", "join my", "click here"];
const B2B = ["our team", "our company", "we are", "we're", "startup", "our business", "my company", "enterprise", "b2b", "saas", "clients"];

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function countMatches(haystack: string, needles: string[]): number {
  let n = 0;
  for (const needle of needles) if (haystack.includes(needle)) n++;
  return n;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export function scoreLead(rawText: string, ctx: CampaignContext): LeadScores {
  const text = (rawText || "").toLowerCase();
  const tokens = tokenize(text);
  const reasons: string[] = [];

  const keywords = (ctx.keywords || []).filter(Boolean);
  let matchedKeywords = 0;
  for (const kw of keywords) {
    const kwTokens = [...tokenize(kw)];
    const present = text.includes(kw.toLowerCase()) || (kwTokens.length > 0 && kwTokens.every((t) => tokens.has(t)));
    if (present) matchedKeywords++;
  }
  const kwCoverage = keywords.length ? matchedKeywords / keywords.length : 0.5;

  const serviceTokens = [...tokenize(ctx.serviceOffered || "")];
  const serviceHits = serviceTokens.filter((t) => tokens.has(t)).length;
  const serviceRatio = serviceTokens.length ? serviceHits / serviceTokens.length : 0;

  const industry = (ctx.industry || "").toLowerCase();
  const industryPresent = industry && industry !== "general" ? [...tokenize(industry)].some((t) => tokens.has(t)) : false;

  let matchScore = 40 + 45 * kwCoverage + 15 * serviceRatio + (industryPresent ? 6 : 0);
  matchScore = clamp(matchScore, 38, 99);
  if (keywords.length) reasons.push(`Matched ${matchedKeywords}/${keywords.length} campaign keyword${keywords.length > 1 ? "s" : ""}`);
  if (serviceHits > 0) reasons.push("Mentions terms from your offering");
  if (industryPresent) reasons.push(`Matches industry "${ctx.industry}"`);

  const highHits = countMatches(text, HIGH_INTENT);
  const buyHits = countMatches(text, BUY_SIGNALS);
  const lowHits = countMatches(text, LOW_INTENT);
  const spamHits = countMatches(text, SPAM);

  let intentScore = 50 + Math.min(highHits * 11, 40) + Math.min(buyHits * 7, 14) - Math.min(lowHits * 15, 45) - spamHits * 12;
  intentScore = clamp(intentScore, 5, 99);
  if (highHits > 0) reasons.push("Active buying/hiring language");
  if (buyHits > 0) reasons.push("Mentions budget or payment");
  if (lowHits > 0) reasons.push("Some low-intent signals (research/self-promo)");

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lengthScore = wordCount < 12 ? 42 : wordCount < 40 ? 55 + (wordCount - 12) * 0.7 : Math.min(78 + (wordCount - 40) * 0.2, 92);
  const asksQuestion = text.includes("?");
  const b2bHits = countMatches(text, B2B);
  let qualityScore = lengthScore + (asksQuestion ? 7 : 0) + (buyHits > 0 ? 8 : 0) + Math.min(b2bHits * 4, 10) - spamHits * 16;
  qualityScore = clamp(qualityScore, 32, 98);
  if (wordCount >= 40) reasons.push("Detailed, specific post");
  if (b2bHits > 0) reasons.push("Business / decision-maker context");
  if (spamHits > 0) reasons.push("Looks promotional");

  const sentiment: LeadScores["sentiment"] = intentScore >= 78 ? "high" : intentScore >= 55 ? "medium" : "low";

  return { intentScore, leadQualityScore: qualityScore, industryMatchScore: matchScore, sentiment, reasons };
}
