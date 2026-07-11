/**
 * LeadQonnect Cloud Functions — Reddit connection + engagement relay, AI lead
 * qualification (Claude), team management, and Razorpay billing.
 *
 * Why this exists: a browser-only SPA can't safely complete Reddit OAuth or hold the
 * Razorpay/Anthropic secrets. These functions run those exchanges server-side and keep
 * secrets out of the client bundle.
 *
 * Required config (set before deploy — see README / SETUP.md):
 *   firebase functions:secrets:set REDDIT_CLIENT_SECRET
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
 *   functions/.env  ->  REDDIT_CLIENT_ID=...  REDDIT_REDIRECT_URI=...  APP_URL=...
 *                       RAZORPAY_KEY_ID=...  RAZORPAY_PLAN_ID_PRO=...  RAZORPAY_PLAN_ID_AGENCY=...
 */
import { onRequest, onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString, defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomBytes, createHmac } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { searchApifyPosts, scanConfigFromEnv, type ApifyPlatform, type RawPost } from "./scan.js";
import { scoreLead } from "./scoring.js";

initializeApp();
const db = getFirestore();

// --- Config ---------------------------------------------------------------
const REDDIT_CLIENT_ID = defineString("REDDIT_CLIENT_ID");
const REDDIT_REDIRECT_URI = defineString("REDDIT_REDIRECT_URI"); // must equal this function's URL
const APP_URL = defineString("APP_URL"); // where to send the user back after connecting
const REDDIT_CLIENT_SECRET = defineSecret("REDDIT_CLIENT_SECRET");

const USER_AGENT = "web:com.leadqonnect:v1.0.0 (by /u/leadqonnect)";

// --- Gmail connection (OAuth) ---
// Lets a user connect their Google account so the app can send email from their address
// (scope gmail.send only — we can't read their inbox). CLIENT_ID/REDIRECT_URI are public
// config; the CLIENT_SECRET is a secret. Same browser-can't-hold-the-secret reason as Reddit.
const GOOGLE_CLIENT_ID = defineString("GOOGLE_CLIENT_ID");
const GOOGLE_REDIRECT_URI = defineString("GOOGLE_REDIRECT_URI"); // must equal gmailCallback's URL
const GOOGLE_CLIENT_SECRET = defineSecret("GOOGLE_CLIENT_SECRET");

// --- Lead scanning (Apify) ---
// The token is a secret so it never reaches the browser. Actor ids / limits are plain
// env config (functions/.env): APIFY_ACTOR_REDDIT/_TWITTER/_LINKEDIN, APIFY_MAX_ITEMS,
// APIFY_MAX_COST_USD. See src/lib/scan.ts for normalization.
const APIFY_TOKEN = defineSecret("APIFY_TOKEN");

// --- AI lead qualification (Claude) ---
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
// Model is configurable: claude-opus-4-8 (most precise, default) → claude-haiku-4-5 (cheapest).
const LEAD_AI_MODEL = defineString("LEAD_AI_MODEL");

// --- Razorpay billing (recurring subscriptions, USD) ----------------------
// KEY_ID is public (it's returned to the browser to open Checkout). The KEY_SECRET
// and WEBHOOK_SECRET are secrets. The two PLAN_IDs reference subscription plans
// created once in Razorpay (see SETUP.md / scripts/create-razorpay-plans.mjs).
const RAZORPAY_KEY_ID = defineString("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const RAZORPAY_PLAN_ID_PRO = defineString("RAZORPAY_PLAN_ID_PRO");
const RAZORPAY_PLAN_ID_AGENCY = defineString("RAZORPAY_PLAN_ID_AGENCY");

// --- Helpers --------------------------------------------------------------
function basicAuth(): string {
  return Buffer.from(`${REDDIT_CLIENT_ID.value()}:${REDDIT_CLIENT_SECRET.value()}`).toString("base64");
}

/** Exchange an auth code or refresh token for an access token. */
async function fetchToken(params: Record<string, string>) {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new Error(`Reddit token error: ${res.status} ${JSON.stringify(json)}`);
  }
  return json as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}

/** Load the user's stored token, refreshing it if it's expired. Returns a valid access token. */
async function getValidAccessToken(uid: string): Promise<string> {
  const ref = db.collection("redditTokens").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "Reddit account not connected.");
  }
  const data = snap.data() as { accessToken: string; refreshToken?: string; expiresAt: number };

  // Still valid (with a 60s safety margin)?
  if (data.expiresAt > Date.now() + 60_000) return data.accessToken;

  if (!data.refreshToken) {
    throw new HttpsError("failed-precondition", "Reddit session expired — please reconnect.");
  }
  const refreshed = await fetchToken({ grant_type: "refresh_token", refresh_token: data.refreshToken });
  await ref.update({
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  });
  return refreshed.access_token;
}

/** Call the authenticated Reddit API with a form body. */
async function redditApi(accessToken: string, path: string, form: Record<string, string>) {
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ api_type: "json", ...form }).toString(),
  });
  const json = (await res.json()) as any;
  const errors = json?.json?.errors;
  if (!res.ok || (Array.isArray(errors) && errors.length > 0)) {
    throw new HttpsError("internal", `Reddit API error: ${JSON.stringify(errors || json)}`);
  }
  return json;
}

function requireUid(request: CallableRequest): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return request.auth.uid;
}

