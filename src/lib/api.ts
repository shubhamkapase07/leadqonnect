// Browser API client for the new Turso+Vercel backend (replaces Firebase SDK calls).
// Holds the JWT session token, attaches it to every request, and exposes typed helpers.
// Base URL is same-origin in production; set VITE_API_BASE for local dev against `vercel dev`.

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "";
const TOKEN_KEY = "lq_token";

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string, message?: string) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }

  if (!res.ok) {
    throw new ApiError(res.status, data?.error, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

/**
 * Poll `fetcher` on an interval and push results to `cb`. Returns an unsubscribe function.
 * Drop-in replacement for Firestore onSnapshot subscriptions. Fires once immediately.
 */
export function poll<T>(fetcher: () => Promise<T>, cb: (v: T) => void, intervalMs = 6000): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopped) return;
    try {
      const v = await fetcher();
      if (!stopped) cb(v);
    } catch { /* transient — keep polling */ }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>("POST", path, body);
export const apiPatch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body);
export const apiDelete = <T>(path: string, body?: unknown) => request<T>("DELETE", path, body);
