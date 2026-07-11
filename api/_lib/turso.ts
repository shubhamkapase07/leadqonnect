// Shared Turso/libSQL client for all Vercel serverless functions.
import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

export function db(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  _client = createClient({ url, authToken });
  return _client;
}

export const nowSec = () => Math.floor(Date.now() / 1000);

/** Parse a JSON column safely; returns fallback on null/invalid. */
export function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  try { return JSON.parse(String(v)) as T; } catch { return fallback; }
}
