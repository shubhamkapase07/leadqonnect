import React, { useState } from 'react';
import { Plus, Trash2, Box, RefreshCw, MessageCircle, Mail, ToggleLeft, ToggleRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UpgradeModal } from '../UpgradeModal';

export const SettingsView: React.FC = () => {
  const { plan, keywords, addKeyword, removeKeyword, strictIntentFilter, setStrictIntentFilter,
    redditAccount, redditConnecting, connectReddit, disconnectReddit,
    gmailAccount, gmailConnecting, connectGmail, disconnectGmail } = useApp();
  const [newKeyword, setNewKeyword] = useState('');
  const [userName, setUserName] = useState('Shubham Kapase');
  const [userEmail, setUserEmail] = useState('shubham@example.com');
  const [businessName, setBusinessName] = useState('DevFlow Agency');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim()) {
      addKeyword(newKeyword.trim());
      setNewKeyword('');
    }
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header">
        <div className="view-title">
          <h1>Account & Crawler Settings</h1>
          <p>Manage tracking targets, team workspace settings, and plans.</p>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Left Column */}
        <div style={styles.leftColumn}>
          {/* Keywords Management */}
          <div className="glass-card" style={styles.card}>
          <h3 style={styles.cardTitle}>Lead Tracker Keywords</h3>
          <p style={styles.cardSubtitle}>The AI scans Reddit, X, and LinkedIn for these exact keywords.</p>

          <form onSubmit={handleAddKeyword} style={styles.keywordForm}>
            <input 
              type="text" 
              placeholder="e.g., WordPress Developer" 
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              className="form-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-primary">
              <Plus size={16} />
              <span>Add Target</span>
            </button>
          </form>

          <div style={styles.keywordsContainer}>
            {keywords.map((kw, i) => (
              <div key={i} style={styles.keywordRow}>
                <span style={styles.keywordText}>{kw}</span>
                <button 
                  onClick={() => removeKeyword(kw)} 
                  style={styles.deleteBtn}
                  title={`Stop scanning for ${kw}`}
                >
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Connected Accounts */}
        <div className="glass-card" style={styles.card}>
          <h3 style={styles.cardTitle}>Connected Accounts</h3>
          <p style={styles.cardSubtitle}>Sign in with your social accounts to reply and DM leads directly from your own profile.</p>

          <div style={styles.platformsContainer}>
            {/* Reddit — real OAuth */}
            <div style={styles.platformRow}>
              <div style={styles.platformInfo}>
                {redditAccount?.avatar
                  ? <img src={redditAccount.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                  : <MessageCircle size={20} color="#ff4500" />}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={styles.platformName}>Reddit</span>
                  <span style={{ fontSize: '0.75rem', color: redditAccount ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', marginTop: '2px' }}>
                    {redditAccount ? `Connected as u/${redditAccount.username}` : 'Not connected — reply & DM disabled'}
                  </span>
                </div>
              </div>
              <button
                style={{
                  padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', border: 'none',
                  cursor: redditConnecting ? 'not-allowed' : 'pointer',
                  backgroundColor: redditAccount ? 'hsl(var(--surface-2))' : 'hsl(var(--primary))',
                  color: redditAccount ? 'hsl(var(--text-primary))' : 'hsl(var(--primary-contrast))',
                  fontWeight: 600, opacity: redditConnecting ? 0.7 : 1,
                }}
                onClick={() => (redditAccount ? disconnectReddit() : connectReddit())}
                disabled={redditConnecting}
              >
                {redditConnecting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} className="spin" /> Working…
                  </span>
                ) : redditAccount ? 'Disconnect' : 'Connect Reddit'}
              </button>
            </div>

            {/* Gmail — real OAuth */}
            <div style={styles.platformRow}>
              <div style={styles.platformInfo}>
                {gmailAccount?.avatar
                  ? <img src={gmailAccount.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                  : <Mail size={20} color="#ea4335" />}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={styles.platformName}>Gmail</span>
                  <span style={{ fontSize: '0.75rem', color: gmailAccount ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', marginTop: '2px' }}>
                    {gmailAccount ? `Connected as ${gmailAccount.email}` : 'Not connected — email sending disabled'}
                  </span>
                </div>
              </div>
              <button
                style={{
                  padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', border: 'none',
                  cursor: gmailConnecting ? 'not-allowed' : 'pointer',
                  backgroundColor: gmailAccount ? 'hsl(var(--surface-2))' : 'hsl(var(--primary))',
                  color: gmailAccount ? 'hsl(var(--text-primary))' : 'hsl(var(--primary-contrast))',
                  fontWeight: 600, opacity: gmailConnecting ? 0.7 : 1,
                }}
                onClick={() => (gmailAccount ? disconnectGmail() : connectGmail())}
                disabled={gmailConnecting}
              >
                {gmailConnecting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} className="spin" /> Working…
                  </span>
                ) : gmailAccount ? 'Disconnect' : 'Connect Gmail'}
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Profile and Billing */}
        <div style={styles.rightColumn}>
          {/* Workspace Credentials */}
          <div className="glass-card" style={styles.profileCard}>
            <h3 style={styles.cardTitle}>Workspace Details</h3>
            <p style={styles.cardSubtitle}>Your team metadata injected into the AI pitch drafts.</p>

            <div style={styles.formGroup}>
              <label style={styles.label}>Your Name</label>
              <input 
                type="text" 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="form-input"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Business Email</label>
              <input 
                type="email" 
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="form-input"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Agency / Business Niche Name</label>
              <input 
                type="text" 
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Plan Info */}
          <div className="glass-card" style={styles.planCard}>
            <h3 style={styles.cardTitle}>Subscription Details</h3>
            <p style={styles.cardSubtitle}>Your active crawler capacity tier parameters.</p>

            <div style={styles.tierStatus}>
              <Box size={24} color="hsl(var(--primary))" />
              <div>
                <h4 style={{ color: 'hsl(var(--text-primary))', fontSize: '0.95rem', margin: 0, textTransform: 'capitalize' }}>
                  {plan} Active Tier
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>
                  {plan === 'free' ? 'Basic Reddit Scanning Only' : 'Reddit, X & LinkedIn Listening Active'}
                </p>
              </div>
              {plan === 'free' && (
                <button 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="btn-primary"
                  style={styles.upgradeBtn}
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>

          {/* Crawler Preferences */}
          <div className="glass-card" style={styles.profileCard}>
            <h3 style={styles.cardTitle}>Crawler Relevance Control</h3>
            <p style={styles.cardSubtitle}>Adjust how strictly the crawler filters new leads.</p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--surface-1))', borderRadius: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingRight: '12px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'hsl(var(--text-primary))' }}>Strict Intent Filtering</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
                  Ignore general chatter/discussions and only import posts with high buying or hiring signals.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStrictIntentFilter(!strictIntentFilter)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: strictIntentFilter ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))'
                }}
              >
                {strictIntentFilter ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
};

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '24px'
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  },
  card: {
    padding: '24px',
    borderRadius: '12px'
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  },
  profileCard: {
    padding: '24px',
    borderRadius: '12px'
  },
  planCard: {
    padding: '24px',
    borderRadius: '12px'
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'hsl(var(--text-primary))',
    marginBottom: '6px'
  },
  cardSubtitle: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))',
    marginBottom: '20px'
  },
  keywordForm: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  keywordsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  keywordRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--surface-1))',
    borderRadius: '8px'
  },
  keywordText: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'hsl(var(--text-primary))'
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.1)'
    }
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '15px'
  },
  label: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-muted))',
    fontWeight: '600'
  },
  tierStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid hsl(var(--surface-1))',
    backgroundColor: 'hsl(var(--surface-1))'
  },
  upgradeBtn: {
    marginLeft: 'auto',
    padding: '6px 12px',
    fontSize: '0.8rem'
  },
  platformsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  platformRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--surface-1))',
    borderRadius: '8px'
  },
  platformInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  platformName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'hsl(var(--text-primary))'
  },
  toggleWrapper: {
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  }
};
export default SettingsView;
