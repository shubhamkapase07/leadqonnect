import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, TrendingUp, ShieldAlert, Users, Globe, Radar, Activity, Hash } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Lead } from '../../context/AppContext';

const PLATFORM_COLORS: Record<string, string> = {
  reddit: '#ff4500', twitter: '#1da1f2', linkedin: '#0a66c2', hackernews: '#ff6600',
};
const PLATFORM_LABELS: Record<string, string> = {
  reddit: 'Reddit', twitter: 'Twitter / X', linkedin: 'LinkedIn', hackernews: 'Hacker News',
};

// Reference data for well-known subreddits (approximate; community guidance for outreach).
const SUBREDDIT_INFO: Record<string, { members: string; policy: string }> = {
  'r/forhire': { members: '~470k', policy: 'Self-promo OK — use [For Hire] tags' },
  'r/saas': { members: '~330k', policy: 'No direct promo — be value-first' },
  'r/entrepreneur': { members: '~4.1M', policy: 'Promo only in weekly threads' },
  'r/marketing': { members: '~1.1M', policy: 'Discussion only, no self-promo' },
  'r/webdev': { members: '~2.6M', policy: 'No soliciting; showcase thread only' },
  'r/startups': { members: '~1.8M', policy: '"Share Your Startup" thread only' },
  'r/smallbusiness': { members: '~2.3M', policy: 'Promotion Sundays only' },
  'r/freelance': { members: '~520k', policy: 'No direct pitching in posts' },
  'r/digital_marketing': { members: '~260k', policy: 'No self-promotion' },
  'r/seo': { members: '~310k', policy: 'No services soliciting' },
  'r/web_design': { members: '~250k', policy: 'Feedback only — no ads' },
};