// --- OAuth callback (HTTP) -------------------------------------------------
// Reddit redirects the user here after they approve. We verify the state nonce,
// exchange the code for tokens, fetch the username, and persist everything.
export const redditCallback = onRequest(
  { secrets: [REDDIT_CLIENT_SECRET], cors: false },
  async (req, res) => {
    const appUrl = APP_URL.value() || "/";
    const back = (status: string) => res.redirect(`${appUrl}?reddit=${status}`);

    try {
      const { code, state, error } = req.query as Record<string, string>;
      if (error) return back("denied");
      if (!code || !state) return back("error");

      let uid = "";
      let nonce = "";
      try {
        const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
        uid = parsed.uid;
        nonce = parsed.nonce;
      } catch {
        return back("error");
      }
      if (!uid) return back("error");

      // Verify the nonce the client stored before redirecting (CSRF protection).
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists || userSnap.data()?.redditOauthNonce !== nonce) {
        return back("error");
      }

      const token = await fetchToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDDIT_REDIRECT_URI.value(),
      });

      // Who did they connect as?
      const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
        headers: { Authorization: `bearer ${token.access_token}`, "User-Agent": USER_AGENT },
      });
      const me = (await meRes.json()) as { name?: string; icon_img?: string };
      const username = me.name || "reddit_user";

      // Tokens go in a private collection (locked down by security rules — clients never read this).
      await db.collection("redditTokens").doc(uid).set({
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: Date.now() + token.expires_in * 1000,
        scope: token.scope,
        username,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Public, display-only connection info lives on the user doc the client already watches.
      await userRef.set(
        {
          reddit: {
            username,
            avatar: (me.icon_img || "").split("?")[0] || null,
            scope: token.scope,
            connectedAt: new Date().toISOString(),
          },
          redditOauthNonce: FieldValue.delete(),
        },
        { merge: true }
      );

      return back("connected");
    } catch (err) {
      console.error("redditCallback failed:", err);
      return back("error");
    }
  }
);

// --- Disconnect (callable) ------------------------------------------------
export const redditDisconnect = onCall(
  { secrets: [REDDIT_CLIENT_SECRET] },
  async (request) => {
    const uid = requireUid(request);
    const ref = db.collection("redditTokens").doc(uid);
    const snap = await ref.get();
    const refreshToken = snap.data()?.refreshToken as string | undefined;

    // Best-effort token revocation at Reddit.
    if (refreshToken) {
      try {
        await fetch("https://www.reddit.com/api/v1/revoke_token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth()}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
          },
          body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token" }).toString(),
        });
      } catch (e) {
        console.warn("revoke_token failed (continuing):", e);
      }
    }

    await ref.delete().catch(() => undefined);
    await db.collection("users").doc(uid).set({ reddit: FieldValue.delete() }, { merge: true });
    return { ok: true };
  }
);

// --- Post a comment / reply (callable) ------------------------------------
// thingId is the fullname of the parent (e.g. "t3_abc123" for a post, "t1_xyz" for a comment).
export const redditPostComment = onCall(
  { secrets: [REDDIT_CLIENT_SECRET] },
  async (request) => {
    const uid = requireUid(request);
    const { thingId, text } = (request.data || {}) as { thingId?: string; text?: string };
    if (!thingId || !text?.trim()) {
      throw new HttpsError("invalid-argument", "thingId and text are required.");
    }
    const accessToken = await getValidAccessToken(uid);
    const json = await redditApi(accessToken, "/api/comment", { thing_id: thingId, text });
    const created = json?.json?.data?.things?.[0]?.data;
    return { ok: true, id: created?.name, permalink: created?.permalink };
  }
);

// Internal Reddit DM — shared by the callable and the sequence processor.
async function redditDmInternal(uid: string, opts: { to: string; subject?: string; text: string }): Promise<void> {
  const accessToken = await getValidAccessToken(uid);
  await redditApi(accessToken, "/api/compose", {
    to: opts.to.replace(/^u\//, ""),
    subject: opts.subject?.trim() || "Hello from LeadQonnect",
    text: opts.text,
  });
}

// --- Send a direct message (callable) -------------------------------------
export const redditSendMessage = onCall(
  { secrets: [REDDIT_CLIENT_SECRET] },
  async (request) => {
    const uid = requireUid(request);
    const { to, subject, text } = (request.data || {}) as { to?: string; subject?: string; text?: string };
    if (!to || !text?.trim()) {
      throw new HttpsError("invalid-argument", "Recipient (to) and text are required.");
    }
    await redditDmInternal(uid, { to, subject, text });
    return { ok: true };
  }
);

// ==========================================================================
// Gmail connection + send relay
// ==========================================================================
// Mirror of the Reddit flow: connect via OAuth, store tokens privately in
// `gmailTokens/{uid}`, and send mail server-side with the user's access token.

/** Exchange an auth code or refresh token at Google's token endpoint. */
async function fetchGoogleToken(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID.value(),
      client_secret: GOOGLE_CLIENT_SECRET.value(),
      ...params,
    }).toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new Error(`Google token error: ${res.status} ${JSON.stringify(json)}`);
  }
  // refresh_token is only returned on the first consent (access_type=offline + prompt=consent).
  return json as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}

/** Load the user's stored Gmail token, refreshing it if expired. Returns a valid access token. */
async function getValidGmailToken(uid: string): Promise<string> {
  const ref = db.collection("gmailTokens").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "Gmail account not connected.");
  }
  const data = snap.data() as { accessToken: string; refreshToken?: string; expiresAt: number };

  if (data.expiresAt > Date.now() + 60_000) return data.accessToken;

  if (!data.refreshToken) {
    throw new HttpsError("failed-precondition", "Gmail session expired — please reconnect.");
  }
  const refreshed = await fetchGoogleToken({ grant_type: "refresh_token", refresh_token: data.refreshToken });
  await ref.update({
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  });
  return refreshed.access_token;
}

