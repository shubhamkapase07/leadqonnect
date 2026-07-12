/// <reference types="node" />
// POST /api/oauth/reddit/action  { action: 'start'|'disconnect'|'comment'|'message', ... }
import { getSession } from "../../../_lib/auth.js";
import { json, methodGuard, readBody } from "../../../_lib/http.js";
import { saveNonce, deleteTokens, getValidRedditToken, redditApi, setUserJsonField, redditRedirectUri } from "../../../_lib/oauth.js";
import { randomBytes } from "node:crypto";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const body = readBody(req);

    if (body.action === "start") {
      // Store a nonce and hand the client the state + redirect uri to build the authorize URL.
      const nonce = randomBytes(12).toString("hex");
      await saveNonce(session.uid, "reddit", nonce);
      const state = Buffer.from(JSON.stringify({ uid: session.uid, nonce })).toString("base64url");
      return json(res, 200, { state, redirectUri: redditRedirectUri() });
    }

    if (body.action === "disconnect") {
      await deleteTokens(session.uid, "reddit");
      await setUserJsonField(session.uid, "reddit", null);
      return json(res, 200, { ok: true });
    }

    if (body.action === "comment") {
      const { thingId, text } = body;
      if (!thingId || !String(text || "").trim()) return json(res, 400, { error: "thingId_and_text_required" });
      const token = await getValidRedditToken(session.uid);
      const r = await redditApi(token, "/api/comment", { thing_id: thingId, text });
      const created = r?.json?.data?.things?.[0]?.data;
      return json(res, 200, { ok: true, id: created?.name, permalink: created?.permalink });
    }

    if (body.action === "message") {
      const { to, subject, text } = body;
      if (!to || !String(text || "").trim()) return json(res, 400, { error: "to_and_text_required" });
      const token = await getValidRedditToken(session.uid);
      await redditApi(token, "/api/compose", { to: String(to).replace(/^u\//, ""), subject: subject?.trim() || "Hello from LeadQonnect", text });
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: "unknown_action" });
  } catch (err: any) {
    console.error("[oauth/reddit/action]", err);
    return json(res, 500, { error: err?.message || "server_error" });
  }
}
