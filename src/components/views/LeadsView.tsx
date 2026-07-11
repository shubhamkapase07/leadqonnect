import React, { useEffect, useState } from 'react';
import {
  Plus, Search, Lock, Sparkles, TrendingUp, Inbox,
  Send, X as CloseIcon, Play, Pause, Trash2, Radar,
  ChevronDown, Filter, ArrowUpDown, CheckCircle, Tag,
  Loader2, AlertCircle, ExternalLink, Clock,
  Building, Globe, UserCheck, UserPlus, Download, Mail,
  Copy, CheckSquare, Square, Layers, ChevronRight, Check, RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RelativeTime } from '../RelativeTime';
import type { Lead, Campaign, Sequence, SequenceEnrollment } from '../../context/AppContext';
import { confirmDialog, notify } from '../Toaster';
import {
  OUTREACH_TEMPLATES, channelsForLead, buildChannelAction, emailSubject,
  mentionFor, CHANNEL_LABEL, type OutreachChannel,
} from '../../lib/outreach';

type MainTab = 'campaigns' | 'inbox';
type SortKey = 'date' | 'intent' | 'platform';

const PLATFORM_COLORS: Record<string, string> = {
  reddit: '#ff4500',
  twitter: '#1da1f2',
  linkedin: '#0a66c2',
  hackernews: '#ff6600'
};

const PLATFORM_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  hackernews: 'Hacker News'
};

// Reddit's API needs a post's "fullname" (t3_<id>) to reply to it. Derive it from the
// post URL (…/comments/<id>/…) or, failing that, from our lead id (l_reddit_<id>).
function redditThingId(lead: Lead): string | null {
  if (lead.platform !== 'reddit') return null;
  const m = lead.postUrl?.match(/\/comments\/([a-z0-9]+)/i);
  if (m) return `t3_${m[1]}`;
  const id = lead.id.replace(/^l_reddit_/, '');
  if (id && id !== lead.id && /^[a-z0-9]+$/i.test(id)) return `t3_${id}`;
  return null;
}