// Approx scan time of a lead, for time-series charts.
function leadDate(l: Lead): Date {
  if (l.createdAt) { const d = new Date(l.createdAt); if (!isNaN(d.getTime())) return d; }
  const t = (l.timestamp || '').toLowerCase();
  const now = Date.now();
  const m = t.match(/(\d+)\s*([dhm])/);
  if (m) {
    const n = parseInt(m[1], 10);
    const ms = m[2] === 'd' ? n * 86400000 : m[2] === 'h' ? n * 3600000 : n * 60000;
    return new Date(now - ms);
  }
  return new Date(now);
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

export const InsightsView: React.FC = () => {
  const { leads, campaigns } = useApp();

  const a = useMemo(() => {
    const total = leads.length;
    const highIntent = leads.filter(l => l.sentiment === 'high').length;
    const avgIntent = total ? Math.round(leads.reduce((s, l) => s + (l.intentScore || 0), 0) / total) : 0;

    // By platform
    const platformMap = new Map<string, number>();
    for (const l of leads) platformMap.set(l.platform, (platformMap.get(l.platform) || 0) + 1);
    const byPlatform = [...platformMap.entries()]
      .map(([k, v]) => ({ key: k, label: PLATFORM_LABELS[k] || k, count: v, color: PLATFORM_COLORS[k] || '#888' }))
      .sort((x, y) => y.count - x.count);

    // By subreddit (reddit only)
    const subAgg = new Map<string, { count: number; intent: number; match: number }>();
    for (const l of leads) {
      if (!l.subreddit) continue;
      const key = l.subreddit.toLowerCase().startsWith('r/') ? l.subreddit.toLowerCase() : 'r/' + l.subreddit.toLowerCase();
      const cur = subAgg.get(key) || { count: 0, intent: 0, match: 0 };
      cur.count++; cur.intent += l.intentScore || 0; cur.match += l.industryMatchScore || 0;
      subAgg.set(key, cur);
    }
    const maxSubCount = Math.max(1, ...[...subAgg.values()].map(s => s.count));
    const subreddits = [...subAgg.entries()].map(([key, s]) => {
      const avgInt = Math.round(s.intent / s.count);
      const info = SUBREDDIT_INFO[key] || { members: '—', policy: 'Review subreddit rules first' };
      const relevance = clamp(avgInt * 0.6 + (s.count / maxSubCount) * 40);
      const freq = s.count >= 5 ? 'High' : s.count >= 2 ? 'Medium' : 'Low';
      return { key, count: s.count, avgIntent: avgInt, members: info.members, policy: info.policy, relevance, freq };
    }).sort((x, y) => y.relevance - x.relevance);

    // By keyword
    const kwAgg = new Map<string, { count: number; intent: number; high: number }>();
    for (const l of leads) for (const kw of l.keywords || []) {
      const cur = kwAgg.get(kw) || { count: 0, intent: 0, high: 0 };
      cur.count++; cur.intent += l.intentScore || 0; if (l.sentiment === 'high') cur.high++;
      kwAgg.set(kw, cur);
    }
    const topKeywords = [...kwAgg.entries()]
      .map(([k, v]) => ({ keyword: k, count: v.count, avgIntent: Math.round(v.intent / v.count), high: v.high }))
      .sort((x, y) => y.count - x.count);
    const demandGaps = [...topKeywords]
      .map(k => ({ ...k, demand: Math.round(k.count * (k.avgIntent / 100)) }))
      .sort((x, y) => y.demand - x.demand)
      .slice(0, 4);

    // Leads over time (last 14 days) + day-of-week
    const days = 14;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overTime = Array.from({ length: days }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (days - 1 - i));
      return { date: d, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0 };
    });
    const dow = [0, 0, 0, 0, 0, 0, 0];
    for (const l of leads) {
      const d = leadDate(l);
      dow[d.getDay()]++;
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
      const bucket = overTime.find(b => b.date.toDateString() === key);
      if (bucket) bucket.count++;
    }
    const weekly = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => ({ label, count: dow[i] }));

    // --- Conversion funnel + attribution ---
    // Pipeline stages in order. A lead "reached" a stage if its current status ranks at or
    // beyond it (won implies it passed every prior stage). 'lost'/'archived' leads are counted
    // in the total but, since we only know their final status, only toward stages they clearly hit.
    const STAGE_ORDER = ['potential', 'contacted', 'replied', 'meeting', 'proposal', 'won'] as const;
    const FUNNEL_LABELS: Record<string, string> = {
      potential: 'Captured', contacted: 'Contacted', replied: 'Replied',
      meeting: 'Meeting', proposal: 'Proposal', won: 'Won',
    };
    // Map every status to its furthest-known stage rank.
    const rankOf = (status: string): number => {
      if (status === 'won') return STAGE_ORDER.length - 1;
      if (status === 'qualified' || status === 'selected') return 0; // captured, not yet contacted
      const idx = STAGE_ORDER.indexOf(status as typeof STAGE_ORDER[number]);
      return idx >= 0 ? idx : 0;
    };
    const funnel = STAGE_ORDER.map((stage, i) => ({
      key: stage,
      label: FUNNEL_LABELS[stage],
      count: leads.filter(l => l.status !== 'lost' && l.status !== 'archived' ? rankOf(l.status) >= i : (l.status === 'lost' && i === 0)).length,
    }));
    // Captured = everyone (top of funnel).
    funnel[0].count = total;
    const wonCount = leads.filter(l => l.status === 'won').length;
    const lostCount = leads.filter(l => l.status === 'lost').length;
    const contactedCount = leads.filter(l => rankOf(l.status) >= 1 && l.status !== 'lost' && l.status !== 'archived').length;
    const winRate = total ? Math.round((wonCount / total) * 100) : 0;
    const replyRate = contactedCount ? Math.round((leads.filter(l => rankOf(l.status) >= 2).length / contactedCount) * 100) : 0;

    // Attribution: win rate by campaign / keyword / platform.
    const attrib = (groups: Map<string, { total: number; won: number }>) =>
      [...groups.entries()]
        .map(([key, v]) => ({ key, total: v.total, won: v.won, rate: v.total ? Math.round((v.won / v.total) * 100) : 0 }))
        .filter(g => g.total > 0)
        .sort((x, y) => y.won - x.won || y.rate - x.rate)
        .slice(0, 6);

    const byCampaign = new Map<string, { total: number; won: number }>();
    const byKeywordConv = new Map<string, { total: number; won: number }>();
    const byPlatformConv = new Map<string, { total: number; won: number }>();
    const campaignName = (id?: string) => campaigns.find(c => c.id === id)?.name || 'Unattributed';
    for (const l of leads) {
      const won = l.status === 'won' ? 1 : 0;
      const cn = campaignName(l.campaignId);
      const c = byCampaign.get(cn) || { total: 0, won: 0 }; c.total++; c.won += won; byCampaign.set(cn, c);
      const p = byPlatformConv.get(l.platform) || { total: 0, won: 0 }; p.total++; p.won += won; byPlatformConv.set(l.platform, p);
      for (const kw of l.keywords || []) {
        const k = byKeywordConv.get(kw) || { total: 0, won: 0 }; k.total++; k.won += won; byKeywordConv.set(kw, k);
      }
    }
    const conversion = {
      funnel, wonCount, lostCount, winRate, replyRate,
      byCampaign: attrib(byCampaign),
      byKeyword: attrib(byKeywordConv),
      byPlatform: attrib(byPlatformConv).map(g => ({ ...g, label: PLATFORM_LABELS[g.key] || g.key })),
    };

    return { total, highIntent, avgIntent, byPlatform, subreddits, topKeywords, demandGaps, overTime, weekly, communities: subreddits.length, conversion };
  }, [leads, campaigns]);

  if (a.total === 0) {
    return (
      <div className="view-container">
        <div className="view-header"><div className="view-title"><h1>Market Insights</h1><p>Analytics to help you decide exactly what to sell and where.</p></div></div>
        <div className="glass-card" style={{ padding: 60, borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <BarChart3 size={42} color="hsl(var(--text-faint))" />
          <h3 style={{ color: 'hsl(var(--text-primary))', margin: 0 }}>No data to analyze yet</h3>
          <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: 420 }}>Create a campaign and run a scan — your communities, demand gaps, and trends will populate here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header"><div className="view-title"><h1>Market Insights</h1><p>Analytics to help you decide exactly what to sell and where.</p></div></div>

      {/* Overview stats */}
      <div style={styles.statRow}>
        <Stat icon={<Users size={16} />} label="Total leads" value={String(a.total)} tint="var(--primary)" />
        <Stat icon={<Radar size={16} />} label="Communities found" value={String(a.communities)} tint="var(--accent-3)" />
        <Stat icon={<Globe size={16} />} label="Active platforms" value={String(a.byPlatform.length)} tint="var(--accent-2)" />
        <Stat icon={<TrendingUp size={16} />} label="Avg buying intent" value={`${a.avgIntent}/100`} tint="var(--success)" />
      </div>

      {/* Trends row */}
      <div style={styles.grid2}>
        <Card title="Leads Over Time" subtitle="New leads discovered per day (last 14 days)">
          <AreaChart data={a.overTime.map(d => d.count)} labels={a.overTime.map(d => d.label)} />
        </Card>
        <Card title="Weekly Activity" subtitle="When your prospects are most active">
          <ColumnChart data={a.weekly.map(w => w.count)} labels={a.weekly.map(w => w.label)} />
        </Card>
      </div>

      {/* Platform spikes + top keywords */}
      <div style={styles.grid2}>
        <Card title="Platform Niche Spikes" subtitle="Lead volume across the platforms you scan">
          <BarList items={a.byPlatform.map(p => ({ label: p.label, value: p.count, color: p.color }))} />
        </Card>
        <Card title="Top Keywords" subtitle="Which search terms are surfacing the most leads">
          <BarList items={a.topKeywords.slice(0, 8).map(k => ({ label: k.keyword, value: k.count, color: 'hsl(var(--primary))' }))} />
        </Card>
      </div>

      {/* Identified Target Communities */}
      <Card title="Identified Target Communities" subtitle="Top subreddits containing your potential clients. Hover a subreddit to see its rules, click to open them on Reddit." icon={<Radar size={16} color="hsl(var(--primary))" />}>
        {a.subreddits.length === 0 ? (
          <Empty text="No subreddit data yet — scan Reddit campaigns to populate this." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr>
                {['Subreddit', 'Members (est.)', 'Leads', 'Post Frequency', 'Promotion Policy', 'Relevance'].map(h => <th key={h} style={styles.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {a.subreddits.map(s => (
                  <tr key={s.key} style={styles.tr}>
                    <td style={styles.td}><SubredditCell sub={s.key} policy={s.policy} /></td>
                    <td style={styles.td}>{s.members}</td>
                    <td style={styles.td}>{s.count}</td>
                    <td style={styles.td}><FreqBadge level={s.freq} /></td>
                    <td style={{ ...styles.td, maxWidth: 220 }}>{s.policy}</td>
                    <td style={styles.td}><RelevanceBar value={s.relevance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Demand gaps */}
      <div style={{ marginBottom: 24 }}>
        <Card title="Market Demand Signals" subtitle="Keywords ranked by lead volume weighted by buying intent — where demand is hottest across what you're tracking" icon={<TrendingUp size={16} color="hsl(var(--primary))" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {a.demandGaps.map(g => {
              const level = g.demand >= 5 ? 'Extreme demand' : g.demand >= 2 ? 'High demand' : 'Emerging';
              return (
                <div key={g.keyword} className="glass-card" style={{ padding: 14, borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--text-primary))', margin: 0, textTransform: 'capitalize' }}>{g.keyword}</h4>
                    <span style={styles.demandBadge}>{level}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.45 }}>
                    {g.count} lead{g.count !== 1 ? 's' : ''} · avg intent {g.avgIntent}/100 · {g.high} high-intent.
                    {g.avgIntent >= 75 ? ' Buyers are actively seeking this — package a clear, fast offer.' : ' Solid interest — lead with proof and a low-friction first step.'}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Conversion funnel + attribution */}
      <div style={{ marginBottom: 24 }}>
        <Card title="Conversion Funnel" subtitle="How leads progress from captured to won — and where they drop off" icon={<TrendingUp size={16} color="hsl(var(--primary))" />}>
          <div style={styles.statRow}>
            <Stat icon={<Users size={16} />} label="Won deals" value={String(a.conversion.wonCount)} tint="var(--success)" />
            <Stat icon={<TrendingUp size={16} />} label="Win rate" value={`${a.conversion.winRate}%`} tint="var(--primary)" />
            <Stat icon={<Activity size={16} />} label="Reply rate" value={`${a.conversion.replyRate}%`} tint="var(--accent-2)" />
            <Stat icon={<Radar size={16} />} label="Lost" value={String(a.conversion.lostCount)} tint="var(--danger)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {a.conversion.funnel.map((stage, i) => {
              const top = a.conversion.funnel[0].count || 1;
              const pct = Math.round((stage.count / top) * 100);
              const prev = i > 0 ? a.conversion.funnel[i - 1].count : stage.count;
              const stepConv = prev ? Math.round((stage.count / prev) * 100) : 0;
              return (
                <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 90, fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>{stage.label}</span>
                  <div style={{ flex: 1, height: 22, background: 'hsl(var(--surface-2))', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: i === a.conversion.funnel.length - 1 ? 'hsl(var(--success))' : 'hsl(var(--primary))', borderRadius: 6, transition: 'width .6s ease', opacity: 0.35 + 0.65 * (i / a.conversion.funnel.length) }} />
                    <span style={{ position: 'absolute', left: 8, top: 2, fontSize: '0.74rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{stage.count}</span>
                  </div>
                  <span style={{ width: 64, textAlign: 'right', fontSize: '0.74rem', color: 'hsl(var(--text-muted))' }}>{i === 0 ? '—' : `${stepConv}%`}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div style={a.conversion.byCampaign.length ? styles.grid2 : { display: 'none' }}>
        <Card title="Top Converting Campaigns" subtitle="Win rate by campaign — where your closed deals come from">
          <AttribList items={a.conversion.byCampaign.map(g => ({ label: g.key, won: g.won, total: g.total, rate: g.rate }))} />
        </Card>
        <Card title="Top Converting Keywords" subtitle="Which search terms produce won deals">
          <AttribList items={a.conversion.byKeyword.map(g => ({ label: g.key, won: g.won, total: g.total, rate: g.rate }))} />
        </Card>
      </div>

      {/* Campaign keywords */}
      <Card title="Campaign Keywords" subtitle="What each of your campaigns is tracking" icon={<Hash size={16} color="hsl(var(--accent-2))" />}>
        {campaigns.length === 0 ? (
          <Empty text="No campaigns yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {campaigns.map(c => (
              <div key={c.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Activity size={13} color="hsl(var(--primary))" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{c.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))' }}>· {c.leadsCount} leads</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {c.keywords.map(kw => <span key={kw} style={styles.chip}>{kw}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ---------- presentational helpers ----------
const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; tint: string }> = ({ icon, label, value, tint }) => (
  <div className="glass-card" style={{ padding: 18, borderRadius: 14, flex: 1, minWidth: 150 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: `hsl(${tint})` }}>
      {icon}<span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>{label}</span>
    </div>
    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{value}</div>
  </div>
);

const Card: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
  <div className="glass-card" style={{ padding: 22, borderRadius: 16, marginBottom: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      {icon}<h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'hsl(var(--text-primary))', margin: 0 }}>{title}</h3>
    </div>
    {subtitle && <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: '0 0 16px 0' }}>{subtitle}</p>}
    {children}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px 0' }}>{text}</p>
);

// Shared SVG tooltip — inverts color with the theme, clamped inside the chart.
const ChartTooltip: React.FC<{ W: number; cx: number; cy: number; text: string }> = ({ W, cx, cy, text }) => {
  const tw = Math.max(34, text.length * 5.2 + 12);
  const th = 17;
  const tx = Math.max(2, Math.min(W - tw - 2, cx - tw / 2));
  const ty = cy - th - 7 < 0 ? cy + 8 : cy - th - 7;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={tx} y={ty} width={tw} height={th} rx={4} fill="hsl(var(--text-primary))" opacity={0.95} />
      <text x={tx + tw / 2} y={ty + 12} textAnchor="middle" fontSize="9" fontWeight={700} fill="hsl(var(--bg-card))">{text}</text>
    </g>
  );
};

const BarList: React.FC<{ items: { label: string; value: number; color: string }[] }> = ({ items }) => {
  const max = Math.max(1, ...items.map(i => i.value));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(it => (
        <div
          key={it.label}
          title={`${it.label}: ${it.value}`}
          onMouseEnter={() => setHover(it.label)}
          onMouseLeave={() => setHover(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px', borderRadius: 8, cursor: 'default', background: hover === it.label ? 'hsl(var(--surface-1))' : 'transparent', transition: 'background .15s ease' }}
        >
          <span style={{ width: 110, fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
          <div style={{ flex: 1, height: 10, background: 'hsl(var(--surface-2))', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(it.value / max) * 100}%`, height: '100%', background: it.color, borderRadius: 999, transition: 'width .6s ease', opacity: hover && hover !== it.label ? 0.55 : 1 }} />
          </div>
          <span style={{ width: 28, textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
};

const AttribList: React.FC<{ items: { label: string; won: number; total: number; rate: number }[] }> = ({ items }) => {
  if (items.length === 0) return <Empty text="No data yet — close some deals to see attribution." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
          <div style={{ width: 90, height: 8, background: 'hsl(var(--surface-2))', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(3, it.rate)}%`, height: '100%', background: it.rate >= 20 ? 'hsl(var(--success))' : 'hsl(var(--primary))', borderRadius: 999 }} />
          </div>
          <span style={{ width: 92, textAlign: 'right', fontSize: '0.78rem', color: 'hsl(var(--text-primary))', fontWeight: 700 }}>
            {it.won}/{it.total} <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 500 }}>· {it.rate}%</span>
          </span>
        </div>
      ))}
    </div>
  );
};

const ColumnChart: React.FC<{ data: number[]; labels: string[] }> = ({ data, labels }) => {
  const max = Math.max(1, ...data);
  const W = 320, H = 150, pad = 22, n = data.length;
  const bw = ((W - pad * 2) / n) * 0.6;
  const gap = (W - pad * 2) / n;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      {data.map((v, i) => {
        const h = (v / max) * (H - 40);
        const x = pad + i * gap + (gap - bw) / 2;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {/* full-column hit area for easy hovering */}
            <rect x={pad + i * gap} y={0} width={gap} height={H - 16} fill="transparent" />
            <rect x={x} y={H - 24 - h} width={bw} height={h} rx={3} fill="hsl(var(--primary))" opacity={hover === i ? 1 : 0.8} />
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="hsl(var(--text-muted))">{labels[i]}</text>
          </g>
        );
      })}
      {hover !== null && (
        <ChartTooltip W={W} cx={pad + hover * gap + gap / 2} cy={H - 24 - (data[hover] / max) * (H - 40)} text={`${labels[hover]}: ${data[hover]}`} />
      )}
    </svg>
  );
};

const AreaChart: React.FC<{ data: number[]; labels: string[] }> = ({ data, labels }) => {
  const max = Math.max(1, ...data);
  const W = 320, H = 150, pad = 10, baseY = H - 26, topY = 12;
  const n = data.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v: number) => baseY - (v / max) * (baseY - topY);
  const colW = n > 1 ? (W - pad * 2) / (n - 1) : W;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${baseY} L ${x(0).toFixed(1)} ${baseY} Z`;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="lqArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lqArea)" />
      <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {hover !== null && (
        <>
          <line x1={x(hover)} y1={topY} x2={x(hover)} y2={baseY} stroke="hsl(var(--border-strong))" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(data[hover])} r={3.5} fill="hsl(var(--primary))" stroke="hsl(var(--bg-card))" strokeWidth={1.5} />
        </>
      )}
      {data.map((v, i) => (i % 2 === 0 || i === n - 1) && (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="hsl(var(--text-muted))">{labels[i]}</text>
      ))}
      {/* invisible hover hit areas per point */}
      {data.map((_, i) => (
        <rect key={'h' + i} x={x(i) - colW / 2} y={0} width={colW} height={baseY} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
      ))}
      {hover !== null && <ChartTooltip W={W} cx={x(hover)} cy={y(data[hover])} text={`${labels[hover]}: ${data[hover]}`} />}
    </svg>
  );
};

const FreqBadge: React.FC<{ level: string }> = ({ level }) => {
  const color = level === 'High' ? 'var(--success)' : level === 'Medium' ? 'var(--warning)' : 'var(--text-muted)';
  return <span style={{ fontSize: '0.72rem', fontWeight: 700, color: `hsl(${color})` }}>{level}</span>;
};

const RelevanceBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ width: 56, height: 6, background: 'hsl(var(--surface-2))', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: value >= 75 ? 'hsl(var(--success))' : value >= 50 ? 'hsl(var(--primary))' : 'hsl(var(--warning))', borderRadius: 999 }} />
    </div>
    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{value}</span>
  </div>
);

// Subreddit name with a hover popover showing its rules; clicking opens Reddit's rules page.
const SubredditCell: React.FC<{ sub: string; policy: string }> = ({ sub, policy }) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const rulesUrl = `https://www.reddit.com/${sub.replace(/^\//, '')}/about/rules/`;
  const open = () => window.open(rulesUrl, '_blank', 'noopener,noreferrer');

  return (
    <span
      style={{ position: 'relative', fontWeight: 700, color: 'hsl(var(--primary))', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
      onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: r.left, y: r.bottom }); }}
      onMouseLeave={() => setPos(null)}
      onClick={open}
    >
      {sub}
      {pos && createPortal(
        <div
          onClick={e => { e.stopPropagation(); open(); }}
          style={{
            position: 'fixed', top: Math.min(pos.y + 6, window.innerHeight - 180), left: Math.min(pos.x, window.innerWidth - 286), width: 270, zIndex: 1000,
            background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-strong))', borderRadius: 12,
            boxShadow: 'var(--shadow-lg)', padding: 14, cursor: 'pointer',
            // Reset inherited styles from the underlined trigger span
            textDecoration: 'none', fontWeight: 400, textAlign: 'left', whiteSpace: 'normal', color: 'hsl(var(--text-secondary))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ShieldAlert size={13} color="hsl(var(--warning))" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{sub} — posting rules</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', margin: '0 0 8px 0', lineHeight: 1.5 }}>
            <strong style={{ color: 'hsl(var(--text-primary))' }}>Promotion: </strong>{policy}.
          </p>
          <p style={{ fontSize: '0.74rem', color: 'hsl(var(--text-muted))', margin: '0 0 10px 0', lineHeight: 1.5 }}>
            Lead with help, not a pitch. Comment &amp; upvote before posting, and only DM after a genuine reply — cold identical messages get you shadowbanned.
          </p>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>Open full rules on Reddit →</span>
        </div>,
        document.body,
      )}
    </span>
  );
};

const styles: Record<string, React.CSSProperties> = {
  statRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, marginBottom: 24 },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 640 },
  th: { padding: '10px 14px', borderBottom: '1px solid hsl(var(--border-color))', color: 'hsl(var(--text-muted))', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid hsl(var(--border-color))' },
  td: { padding: '12px 14px', color: 'hsl(var(--text-secondary))', fontSize: '0.84rem' },
  auditList: { display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0, listStyle: 'none' },
  demandBadge: { fontSize: '0.68rem', fontWeight: 700, color: 'hsl(var(--primary))', background: 'rgba(var(--primary-rgb), 0.12)', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' },
  chip: { fontSize: '0.76rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-color))', padding: '4px 10px', borderRadius: 999 },
};

export default InsightsView;
