// Live "x ago" timestamp. Renders the relative time from a lead's *absolute* post time
// (createdUtc, falling back to the scan time createdAt) and recomputes on a shared ticker,
// so it stays correct after the lead is saved and reloaded — instead of freezing the string
// that was computed once at scan time.
import React, { useEffect, useState } from 'react';

/** Resolve a lead's best absolute post time, in epoch milliseconds (or null if unknown). */
export function leadEpochMs(lead: { createdUtc?: number; createdAt?: string }): number | null {
  if (typeof lead.createdUtc === 'number' && lead.createdUtc > 0) return lead.createdUtc * 1000;
  if (lead.createdAt) {
    const t = Date.parse(lead.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/** Format an absolute time as a relative label ("Just now", "5m ago", "3h ago", ...). */
export function formatRelativeTime(epochMs: number, nowMs: number): string {
  let diff = Math.floor((nowMs - epochMs) / 1000);
  if (diff < 0) diff = 0; // future/clock-skew → treat as now rather than "-2h ago"
  if (diff < 45) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2_592_000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31_536_000) return `${Math.floor(diff / 2_592_000)}mo ago`;
  return `${Math.floor(diff / 31_536_000)}y ago`;
}

// One shared 30s ticker drives every RelativeTime instance, so a long lead list
// doesn't spin up hundreds of independent timers.
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  if (!timer) timer = setInterval(() => subscribers.forEach((s) => s()), 30_000);
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribe(() => setNow(Date.now())), []);
  return now;
}

interface RelativeTimeProps {
  lead: { createdUtc?: number; createdAt?: string; timestamp?: string };
  style?: React.CSSProperties;
  className?: string;
}

export const RelativeTime: React.FC<RelativeTimeProps> = ({ lead, style, className }) => {
  const now = useNow();
  const epoch = leadEpochMs(lead);
  // If we genuinely have no absolute time, fall back to whatever static label exists.
  const label = epoch != null ? formatRelativeTime(epoch, now) : (lead.timestamp || '');
  const title = epoch != null ? new Date(epoch).toLocaleString() : undefined;
  return (
    <span className={className} style={style} title={title}>
      {label}
    </span>
  );
};