// ─── Create Campaign Modal ─────────────────────────────────────────
interface CreateCampaignModalProps {
  onClose: () => void;
  plan: string;
  onShowUpgrade: () => void;
}

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ onClose, plan, onShowUpgrade }) => {
  const { addCampaign, suggestKeywords } = useApp();
  const [name, setName] = useState('');
  const [serviceOffered, setServiceOffered] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<Campaign['platforms']>(['reddit']);
  const [error, setError] = useState('');

  // AI Suggestions state
  const [suggestions, setSuggestions] = useState<Record<string, string[]> | null>(null);
  const [activeSugTab, setActiveSugTab] = useState<string>('Primary Keywords');
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleAddKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
    setKeywordInput('');
  };

  const handleAddSuggestedKeyword = (kw: string) => {
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
  };

  const handleAddAllSuggestions = () => {
    if (!suggestions) return;
    const allSugs = Object.values(suggestions).flat();
    setKeywords(prev => {
      const unique = new Set([...prev, ...allSugs]);
      return Array.from(unique);
    });
  };

  const handleSuggest = () => {
    if (!serviceOffered.trim()) {
      setError('Please fill in the "Service/Product Offered" to generate AI keywords.');
      return;
    }
    setError('');
    setIsSuggesting(true);
    setTimeout(() => {
      const sugs = suggestKeywords(serviceOffered);
      setSuggestions(sugs);
      setIsSuggesting(false);
    }, 900);
  };

  const togglePlatform = (p: Campaign['platforms'][number]) => {
    if (p !== 'reddit' && plan === 'free') {
      onShowUpgrade();
      return;
    }
    setError('');
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleCreate = () => {
    if (keywords.length === 0) { setError('Add or generate at least one keyword to scan for.'); return; }
    if (platforms.length === 0) { setError('Select at least one platform to scan.'); return; }

    // Auto-name the campaign if the user didn't bother: use their offer, else the first keyword.
    const finalName =
      name.trim() ||
      (serviceOffered.trim() ? serviceOffered.trim().split(/\s+/).slice(0, 4).join(' ') : '') ||
      keywords[0] ||
      'New Campaign';

    // Industry / geography are optional enrichment — sensible defaults keep the data model intact.
    addCampaign(finalName, keywords, platforms, 'General', serviceOffered.trim() || finalName, 'Global');
    onClose();
  };

  return (
    <div style={mStyles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...mStyles.modal, maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={mStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={mStyles.iconWrap}><Radar size={18} color="hsl(var(--primary))" /></div>
            <div>
              <h2 style={mStyles.title}>Create Campaign</h2>
              <p style={mStyles.subtitle}>Add keywords and pick platforms — that's all you need.</p>
            </div>
          </div>
          <button onClick={onClose} style={mStyles.closeBtn}><CloseIcon size={20} /></button>
        </div>

        <div style={mStyles.body}>
          {/* Optional campaign name — auto-generated if left blank */}
          <div style={mStyles.field}>
            <label style={mStyles.label}>
              Campaign name <span style={{ color: 'hsl(var(--text-faint))', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Auto-named from your keywords if left blank"
              value={name}
              onChange={e => setName(e.target.value)}
              style={mStyles.input}
              className="form-input"
            />
          </div>

          {/* Optional: what you offer — powers AI keyword suggestions */}
          <div style={mStyles.field}>
            <label style={mStyles.label}>
              What do you offer? <span style={{ color: 'hsl(var(--text-faint))', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              placeholder="e.g. We build premium Shopify stores. Helps us suggest keywords for you."
              value={serviceOffered}
              onChange={e => setServiceOffered(e.target.value)}
              style={{ ...mStyles.input, minHeight: '42px', resize: 'vertical', padding: '8px 12px' }}
              className="form-input"
            />
          </div>

          {/* Keywords suggestions engine */}
          <div style={mStyles.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={mStyles.label}>Keywords to track</label>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={isSuggesting}
                style={{
                  background: 'rgba(var(--primary-rgb), 0.08)',
                  border: '1px solid rgba(var(--primary-rgb), 0.2)',
                  color: 'hsl(var(--primary))',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isSuggesting ? (
                  <><Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating...</>
                ) : (
                  <><Sparkles size={12} /> Suggest Keywords (AI)</>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Add keyword manually and press Enter"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                style={{ ...mStyles.input, flex: 1 }}
                className="form-input"
              />
              <button onClick={handleAddKeyword} style={mStyles.addBtn} className="btn-primary">
                <Plus size={16} />
              </button>
            </div>

            {keywords.length > 0 && (
              <div style={mStyles.tagRow}>
                {keywords.map(kw => (
                  <span key={kw} style={mStyles.tag}>
                    <Tag size={11} />
                    {kw}
                    <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))} style={mStyles.tagRemove}>
                      <CloseIcon size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* AI Keyword suggestion box */}
          {suggestions && (
            <div className="glass-card" style={{ padding: '16px', borderRadius: '10px', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={13} /> AI Suggested Keyword Sets
                </span>
                <button
                  type="button"
                  onClick={handleAddAllSuggestions}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  Add All Suggestion Phrases
                </button>
              </div>

              {/* Suggestions Tabs */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', borderBottom: '1px solid hsl(var(--surface-1))', marginBottom: '12px' }}>
                {Object.keys(suggestions).map(tabName => (
                  <button
                    key={tabName}
                    type="button"
                    onClick={() => setActiveSugTab(tabName)}
                    style={{
                      background: activeSugTab === tabName ? 'hsl(var(--border-color))' : 'transparent',
                      border: 'none',
                      color: activeSugTab === tabName ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))',
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tabName}
                  </button>
                ))}
              </div>

              {/* Suggestions badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {suggestions[activeSugTab].map(kw => {
                  const added = keywords.includes(kw);
                  return (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => handleAddSuggestedKeyword(kw)}
                      disabled={added}
                      style={{
                        background: added ? 'hsl(var(--surface-1))' : 'hsl(var(--surface-1))',
                        border: '1px solid',
                        borderColor: added ? 'hsl(var(--surface-1))' : 'hsl(var(--border-color))',
                        color: added ? 'hsl(var(--text-faint))' : 'hsl(var(--text-secondary))',
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: added ? 'default' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {added ? <Check size={11} /> : <Plus size={11} />}
                      {kw}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platforms to scan */}
          <div style={mStyles.field}>
            <label style={mStyles.label}>Platforms to Scan</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
              {([
                'reddit', 'twitter', 'linkedin'
              ] as const).map(p => {
                const locked = p !== 'reddit' && plan === 'free';
                const selected = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    style={{
                      ...mStyles.platformBtn,
                      borderColor: selected ? PLATFORM_COLORS[p] : 'hsl(var(--border-color))',
                      background: selected ? `${PLATFORM_COLORS[p]}18` : 'hsl(var(--surface-1))',
                      opacity: locked ? 0.6 : 1,
                      padding: '8px 10px',
                      fontSize: '0.78rem',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PLATFORM_COLORS[p], display: 'inline-block' }} />
                      <span>{PLATFORM_LABELS[p]}</span>
                    </div>
                    {locked && <Lock size={12} color="hsl(var(--text-muted))" />}
                    {selected && !locked && <CheckCircle size={13} color={PLATFORM_COLORS[p]} />}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div style={mStyles.error}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        <div style={mStyles.footer}>
          <button onClick={onClose} style={mStyles.cancelBtn}>Cancel</button>
          <button onClick={handleCreate} className="btn-primary" style={{ padding: '11px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radar size={16} />
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Campaign Card ─────────────────────────────────────────────────
interface CampaignCardProps {
  campaign: Campaign;
  onScan: (timeframe: 'day' | 'week' | 'month') => Promise<void>;
  onDelete: () => void;
  onToggle: () => void;
  onToggleAutoScan: () => void;
  plan: string;
  onShowUpgrade: () => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onScan, onDelete, onToggle, onToggleAutoScan, plan, onShowUpgrade }) => {
  const [scanning, setScanning] = useState(false);
  const [lastScanCount, setLastScanCount] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');

  const handleScan = async () => {
    if (campaign.status === 'paused') return;
    const hasLockedPlatform = plan === 'free' && campaign.platforms.some(p => p !== 'reddit');
    if (hasLockedPlatform && campaign.platforms.every(p => p !== 'reddit')) {
      onShowUpgrade(); return;
    }
    setScanning(true);
    setLastScanCount(null);
    const prevLeads = campaign.leadsCount;
    await onScan(timeframe);
    setLastScanCount(campaign.leadsCount - prevLeads);
    setScanning(false);
  };

  return (
    <div style={cStyles.card}>
      {/* Header */}
      <div style={cStyles.cardHeader}>
        <div style={cStyles.cardIcon}>
          <Radar size={16} color="hsl(var(--primary))" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={cStyles.cardTitle}>{campaign.name}</h3>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-faint))' }}>Created {campaign.createdAt}</span>
        </div>
        <span style={{
          ...cStyles.statusPill,
          background: campaign.status === 'active' ? 'rgba(var(--primary-rgb), 0.12)' : 'rgba(100,116,139,0.12)',
          color: campaign.status === 'active' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))',
          borderColor: campaign.status === 'active' ? 'rgba(var(--primary-rgb), 0.3)' : 'rgba(100,116,139,0.2)'
        }}>
          {campaign.status === 'active' ? '● Active' : '◌ Paused'}
        </span>
      </div>

      {/* Keywords */}
      <div style={cStyles.tagRow}>
        {campaign.keywords.map(kw => (
          <span key={kw} style={cStyles.keyword}>{kw}</span>
        ))}
      </div>

      {/* Platforms */}
      <div style={cStyles.platformRow}>
        {campaign.platforms.map(p => (
          <span key={p} style={{ ...cStyles.platformBadge, color: PLATFORM_COLORS[p], borderColor: `${PLATFORM_COLORS[p]}44`, backgroundColor: `${PLATFORM_COLORS[p]}12` }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: PLATFORM_COLORS[p], display: 'inline-block' }} />
            {PLATFORM_LABELS[p]}
            {plan === 'free' && p !== 'reddit' && <Lock size={10} />}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div style={cStyles.stats}>
        <div style={cStyles.stat}>
          <span style={cStyles.statNum}>{campaign.leadsCount}</span>
          <span style={cStyles.statLabel}>Total Leads</span>
        </div>
        {scanning && (
          <div style={cStyles.scanningBadge}>
            <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} color="hsl(var(--primary))" />
            <span>Scanning...</span>
          </div>
        )}
        {lastScanCount !== null && !scanning && (
          <div style={cStyles.scanResult}>
            <CheckCircle size={13} color="hsl(var(--primary))" />
            <span>+{lastScanCount} new leads found</span>
          </div>
        )}
      </div>

      {/* Timeframe Select */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4, marginBottom: 12, padding: '8px 12px', borderTop: '1px solid hsl(var(--surface-1))', borderBottom: '1px solid hsl(var(--surface-1))' }}>
        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={12} /> Time Window:
        </span>
        <select
          value={timeframe}
          onChange={e => setTimeframe(e.target.value as any)}
          disabled={scanning}
          style={{
            background: 'hsl(var(--surface-1))',
            border: '1px solid hsl(var(--border-color))',
            color: 'hsl(var(--text-primary))',
            fontSize: '0.75rem',
            padding: '3px 6px',
            borderRadius: 6,
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="day">Past 24 Hours</option>
          <option value="week">Past Week</option>
          <option value="month">Past Month</option>
        </select>
      </div>

      {/* Auto-scan toggle — backend scans this campaign daily on a schedule */}
      <div
        onClick={onToggleAutoScan}
        title={campaign.autoScan ? 'Scanning automatically every day' : 'Scan this campaign automatically every day'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          marginBottom: 12, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
          background: campaign.autoScan ? 'rgba(var(--primary-rgb), 0.1)' : 'hsl(var(--surface-1))',
          border: `1px solid ${campaign.autoScan ? 'rgba(var(--primary-rgb), 0.35)' : 'hsl(var(--border-color))'}`,
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} color={campaign.autoScan ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))'} />
          Auto-scan daily
          {plan === 'free' && <Lock size={10} />}
        </span>
        <span style={{
          width: 34, height: 18, borderRadius: 999, position: 'relative', flexShrink: 0,
          background: campaign.autoScan ? 'hsl(var(--primary))' : 'hsl(var(--surface-2))',
          transition: 'background .2s ease',
        }}>
          <span style={{
            position: 'absolute', top: 2, left: campaign.autoScan ? 18 : 2, width: 14, height: 14,
            borderRadius: '50%', background: '#fff', transition: 'left .2s ease',
          }} />
        </span>
      </div>

      {/* Actions */}
      <div style={cStyles.actions}>
        <button
          onClick={handleScan}
          disabled={scanning || campaign.status === 'paused'}
          className="btn-primary"
          style={{
            flex: 1, justifyContent: 'center', padding: '10px',
            opacity: (scanning || campaign.status === 'paused') ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem'
          }}
        >
          {scanning ? (
            <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />Scanning...</>
          ) : (
            <><Search size={15} />Scan for Leads</>
          )}
        </button>
        <button
          onClick={onToggle}
          title={campaign.status === 'active' ? 'Pause' : 'Resume'}
          style={cStyles.iconBtn}
        >
          {campaign.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button onClick={onDelete} title="Delete" style={{ ...cStyles.iconBtn, color: '#ef4444' }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};

// ─── Lead Row ─────────────────────────────────────────────────────
const LeadRow: React.FC<{
  lead: Lead;
  campaigns: Campaign[];
  onClick: () => void;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  showCheckbox?: boolean;
  onDelete?: () => void;
}> = ({ lead, campaigns, onClick, isSelected = false, onToggleSelect, showCheckbox = false, onDelete }) => {
  const campaign = campaigns.find(c => c.id === lead.campaignId);
  return (
    <div
      onClick={onClick}
      style={{
        ...lStyles.row,
        background: isSelected ? 'rgba(var(--primary-rgb), 0.04)' : 'transparent',
        borderColor: isSelected ? 'rgba(var(--primary-rgb), 0.2)' : 'hsl(var(--surface-1))',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ ...lStyles.platformBar, backgroundColor: PLATFORM_COLORS[lead.platform] }} />
      {showCheckbox && onToggleSelect && (
        <div
          onClick={onToggleSelect}
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingRight: '10px',
            cursor: 'pointer',
            alignSelf: 'stretch'
          }}
        >
          {isSelected ? (
            <CheckSquare size={19} color="hsl(var(--primary))" />
          ) : (
            <Square size={19} color="hsl(var(--text-muted))" />
          )}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={lStyles.header}>
          <div style={{ ...lStyles.platformDot, backgroundColor: PLATFORM_COLORS[lead.platform] }} />
          <span style={lStyles.author}>{lead.author}</span>
          <span style={lStyles.handle}>{lead.handle}</span>
          {campaign && (
            <span style={lStyles.campaignTag}>
              <Radar size={10} />
              {campaign.name}
            </span>
          )}
          <RelativeTime lead={lead} style={lStyles.time} />
        </div>
        {lead.title && <h3 style={lStyles.title}>{lead.title}</h3>}
        <p style={lStyles.snippet}>{lead.content.substring(0, 160)}{lead.content.length > 160 ? '...' : ''}</p>
        
        {/* Step 3: Intent, Quality, Match Scores & Geography */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', margin: '10px 0', padding: '10px 14px', background: 'hsl(var(--surface-1))', borderRadius: '8px', border: '1px solid hsl(var(--surface-1))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
            <span style={{ color: 'hsl(var(--text-muted))' }}>Intent Score:</span>
            <span style={{ color: lead.intentScore >= 85 ? 'hsl(var(--primary))' : '#f59e0b', fontWeight: '700' }}>{lead.intentScore || 70}/100</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
            <span style={{ color: 'hsl(var(--text-muted))' }}>Quality Score:</span>
            <span style={{ color: lead.leadQualityScore >= 80 ? 'hsl(var(--primary))' : '#f59e0b', fontWeight: '700' }}>{lead.leadQualityScore || 70}/100</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
            <span style={{ color: 'hsl(var(--text-muted))' }}>Match Score:</span>
            <span style={{ color: lead.industryMatchScore >= 85 ? 'hsl(var(--primary))' : '#f59e0b', fontWeight: '700' }}>{lead.industryMatchScore || 70}/100</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', marginLeft: 'auto' }}>
            <Globe size={11} color="hsl(var(--text-muted))" />
            <span style={{ color: 'hsl(var(--text-secondary))' }}>{lead.geography || 'Remote'}</span>
          </div>
        </div>

        <div style={lStyles.footer}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
            {lead.keywords.map((kw, i) => (
              <span key={i} style={lStyles.keyword}>{kw}</span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            <TrendingUp size={13} color={lead.sentiment === 'high' ? 'hsl(var(--primary))' : '#f59e0b'} />
            <span style={{ color: lead.sentiment === 'high' ? 'hsl(var(--primary))' : '#f59e0b', textTransform: 'capitalize' as const }}>
              {lead.sentiment} intent
            </span>
            <span style={{ color: 'hsl(var(--border-color))' }}>•</span>
            <span style={{ ...lStyles.platformPill, color: PLATFORM_COLORS[lead.platform], borderColor: `${PLATFORM_COLORS[lead.platform]}44` }}>
              {PLATFORM_LABELS[lead.platform] || lead.platform}
            </span>
            {lead.postUrl && (
              <a
                href={lead.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'hsl(var(--primary))', textDecoration: 'none', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(var(--primary-rgb), 0.2)', background: 'rgba(var(--primary-rgb), 0.06)', fontWeight: '600', cursor: 'pointer' }}
                title="View original post"
              >
                <ExternalLink size={11} />
                View Post
              </a>
            )}
            <span className={`badge badge-${lead.status}`} style={{ fontSize: '0.65rem', padding: '2px 8px', textTransform: 'uppercase' }}>
              {lead.status === 'potential' ? 'potential lead' : lead.status}
            </span>
            {onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(); }}
                title="Delete this lead"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'hsl(var(--danger))', padding: '2px 6px', borderRadius: 4, border: '1px solid hsl(var(--danger) / 0.25)', background: 'hsl(var(--danger) / 0.08)', fontWeight: 600, cursor: 'pointer' }}
              >
                <Trash2 size={11} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Enroll-in-sequence control (lead detail panel) ────────────────
const EnrollInSequence: React.FC<{
  lead: Lead;
  sequences: Sequence[];
  enrollments: SequenceEnrollment[];
  capable: boolean;
  onEnroll: (leadId: string, sequenceId: string, emailTo?: string) => Promise<void>;
  onUpgrade: () => void;
}> = ({ lead, sequences, enrollments, capable, onEnroll, onUpgrade }) => {
  const [seqId, setSeqId] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const active = enrollments.find(e => e.leadId === lead.id && e.status === 'active');
  const selectedSeq = sequences.find(s => s.id === seqId);
  const needsEmail = selectedSeq?.channel === 'email';

  const doEnroll = async () => {
    if (!seqId) return;
    setBusy(true);
    await onEnroll(lead.id, seqId, email);
    setBusy(false);
    setSeqId(''); setEmail('');
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ ...mStyles.label, fontSize: '0.7rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Send size={12} /> Outreach Sequence
      </label>

      {!capable ? (
        <button onClick={onUpgrade} style={{ ...vStyles.select, width: '100%', cursor: 'pointer', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))' }}>Automate follow-ups</span>
          <span style={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', fontWeight: 700 }}>Upgrade ↗</span>
        </button>
      ) : active ? (
        <div style={{ ...vStyles.select, justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', color: 'hsl(var(--text-primary))' }}>{active.sequenceName}</span>
          <span style={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', fontWeight: 700 }}>Step {active.currentStep + 1}/{active.totalSteps}</span>
        </div>
      ) : sequences.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', margin: 0 }}>No sequences yet — create one in the Sequences tab.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select value={seqId} onChange={e => setSeqId(e.target.value)} style={{ ...vStyles.selectEl, width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--surface-1))' }}>
            <option value="">Choose a sequence…</option>
            {sequences.map(s => <option key={s.id} value={s.id}>{s.name} ({s.channel})</option>)}
          </select>
          {needsEmail && (
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Recipient email"
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--surface-1))', color: 'hsl(var(--text-primary))', fontSize: '0.82rem', outline: 'none' }} />
          )}
          <button className="btn-primary" disabled={!seqId || busy} onClick={doEnroll}
            style={{ padding: '9px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, opacity: (!seqId || busy) ? 0.5 : 1 }}>
            {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />} Enroll lead
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main View ─────────────────────────────────────────────────────
export const LeadsView: React.FC = () => {
  const { plan, capabilities, leads, campaigns, triggerScanLeads, deleteCampaign, toggleCampaignStatus, setCampaignAutoScan, updateLeadStatus, deleteLead, deleteLeads, sendPitch, qualifyLead, assignLead, teamMembers, redditAccount, postRedditComment, setActiveTab, openUpgradeModal, sequences, enrollments, enrollLeadInSequence } = useApp();
  const [mainTab, setMainTab] = useState<'campaigns' | 'potential_leads' | 'crm_pipeline'>('campaigns');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Gate campaign creation on the plan's campaign limit (Free = 1).
  const handleNewCampaign = () => {
    if (campaigns.length >= capabilities.maxCampaigns) { openUpgradeModal(); return; }
    setShowCreateModal(true);
  };

  // Selected state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);

  // Outreach & Assignment State
  const [templateId, setTemplateId] = useState<string>(OUTREACH_TEMPLATES[0].id);
  const [outreachDraft, setOutreachDraft] = useState('');
  const [copiedOutreach, setCopiedOutreach] = useState(false);

  // Reddit reply state
  const [redditPosting, setRedditPosting] = useState(false);
  const [redditPostMsg, setRedditPostMsg] = useState<string | null>(null);

  const handleRedditReply = async () => {
    if (!selectedLead) return;
    const thingId = redditThingId(selectedLead);
    if (!thingId) { setRedditPostMsg("Couldn't locate the original Reddit post to reply to."); return; }
    setRedditPosting(true);
    setRedditPostMsg(null);
    try {
      await postRedditComment(thingId, outreachDraft.trim() || buildTemplate(selectedLead, templateId));
      updateLeadStatus(selectedLead.id, 'contacted');
      setRedditPostMsg('✅ Reply posted on Reddit from your account.');
    } catch (err) {
      setRedditPostMsg(err instanceof Error ? err.message : 'Failed to post the reply.');
    } finally {
      setRedditPosting(false);
    }
  };
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Filter out potential leads vs crm leads
  const potentialLeads = leads.filter(l => l.status === 'potential');
  const crmLeads = leads.filter(l => l.status !== 'potential' && l.status !== 'archived');

  // Multi-select actions
  const handleToggleSelectLead = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleSelectAllLeads = () => {
    const activePotentialLeads = displayPotentialLeads.map(l => l.id);
    const allSelected = activePotentialLeads.every(id => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds(prev => prev.filter(id => !activePotentialLeads.includes(id)));
    } else {
      setSelectedLeadIds(prev => {
        const union = new Set([...prev, ...activePotentialLeads]);
        return Array.from(union);
      });
    }
  };

  const handlePromoteSelected = () => {
    selectedLeadIds.forEach(id => {
      updateLeadStatus(id, 'selected');
    });
    setSelectedLeadIds([]);
  };

  const handleDeleteLead = async (lead: Lead) => {
    const ok = await confirmDialog({
      title: 'Delete lead?',
      message: `This permanently removes the lead from ${lead.author}. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    deleteLead(lead.id);
    setSelectedLeadIds(prev => prev.filter(id => id !== lead.id));
    notify('Lead deleted.', 'success');
  };

  const handleDeleteSelected = async () => {
    if (selectedLeadIds.length === 0) return;
    const n = selectedLeadIds.length;
    const ok = await confirmDialog({
      title: `Delete ${n} lead${n > 1 ? 's' : ''}?`,
      message: `This permanently removes ${n} selected lead${n > 1 ? 's' : ''}. This can't be undone.`,
      confirmLabel: `Delete ${n}`,
      danger: true,
    });
    if (!ok) return;
    deleteLeads(selectedLeadIds);
    setSelectedLeadIds([]);
    notify(`${n} lead${n > 1 ? 's' : ''} deleted.`, 'success');
  };

  // CSV Exporter — exports one or more leads with every CRM column.
  const handleExportLeads = (leadsToExport: Lead[], filename: string) => {
    if (leadsToExport.length === 0) {
      notify('No leads to export.', 'info');
      return;
    }
    const headers = [
      'ID', 'Author', 'Handle', 'Platform', 'Content', 'Intent Score', 'Quality Score', 'Industry Match Score', 'Geography',
      'Status', 'Company Name', 'Website', 'Employee Count', 'Industry', 'Funding', 'Decision Makers', 'Contact Email',
      'Buying Intent Score', 'Budget Potential', 'Response Probability', 'Overall Score', 'Assigned To'
    ];
    const esc = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = leadsToExport.map(lead => {
      const dms = lead.decisionMakers ? lead.decisionMakers.map(dm => `${dm.name} (${dm.title})`).join('; ') : '';
      return [
        lead.id,
        lead.author,
        lead.handle,
        lead.platform,
        lead.content,
        lead.intentScore || '',
        lead.leadQualityScore || '',
        lead.industryMatchScore || '',
        lead.geography || '',
        lead.status,
        lead.companyName || '',
        lead.companyWebsite || '',
        lead.employeeCount || '',
        lead.companyIndustry || '',
        lead.fundingInfo || '',
        dms,
        lead.contactDetails?.email || '',
        lead.buyingIntentScore || '',
        lead.budgetPotential || '',
        lead.responseProbability || '',
        lead.overallOpportunityScore || '',
        lead.assignedTo || 'Unassigned'
      ].map(esc).join(',');
    });

    const csvContent = [headers.map(esc).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Build a personalized template body for the current lead.
  const buildTemplate = (lead: Lead, templateId: string): string => {
    const tpl = OUTREACH_TEMPLATES.find(t => t.id === templateId) || OUTREACH_TEMPLATES[0];
    return tpl.build({
      mention: mentionFor(lead),
      keyword: lead.keywords[0] || 'your project',
      company: lead.companyName || 'your team',
    });
  };

  const handleCopyOutreach = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOutreach(true);
    setTimeout(() => setCopiedOutreach(false), 2000);
  };

  // Open the chosen channel with the message pre-filled where the platform allows it,
  // otherwise copy the message and open the destination so the user can paste.
  const handleChannelOutreach = (lead: Lead, channel: OutreachChannel) => {
    const body = outreachDraft.trim();
    if (!body) { notify('Write a message first.', 'info'); return; }
    const action = buildChannelAction(lead, channel, body, emailSubject(lead.keywords[0] || 'your project'));
    if (!action.available) { notify(action.hint || `${CHANNEL_LABEL[channel]} isn't available for this lead.`, 'info'); return; }
    if (!action.prefilled) {
      navigator.clipboard.writeText(body);
      notify('Message copied — paste it into the chat that opens.', 'success');
    }
    window.open(action.url, '_blank', 'noopener,noreferrer');
    if (lead.status === 'potential' || lead.status === 'selected' || lead.status === 'qualified') {
      updateLeadStatus(lead.id, 'contacted');
    }
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
  };

  // Regenerate the editable outreach draft whenever the open lead or chosen template changes.
  useEffect(() => {
    if (!selectedLead) return;
    setOutreachDraft(buildTemplate(selectedLead, templateId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id, templateId]);

  const handleQualifyLead = async (leadId: string) => {
    setQualifyingId(leadId);
    await qualifyLead(leadId);
    setQualifyingId(null);
    // Refresh the currently open drawer if it's the qualified lead
    if (selectedLead && selectedLead.id === leadId) {
      const updated = leads.find(l => l.id === leadId);
      if (updated) setSelectedLead(updated);
    }
  };

  // ── Filters & Sorting ──
  const applyFilters = (leadList: Lead[]) => {
    return leadList.filter(l => {
      const matchSearch = l.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchCampaign = filterCampaign === 'all' || l.campaignId === filterCampaign;
      const matchPlatform = filterPlatform === 'all' || l.platform === filterPlatform;
      return matchSearch && matchCampaign && matchPlatform;
    });
  };

  const applySorting = (leadList: Lead[]) => {
    const sorted = [...leadList];
    if (sortKey === 'intent') {
      sorted.sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));
    } else if (sortKey === 'platform') {
      sorted.sort((a, b) => a.platform.localeCompare(b.platform));
    }
    return sorted; // date sorting is default from state order
  };

  const displayPotentialLeads = applySorting(applyFilters(potentialLeads));
  const sortLabels: Record<SortKey, string> = { date: 'Newest First', intent: 'High Intent First', platform: 'By Platform' };

  // Kanban CRM Pipelines Columns Configuration
  const PIPELINE_COLUMNS: { key: Lead['status']; label: string; color: string }[] = [
    { key: 'selected', label: 'Selected', color: '#3b82f6' },
    { key: 'qualified', label: 'Qualified', color: 'hsl(var(--primary))' },
    { key: 'contacted', label: 'Contacted', color: '#f59e0b' },
    { key: 'replied', label: 'Replied', color: 'hsl(var(--primary))' },
    { key: 'meeting', label: 'Meeting Booked', color: '#ec4899' },
    { key: 'proposal', label: 'Proposal Sent', color: '#06b6d4' },
    { key: 'won', label: 'Won', color: '#22c55e' },
    { key: 'lost', label: 'Lost', color: '#ef4444' }
  ];

  return (
    <div className="view-container" style={{ position: 'relative' }}>
      {/* ── Header ── */}
      <div className="view-header">
        <div className="view-title">
          <h1>Lead Discovery Pipeline</h1>
          <p>Launch active crawler campaigns, approve potential leads, and qualify sales prospects.</p>
        </div>
        <button onClick={handleNewCampaign} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} />
          New Campaign
        </button>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={vStyles.tabs}>
        <button
          onClick={() => setMainTab('campaigns')}
          style={{ ...vStyles.tab, borderBottomColor: mainTab === 'campaigns' ? 'hsl(var(--primary))' : 'transparent', color: mainTab === 'campaigns' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}
        >
          <Radar size={15} />
          Campaigns
          <span style={vStyles.tabBadge}>{campaigns.length}</span>
        </button>
        <button
          onClick={() => setMainTab('potential_leads')}
          style={{ ...vStyles.tab, borderBottomColor: mainTab === 'potential_leads' ? 'hsl(var(--primary))' : 'transparent', color: mainTab === 'potential_leads' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}
        >
          <Inbox size={15} />
          Potential Leads
          <span style={vStyles.tabBadge}>{potentialLeads.length}</span>
        </button>
        <button
          onClick={() => setMainTab('crm_pipeline')}
          style={{ ...vStyles.tab, borderBottomColor: mainTab === 'crm_pipeline' ? 'hsl(var(--primary))' : 'transparent', color: mainTab === 'crm_pipeline' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}
        >
          <Layers size={15} />
          CRM Pipeline
          <span style={vStyles.tabBadge}>{crmLeads.length}</span>
        </button>
      </div>

      {/* ── Campaigns Tab ── */}
      {mainTab === 'campaigns' && (
        <>
          {campaigns.length === 0 ? (
            <div style={vStyles.emptyState}>
              <Radar size={52} color="hsl(var(--text-faint))" style={{ marginBottom: 16 }} />
              <h3 style={{ color: 'hsl(var(--text-primary))', marginBottom: 8 }}>No Campaigns Yet</h3>
              <p style={{ color: 'hsl(var(--text-muted))', maxWidth: 360, textAlign: 'center' as const }}>
                Create your first campaign to start scanning Reddit, X, LinkedIn, Job boards and more for active requirements posts.
              </p>
              <button onClick={handleNewCampaign} className="btn-primary" style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} />Create First Campaign
              </button>
            </div>
          ) : (
            <div style={vStyles.campaignGrid}>
              {campaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  plan={plan}
                  onScan={(tf) => triggerScanLeads(campaign.id, tf)}
                  onDelete={() => deleteCampaign(campaign.id)}
                  onToggle={() => toggleCampaignStatus(campaign.id)}
                  onToggleAutoScan={() => setCampaignAutoScan(campaign.id, !campaign.autoScan)}
                  onShowUpgrade={openUpgradeModal}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Potential Leads Dashboard Tab ── */}
      {mainTab === 'potential_leads' && (
        <>
          {/* Toolbar */}
          <div style={vStyles.toolbar}>
            <div style={{ position: 'relative' as const, display: 'flex', alignItems: 'center' }}>
              <Search size={15} color="hsl(var(--text-muted))" style={{ position: 'absolute' as const, left: 12 }} />
              <input
                type="text"
                placeholder="Search potential leads..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 36, width: 220, fontSize: '0.875rem' }}
              />
            </div>

            {/* Campaign filter */}
            <div style={vStyles.select}>
              <Filter size={14} color="hsl(var(--text-muted))" />
              <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} style={vStyles.selectEl}>
                <option value="all">All Campaigns</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="">No Campaign</option>
              </select>
              <ChevronDown size={14} color="hsl(var(--text-muted))" />
            </div>

            {/* Platform filter */}
            <div style={vStyles.select}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: filterPlatform !== 'all' ? PLATFORM_COLORS[filterPlatform] : 'hsl(var(--text-muted))', display: 'inline-block' }} />
              <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} style={vStyles.selectEl}>
                <option value="all">All Platforms</option>
                {(['reddit', 'twitter', 'linkedin'] as const).map(p => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
              <ChevronDown size={14} color="hsl(var(--text-muted))" />
            </div>

            {/* Sort */}
            <div style={{ position: 'relative' as const }}>
              <button
                onClick={() => setShowSortMenu(v => !v)}
                style={vStyles.sortBtn}
              >
                <ArrowUpDown size={14} />
                {sortLabels[sortKey]}
                <ChevronDown size={13} />
              </button>
              {showSortMenu && (
                <div style={vStyles.sortMenu}>
                  {(Object.keys(sortLabels) as SortKey[]).map(k => (
                    <button
                      key={k}
                      onClick={() => { setSortKey(k); setShowSortMenu(false); }}
                      style={{ ...vStyles.sortItem, color: sortKey === k ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))' }}
                    >
                      {sortKey === k && <CheckCircle size={13} color="hsl(var(--primary))" />}
                      {sortLabels[k]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {displayPotentialLeads.length > 0 && (
              <button
                onClick={handleSelectAllLeads}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '8px 12px' }}
              >
                {displayPotentialLeads.every(l => selectedLeadIds.includes(l.id)) ? 'Deselect Page' : 'Select Page'}
              </button>
            )}

            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
              {displayPotentialLeads.length} potential leads found
            </span>
          </div>

          {/* Leads list */}
          <div className="glass-card" style={{ borderRadius: 12, overflow: 'hidden' as const }}>
            {displayPotentialLeads.length === 0 ? (
              <div style={vStyles.emptyState}>
                <Inbox size={48} color="hsl(var(--text-faint))" style={{ marginBottom: 12 }} />
                <h3 style={{ color: 'hsl(var(--text-primary))', marginBottom: 8 }}>No potential leads found</h3>
                <p style={{ color: 'hsl(var(--text-muted))' }}>Launch crawler scans or verify your filters.</p>
              </div>
            ) : (
              displayPotentialLeads.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  campaigns={campaigns}
                  onClick={() => handleSelectLead(lead)}
                  isSelected={selectedLeadIds.includes(lead.id)}
                  onToggleSelect={(e) => handleToggleSelectLead(lead.id, e)}
                  showCheckbox={true}
                  onDelete={() => handleDeleteLead(lead)}
                />
              ))
            )}
          </div>

          {/* Floating selection actions bar */}
          {selectedLeadIds.length > 0 && (
            <div
              className="glass-card glow-card"
              style={{
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '14px 28px',
                borderRadius: '12px',
                backgroundColor: 'rgba(9, 10, 15, 0.85)',
                border: '1px solid rgba(var(--primary-rgb), 0.3)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                backdropFilter: 'blur(20px)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'hsl(var(--text-primary))', fontSize: '0.9rem', fontWeight: '700' }}>
                  {selectedLeadIds.length} leads selected
                </span>
                <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>
                  Approve and promote them to CRM selection stage
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setSelectedLeadIds([])}
                  style={{ background: 'none', border: '1px solid hsl(var(--border-color))', borderRadius: '6px', padding: '6px 12px', color: 'hsl(var(--text-secondary))', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSelected}
                  style={{ border: '1px solid hsl(var(--danger) / 0.3)', background: 'hsl(var(--danger) / 0.1)', borderRadius: '6px', padding: '8px 14px', color: 'hsl(var(--danger))', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  onClick={handlePromoteSelected}
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserCheck size={14} /> Promote to Selected
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── CRM Pipeline Board Tab ── */}
      {mainTab === 'crm_pipeline' && (
        <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px' }}>
          <button
            onClick={() => handleExportLeads(crmLeads, 'crm_pipeline_leads')}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px' }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
        <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '16px', minHeight: '600px', width: 'max-content', padding: '4px' }}>
            {PIPELINE_COLUMNS.map(col => {
              const colLeads = crmLeads.filter(l => l.status === col.key);
              return (
                <div
                  key={col.key}
                  style={{
                    width: '300px',
                    backgroundColor: 'hsl(var(--surface-1))',
                    border: '1px solid hsl(var(--surface-1))',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Column Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--surface-1))', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color }} />
                      <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'hsl(var(--text-primary))', margin: 0 }}>{col.label}</h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', background: 'hsl(var(--surface-1))', color: 'hsl(var(--text-secondary))', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' }}>
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Cards container */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '550px', paddingRight: '4px' }}>
                    {colLeads.length === 0 ? (
                      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '40px 10px', color: 'hsl(var(--text-faint))', fontSize: '0.8rem', border: '1px dashed hsl(var(--surface-1))', borderRadius: '8px' }}>
                        No opportunities
                      </div>
                    ) : (
                      colLeads.map(lead => {
                        const score = lead.overallOpportunityScore || lead.intentScore;
                        return (
                          <div
                            key={lead.id}
                            onClick={() => handleSelectLead(lead)}
                            className="glass-card glow-card"
                            style={{
                              padding: '14px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              borderLeft: `2.5px solid ${col.color}`
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                                {lead.author}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: PLATFORM_COLORS[lead.platform], background: `${PLATFORM_COLORS[lead.platform]}12`, border: `1px solid ${PLATFORM_COLORS[lead.platform]}22`, padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                {PLATFORM_LABELS[lead.platform] ? PLATFORM_LABELS[lead.platform].split(' ')[0] : lead.platform}
                              </span>
                            </div>

                            <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                              {lead.content}
                            </p>

                            {/* Qualification & scores info */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.75rem', borderTop: '1px solid hsl(var(--surface-1))', paddingTop: '6px' }}>
                              <span style={{ color: 'hsl(var(--text-faint))' }}>
                                {lead.geography || 'Remote'}
                              </span>
                              <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: '700' }}>
                                Score: <strong style={{ color: score >= 85 ? 'hsl(var(--primary))' : '#f59e0b' }}>{score}</strong>
                              </span>
                            </div>

                            {/* Pipeline control buttons */}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }} onClick={e => e.stopPropagation()}>
                              {lead.status === 'selected' && (
                                <button
                                  onClick={() => handleQualifyLead(lead.id)}
                                  disabled={qualifyingId === lead.id}
                                  className="btn-primary"
                                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.72rem', borderRadius: '4px', justifyContent: 'center' }}
                                >
                                  {qualifyingId === lead.id ? (
                                    <><Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> Qualifying...</>
                                  ) : (
                                    <><Sparkles size={11} /> AI Qualify</>
                                  )}
                                </button>
                              )}
                              {lead.status !== 'selected' && lead.status !== 'lost' && (
                                <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
                                  {/* Left Arrow */}
                                  <button
                                    onClick={() => {
                                      const colIndex = PIPELINE_COLUMNS.findIndex(c => c.key === lead.status);
                                      if (colIndex > 0) {
                                        updateLeadStatus(lead.id, PIPELINE_COLUMNS[colIndex - 1].key);
                                      }
                                    }}
                                    style={{ flex: 1, background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-color))', borderRadius: '4px', padding: '3px 0', color: 'hsl(var(--text-secondary))', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                                    title="Move Left"
                                  >
                                    ←
                                  </button>
                                  {/* Right Arrow */}
                                  <button
                                    onClick={() => {
                                      const colIndex = PIPELINE_COLUMNS.findIndex(c => c.key === lead.status);
                                      if (colIndex < PIPELINE_COLUMNS.length - 1) {
                                        updateLeadStatus(lead.id, PIPELINE_COLUMNS[colIndex + 1].key);
                                      }
                                    }}
                                    style={{ flex: 1, background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-color))', borderRadius: '4px', padding: '3px 0', color: 'hsl(var(--text-secondary))', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                                    title="Move Right"
                                  >
                                    →
                                  </button>
                                </div>
                              )}
                              {/* Delete — always available */}
                              <button
                                onClick={() => handleDeleteLead(lead)}
                                title="Delete lead"
                                style={{ flexShrink: 0, background: 'hsl(var(--danger) / 0.1)', border: '1px solid hsl(var(--danger) / 0.25)', borderRadius: '4px', padding: '3px 8px', color: 'hsl(var(--danger))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}

      {/* ── Lead Detail Drawer ── */}
      {selectedLead && (
        <div style={dStyles.overlay} onClick={() => setSelectedLead(null)}>
          <div style={dStyles.drawer} className="glass-card" onClick={e => e.stopPropagation()}>
            <div style={dStyles.drawerHeader}>
              <h2 style={dStyles.drawerTitle}>Opportunity Workspace</h2>
              <button style={dStyles.closeBtn} onClick={() => setSelectedLead(null)}><CloseIcon size={20} /></button>
            </div>
            
            <div style={dStyles.drawerBody}>
              {/* Original Post card */}
              <div className="glass-card" style={{ padding: 20, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={dStyles.avatar}>{selectedLead.author[0].toUpperCase()}</div>
                  <div>
                    <h4 style={{ color: 'hsl(var(--text-primary))', margin: 0, fontSize: '0.95rem' }}>{selectedLead.author}</h4>
                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>{selectedLead.handle}</span>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: PLATFORM_COLORS[selectedLead.platform], background: `${PLATFORM_COLORS[selectedLead.platform]}15`, border: `1px solid ${PLATFORM_COLORS[selectedLead.platform]}44`, padding: '2px 8px', borderRadius: 4, fontWeight: '600' }}>
                    {PLATFORM_LABELS[selectedLead.platform] || selectedLead.platform}
                  </span>
                </div>
                {selectedLead.title && <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: '1rem', marginBottom: 10 }}>{selectedLead.title}</h3>}
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const }}>{selectedLead.content}</p>
                
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 0 0', borderTop: '1px solid hsl(var(--surface-1))', marginTop: 12 }}>
                  {selectedLead.subreddit && (
                    <span style={{ fontSize: '0.74rem', color: 'hsl(var(--text-muted))', background: 'hsl(var(--surface-1))', padding: '2px 6px', borderRadius: '4px' }}>
                      {selectedLead.subreddit}
                    </span>
                  )}
                  <span style={{ fontSize: '0.74rem', color: 'hsl(var(--text-muted))', background: 'hsl(var(--surface-1))', padding: '2px 6px', borderRadius: '4px' }}>
                    Matched: {selectedLead.keywords.join(', ')}
                  </span>
                </div>

                {selectedLead.postUrl && (
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid hsl(var(--surface-1))' }}>
                    <a
                      href={selectedLead.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.8rem',
                        textDecoration: 'none',
                        color: 'hsl(var(--primary))',
                        border: '1px solid rgba(var(--primary-rgb), 0.2)',
                        background: 'rgba(var(--primary-rgb), 0.05)',
                        padding: '6px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                    >
                      <ExternalLink size={13} />
                      View Requirement Post on {PLATFORM_LABELS[selectedLead.platform] ? PLATFORM_LABELS[selectedLead.platform].split(' ')[0] : selectedLead.platform}
                    </a>
                  </div>
                )}
              </div>

              {/* Step 5: AI Lead Qualification Details */}
              {selectedLead.status !== 'potential' && selectedLead.status !== 'selected' ? (
                <div className="glass-card" style={{ padding: 20, borderRadius: 10, border: '1px solid rgba(var(--primary-rgb), 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Sparkles size={15} color="hsl(var(--primary))" />
                    <span style={{ color: 'hsl(var(--text-primary))', fontWeight: '700', fontSize: '0.9rem' }}>AI Lead Qualification Report</span>
                  </div>

                  {/* AI rationale + recommended next step */}
                  {selectedLead.aiSummary && (
                    <p style={{ fontSize: '0.83rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                      {selectedLead.aiSummary}
                    </p>
                  )}
                  {selectedLead.recommendedAction && (
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-primary))', background: 'rgba(var(--primary-rgb), 0.08)', border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
                      <strong style={{ color: 'hsl(var(--primary))' }}>Recommended:</strong> {selectedLead.recommendedAction}
                    </div>
                  )}

                  {/* Company Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 18 }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Company Name</span>
                      <strong style={{ fontSize: '0.85rem', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building size={12} color="hsl(var(--primary))" /> {selectedLead.companyName || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Website</span>
                      {selectedLead.companyWebsite ? (
                        <a href={selectedLead.companyWebsite} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Globe size={12} /> visit site
                        </a>
                      ) : 'N/A'}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Company Size</span>
                      <strong style={{ fontSize: '0.85rem', color: 'hsl(var(--text-primary))' }}>{selectedLead.employeeCount ? `${selectedLead.employeeCount} employees` : 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Funding Information</span>
                      <strong style={{ fontSize: '0.85rem', color: 'hsl(var(--primary))' }}>{selectedLead.fundingInfo || 'Bootstrapped'}</strong>
                    </div>
                  </div>

                  {/* Scores Gauge meters */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: 18 }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Buying Intent</span>
                      <strong style={{ fontSize: '1rem', color: 'hsl(var(--primary))' }}>{selectedLead.buyingIntentScore || 80}%</strong>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Budget Potential</span>
                      <strong style={{ fontSize: '0.8rem', color: '#f59e0b', whiteSpace: 'nowrap' }}>{selectedLead.budgetPotential || 'High'}</strong>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', display: 'block' }}>Reply Prob.</span>
                      <strong style={{ fontSize: '1rem', color: '#a855f7' }}>{selectedLead.responseProbability || 75}%</strong>
                    </div>
                  </div>

                  {/* Decision Makers List */}
                  {selectedLead.decisionMakers && selectedLead.decisionMakers.length > 0 && (
                    <div style={{ borderTop: '1px solid hsl(var(--surface-1))', paddingTop: '12px', marginBottom: '14px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '8px' }}>Decision Makers</span>
                      {selectedLead.decisionMakers.map((dm, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--surface-1))', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-primary))', fontWeight: '700', display: 'block' }}>{dm.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>{dm.title}</span>
                          </div>
                          {dm.email && (
                            <span style={{ fontSize: '0.72rem', color: '#3b82f6' }}>{dm.email}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contact details */}
                  {selectedLead.contactDetails && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
                      <span>Email: <strong>{selectedLead.contactDetails.email || 'N/A'}</strong></span>
                      <span>Phone: <strong>{selectedLead.contactDetails.phone || 'N/A'}</strong></span>
                    </div>
                  )}
                </div>
              ) : selectedLead.status === 'selected' ? (
                <div className="glass-card" style={{ padding: 20, borderRadius: 10, textAlign: 'center' }}>
                  <Sparkles size={32} color="hsl(var(--primary))" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ color: 'hsl(var(--text-primary))', margin: '0 0 6px' }}>Lead Qualification Available</h4>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.82rem', marginBottom: '14px' }}>Run deep AI classification to gather funding, contact emails, budget parameters, and decision makers.</p>
                  <button
                    onClick={() => handleQualifyLead(selectedLead.id)}
                    disabled={qualifyingId === selectedLead.id}
                    className="btn-primary"
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
                  >
                    {qualifyingId === selectedLead.id ? (
                      <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Qualify Report...</>
                    ) : (
                      <><Sparkles size={13} /> Perform AI Qualification</>
                    )}
                  </button>
                </div>
              ) : null}

              {/* Step 6 Actions Menu */}
              <div style={{ borderTop: '1px solid hsl(var(--surface-1))', paddingTop: '16px' }}>
                <h4 style={dStyles.sectionLabel}>CRM Lead Actions</h4>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {/* Mark Won/Lost */}
                  <button
                    onClick={() => { updateLeadStatus(selectedLead.id, 'won'); setSelectedLead(null); }}
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: '0.78rem', padding: '8px 12px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px', color: '#4ade80' }}
                  >
                    Mark Won
                  </button>
                  <button
                    onClick={() => { updateLeadStatus(selectedLead.id, 'lost'); setSelectedLead(null); }}
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: '0.78rem', padding: '8px 12px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}
                  >
                    Mark Lost
                  </button>
                </div>

                {/* Team Assignee Select */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ ...mStyles.label, fontSize: '0.7rem', marginBottom: '6px', display: 'block' }}>Assign Lead</label>
                  <div style={vStyles.select}>
                    <UserPlus size={14} color="hsl(var(--text-muted))" />
                    <select
                      value={selectedLead.assignedTo || 'Unassigned'}
                      onChange={e => assignLead(selectedLead.id, e.target.value === 'Unassigned' ? '' : e.target.value)}
                      style={{ ...vStyles.selectEl, width: '100%' }}
                    >
                      <option value="Unassigned">Unassigned</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.name}>{m.name}{m.role ? ` (${m.role})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Enroll in an outreach sequence */}
                <EnrollInSequence
                  lead={selectedLead}
                  sequences={sequences}
                  enrollments={enrollments}
                  capable={capabilities.ai}
                  onEnroll={enrollLeadInSequence}
                  onUpgrade={openUpgradeModal}
                />

                {/* CRM Status select */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ ...mStyles.label, fontSize: '0.7rem', marginBottom: '6px', display: 'block' }}>Pipeline Status Stage</label>
                  <div style={vStyles.select}>
                    <Layers size={14} color="hsl(var(--text-muted))" />
                    <select
                      value={selectedLead.status}
                      onChange={e => {
                        const nextStat = e.target.value as Lead['status'];
                        updateLeadStatus(selectedLead.id, nextStat);
                        setSelectedLead(prev => prev ? { ...prev, status: nextStat } : null);
                      }}
                      style={{ ...vStyles.selectEl, width: '100%' }}
                    >
                      <option value="potential">Potential Lead</option>
                      {PIPELINE_COLUMNS.map(col => (
                        <option key={col.key} value={col.key}>{col.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* AI Pitch Outreach Panel */}
              <div className="glass-card glow-card" style={{ padding: 20, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Sparkles size={15} color="hsl(var(--primary))" />
                  <span style={{ color: 'hsl(var(--text-primary))', fontWeight: '700', fontSize: '0.9rem' }}>Outreach Copy Generator</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.7rem', background: 'rgba(var(--primary-rgb), 0.1)', color: 'hsl(var(--primary))', padding: '2px 6px', borderRadius: 4, fontWeight: '600' }}>
                    LeadQonnect AI
                  </span>
                </div>

                {/* Predefined personalized templates */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                  {OUTREACH_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      style={{
                        background: templateId === t.id ? 'hsl(var(--primary))' : 'hsl(var(--surface-1))',
                        border: '1px solid hsl(var(--border-color))',
                        color: templateId === t.id ? '#fff' : 'hsl(var(--text-secondary))',
                        fontSize: '0.72rem',
                        padding: '5px 12px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={outreachDraft}
                  onChange={e => setOutreachDraft(e.target.value)}
                  placeholder="Your personalized message…"
                  style={{ width: '100%', minHeight: 120, resize: 'vertical' as const, lineHeight: '1.5', fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                  className="form-input"
                />

                {/* Send via a channel — pre-filled where the platform allows it, copy + open otherwise */}
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', margin: '0 0 6px' }}>Send via</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {channelsForLead(selectedLead).map(channel => (
                      <button
                        key={channel}
                        onClick={() => handleChannelOutreach(selectedLead, channel)}
                        className="btn-secondary"
                        style={{ flex: '1 1 auto', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
                      >
                        {channel === 'email' ? <Mail size={13} /> : <ExternalLink size={13} />}
                        {CHANNEL_LABEL[channel]}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={() => handleCopyOutreach(outreachDraft)}
                    className="btn-secondary"
                    style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Copy size={13} />
                    {copiedOutreach ? 'Copied!' : 'Copy'}
                  </button>

                  <button
                    onClick={() => {
                      sendPitch(selectedLead.id, outreachDraft.trim() || buildTemplate(selectedLead, templateId));
                      setSelectedLead(null);
                    }}
                    className="btn-primary"
                    style={{ flex: 1.5, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={14} /> Log Pitch & Move CRM
                  </button>
                </div>

                {/* Post the reply directly on Reddit from the user's connected account */}
                {selectedLead.platform === 'reddit' && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '12px' }}>
                    {redditAccount ? (
                      <>
                        <button
                          onClick={handleRedditReply}
                          disabled={redditPosting || !redditThingId(selectedLead)}
                          className="btn-secondary"
                          style={{
                            width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px',
                            borderColor: '#ff4500', color: '#ff4500',
                            opacity: redditPosting || !redditThingId(selectedLead) ? 0.6 : 1,
                          }}
                        >
                          {redditPosting
                            ? <><Loader2 size={14} className="spin" /> Posting reply…</>
                            : <><Send size={14} /> Reply on Reddit as u/{redditAccount.username}</>}
                        </button>
                        {!redditThingId(selectedLead) && (
                          <p style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '6px' }}>
                            Original post link unavailable for this lead — can't auto-reply.
                          </p>
                        )}
                        {redditPostMsg && (
                          <p style={{ fontSize: '0.75rem', marginTop: '8px', color: redditPostMsg.startsWith('✅') ? 'hsl(var(--primary))' : 'hsl(var(--danger))' }}>
                            {redditPostMsg}
                          </p>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => { setSelectedLead(null); setActiveTab('settings'); }}
                        className="btn-secondary"
                        style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <ExternalLink size={13} /> Connect Reddit to reply directly
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          plan={plan}
          onShowUpgrade={() => { setShowCreateModal(false); openUpgradeModal(); }}
        />
      )}
    </div>
  );
};

// ─── Modal Styles ──────────────────────────────────────────────────
const mStyles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modal: { width: '100%', maxWidth: 520, backgroundColor: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 28px 20px', borderBottom: '1px solid hsl(var(--border-color))' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: '1.15rem', fontWeight: '700', color: 'hsl(var(--text-primary))', margin: 0 },
  subtitle: { fontSize: '0.82rem', color: 'hsl(var(--text-muted))', margin: 0, marginTop: 2 },
  closeBtn: { background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  body: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: '0.82rem', fontWeight: '600', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { width: '100%', boxSizing: 'border-box' },
  addBtn: { padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 8 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '4px 10px' },
  tagRemove: { background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', padding: 0 },
  platformRow: { display: 'flex', gap: 10 },
  platformBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--text-primary))', transition: 'all 0.2s' },
  error: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '20px 28px', borderTop: '1px solid hsl(var(--border-color))' },
  cancelBtn: { background: 'none', border: '1px solid hsl(var(--border-color))', borderRadius: 8, padding: '10px 20px', color: 'hsl(var(--text-secondary))', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600' }
};

// ─── Campaign Card Styles ──────────────────────────────────────────
const cStyles: Record<string, React.CSSProperties> = {
  card: { background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-color))', borderRadius: 14, padding: 22, display: 'flex', flexDirection: 'column', gap: 16, transition: 'border-color 0.2s, box-shadow 0.2s' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 8, background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle: { fontSize: '0.95rem', fontWeight: '700', color: 'hsl(var(--text-primary))', margin: 0, marginBottom: 2 },
  statusPill: { fontSize: '0.72rem', fontWeight: '700', padding: '3px 10px', borderRadius: 20, border: '1px solid', whiteSpace: 'nowrap' as const },
  tagRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  keyword: { fontSize: '0.78rem', color: '#60a5fa', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)', padding: '3px 9px', borderRadius: 5 },
  platformRow: { display: 'flex', gap: 7, flexWrap: 'wrap' as const },
  platformBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', fontWeight: '600', padding: '3px 9px', borderRadius: 5, border: '1px solid' },
  stats: { display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4, borderTop: '1px solid hsl(var(--surface-1))' },
  stat: { display: 'flex', flexDirection: 'column' as const },
  statNum: { fontSize: '1.4rem', fontWeight: '800', color: 'hsl(var(--text-primary))', lineHeight: 1 },
  statLabel: { fontSize: '0.72rem', color: 'hsl(var(--text-faint))', marginTop: 2 },
  scanningBadge: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'hsl(var(--primary))', background: 'rgba(var(--primary-rgb), 0.08)', padding: '4px 10px', borderRadius: 6, marginLeft: 'auto' },
  scanResult: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'hsl(var(--primary))', marginLeft: 'auto' },
  actions: { display: 'flex', gap: 8 },
  iconBtn: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--surface-1))', color: 'hsl(var(--text-secondary))', cursor: 'pointer', flexShrink: 0 }
};

// ─── Lead Row Styles ───────────────────────────────────────────────
const lStyles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 22px', borderBottom: '1px solid hsl(var(--surface-1))', cursor: 'pointer', position: 'relative' as const, transition: 'background 0.15s' },
  platformBar: { position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: 3, borderRadius: '0 2px 2px 0' },
  platformDot: { width: 8, height: 8, borderRadius: '50%', marginTop: 7, flexShrink: 0 },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' as const },
  author: { fontWeight: '700', color: 'hsl(var(--text-primary))', fontSize: '0.9rem' },
  handle: { fontSize: '0.78rem', color: 'hsl(var(--text-muted))' },
  campaignTag: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'hsl(var(--primary))', background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.2)', padding: '1px 7px', borderRadius: 4 },
  time: { marginLeft: 'auto', fontSize: '0.75rem', color: 'hsl(var(--text-faint))' },
  title: { fontSize: '0.95rem', fontWeight: '600', color: 'hsl(var(--text-primary))', marginBottom: 5 },
  snippet: { fontSize: '0.86rem', color: 'hsl(var(--text-secondary))', lineHeight: '1.55', marginBottom: 10 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const },
  keyword: { fontSize: '0.73rem', color: '#3b82f6', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.14)', padding: '2px 7px', borderRadius: 4 },
  platformPill: { fontSize: '0.73rem', fontWeight: '600', border: '1px solid', padding: '1px 7px', borderRadius: 4 },
  statusPill: { fontSize: '0.73rem', color: 'hsl(var(--text-muted))', background: 'rgba(100,116,139,0.1)', padding: '1px 7px', borderRadius: 4, textTransform: 'capitalize' as const }
};

// ─── View-level Styles ─────────────────────────────────────────────
const vStyles: Record<string, React.CSSProperties> = {
  tabs: { display: 'flex', gap: 24, borderBottom: '1px solid hsl(var(--border-color))', marginBottom: 24 },
  tab: { display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '12px 4px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  tabBadge: { background: 'hsl(var(--border-color))', borderRadius: 20, padding: '2px 8px', fontSize: '0.72rem', fontWeight: '700', color: 'hsl(var(--text-secondary))' },
  campaignGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' as const },
  select: { display: 'flex', alignItems: 'center', gap: 6, background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-color))', borderRadius: 8, padding: '8px 12px' },
  selectEl: { background: 'none', border: 'none', outline: 'none', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', cursor: 'pointer', appearance: 'none' as any },
  sortBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-color))', borderRadius: 8, padding: '8px 12px', color: 'hsl(var(--text-secondary))', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' },
  sortMenu: { position: 'absolute' as const, top: '110%', right: 0, background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: 10, padding: 6, zIndex: 50, minWidth: 180, boxShadow: '0 12px 30px rgba(0,0,0,0.5)' },
  sortItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '9px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left' as const },
  emptyState: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '70px 20px', color: 'hsl(var(--text-muted))', textAlign: 'center' as const }
};

// ─── Drawer Styles ────────────────────────────────────────────────
const dStyles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 90, display: 'flex', justifyContent: 'flex-end' },
  drawer: { width: 490, height: '100vh', borderLeft: '1px solid hsl(var(--border-color))', display: 'flex', flexDirection: 'column', padding: 30, borderRadius: 0, backgroundColor: 'hsl(var(--bg-main))', animation: 'slideIn 0.3s ease-out', overflowY: 'auto' as const },
  drawerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: 16 },
  drawerTitle: { fontSize: '1.2rem', fontWeight: '700', color: 'hsl(var(--text-primary))' },
  closeBtn: { background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' },
  drawerBody: { display: 'flex', flexDirection: 'column', gap: 22, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-color))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-primary))', fontWeight: '700', flexShrink: 0 },
  sectionLabel: { fontSize: '0.78rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', letterSpacing: '0.05em', marginBottom: 10 }
};

if (typeof document !== 'undefined') {
  const existing = document.getElementById('lv-anim');
  if (!existing) {
    const s = document.createElement('style');
    s.id = 'lv-anim';
    s.innerHTML = `@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`;
    document.head.appendChild(s);
  }
}

export default LeadsView;
