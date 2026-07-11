import React, { useState } from 'react';
import {
  Globe,
  Radar,
  CheckSquare,
  Sparkles,
  Send,
  MessageCircle,
  Calendar,
  Briefcase,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Lead } from '../../context/AppContext';

const PLATFORM_COLORS: Record<string, string> = {
  reddit: '#ff4500', twitter: '#1da1f2', linkedin: '#0a66c2', hackernews: '#ff6600',
};
const PLATFORM_LABELS: Record<string, string> = {
  reddit: 'Reddit', twitter: 'Twitter', linkedin: 'LinkedIn', hackernews: 'Hacker News',
};

export const DashboardView: React.FC = () => {
  const { leads, plan } = useApp();

  // Stats calculation
  const potentialLeads = leads.filter(l => l.status === 'potential').length;
  const selectedLeads = leads.filter(l => l.status === 'selected').length;
  const qualifiedLeads = leads.filter(l => l.status === 'qualified').length;
  const contactedLeads = leads.filter(l => 
    ['contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'].includes(l.status)
  ).length;
  const responses = leads.filter(l => 
    ['replied', 'meeting', 'proposal', 'won'].includes(l.status)
  ).length;
  const meetingsBooked = leads.filter(l => l.status === 'meeting').length;
  const opportunities = leads.filter(l => 
    ['proposal', 'won', 'lost'].includes(l.status)
  ).length;
  const wonLeads = leads.filter(l => l.status === 'won').length;
  
  // Custom Revenue calculation: each won deal is valued at $5,000
  const revenueGenerated = wonLeads * 5000;

  // --- Chart data (all derived from real leads) ---
  // Leads discovered per day, last 14 days.
  const days = 14;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const otBuckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (days - 1 - i));
    return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), key: d.toDateString(), count: 0 };
  });
  leads.forEach(l => {
    const d = leadDate(l);
    const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
    const b = otBuckets.find(x => x.key === k);
    if (b) b.count++;
  });

  // Leads by platform (donut).
  const platformCounts: Record<string, number> = {};
  leads.forEach(l => { platformCounts[l.platform] = (platformCounts[l.platform] || 0) + 1; });
  const platformSeg = Object.entries(platformCounts)
    .map(([k, v]) => ({ label: PLATFORM_LABELS[k] || k, value: v, color: PLATFORM_COLORS[k] || '#888' }))
    .sort((a, b) => b.value - a.value);

  // Intent breakdown (donut).
  const intentSeg = [
    { label: 'High intent', value: leads.filter(l => l.sentiment === 'high').length, color: 'hsl(var(--success))' },
    { label: 'Medium', value: leads.filter(l => l.sentiment === 'medium').length, color: '#f59e0b' },
    { label: 'Low', value: leads.filter(l => l.sentiment === 'low').length, color: 'hsl(var(--text-muted))' },
  ].filter(s => s.value > 0);

  // Conversion funnel (pipeline stages).
  const funnel = [
    { label: 'Potential', count: potentialLeads, color: 'hsl(var(--primary))' },
    { label: 'Selected', count: selectedLeads, color: '#3b82f6' },
    { label: 'Qualified', count: qualifiedLeads, color: '#c084fc' },
    { label: 'Contacted', count: contactedLeads, color: '#06b6d4' },
    { label: 'Won', count: wonLeads, color: '#22c55e' },
  ];

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header">
        <div className="view-title">
          <h1>LeadQonnect Dashboard</h1>
          <p>Real-time analytics and social intelligence overview.</p>
        </div>
        <div style={styles.planBadge} className="glass-card">
          <Globe size={14} color="hsl(var(--primary))" />
          <span>Active Plan: <strong style={{ color: 'hsl(var(--text-primary))', textTransform: 'uppercase' }}>{plan}</strong></span>
        </div>
      </div>

      {/* Metrics Row (8 metrics cards, 4x2 Grid layout) */}
      <div style={styles.metricsGrid}>
        {/* Metric 1 */}
        <div className="glass-card" style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricTitle}>Potential Leads</span>
            <Radar size={18} color="hsl(var(--primary))" />
          </div>
          <div style={styles.metricValue}>{potentialLeads}</div>
          <div style={styles.metricSub}>
            Unapproved posts found
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card" style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricTitle}>Selected Leads</span>
            <CheckSquare size={18} color="#3b82f6" />
          </div>
          <div style={styles.metricValue}>{selectedLeads}</div>
          <div style={styles.metricSub}>
            Moved to CRM workspace
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card" style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricTitle}>Qualified Leads</span>
            <Sparkles size={18} color="#c084fc" />
          </div>
          <div style={styles.metricValue}>{qualifiedLeads}</div>
          <div style={styles.metricSub}>
            Deep AI report calculated
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-card" style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricTitle}>Contacted Leads</span>
            <Send size={18} color="#06b6d4" />
          </div>
          <div style={styles.metricValue}>{contactedLeads}</div>
          <div style={styles.metricSub}>
            Outreach messages sent
          </div>
        </div>

        {/* Metric 5 */}
        <div className="glass-card" style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricTitle}>Responses</span>
            <MessageCircle size={18} color="#f59e0b" />
          </div>
          <div style={styles.metricValue}>{responses}</div>
          <div style={styles.metricSub}>
            Replies received
          </div>
        </div>

        {/* Metric 6 */}
        <div className="glass-card" style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricTitle}>Meetings Booked</span>
            <Calendar size={18} color="#ec4899" />
          </div>
          <div style={styles.metricValue}>{meetingsBooked}</div>
          <div style={styles.metricSub}>
            Calendar events scheduled
          </div>
        </div>

        {/* Metric 7 */}
        <div className="glass-card" style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricTitle}>Opportunities</span>
            <Briefcase size={18} color="#a855f7" />
          </div>
          <div style={styles.metricValue}>{opportunities}</div>
          <div style={styles.metricSub}>
            Active deal proposals
          </div>
        </div>

        {/* Metric 8 */}
        <div className="glass-card" style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricTitle}>Revenue Generated</span>
            <DollarSign size={18} color="#10b981" />
          </div>
          <div style={styles.metricValue}>${revenueGenerated.toLocaleString()}</div>
          <div style={styles.metricSub}>
            Won deal value ($5k avg)
          </div>
        </div>
      </div>

      {/* Charts */}
      {leads.length === 0 ? (
        <div className="glass-card" style={{ ...styles.chartCard, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, gap: 10 }}>
          <TrendingUp size={40} color="hsl(var(--text-faint))" />
          <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>No analytics yet — create a campaign and scan to populate your dashboard.</span>
        </div>
      ) : (
        <>
          {/* Leads over time — full width */}
          <div className="glass-card" style={{ ...styles.chartCard, marginBottom: 20 }}>
            <h2 style={styles.sectionTitle}>Leads Over Time</h2>
            <p style={styles.sectionSubtitle}>New leads discovered per day (last 14 days).</p>
            <AreaChart data={otBuckets.map(b => b.count)} labels={otBuckets.map(b => b.label)} />
          </div>

          <div style={styles.contentGrid3}>
            <div className="glass-card" style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>Conversion Funnel</h2>
              <p style={styles.sectionSubtitle}>How leads move through your pipeline.</p>
              <Funnel stages={funnel} />
            </div>

            <div className="glass-card" style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>Leads by Platform</h2>
              <p style={styles.sectionSubtitle}>Where your prospects are coming from.</p>
              <DonutChart segments={platformSeg} centerLabel="leads" />
            </div>

            <div className="glass-card" style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>Intent Breakdown</h2>
              <p style={styles.sectionSubtitle}>Quality split of every lead found.</p>
              <DonutChart segments={intentSeg} centerLabel="leads" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Approx date of a lead for time-series (scan time, else parse relative timestamp).
function leadDate(l: Lead): Date {
  if (l.createdAt) { const d = new Date(l.createdAt); if (!isNaN(d.getTime())) return d; }
  const t = (l.timestamp || '').toLowerCase();
  const m = t.match(/(\d+)\s*([dhm])/);
  if (m) {
    const n = parseInt(m[1], 10);
    const ms = m[2] === 'd' ? n * 86400000 : m[2] === 'h' ? n * 3600000 : n * 60000;
    return new Date(Date.now() - ms);
  }
  return new Date();
}

// --- Reusable charts ---
const ChartTooltip: React.FC<{ W: number; cx: number; cy: number; text: string }> = ({ W, cx, cy, text }) => {
  const tw = Math.max(34, text.length * 5.2 + 12), th = 17;
  const tx = Math.max(2, Math.min(W - tw - 2, cx - tw / 2));
  const ty = cy - th - 7 < 0 ? cy + 8 : cy - th - 7;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={tx} y={ty} width={tw} height={th} rx={4} fill="hsl(var(--text-primary))" opacity={0.95} />
      <text x={tx + tw / 2} y={ty + 12} textAnchor="middle" fontSize="9" fontWeight={700} fill="hsl(var(--bg-card))">{text}</text>
    </g>
  );
};

const AreaChart: React.FC<{ data: number[]; labels: string[] }> = ({ data, labels }) => {
  const max = Math.max(1, ...data);
  const W = 600, H = 170, pad = 12, baseY = H - 26, topY = 14;
  const n = data.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v: number) => baseY - (v / max) * (baseY - topY);
  const colW = n > 1 ? (W - pad * 2) / (n - 1) : W;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${baseY} L ${x(0).toFixed(1)} ${baseY} Z`;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible', marginTop: 8 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lqDashArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lqDashArea)" />
      <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {hover !== null && (
        <>
          <line x1={x(hover)} y1={topY} x2={x(hover)} y2={baseY} stroke="hsl(var(--border-strong))" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(data[hover])} r={3.5} fill="hsl(var(--primary))" stroke="hsl(var(--bg-card))" strokeWidth={1.5} />
        </>
      )}
      {data.map((_, i) => (i % 2 === 0 || i === n - 1) && (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="hsl(var(--text-muted))">{labels[i]}</text>
      ))}
      {data.map((_, i) => (
        <rect key={'h' + i} x={x(i) - colW / 2} y={0} width={colW} height={baseY} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
      ))}
      {hover !== null && <ChartTooltip W={W} cx={x(hover)} cy={y(data[hover])} text={`${labels[hover]}: ${data[hover]}`} />}
    </svg>
  );
};

const DonutChart: React.FC<{ segments: { label: string; value: number; color: string }[]; centerLabel?: string }> = ({ segments, centerLabel }) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const size = 150, stroke = 22, r = (size - stroke) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--surface-2))" strokeWidth={stroke} />
        {total > 0 && segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`}>
              <title>{`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x={cx} y={cy - 1} textAnchor="middle" fontSize="22" fontWeight="800" fill="hsl(var(--text-primary))">{total}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="9" fill="hsl(var(--text-muted))">{centerLabel || 'total'}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 110 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'hsl(var(--text-secondary))', flex: 1, whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 700 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Funnel: React.FC<{ stages: { label: string; count: number; color: string }[] }> = ({ stages }) => {
  const top = stages[0]?.count || 0;
  const max = Math.max(1, ...stages.map(s => s.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
      {stages.map(s => {
        const pct = top ? Math.round((s.count / top) * 100) : 0;
        return (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }} title={`${s.label}: ${s.count} (${pct}% of top)`}>
            <span style={{ width: 72, fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>{s.label}</span>
            <div style={{ flex: 1, height: 22, background: 'hsl(var(--surface-2))', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${Math.max((s.count / max) * 100, s.count > 0 ? 8 : 0)}%`, height: '100%', background: s.color, borderRadius: 6, transition: 'width .6s ease' }} />
              <span style={{ position: 'absolute', right: 8, top: 0, height: '100%', display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{s.count}</span>
            </div>
            <span style={{ width: 36, textAlign: 'right', fontSize: '0.72rem', color: 'hsl(var(--text-muted))' }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  planBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '10px',
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  metricCard: {
    padding: '20px',
    borderRadius: '16px'
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  metricTitle: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))',
    fontWeight: '500'
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: '800',
    color: 'hsl(var(--text-primary))',
    marginBottom: '8px'
  },
  metricSub: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-muted))'
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '20px'
  },
  chartCard: {
    padding: '24px',
    borderRadius: '16px'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'hsl(var(--text-primary))',
    marginBottom: '6px'
  },
  sectionSubtitle: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))',
    marginBottom: '20px'
  },
  chartWrapper: {
    height: '180px',
    margin: '20px 0',
    position: 'relative' as const
  },
  chartLegend: {
    display: 'flex',
    gap: '20px',
    marginTop: '15px'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.8rem',
    color: 'hsl(var(--text-secondary))'
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  contentGrid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
};
