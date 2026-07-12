/// <reference types="node" />
// Single catch-all router for ALL /api/* routes except the Razorpay webhook.
// Vercel's Hobby plan caps a deployment at 12 Serverless Functions, so instead of one
// function per endpoint we register every handler here and dispatch by path. The actual
// handlers live in api/_routes/** (the `_` prefix keeps them out of the function count).

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
};

export default async function handler(req: any, res: any) {
  // Vercel provides the catch-all segments in req.query.path; fall back to parsing the URL.
  let segments: string[] = [];
  const p = req.query?.path;
  if (Array.isArray(p)) segments = p;
  else if (typeof p === "string") segments = [p];
  else {
    const url = new URL(req.url, "http://x");
    segments = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  }
  const key = segments.join("/");

  const route = ROUTES[key];
  if (!route) {
    res.status(404).json({ error: "not_found", path: key });
    return;
  }
  return route(req, res);
}
