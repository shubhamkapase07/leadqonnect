// Shared access gate for the dashboard API. If DASHBOARD_TOKEN is set, every request
// must send a matching `x-access-token` header (the dashboard stores it in localStorage).
// If unset, the API is open — fine for a private, unshared Vercel URL.

export function checkAuth(req: any, res: any): boolean {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) return true; // open mode
  const got = req.headers["x-access-token"];
  if (got === expected) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}
