/// <reference types="node" />
// Gemini (free tier) lead qualification — replaces the paid Claude callable.
// Returns the exact result shape the client's qualifyLead() already consumes.

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const QUALIFY_SCHEMA = {
  type: "object",
  properties: {
    intentScore: { type: "integer" },
    leadQualityScore: { type: "integer" },
    industryMatchScore: { type: "integer" },
    buyingIntentScore: { type: "integer" },
    responseProbability: { type: "integer" },
    overallOpportunityScore: { type: "integer" },
    sentiment: { type: "string", enum: ["high", "medium", "low"] },
    summary: { type: "string" },
    companyName: { type: "string" },
    companyIndustry: { type: "string" },
    budgetPotential: { type: "string" },
    recommendedAction: { type: "string" },
  },
  required: [
    "intentScore", "leadQualityScore", "industryMatchScore", "buyingIntentScore",
    "responseProbability", "overallOpportunityScore", "sentiment", "summary",
    "companyName", "companyIndustry", "budgetPotential", "recommendedAction",
  ],
};

export function aiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const clampInt = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

export async function qualifyWithGemini(lead: any, campaign: any): Promise<any | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const prompt = [
    "You are a B2B lead-qualification analyst. Score how good this social post is as a sales lead for the service below. Be precise and calibrated — do not inflate scores. All scores are integers 0-100.",
    "",
    `OUR SERVICE: ${campaign?.serviceOffered || campaign?.name || "(unspecified)"}`,
    `TARGET INDUSTRY: ${campaign?.industry || "general"}`,
    `TARGET KEYWORDS: ${(campaign?.keywords || []).join(", ") || "(none)"}`,
    "",
    `LEAD PLATFORM: ${lead.platform}`,
    `LEAD AUTHOR: ${lead.author || lead.handle || "unknown"}`,
    `LEAD TITLE: ${lead.title || ""}`,
    `LEAD CONTENT: ${(lead.content || "").slice(0, 4000)}`,
    "",
    "Judge match by how well the post's need aligns with our service; intent by how actively they're seeking a provider (budget, 'looking for', hiring); quality by specificity and decision-maker signals. Infer company/industry only if evident, else empty string.",
  ].join("\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: QUALIFY_SCHEMA },
      }),
    });
    if (!res.ok) { console.warn(`[gemini] qualify ${res.status}`); return null; }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const p = JSON.parse(text);
    return {
      intentScore: clampInt(p.intentScore),
      leadQualityScore: clampInt(p.leadQualityScore),
      industryMatchScore: clampInt(p.industryMatchScore),
      buyingIntentScore: clampInt(p.buyingIntentScore),
      responseProbability: clampInt(p.responseProbability),
      overallOpportunityScore: clampInt(p.overallOpportunityScore),
      sentiment: ["high", "medium", "low"].includes(p.sentiment) ? p.sentiment : "low",
      summary: String(p.summary || "").slice(0, 600),
      companyName: String(p.companyName || ""),
      companyIndustry: String(p.companyIndustry || ""),
      budgetPotential: String(p.budgetPotential || ""),
      recommendedAction: String(p.recommendedAction || "").slice(0, 400),
    };
  } catch (err) {
    console.warn("[gemini] qualify failed:", (err as Error).message);
    return null;
  }
}
