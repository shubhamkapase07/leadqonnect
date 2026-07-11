// OAuth helpers for Reddit + Gmail connection/engagement (replaces the Cloud Functions relay).
// Tokens live in the private oauth_tokens table; nonces in oauth_nonces. Requires these env
// vars (set in Vercel): REDDIT_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET, APP_URL.
import { db, nowSec } from "./turso.js";

export const APP_URL = () => process.env.APP_URL || "";
const REDDIT_UA = "web:com.leadqonnect:v1.0.0 (by /u/leadqonnect)";

export const redditRedirectUri = () => `${APP_URL()}/api/oauth/reddit/callback`;
export const gmailRedirectUri = () => `${APP_URL()}/api/oauth/gmail/callback`;

// --- nonce store (CSRF) ---
export async function saveNonce(uid: string, provider: string, nonce: string) {
  await db().execute({
    sql: `INSERT INTO oauth_nonces (user_id, provider, nonce, created_at) VALUES (?,?,?,?)
          ON CONFLICT (user_id, provider) DO UPDATE SET nonce=excluded.nonce, created_at=excluded.created_at`,
    args: [uid, provider, nonce, nowSec()],
  });
}
export async function checkNonce(uid: string, provider: string, nonce: string): Promise<boolean> {
  const r = await db().execute({ sql: "SELECT nonce FROM oauth_nonces WHERE user_id=? AND provider=?", args: [uid, provider] });
  const ok = r.rows.length > 0 && String(r.rows[0].nonce) === nonce;
  if (ok) await db().execute({ sql: "DELETE FROM oauth_nonces WHERE user_id=? AND provider=?", args: [uid, provider] });
  return ok;
}

// --- token store ---
export async function storeTokens(uid: string, provider: string, t: { access_token: string; refresh_token?: string | null; expires_in: number; scope?: string; account?: string }) {
  await db().execute({
    sql: `INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, expires_at, scope, account, updated_at)
          VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT (user_id, provider) DO UPDATE SET
            access_token=excluded.access_token,
            refresh_token=COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
            expires_at=excluded.expires_at, scope=excluded.scope, account=excluded.account, updated_at=excluded.updated_at`,
    args: [uid, provider, t.access_token, t.refresh_token || null, Date.now() + t.expires_in * 1000, t.scope || "", t.account || "", nowSec()],
  });
}
export async function deleteTokens(uid: string, provider: string) {
  await db().execute({ sql: "DELETE FROM oauth_tokens WHERE user_id=? AND provider=?", args: [uid, provider] });
}

// --- Reddit ---
function redditBasicAuth() {
  return Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
}
export async function redditFetchToken(params: Record<string, string>) {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { Authorization: `Basic ${redditBasicAuth()}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": REDDIT_UA },
    body: new URLSearchParams(params).toString(),
  });
  const json: any = await res.json();
  if (!res.ok || json.error) throw new Error(`Reddit token error: ${res.status} ${JSON.stringify(json)}`);
  return json as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}
export async function getValidRedditToken(uid: string): Promise<string> {
  const r = await db().execute({ sql: "SELECT * FROM oauth_tokens WHERE user_id=? AND provider='reddit'", args: [uid] });
  if (!r.rows.length) throw new Error("Reddit not connected");
  const row: any = r.rows[0];
  if (Number(row.expires_at) > Date.now() + 60_000) return row.access_token;
  if (!row.refresh_token) throw new Error("Reddit session expired");
  const refreshed = await redditFetchToken({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await storeTokens(uid, "reddit", refreshed);
  return refreshed.access_token;
}
export async function redditApi(token: string, path: string, form: Record<string, string>) {
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": REDDIT_UA },
    body: new URLSearchParams({ api_type: "json", ...form }).toString(),
  });
  const json: any = await res.json();
  const errors = json?.json?.errors;
  if (!res.ok || (Array.isArray(errors) && errors.length)) throw new Error(`Reddit API error: ${JSON.stringify(errors || json)}`);
  return json;
}

// --- Google / Gmail ---
export async function googleFetchToken(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", ...params }).toString(),
  });
  const json: any = await res.json();
  if (!res.ok || json.error) throw new Error(`Google token error: ${res.status} ${JSON.stringify(json)}`);
  return json as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}
export async function getValidGmailToken(uid: string): Promise<string> {
  const r = await db().execute({ sql: "SELECT * FROM oauth_tokens WHERE user_id=? AND provider='gmail'", args: [uid] });
  if (!r.rows.length) throw new Error("Gmail not connected");
  const row: any = r.rows[0];
  if (Number(row.expires_at) > Date.now() + 60_000) return row.access_token;
  if (!row.refresh_token) throw new Error("Gmail session expired");
  const refreshed = await googleFetchToken({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await storeTokens(uid, "gmail", refreshed);
  return refreshed.access_token;
}
export function buildRawEmail(opts: { to: string; subject: string; text: string; html?: string }): string {
  const subject = `=?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`;
  const contentType = opts.html ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"';
  const body = opts.html ?? opts.text;
  const headers = [`To: ${opts.to}`, `Subject: ${subject}`, "MIME-Version: 1.0", `Content-Type: ${contentType}`, "Content-Transfer-Encoding: base64"].join("\r\n");
  const message = `${headers}\r\n\r\n${Buffer.from(body, "utf8").toString("base64")}`;
  return Buffer.from(message, "utf8").toString("base64url");
}
export async function gmailSend(uid: string, opts: { to: string; subject?: string; text?: string; html?: string }) {
  const token = await getValidGmailToken(uid);
  const raw = buildRawEmail({ to: opts.to.trim(), subject: opts.subject?.trim() || "Message from LeadQonnect", text: opts.text || "", html: opts.html });
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Gmail API error: ${JSON.stringify(json?.error || json)}`);
  return { id: json.id, threadId: json.threadId };
}

export async function setUserJsonField(uid: string, field: "reddit" | "gmail", value: any) {
  await db().execute({ sql: `UPDATE users SET ${field} = ? WHERE uid = ?`, args: [value ? JSON.stringify(value) : null, uid] });
}
