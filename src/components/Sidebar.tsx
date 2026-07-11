import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  ClipboardList,
  MessageSquare,
  Bell,
  BarChart3,
  Settings,
  Gift,
  ChevronDown,
  Box,
  LogOut,
  Sun,
  Moon,
  Lock,
  Network,
  MessagesSquare,
  Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

// Tabs that require a Pro plan. Free users see a lock and get the upgrade prompt.
const PRO_TABS = new Set(['workspace', 'alerts', 'insights', 'refer', 'sequences']);

export const Sidebar: React.FC = () => {
  const { plan, isPro, activeTab, setActiveTab, openUpgradeModal, myTeamRole, teamChatEnabled, conversations, alerts, assignedToMe, logout, userProfile, theme, toggleTheme } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const hasUnreadConversations = conversations.length > 0;
  const hasUnreadAlerts = alerts.some(a => !a.read);

  const getLinkClass = (tabId: string) => `sidebar-link ${activeTab === tabId ? 'active' : ''}`;

  // Navigate, but gate Pro-only tabs for Free users.
  const navTo = (tabId: string) => {
    if (!isPro && PRO_TABS.has(tabId)) { openUpgradeModal(); return; }
    setActiveTab(tabId);
  };
  const lockIcon = (tabId: string) =>
    !isPro && PRO_TABS.has(tabId) ? <Lock size={13} style={styles.lockIndicator} /> : null;

  return (
    <div style={styles.sidebar}>
      {/* Brand Profile Header */}
      <div style={styles.headerRow}>
        <div style={styles.header} onClick={() => setDropdownOpen(!dropdownOpen)}>
          {userProfile?.photoURL ? (
            <img src={userProfile.photoURL} alt="avatar" style={{ width: '30px', height: '30px', borderRadius: '8px', objectFit: 'cover' }} />
          ) : (
            <div style={styles.avatar}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>
                {(userProfile?.name || 'U')[0].toUpperCase()}
              </span>
            </div>
          )}
          <div style={styles.brandInfo}>
            <span style={styles.brandName}>{userProfile?.name || 'My Workspace'}</span>
            <span style={styles.brandSub}>{userProfile?.email || ''}</span>
          </div>
          <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ marginLeft: 'auto' }} />
        </div>
        <button className="theme-toggle" aria-label="Toggle theme" onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}>
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      {dropdownOpen && (
        <div style={styles.dropdown} className="glass-card">
          <div style={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
            <span style={styles.dropdownItemDot} /> LeadQonnect Org
          </div>
          <div style={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
            <span style={{ ...styles.dropdownItemDot, backgroundColor: 'transparent' }} /> Add Workspace
          </div>
        </div>
      )}

      {/* Nav Groups */}
      <div style={styles.navContainer}>
        <div className={getLinkClass('dashboard')} onClick={() => navTo('dashboard')}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </div>

        <div style={styles.groupLabel}>ENGAGE</div>

        <div className={getLinkClass('leads')} onClick={() => navTo('leads')}>
          <Users size={18} />
          <span>Leads</span>
        </div>

        <div className={getLinkClass('conversations')} onClick={() => navTo('conversations')}>
          <MessageSquare size={18} />
          <span>Conversations</span>
          {hasUnreadConversations && <span className="dot dot-green dot-pulse" style={styles.linkIndicator} />}
        </div>

        <div className={getLinkClass('sequences')} onClick={() => navTo('sequences')}>
          <Send size={18} />
          <span>Sequences</span>
          {lockIcon('sequences')}
        </div>

        <div style={styles.groupLabel}>TEAM</div>

        <div className={getLinkClass('workspace')} onClick={() => navTo('workspace')}>
          <UsersRound size={18} />
          <span>Workspace</span>
          {lockIcon('workspace')}
        </div>

        <div className={getLinkClass('assigned')} onClick={() => navTo('assigned')}>
          <ClipboardList size={18} />
          <span>Assigned to Me</span>
          {assignedToMe.length > 0 && <span style={styles.countBadge}>{assignedToMe.length}</span>}
        </div>

        {myTeamRole && (
          <div className={getLinkClass('myteam')} onClick={() => navTo('myteam')}>
            <Network size={18} />
            <span>My Team</span>
          </div>
        )}

        {myTeamRole && (
          <div className={getLinkClass('teamchat')} onClick={() => navTo('teamchat')}>
            <MessagesSquare size={18} />
            <span>Team Chat</span>
            {!teamChatEnabled && <Lock size={13} style={styles.lockIndicator} />}
          </div>
        )}

        <div style={styles.groupLabel}>CONFIGURE</div>

        <div className={getLinkClass('alerts')} onClick={() => navTo('alerts')}>
          <Bell size={18} />
          <span>Real-time Alerts</span>
          {lockIcon('alerts') || (hasUnreadAlerts && <span className="dot dot-green" style={styles.linkIndicator} />)}
        </div>

        <div style={styles.groupLabel}>RESEARCH</div>

        <div className={getLinkClass('insights')} onClick={() => navTo('insights')}>
          <BarChart3 size={18} />
          <span>Insights</span>
          {lockIcon('insights') || <span className="dot dot-green" style={styles.linkIndicator} />}
        </div>

        <div style={{ height: '20px' }} />

        <div className={getLinkClass('settings')} onClick={() => navTo('settings')}>
          <Settings size={18} />
          <span>Settings</span>
        </div>

        <div className={getLinkClass('refer')} onClick={() => navTo('refer')}>
          <Gift size={18} />
          <span>Refer & Earn</span>
          {lockIcon('refer')}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <div className="sidebar-link" onClick={logout} style={{ color: 'hsl(var(--danger))' }}>
            <LogOut size={18} />
            <span>Log Out</span>
          </div>
        </div>
      </div>

      {/* Subscription / Trial Card */}
      <div style={styles.bottomCardWrapper}>
        {plan === 'free' ? (
          <div style={styles.upgradeCard} className="glass-card">
            <div style={styles.upgradeCardHeader}>
              <Box size={16} color="hsl(var(--text-muted))" />
              <span style={styles.upgradeCardTitle}>No active plan</span>
            </div>
            <button onClick={openUpgradeModal} className="btn-primary" style={styles.upgradeBtn}>
              Start Free Trial
            </button>
            <span style={styles.upgradeCardSub}>No charge today • Cancel anytime</span>
          </div>
        ) : plan === 'trial' ? (
          <div style={{ ...styles.upgradeCard, borderColor: 'rgba(var(--primary-rgb), 0.3)' }} className="glass-card">
            <div style={styles.upgradeCardHeader}>
              <Box size={16} color="hsl(var(--primary))" />
              <span style={{ ...styles.upgradeCardTitle, color: 'hsl(var(--primary))' }}>Trial Active</span>
            </div>
            <button onClick={openUpgradeModal} className="btn-secondary" style={{ ...styles.upgradeBtn, justifyContent: 'center' }}>
              Upgrade Pro
            </button>
            <span style={styles.upgradeCardSub}>7 days left • Reddit, X, LinkedIn</span>
          </div>
        ) : plan === 'agency' ? (
          <div style={{ ...styles.upgradeCard, borderColor: 'rgba(var(--primary-rgb), 0.4)', background: 'rgba(var(--primary-rgb), 0.06)' }} className="glass-card">
            <div style={styles.upgradeCardHeader}>
              <Box size={16} color="hsl(var(--primary))" />
              <span style={{ ...styles.upgradeCardTitle, color: 'hsl(var(--primary))' }}>Agency Plan Active</span>
            </div>
            <div style={styles.proBadge}>
              Unlimited Seats <SparkleDot />
            </div>
            <span style={styles.upgradeCardSub}>Billed monthly • Unlimited team</span>
          </div>
        ) : (
          <div style={{ ...styles.upgradeCard, borderColor: 'rgba(var(--primary-rgb), 0.4)', background: 'rgba(var(--primary-rgb), 0.06)' }} className="glass-card">
            <div style={styles.upgradeCardHeader}>
              <Box size={16} color="hsl(var(--primary))" />
              <span style={{ ...styles.upgradeCardTitle, color: 'hsl(var(--primary))' }}>Pro Plan Active</span>
            </div>
            <div style={styles.proBadge}>
              Premium Unlocked <SparkleDot />
            </div>
            <button onClick={openUpgradeModal} className="btn-secondary" style={{ ...styles.upgradeBtn, justifyContent: 'center' }}>
              Upgrade to Agency
            </button>
            <span style={styles.upgradeCardSub}>Up to 3 team members</span>
          </div>
        )}
      </div>
    </div>
  );
};

