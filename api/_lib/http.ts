// Tiny helpers for the Vercel Node serverless functions: consistent JSON responses,
// method guarding, and body parsing. Keeps every endpoint terse.

export function json(res: any, code: number, body: unknown) {
  res.status(code).json(body);
}

export function methodGuard(req: any, res: any, allowed: string[]): boolean {
  if (!allowed.includes(req.method)) {
    res.status(405).json({ error: "method_not_allowed" });
    return false;
  }
  return true;
}

export function readBody(req: any): any {
  if (!req.body) return {};
  return typeof req.body === "string" ? safeParse(req.body) : req.body;
}

function safeParse(s: string): any {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
