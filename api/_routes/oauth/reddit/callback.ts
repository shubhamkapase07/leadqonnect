/// <reference types="node" />
// GET /api/oauth/reddit/callback — Reddit redirects here after the user approves.
import { checkNonce, redditFetchToken, storeTokens, setUserJsonField, redditRedirectUri, APP_URL } from "../../../_lib/oauth.js";

export default async function handler(req: any, res: any) {
  const appUrl = APP_URL() || "/";
  const back = (status: string) => res.redirect(`${appUrl}?reddit=${status}`);
  try {
    const { code, state, error } = req.query || {};
    if (error) return back("denied");
    if (!code || !state) return back("error");

    let uid = "", nonce = "";
    try {
      const parsed = JSON.parse(Buffer.from(String(state), "base64url").toString("utf8"));
      uid = parsed.uid; nonce = parsed.nonce;
    } catch { return back("error"); }
    if (!uid || !(await checkNonce(uid, "reddit", nonce))) return back("error");

    const token = await redditFetchToken({ grant_type: "authorization_code", code: String(code), redirect_uri: redditRedirectUri() });
    const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: { Authorization: `bearer ${token.access_token}`, "User-Agent": "web:com.leadqonnect:v1.0.0 (by /u/leadqonnect)" },
    });
    const me: any = await meRes.json();
    const username = me.name || "reddit_user";

    await storeTokens(uid, "reddit", { ...token, account: username });
    await setUserJsonField(uid, "reddit", {
      username, avatar: (me.icon_img || "").split("?")[0] || null, scope: token.scope, connectedAt: new Date().toISOString(),
    });
    return back("connected");
  } catch (err) {
    console.error("[oauth/reddit/callback]", err);
    return back("error");
  }
}
