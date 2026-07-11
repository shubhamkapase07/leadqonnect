// Central error monitoring for the client.
//
// Why this exists: scattered `console.error` calls give no visibility once the app is
// deployed. This module standardizes logging, captures otherwise-silent global errors
// (uncaught exceptions + unhandled promise rejections), keeps a small in-memory ring
// buffer for debugging, and best-effort ships errors to a Cloud Function sink so they
// land in a central `errorLogs` collection an admin can review.
//
// It adds no third-party dependency. To plug in Sentry/Datadog later, implement a sink
// and pass it to `initErrorMonitoring({ sink })` — the call sites don't change.

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEntry {
  level: LogLevel;
  context: string;       // where it happened, e.g. 'scanLeads'
  message: string;
  stack?: string;
  meta?: Record<string, unknown>;
  at: string;            // ISO timestamp
}

type Sink = (entry: LogEntry) => void;

const BUFFER_LIMIT = 50;
const buffer: LogEntry[] = [];

// Throttle the remote sink so a tight error loop can't spam the backend / burn quota.
const REMOTE_MIN_INTERVAL_MS = 2000;
let lastRemoteAt = 0;

let remoteSink: Sink | null = null;
let initialized = false;

/** The default sink: fire-and-forget to a callable that persists the error server-side. */
const firebaseSink: Sink = (entry) => {
  const now = Date.now();
  if (now - lastRemoteAt < REMOTE_MIN_INTERVAL_MS) return; // throttled
  lastRemoteAt = now;
  // Never let logging throw or block; swallow everything.
  try {
    httpsCallable(functions, 'logClientError')({
      level: entry.level,
      context: entry.context,
      message: entry.message,
      stack: entry.stack || null,
      meta: entry.meta || null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      at: entry.at,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
};

function toMessage(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  if (typeof err === 'string') return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

function record(level: LogLevel, context: string, err: unknown, meta?: Record<string, unknown>) {
  const { message, stack } = toMessage(err);
  const entry: LogEntry = { level, context, message, stack, meta, at: new Date().toISOString() };

  buffer.push(entry);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();

  // Keep the familiar console output for local dev.
  const tag = `[${context}]`;
  if (level === 'error') console.error(tag, err, meta || '');
  else if (level === 'warn') console.warn(tag, err, meta || '');
  else console.info(tag, err, meta || '');

  if (remoteSink) remoteSink(entry);
}

/** Log a handled error with the context where it occurred. */
export function logError(context: string, err: unknown, meta?: Record<string, unknown>) {
  record('error', context, err, meta);
}

/** Log a non-fatal warning. */
export function logWarn(context: string, err: unknown, meta?: Record<string, unknown>) {
  record('warn', context, err, meta);
}

/** Recent entries, newest last — handy in the console: `window.__lqLogs`. */
export function getRecentLogs(): LogEntry[] {
  return [...buffer];
}

/**
 * Install global handlers + the remote sink. Call once at app startup.
 * Pass a custom `sink` to route errors to Sentry/etc. instead of the Cloud Function.
 */
export function initErrorMonitoring(opts?: { sink?: Sink | null }) {
  if (initialized) return;
  initialized = true;
  remoteSink = opts && 'sink' in opts ? opts.sink ?? null : firebaseSink;

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
      record('error', 'window.onerror', e.error || e.message, {
        filename: e.filename, lineno: e.lineno, colno: e.colno,
      });
    });
    window.addEventListener('unhandledrejection', (e) => {
      record('error', 'unhandledrejection', e.reason);
    });
    // Expose the buffer for quick debugging in the console.
    (window as unknown as { __lqLogs: () => LogEntry[] }).__lqLogs = getRecentLogs;
  }
}