const SparkleDot: React.FC = () => (
  <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'hsl(var(--primary))', borderRadius: '50%', marginLeft: '4px', boxShadow: '0 0 6px hsl(var(--primary))' }} />
);

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-width)',
    height: '100vh',
    backgroundColor: 'hsl(var(--bg-sidebar))',
    borderRight: '1px solid hsl(var(--border-color))',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 14px',
    position: 'relative',
    userSelect: 'none',
  },
  headerRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' },
  header: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '10px',
    cursor: 'pointer',
    minWidth: 0,
    transition: 'background 0.2s',
  },
  avatar: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent-3)))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandInfo: { display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 },
  brandName: { fontWeight: 700, fontSize: '0.92rem', color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  brandSub: { fontSize: '0.74rem', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  dropdown: {
    position: 'absolute',
    top: '70px',
    left: '14px',
    width: 'calc(100% - 28px)',
    padding: '8px',
    zIndex: 10,
    borderRadius: '12px',
  },
  dropdownItem: {
    padding: '8px 10px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    color: 'hsl(var(--text-secondary))',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dropdownItemDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary))' },
  navContainer: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' },
  groupLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'hsl(var(--text-faint))',
    marginTop: '18px',
    marginBottom: '6px',
    paddingLeft: '12px',
    letterSpacing: '0.08em',
  },
  linkIndicator: { position: 'absolute', right: '12px', top: 'calc(50% - 4px)' },
  lockIndicator: { position: 'absolute', right: '12px', top: 'calc(50% - 6px)', color: 'hsl(var(--text-faint))' },
  countBadge: { position: 'absolute', right: '12px', top: 'calc(50% - 9px)', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'hsl(var(--primary))', color: '#fff', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  bottomCardWrapper: { marginTop: 'auto', paddingTop: '20px' },
  upgradeCard: {
    padding: '16px',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  upgradeCardHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  upgradeCardTitle: { fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-primary))' },
  upgradeBtn: { width: '100%', padding: '9px', fontSize: '0.85rem', justifyContent: 'center' },
  upgradeCardSub: { fontSize: '0.7rem', color: 'hsl(var(--text-muted))', textAlign: 'center' },
  proBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    color: 'hsl(var(--primary))',
    fontWeight: 600,
    padding: '7px',
    background: 'rgba(var(--primary-rgb), 0.1)',
    borderRadius: '8px',
  },
};

// Sidebar link styles + states (token-driven, theme-aware)
if (typeof document !== 'undefined' && !document.getElementById('lq-sidebar-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'lq-sidebar-styles';
  styleEl.innerHTML = `
    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 0.9rem;
      color: hsl(var(--text-secondary));
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }
    .sidebar-link:hover {
      background: hsl(var(--surface-1));
      color: hsl(var(--text-primary));
    }
    .sidebar-link.active {
      background: rgba(var(--primary-rgb), 0.12);
      color: hsl(var(--text-primary));
      font-weight: 600;
    }
    .sidebar-link.active svg { color: hsl(var(--primary)); }
    .sidebar-link:hover svg { color: hsl(var(--primary)); }
  `;
  document.head.appendChild(styleEl);
}
