/// <reference types="node" />
// GET /api/oauth/gmail/callback — Google redirects here after the user approves.
import { checkNonce, googleFetchToken, storeTokens, setUserJsonField, gmailRedirectUri, APP_URL } from "../../../_lib/oauth.js";

export default async function handler(req: any, res: any) {
  const appUrl = APP_URL() || "/";
  const back = (status: string) => res.redirect(`${appUrl}?gmail=${status}`);
  try {
    const { code, state, error } = req.query || {};
    if (error) return back("denied");
    if (!code || !state) return back("error");

    let uid = "", nonce = "";
    try {
      const parsed = JSON.parse(Buffer.from(String(state), "base64url").toString("utf8"));
      uid = parsed.uid; nonce = parsed.nonce;
    } catch { return back("error"); }
    if (!uid || !(await checkNonce(uid, "gmail", nonce))) return back("error");

    const token = await googleFetchToken({ grant_type: "authorization_code", code: String(code), redirect_uri: gmailRedirectUri() });
    const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const me: any = await meRes.json();
    const email = me.email || "your account";

    await storeTokens(uid, "gmail", { ...token, account: email });
    await setUserJsonField(uid, "gmail", {
      email, name: me.name || null, avatar: me.picture || null, scope: token.scope, connectedAt: new Date().toISOString(),
    });
    return back("connected");
  } catch (err) {
    console.error("[oauth/gmail/callback]", err);
    return back("error");
  }
}
