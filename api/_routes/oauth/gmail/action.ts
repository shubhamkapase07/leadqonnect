/// <reference types="node" />
// POST /api/oauth/gmail/action  { action: 'start'|'disconnect'|'send', ... }
import { getSession } from "../../../_lib/auth.js";
import { json, methodGuard, readBody, isEmail } from "../../../_lib/http.js";
import { saveNonce, deleteTokens, gmailSend, setUserJsonField, gmailRedirectUri } from "../../../_lib/oauth.js";
import { randomBytes } from "node:crypto";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const session = await getSession(req);
    if (!session) return json(res, 401, { error: "unauthenticated" });
    const body = readBody(req);

    if (body.action === "start") {
      const nonce = randomBytes(12).toString("hex");
      await saveNonce(session.uid, "gmail", nonce);
      const state = Buffer.from(JSON.stringify({ uid: session.uid, nonce })).toString("base64url");
      return json(res, 200, { state, redirectUri: gmailRedirectUri() });
    }

    if (body.action === "disconnect") {
      await deleteTokens(session.uid, "gmail");
      await setUserJsonField(session.uid, "gmail", null);
      return json(res, 200, { ok: true });
    }

    if (body.action === "send") {
      const { to, subject, text, html } = body;
      if (!to || !isEmail(String(to).trim())) return json(res, 400, { error: "invalid_to" });
      if (!(String(text || "").trim() || String(html || "").trim())) return json(res, 400, { error: "empty_body" });
      const r = await gmailSend(session.uid, { to, subject, text, html });
      return json(res, 200, { ok: true, id: r.id });
    }

    return json(res, 400, { error: "unknown_action" });
  } catch (err: any) {
    console.error("[oauth/gmail/action]", err);
    return json(res, 500, { error: err?.message || "server_error" });
  }
}
