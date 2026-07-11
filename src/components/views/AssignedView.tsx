import React from 'react';
import { ClipboardList, ExternalLink, UserCircle2, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Lead } from '../../context/AppContext';

const PLATFORM_COLORS: Record<string, string> = {
  reddit: '#ff4500', twitter: '#1da1f2', linkedin: '#0a66c2', hackernews: '#ff6600',
};

// The stages a teammate can move an assigned lead through.
const STAGES: Lead['status'][] = ['contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'];

export const AssignedView: React.FC = () => {
  const { assignedToMe, updateMyAssignmentStatus, isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return (
      <div className="view-container">
        <div className="view-header"><div className="view-title">
          <h1>Assigned to Me</h1>
          <p>Leads your team leader hands off to you appear here.</p>
        </div></div>
        <div className="glass-card" style={styles.empty}>
          <ClipboardList size={34} color="hsl(var(--text-faint))" />
          <p style={{ marginTop: 10 }}>Sign in with your own account to see leads assigned to you.</p>
        </div>
      </div>
    );
  }

  const sorted = [...assignedToMe].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  return (
    <div className="view-container">
      <div className="view-header"><div className="view-title">
        <h1>Assigned to Me</h1>
        <p>Leads handed to you by your team. Update the stage and your leader sees it instantly.</p>
      </div></div>

      {sorted.length === 0 ? (
        <div className="glass-card" style={styles.empty}>
          <ClipboardList size={34} color="hsl(var(--text-faint))" />
          <p style={{ margin: '10px 0 0' }}>Nothing assigned to you yet.</p>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-faint))' }}>When a leader assigns you a lead, it shows up here.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {sorted.map(a => {
            const color = PLATFORM_COLORS[a.lead?.platform] || 'hsl(var(--primary))';
            return (
              <div key={a.id} className="glass-card" style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
                <div style={styles.cardHead}>
                  <span style={styles.author}>{a.lead?.author || 'Lead'}</span>
                  <span style={{ ...styles.platform, color }}>{a.lead?.platform}</span>
                </div>

                {a.lead?.title && <div style={styles.title}>{a.lead.title}</div>}
                {a.lead?.content && <p style={styles.snippet}>{a.lead.content}</p>}

                <div style={styles.metaRow}>
                  <span style={styles.metaItem}><UserCircle2 size={13} /> from {a.ownerName}</span>
                  {typeof a.lead?.intentScore === 'number' && (
                    <span style={styles.metaItem}>Intent {a.lead.intentScore}</span>
                  )}
                </div>

                <div style={styles.footer}>
                  <label style={styles.stageLabel}>Stage</label>
                  <select
                    value={STAGES.includes(a.status as Lead['status']) ? a.status : 'contacted'}
                    onChange={e => updateMyAssignmentStatus(a.id, e.target.value as Lead['status'])}
                    className="form-input"
                    style={styles.select}
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {a.lead?.postUrl && (
                    <a href={a.lead.postUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={styles.openBtn}>
                      <ExternalLink size={13} /> Open
                    </a>
                  )}
                </div>

                <div style={styles.updated}><Clock size={11} /> updated {a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '—'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card: { padding: 18, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  author: { fontWeight: 700, fontSize: '0.95rem', color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  platform: { fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize', flexShrink: 0 },
  title: { fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-primary))' },
  snippet: { fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  metaRow: { display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.74rem', color: 'hsl(var(--text-muted))' },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  footer: { display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid hsl(var(--surface-1))', paddingTop: 12 },
  stageLabel: { fontSize: '0.74rem', color: 'hsl(var(--text-muted))' },
  select: { flex: 1, fontSize: '0.8rem', textTransform: 'capitalize' },
  openBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', padding: '6px 12px', textDecoration: 'none', whiteSpace: 'nowrap' },
  updated: { display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'hsl(var(--text-faint))' },
  empty: { padding: '46px 20px', borderRadius: 14, textAlign: 'center', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  invite: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, marginBottom: 16, border: '1px solid rgba(var(--primary-rgb), 0.3)' },
  acceptBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.82rem', flexShrink: 0 },
};

export default AssignedView;
