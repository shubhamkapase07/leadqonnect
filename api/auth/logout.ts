/// <reference types="node" />
// POST /api/auth/logout -> { ok: true }
// JWTs are stateless, so logout is client-side (drop the token). This exists for symmetry
// and as the place to add token revocation/blocklisting later if needed.
import { json, methodGuard } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (!methodGuard(req, res, ["POST"])) return;
  return json(res, 200, { ok: true });
}
