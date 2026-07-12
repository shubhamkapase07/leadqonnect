/// <reference types="node" />
// Single API function. A rewrite in vercel.json sends every /api/* request here as
// /api/index?path=<subpath>, so ONE Serverless Function serves all routes (Hobby plan
// caps deployments at 12 functions). Handlers live in api/_routes/** (the `_` keeps them
// out of the function count). bodyParser is disabled so we can hand the Razorpay webhook
// the exact raw bytes it needs for signature verification; all other routes get parsed JSON.

export const config = { api: { bodyParser: false } };

import authSignup from "./_routes/auth/signup.js";
import authLogin from "./_routes/auth/login.js";
import authMe from "./_routes/auth/me.js";
import authLogout from "./_routes/auth/logout.js";
import workspaceLoad from "./_routes/workspace/load.js";
import workspaceSync from "./_routes/workspace/sync.js";
import assignedToMe from "./_routes/assignments/assigned-to-me.js";
import assignmentsOwned from "./_routes/assignments/owned.js";
import assignmentsMutate from "./_routes/assignments/mutate.js";
import enrollments from "./_routes/enrollments.js";
import enroll from "./_routes/enroll.js";
import user from "./_routes/user.js";
import scan from "./_routes/scan.js";
import qualify from "./_routes/qualify.js";
import log from "./_routes/log.js";
import referrals from "./_routes/referrals.js";
import teamRoster from "./_routes/team/roster.js";
import teamChat from "./_routes/team/chat.js";
import teamManage from "./_routes/team/manage.js";
import adminUsers from "./_routes/admin/users.js";
import adminManage from "./_routes/admin/manage.js";
import redditAction from "./_routes/oauth/reddit/action.js";
import redditCallback from "./_routes/oauth/reddit/callback.js";
import gmailAction from "./_routes/oauth/gmail/action.js";
import gmailCallback from "./_routes/oauth/gmail/callback.js";
import razorpayCreate from "./_routes/razorpay/create.js";
import razorpayVerify from "./_routes/razorpay/verify.js";
import razorpayWebhook from "./_routes/razorpay/webhook.js";

type Handler = (req: any, res: any) => any;

const ROUTES: Record<string, Handler> = {
  "auth/signup": authSignup,
  "auth/login": authLogin,
  "auth/me": authMe,
  "auth/logout": authLogout,
  "workspace/load": workspaceLoad,
  "workspace/sync": workspaceSync,
  "assignments/assigned-to-me": assignedToMe,
  "assignments/owned": assignmentsOwned,
  "assignments/mutate": assignmentsMutate,
  "enrollments": enrollments,
  "enroll": enroll,
  "user": user,
  "scan": scan,
  "qualify": qualify,
  "log": log,
  "referrals": referrals,
  "team/roster": teamRoster,
  "team/chat": teamChat,
  "team/manage": teamManage,
  "admin/users": adminUsers,
  "admin/manage": adminManage,
  "oauth/reddit/action": redditAction,
  "oauth/reddit/callback": redditCallback,
  "oauth/gmail/action": gmailAction,
  "oauth/gmail/callback": gmailCallback,
  "razorpay/create": razorpayCreate,
  "razorpay/verify": razorpayVerify,
  "razorpay/webhook": razorpayWebhook,
};

function readRaw(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function safeJson(s: string): any { try { return JSON.parse(s); } catch { return {}; } }

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || "/", "http://x");
  const params = Object.fromEntries(url.searchParams);
  // Ensure handlers that read req.query.<param> keep working regardless of body parsing.
  req.query = { ...(req.query || {}), ...params };

  // Path comes from the rewrite (?path=<subpath>); fall back to the URL pathname.
  const key = String(req.query.path || url.pathname.replace(/^\/api\//, ""))
    .replace(/^\/+|\/+$/g, "");

  const route = ROUTES[key];
  if (!route) { res.status(404).json({ error: "not_found", path: key }); return; }

  // Read the body once. The webhook needs the raw bytes; everyone else gets parsed JSON.
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    const raw = await readRaw(req);
    req.rawBody = raw;
    if (key !== "razorpay/webhook") {
      const txt = raw.toString("utf8");
      req.body = txt ? safeJson(txt) : {};
    }
  }

  return route(req, res);
}