/** Build a base64url-encoded RFC 2822 message for the Gmail send endpoint. */
function buildRawEmail(opts: { to: string; subject: string; text: string; html?: string }): string {
  // RFC 2047 encode the subject so non-ASCII characters survive.
  const subject = `=?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`;
  const contentType = opts.html ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"';
  const body = opts.html ?? opts.text;
  const headers = [
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}`,
    "Content-Transfer-Encoding: base64",
  ].join("\r\n");
  // Base64-encode the body too (matches the declared transfer-encoding; avoids CRLF issues).
  const message = `${headers}\r\n\r\n${Buffer.from(body, "utf8").toString("base64")}`;
  return Buffer.from(message, "utf8").toString("base64url");
}

// --- OAuth callback (HTTP) -------------------------------------------------
export const gmailCallback = onRequest(
  { secrets: [GOOGLE_CLIENT_SECRET], cors: false },
  async (req, res) => {
    const appUrl = APP_URL.value() || "/";
    const back = (status: string) => res.redirect(`${appUrl}?gmail=${status}`);

    try {
      const { code, state, error } = req.query as Record<string, string>;
      if (error) return back("denied");
      if (!code || !state) return back("error");

      let uid = "";
      let nonce = "";
      try {
        const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
        uid = parsed.uid;
        nonce = parsed.nonce;
      } catch {
        return back("error");
      }
      if (!uid) return back("error");

      // Verify the nonce the client stored before redirecting (CSRF protection).
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists || userSnap.data()?.gmailOauthNonce !== nonce) {
        return back("error");
      }

      const token = await fetchGoogleToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: GOOGLE_REDIRECT_URI.value(),
      });

      // Which address did they connect?
      const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const me = (await meRes.json()) as { email?: string; name?: string; picture?: string };
      const email = me.email || "your account";

      // Tokens go in a private collection (locked down by security rules — clients never read this).
      await db.collection("gmailTokens").doc(uid).set({
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: Date.now() + token.expires_in * 1000,
        scope: token.scope,
        email,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Public, display-only connection info lives on the user doc the client already watches.
      await userRef.set(
        {
          gmail: {
            email,
            name: me.name || null,
            avatar: me.picture || null,
            scope: token.scope,
            connectedAt: new Date().toISOString(),
          },
          gmailOauthNonce: FieldValue.delete(),
        },
        { merge: true }
      );

      return back("connected");
    } catch (err) {
      console.error("gmailCallback failed:", err);
      return back("error");
    }
  }
);

// --- Disconnect (callable) ------------------------------------------------
export const gmailDisconnect = onCall(
  { secrets: [GOOGLE_CLIENT_SECRET] },
  async (request) => {
    const uid = requireUid(request);
    const ref = db.collection("gmailTokens").doc(uid);
    const snap = await ref.get();
    const refreshToken = snap.data()?.refreshToken as string | undefined;

    // Best-effort token revocation at Google.
    if (refreshToken) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }).toString(),
        });
      } catch (e) {
        console.warn("google revoke failed (continuing):", e);
      }
    }

    await ref.delete().catch(() => undefined);
    await db.collection("users").doc(uid).set({ gmail: FieldValue.delete() }, { merge: true });
    return { ok: true };
  }
);

// Internal Gmail send — shared by the callable and the sequence processor.
async function gmailSendInternal(
  uid: string,
  opts: { to: string; subject?: string; text?: string; html?: string },
): Promise<{ id?: string; threadId?: string }> {
  const accessToken = await getValidGmailToken(uid);
  const raw = buildRawEmail({
    to: opts.to.trim(),
    subject: opts.subject?.trim() || "Message from LeadQonnect",
    text: opts.text || "",
    html: opts.html,
  });
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new HttpsError("internal", `Gmail API error: ${JSON.stringify(json?.error || json)}`);
  }
  return { id: json.id, threadId: json.threadId };
}

// --- Send an email (callable) ---------------------------------------------
export const gmailSendEmail = onCall(
  { secrets: [GOOGLE_CLIENT_SECRET] },
  async (request) => {
    const uid = requireUid(request);
    const { to, subject, text, html } = (request.data || {}) as {
      to?: string; subject?: string; text?: string; html?: string;
    };
    if (!to?.trim() || !(text?.trim() || html?.trim())) {
      throw new HttpsError("invalid-argument", "Recipient (to) and a text or html body are required.");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
      throw new HttpsError("invalid-argument", "That doesn't look like a valid email address.");
    }
    const { id, threadId } = await gmailSendInternal(uid, { to, subject, text, html });
    return { ok: true, id, threadId };
  }
);

// --- Team (parent → child) account management -----------------------------
// A "parent" (workspace leader) provisions "child" teammate accounts directly. The child
// logs in with the temp password the parent shares, and only ever sees leads assigned to them.
// Creating an account for someone else needs the Admin SDK, hence these server-side functions.

/** Readable temporary password, e.g. "Lq-7f3a9c21". Child can change it after first login. */
function generateTempPassword(): string {
  return "Lq-" + randomBytes(6).toString("hex");
}

export const createTeamMember = onCall(async (request) => {
  const parentUid = requireUid(request);
  const { name, email, role } = (request.data || {}) as { name?: string; email?: string; role?: string };
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!name?.trim() || !cleanEmail) {
    throw new HttpsError("invalid-argument", "Name and email are required.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    throw new HttpsError("invalid-argument", "That doesn't look like a valid email.");
  }

  const tempPassword = generateTempPassword();
  let childUid: string;
  try {
    const user = await getAuth().createUser({ email: cleanEmail, password: tempPassword, displayName: name.trim() });
    childUid = user.uid;
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "An account with this email already exists.");
    }
    console.error("createTeamMember failed:", err);
    throw new HttpsError("internal", "Could not create the teammate account.");
  }

  // The child's user doc records who their parent is (used by rules + the app).
  await db.collection("users").doc(childUid).set({
    id: childUid,
    name: name.trim(),
    email: cleanEmail,
    role: (role || "Member").trim(),
    parentUid,
    plan: "free",
    status: "active",
    mustChangePassword: true,
    joinedAt: new Date().toISOString().split("T")[0],
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, uid: childUid, email: cleanEmail, tempPassword };
});

/** Verify the target user is actually a child of the caller before any destructive action. */
async function assertIsMyChild(parentUid: string, childUid: string) {
  const snap = await db.collection("users").doc(childUid).get();
  if (!snap.exists || snap.data()?.parentUid !== parentUid) {
    throw new HttpsError("permission-denied", "That teammate isn't part of your workspace.");
  }
}

export const deleteTeamMember = onCall(async (request) => {
  const parentUid = requireUid(request);
  const { uid } = (request.data || {}) as { uid?: string };
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
  await assertIsMyChild(parentUid, uid);
  await getAuth().deleteUser(uid).catch((e) => console.warn("auth deleteUser failed (continuing):", e));
  await db.collection("users").doc(uid).delete().catch(() => undefined);
  return { ok: true };
});

export const resetTeamMemberPassword = onCall(async (request) => {
  const parentUid = requireUid(request);
  const { uid } = (request.data || {}) as { uid?: string };
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
  await assertIsMyChild(parentUid, uid);
  const tempPassword = generateTempPassword();
  await getAuth().updateUser(uid, { password: tempPassword });
  await db.collection("users").doc(uid).set({ mustChangePassword: true }, { merge: true });
  return { ok: true, tempPassword };
});

// --- Refer & Earn ---------------------------------------------------------
// Each user gets a stable `referralCode`. People who sign up via ?ref=CODE get
// `referredBy` stamped on their user doc (claimReferral). Stats are computed live
// from the users collection with the Admin SDK (clients can't read other users'
// docs, so this must be server-side). Only clicks need a stored counter, kept in
// `referrals/{code}`.
const REFERRAL_COMMISSION_RATE = 0.3;             // 30% recurring
const REFERRAL_PLAN_PRICE_CENTS: Record<string, number> = { premium: 4900, agency: 14900 };

/** Make a unique referral code: a slug from the user's name/email + random suffix. */
async function generateUniqueReferralCode(seed: string): Promise<string> {
  const base = (seed || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "user";
  for (let i = 0; i < 6; i++) {
    const code = `${base}${randomBytes(3).toString("hex")}`; // base + 6 hex chars
    const q = await db.collection("users").where("referralCode", "==", code).limit(1).get();
    if (q.empty) return code;
  }
  return "ref" + randomBytes(6).toString("hex"); // fallback
}

// Count a click on a referral link. No auth (the visitor isn't signed in yet).
// Only counts for codes that belong to a real user, to avoid junk docs.
export const trackReferralClick = onCall(async (request) => {
  const { code } = (request.data || {}) as { code?: string };
  const clean = (code || "").trim().toLowerCase();
  if (!clean) return { ok: false };
  const q = await db.collection("users").where("referralCode", "==", clean).limit(1).get();
  if (q.empty) return { ok: false };
  await db.collection("referrals").doc(clean).set(
    { code: clean, ownerUid: q.docs[0].id, clicks: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { ok: true };
});

// Attribute a newly signed-up user to the referrer whose code they arrived with.
// Idempotent: sets referredBy only once, and never to the user's own code.
export const claimReferral = onCall(async (request) => {
  const uid = requireUid(request);
  const { code } = (request.data || {}) as { code?: string };
  const clean = (code || "").trim().toLowerCase();
  if (!clean) throw new HttpsError("invalid-argument", "code is required.");

  const referrerQ = await db.collection("users").where("referralCode", "==", clean).limit(1).get();
  if (referrerQ.empty) return { ok: false, reason: "unknown_code" };
  const referrer = referrerQ.docs[0];
  if (referrer.id === uid) return { ok: false, reason: "self" };

  const meRef = db.collection("users").doc(uid);
  const me = await meRef.get();
  if (me.data()?.referredBy) return { ok: false, reason: "already" };

  await meRef.set(
    { referredBy: clean, referredByUid: referrer.id, referredAt: new Date().toISOString() },
    { merge: true }
  );
  return { ok: true };
});

// Return the signed-in user's referral code + live performance stats. Lazily creates
// the code on first call so every user has one without a migration.
export const getReferralDashboard = onCall(async (request) => {
  const uid = requireUid(request);
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const data = snap.data() || {};

  let code = data.referralCode as string | undefined;
  if (!code) {
    code = await generateUniqueReferralCode((data.name as string) || (data.email as string) || "user");
    await userRef.set({ referralCode: code }, { merge: true });
  }
  // Ensure a referrals doc exists so click tracking has a home.
  await db.collection("referrals").doc(code).set({ code, ownerUid: uid }, { merge: true });
  const refSnap = await db.collection("referrals").doc(code).get();
  const clicks = (refSnap.data()?.clicks as number) || 0;

  // Everyone who signed up with this code.
  const referred = await db.collection("users").where("referredBy", "==", code).get();
  let signups = 0;
  let conversions = 0;
  let monthlyCommissionCents = 0;
  referred.forEach((d) => {
    signups++;
    const price = REFERRAL_PLAN_PRICE_CENTS[d.data().plan as string];
    if (price) {
      conversions++;
      monthlyCommissionCents += Math.round(price * REFERRAL_COMMISSION_RATE);
    }
  });

  return { code, clicks, signups, conversions, monthlyCommissionCents };
});

// --- Client error monitoring (callable) -----------------------------------
// The browser logger ships handled errors + uncaught exceptions here so they land in
// a central `errorLogs` collection (Admin-SDK writes bypass rules; clients can't read
// it — see firestore.rules). Best-effort and rate-limited client-side. We cap field
// sizes so a runaway error can't bloat documents.
const clamp = (s: unknown, n: number): string => String(s ?? "").slice(0, n);

export const logClientError = onCall(async (request) => {
  const d = (request.data || {}) as Record<string, unknown>;
  const message = clamp(d.message, 1000);
  if (!message) return { ok: false };

  await db.collection("errorLogs").add({
    uid: request.auth?.uid || null,
    level: clamp(d.level, 16) || "error",
    context: clamp(d.context, 120),
    message,
    stack: clamp(d.stack, 4000) || null,
    url: clamp(d.url, 500) || null,
    userAgent: clamp(d.userAgent, 300) || null,
    meta: d.meta ?? null,
    clientAt: clamp(d.at, 40) || null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// --- Lead scanning proxy (callable) ---------------------------------------
// Scrapes one platform for one keyword and returns normalized posts. The browser calls
// this instead of hitting Apify directly, so the token stays server-side. Scoring still
// happens client-side (it's a pure, non-secret function). Requires sign-in.
const VALID_PLATFORMS = new Set<ApifyPlatform>(["reddit", "twitter", "linkedin"]);

export const scrapeLeads = onCall(
  { secrets: [APIFY_TOKEN] },
  async (request) => {
    requireUid(request);
    const { platform, keyword, timeframe } = (request.data || {}) as {
      platform?: string; keyword?: string; timeframe?: string;
    };
    if (!platform || !VALID_PLATFORMS.has(platform as ApifyPlatform)) {
      throw new HttpsError("invalid-argument", "platform must be reddit, twitter, or linkedin.");
    }
    if (!keyword?.trim()) {
      throw new HttpsError("invalid-argument", "keyword is required.");
    }
    const cfg = scanConfigFromEnv(APIFY_TOKEN.value());
    const posts = await searchApifyPosts(
      platform as ApifyPlatform,
      keyword.trim(),
      timeframe === "day" || timeframe === "month" ? timeframe : "week",
      cfg,
    );
    return { ok: true, posts };
  }
);

// --- Scheduled auto-scan ---------------------------------------------------
// Runs daily and scans every campaign with `autoScan: true` that belongs to a paid
// (premium/agency) user. For each, it scrapes the campaign's platforms/keywords, scores
// the posts deterministically, dedups against the user's existing leads, and writes the
// new ones to users/{uid}/leads — so the pipeline fills itself with no manual trigger.
//
// Auto-scan is a paid feature, so free users are skipped (their toggle is gated client-side
// too). Requires the APIFY_TOKEN secret and a Cloud Scheduler job (created on deploy).

const PAID_PLANS = new Set(["premium", "agency", "trial"]);

function relativeTime(createdUtc: number): string {
  if (!createdUtc) return "recently";
  const diff = Math.floor(Date.now() / 1000 - createdUtc);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface CampaignDoc {
  id: string;
  name: string;
  keywords: string[];
  platforms: ApifyPlatform[];
  status?: string;
  industry?: string;
  serviceOffered?: string;
  geography?: string;
  autoScan?: boolean;
  autoScanTimeframe?: string;
  leadsCount?: number;
}

/** Scan one campaign for one user and write any new leads. Returns the count added. */
async function autoScanCampaign(uid: string, campaign: CampaignDoc, cfg: ReturnType<typeof scanConfigFromEnv>): Promise<number> {
  const timeframe = campaign.autoScanTimeframe === "day" || campaign.autoScanTimeframe === "month"
    ? campaign.autoScanTimeframe : "week";

  // Existing lead ids for this user (ids only — cheap) so we never write duplicates.
  const existingSnap = await db.collection(`users/${uid}/leads`).select().get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  const batch = db.batch();
  let added = 0;

  for (const platform of campaign.platforms) {
    for (const keyword of campaign.keywords) {
      let posts: RawPost[] = [];
      try {
        posts = await searchApifyPosts(platform, keyword, timeframe, cfg);
      } catch (e) {
        console.error(`[scheduledScan] scrape failed ${uid}/${campaign.id} ${platform}/${keyword}`, e);
        continue;
      }
      for (const post of posts) {
        const id = `l_${platform}_${post.id}`;
        if (existingIds.has(id)) continue;
        existingIds.add(id);

        const title = post.title || "";
        const content = post.text || post.title || "";
        const scores = scoreLead(`${title}\n${content}`, {
          keywords: campaign.keywords,
          serviceOffered: campaign.serviceOffered,
          industry: campaign.industry,
          geography: campaign.geography,
        });
        // Skip clearly low-intent posts (matches the client's default, non-strict filter).
        if (scores.sentiment === "low") continue;

        batch.set(db.doc(`users/${uid}/leads/${id}`), {
          id,
          platform,
          author: post.author,
          handle: post.author,
          title,
          content,
          timestamp: relativeTime(post.createdUtc),
          createdUtc: post.createdUtc,
          sentiment: scores.sentiment,
          keywords: [keyword],
          subreddit: post.subreddit || null,
          status: "potential",
          campaignId: campaign.id,
          postUrl: post.postUrl,
          intentScore: scores.intentScore,
          leadQualityScore: scores.leadQualityScore,
          industryMatchScore: scores.industryMatchScore,
          geography: campaign.geography || "Remote",
          createdAt: new Date().toISOString(),
          source: "auto",
        });
        added++;
      }
    }
  }

  // Stamp the campaign with results so the client can show "last auto-scan" + updated count.
  batch.set(
    db.doc(`users/${uid}/campaigns/${campaign.id}`),
    { leadsCount: (campaign.leadsCount || 0) + added, lastAutoScanAt: new Date().toISOString() },
    { merge: true },
  );
  await batch.commit();
  return added;
}

export const scheduledScan = onSchedule(
  { schedule: "every 24 hours", secrets: [APIFY_TOKEN], timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const cfg = scanConfigFromEnv(APIFY_TOKEN.value());
    if (!cfg.token) {
      console.warn("[scheduledScan] APIFY_TOKEN not set — skipping run.");
      return;
    }

    // Every campaign across all users that has auto-scan enabled and is active.
    const snap = await db.collectionGroup("campaigns").where("autoScan", "==", true).get();
    let scanned = 0;
    let totalAdded = 0;

    for (const doc of snap.docs) {
      const campaign = { id: doc.id, ...(doc.data() as Omit<CampaignDoc, "id">) };
      if (campaign.status === "paused") continue;
      if (!campaign.platforms?.length || !campaign.keywords?.length) continue;

      const uid = doc.ref.parent.parent?.id;
      if (!uid) continue;

      // Only run for paid users (auto-scan is a premium feature).
      const userSnap = await db.collection("users").doc(uid).get();
      const plan = (userSnap.data()?.plan as string) || "free";
      if (!PAID_PLANS.has(plan)) continue;

      try {
        const added = await autoScanCampaign(uid, campaign, cfg);
        scanned++;
        totalAdded += added;
      } catch (e) {
        console.error(`[scheduledScan] campaign ${uid}/${campaign.id} failed:`, e);
      }
    }

    console.log(`[scheduledScan] done — ${scanned} campaigns, ${totalAdded} new leads.`);
  }
);

// --- Outreach sequencing (scheduled sender) -------------------------------
// A sequence is a cadence of steps (users/{uid}/sequences). Enrolling a lead creates an
// enrollment (users/{uid}/sequenceEnrollments) with a `nextRunAt`. This job runs hourly,
// finds due enrollments, sends the current step from the user's connected Gmail/Reddit
// account, then advances to the next step (or completes). It auto-stops if the lead has
// already engaged, so we never keep messaging someone who replied.

interface SequenceStepDoc { delayDays?: number; subject?: string; body: string }
interface SequenceDoc { id: string; name: string; channel: "email" | "reddit"; steps: SequenceStepDoc[] }

// Lead statuses that mean "they engaged — stop the cadence".
const ENGAGED_STATUSES = new Set(["replied", "meeting", "proposal", "won", "lost", "archived"]);

function fillTokens(text: string, lead: any): string {
  const name = lead?.author || lead?.handle || "there";
  const firstName = String(name).replace(/^u\//, "").split(/[\s_]/)[0] || "there";
  return (text || "")
    .replace(/\{\{\s*name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*author\s*\}\}/gi, String(name))
    .replace(/\{\{\s*keyword\s*\}\}/gi, (lead?.keywords?.[0]) || "this")
    .replace(/\{\{\s*title\s*\}\}/gi, lead?.title || "");
}

export const processSequences = onSchedule(
  { schedule: "every 1 hours", secrets: [GOOGLE_CLIENT_SECRET, REDDIT_CLIENT_SECRET], timeoutSeconds: 540 },
  async () => {
    const nowMs = Date.now();
    const nowIso = new Date().toISOString();
    const snap = await db.collectionGroup("sequenceEnrollments").where("status", "==", "active").get();
    let sent = 0;

    for (const doc of snap.docs) {
      const e = doc.data() as any;
      if (e.nextRunAt && e.nextRunAt > nowIso) continue; // not due yet
      const uid = doc.ref.parent.parent?.id;
      if (!uid) continue;

      try {
        const seqSnap = await db.doc(`users/${uid}/sequences/${e.sequenceId}`).get();
        const seq = seqSnap.data() as SequenceDoc | undefined;
        if (!seq || !Array.isArray(seq.steps) || seq.steps.length === 0) {
          await doc.ref.set({ status: "failed", lastError: "Sequence not found", updatedAt: nowIso }, { merge: true });
          continue;
        }

        const leadSnap = await db.doc(`users/${uid}/leads/${e.leadId}`).get();
        const lead = leadSnap.data();
        if (lead && ENGAGED_STATUSES.has(lead.status)) {
          await doc.ref.set({ status: "stopped", lastError: "Lead already engaged", updatedAt: nowIso }, { merge: true });
          continue;
        }

        const step = seq.steps[e.currentStep];
        if (!step) {
          await doc.ref.set({ status: "completed", updatedAt: nowIso }, { merge: true });
          continue;
        }

        const body = fillTokens(step.body, lead || {});
        const subject = fillTokens(step.subject || `Following up`, lead || {});

        if (seq.channel === "email") {
          await gmailSendInternal(uid, { to: e.to, subject, text: body });
        } else {
          await redditDmInternal(uid, { to: e.to, subject, text: body });
        }
        sent++;

        // Mark the lead as contacted on the first touch.
        if (lead && lead.status === "potential") {
          await db.doc(`users/${uid}/leads/${e.leadId}`).set({ status: "contacted" }, { merge: true });
        }

        const nextStep = e.currentStep + 1;
        if (nextStep >= seq.steps.length) {
          await doc.ref.set({ currentStep: nextStep, status: "completed", lastSentAt: nowIso, updatedAt: nowIso }, { merge: true });
        } else {
          const delayDays = Number(seq.steps[nextStep].delayDays) || 0;
          const nextRunAt = new Date(nowMs + delayDays * 86_400_000).toISOString();
          await doc.ref.set({ currentStep: nextStep, nextRunAt, lastSentAt: nowIso, updatedAt: nowIso }, { merge: true });
        }
      } catch (err: any) {
        console.error(`[processSequences] ${uid}/${e.id} failed:`, err);
        await doc.ref.set(
          { status: "failed", lastError: String(err?.message || err).slice(0, 300), updatedAt: nowIso },
          { merge: true },
        );
      }
    }

    console.log(`[processSequences] sent ${sent} messages.`);
  }
);

// --- AI lead qualification (callable) -------------------------------------
// Given a lead + its campaign, Claude returns precise scores, a summary, an enrichment
// guess, and a recommended action. Uses structured outputs so the response is valid JSON.
const QUALIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intentScore: { type: "integer", description: "0-100 buying/hiring intent" },
    leadQualityScore: { type: "integer", description: "0-100 richness/specificity of the lead" },
    industryMatchScore: { type: "integer", description: "0-100 fit with the campaign's offering/industry" },
    buyingIntentScore: { type: "integer", description: "0-100 likelihood they will purchase soon" },
    responseProbability: { type: "integer", description: "0-100 likelihood they reply to outreach" },
    overallOpportunityScore: { type: "integer", description: "0-100 overall opportunity" },
    sentiment: { type: "string", enum: ["high", "medium", "low"] },
    summary: { type: "string", description: "one-sentence why this is or isn't a good lead" },
    companyName: { type: "string", description: "inferred company/org name, or empty string" },
    companyIndustry: { type: "string", description: "inferred industry, or empty string" },
    budgetPotential: { type: "string", description: "e.g. 'Low (<$2k)', 'Medium ($2k-$5k)', 'High ($5k+)'" },
    recommendedAction: { type: "string", description: "the best next step for outreach" },
  },
  required: [
    "intentScore", "leadQualityScore", "industryMatchScore", "buyingIntentScore",
    "responseProbability", "overallOpportunityScore", "sentiment", "summary",
    "companyName", "companyIndustry", "budgetPotential", "recommendedAction",
  ],
} as const;

export const qualifyLeadAI = onCall(
  { secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    requireUid(request);
    const { lead, campaign } = (request.data || {}) as { lead?: any; campaign?: any };
    if (!lead) throw new HttpsError("invalid-argument", "lead is required.");

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    const model = LEAD_AI_MODEL.value() || "claude-opus-4-8";

    const prompt = [
      `You are a B2B lead-qualification analyst. Score how good this social post is as a sales lead for the service below. Be precise and calibrated — do not inflate scores. All scores are integers 0-100.`,
      ``,
      `OUR SERVICE: ${campaign?.serviceOffered || campaign?.name || "(unspecified)"}`,
      `TARGET INDUSTRY: ${campaign?.industry || "general"}`,
      `TARGET KEYWORDS: ${(campaign?.keywords || []).join(", ") || "(none)"}`,
      ``,
      `LEAD PLATFORM: ${lead.platform}`,
      `LEAD AUTHOR: ${lead.author || lead.handle || "unknown"}`,
      `LEAD TITLE: ${lead.title || ""}`,
      `LEAD CONTENT: ${(lead.content || "").slice(0, 4000)}`,
      ``,
      `Judge match by how well the post's need aligns with our service; intent by how actively they're seeking a provider (budget, "looking for", hiring); quality by specificity and decision-maker signals. Infer company/industry only if evident, else empty string.`,
    ].join("\n");

    // Cast around SDK type lag: adaptive thinking + output_config are valid on the API
    // (model claude-opus-4-8) but may not yet be in the installed SDK's static types.
    const message: any = await client.messages.create({
      model,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: QUALIFY_SCHEMA }, effort: "low" },
      messages: [{ role: "user", content: prompt }],
    } as any);

    const textBlock = (message.content as any[]).find((b) => b.type === "text") as { text: string } | undefined;
    if (!textBlock) throw new HttpsError("internal", "No structured output returned.");
    try {
      return { ok: true, model, result: JSON.parse(textBlock.text) };
    } catch {
      throw new HttpsError("internal", "Failed to parse AI output.");
    }
  }
);

// --- Razorpay subscriptions -----------------------------------------------
// Why server-side: creating a subscription and verifying a payment both need the
// Razorpay key SECRET, which must never reach the browser. Checkout (card entry)
// happens in Razorpay's own iframe; we only create the subscription, then verify
// the signed result and flip the user's plan via the Admin SDK (bypassing rules —
// clients are blocked from writing `plan`/`razorpay` themselves).

// Map our app tiers to the configured Razorpay plan ids and the plan value we store.
function planIdForTier(tier: string): string {
  if (tier === "agency") return RAZORPAY_PLAN_ID_AGENCY.value();
  if (tier === "pro") return RAZORPAY_PLAN_ID_PRO.value();
  return "";
}
function appPlanForTier(tier: string): "premium" | "agency" {
  return tier === "agency" ? "agency" : "premium";
}

/** Call the Razorpay REST API with Basic auth (key_id:key_secret). */
async function razorpayApi(path: string, method: "GET" | "POST", body?: unknown) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID.value()}:${RAZORPAY_KEY_SECRET.value()}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new HttpsError("internal", `Razorpay error: ${res.status} ${JSON.stringify(json?.error || json)}`);
  }
  return json;
}

// Create a recurring subscription for the signed-in user and return the id + public
// key so the browser can open Checkout. We index the subscription by id so the
// webhook (and the verify step) can map it back to this user.
export const createRazorpaySubscription = onCall(
  { secrets: [RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = requireUid(request);
    const { tier } = (request.data || {}) as { tier?: string };
    if (tier !== "pro" && tier !== "agency") {
      throw new HttpsError("invalid-argument", "tier must be 'pro' or 'agency'.");
    }
    const planId = planIdForTier(tier);
    if (!planId) {
      throw new HttpsError("failed-precondition", `Razorpay plan id for '${tier}' is not configured.`);
    }

    const sub = await razorpayApi("/subscriptions", "POST", {
      plan_id: planId,
      total_count: 120, // up to 120 monthly cycles (~10y); auto-renews until cancelled
      customer_notify: 1,
      notes: { uid, tier },
    });

    const now = new Date().toISOString();
    await db.collection("razorpaySubscriptions").doc(sub.id).set(
      { uid, tier, status: sub.status, planId, createdAt: now },
      { merge: true }
    );
    await db.collection("users").doc(uid).set(
      { razorpay: { subscriptionId: sub.id, tier, status: sub.status, updatedAt: now } },
      { merge: true }
    );

    return { subscriptionId: sub.id, keyId: RAZORPAY_KEY_ID.value() };
  }
);

// Verify the signed Checkout result and activate the plan. Razorpay signs a
// subscription payment as HMAC_SHA256(payment_id + "|" + subscription_id, key_secret).
export const verifyRazorpaySubscription = onCall(
  { secrets: [RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = requireUid(request);
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = (request.data || {}) as {
      razorpay_payment_id?: string;
      razorpay_subscription_id?: string;
      razorpay_signature?: string;
    };
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      throw new HttpsError("invalid-argument", "Missing Razorpay verification fields.");
    }

    const expected = createHmac("sha256", RAZORPAY_KEY_SECRET.value())
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      throw new HttpsError("permission-denied", "Invalid payment signature.");
    }

    // The subscription must be one we created for this exact user.
    const idxSnap = await db.collection("razorpaySubscriptions").doc(razorpay_subscription_id).get();
    const idx = idxSnap.data() as { uid?: string; tier?: string } | undefined;
    if (!idx || idx.uid !== uid || (idx.tier !== "pro" && idx.tier !== "agency")) {
      throw new HttpsError("permission-denied", "Subscription does not belong to you.");
    }

    const plan = appPlanForTier(idx.tier);
    const now = new Date().toISOString();
    await db.collection("users").doc(uid).set(
      {
        plan,
        razorpay: {
          subscriptionId: razorpay_subscription_id,
          tier: idx.tier,
          status: "active",
          lastPaymentId: razorpay_payment_id,
          activatedAt: now,
          updatedAt: now,
        },
      },
      { merge: true }
    );
    await db.collection("razorpaySubscriptions").doc(razorpay_subscription_id).set(
      { status: "active", updatedAt: now },
      { merge: true }
    );

    return { ok: true, plan };
  }
);

// Razorpay webhook — the source of truth over time. Renewals (subscription.charged)
// keep the plan active; halts/cancellations/expiries downgrade to free. Configure the
// endpoint URL + a webhook secret in the Razorpay dashboard (see SETUP.md).
const RAZORPAY_DOWNGRADE_EVENTS = new Set([
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "subscription.expired",
  "subscription.paused",
]);
const RAZORPAY_ACTIVATE_EVENTS = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.resumed",
]);

export const razorpayWebhook = onRequest(
  { secrets: [RAZORPAY_WEBHOOK_SECRET], cors: false },
  async (req, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string | undefined;
      // rawBody is required — the signature is computed over the exact bytes Razorpay sent.
      const raw = (req as any).rawBody as Buffer | undefined;
      if (!signature || !raw) {
        res.status(400).send("missing signature/body");
        return;
      }
      const expected = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET.value()).update(raw).digest("hex");
      if (expected !== signature) {
        res.status(400).send("invalid signature");
        return;
      }

      const event = req.body as any;
      const subEntity = event?.payload?.subscription?.entity;
      const subId: string | undefined = subEntity?.id;
      if (subId) {
        const idxSnap = await db.collection("razorpaySubscriptions").doc(subId).get();
        const idx = idxSnap.data() as { uid?: string; tier?: string } | undefined;
        const uid = idx?.uid || subEntity?.notes?.uid;
        const tier = idx?.tier || subEntity?.notes?.tier;

        if (uid && (tier === "pro" || tier === "agency")) {
          let plan: "free" | "premium" | "agency" | undefined;
          if (RAZORPAY_ACTIVATE_EVENTS.has(event.event)) plan = appPlanForTier(tier);
          else if (RAZORPAY_DOWNGRADE_EVENTS.has(event.event)) plan = "free";

          if (plan) {
            const now = new Date().toISOString();
            await db.collection("users").doc(uid).set(
              {
                plan,
                razorpay: { subscriptionId: subId, tier, status: subEntity?.status || event.event, updatedAt: now },
              },
              { merge: true }
            );
            await db.collection("razorpaySubscriptions").doc(subId).set(
              { uid, tier, status: subEntity?.status || event.event, updatedAt: now },
              { merge: true }
            );
          }
        }
      }

      res.status(200).send("ok");
    } catch (err) {
      console.error("razorpayWebhook failed:", err);
      res.status(500).send("error");
    }
  }
);
