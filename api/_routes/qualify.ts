/// <reference types="node" />
// POST /api/qualify  { lead, campaign } -> { ok, result } | { ok:false }
// Gemini-backed lead qualification (replaces qualifyLeadAI). Returns null result on failure
// so the client falls back to its deterministic scorer.
import { getSession } from "../_lib/auth.js";
import { qualifyWithGemini } from "../_lib/gemini.js";
import { json, methodGuard, readBody } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const { lead, campaign } = readBody(req);
    if (!lead) return json(res, 400, { error: "lead_required" });

    const result = await qualifyWithGemini(lead, campaign || {});
    return json(res, 200, { ok: Boolean(result), result });
  } catch (err) {
    console.error("[qualify]", err);
    return json(res, 200, { ok: false, result: null });
  }
}
