import React from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  LogOut,
  ShieldCheck,
  Activity,
  Sun,
  Moon
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AdminSidebar: React.FC<{ activeAdminTab: string, setActiveAdminTab: (tab: string) => void }> = ({ activeAdminTab, setActiveAdminTab }) => {
  const { logout, userProfile, theme, toggleTheme } = useApp();

  const getLinkClass = (tabId: string) => {
    return `sidebar-link ${activeAdminTab === tabId ? 'active' : ''}`;
  };

  return (
    <div style={styles.sidebar}>
      {/* Brand Profile Header */}
      <div style={styles.headerRow}>
        <div style={styles.header}>
          <div style={styles.avatar}>
            <ShieldCheck size={16} color="#fff" />
          </div>
          <div style={styles.brandInfo}>
            <span style={styles.brandName}>LeadQonnect</span>
            <span style={styles.brandSub}>Admin Portal</span>
          </div>
        </div>
        <button className="theme-toggle" aria-label="Toggle theme" onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}>
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      <div style={styles.welcomeBanner}>
        Welcome back, <br/><strong style={{ color: 'hsl(var(--text-primary))' }}>{userProfile?.name || 'Admin'}</strong>
        <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-faint))', marginTop: '2px' }}>{userProfile?.email}</div>
      </div>

      {/* Nav Groups */}
      <div style={styles.navContainer}>
        <div style={styles.groupLabel}>SYSTEM</div>

        <div 
          className={getLinkClass('overview')} 
          onClick={() => setActiveAdminTab('overview')}
          style={styles.linkWrapper}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </div>

        <div 
          className={getLinkClass('users')} 
          onClick={() => setActiveAdminTab('users')}
          style={styles.linkWrapper}
        >
          <Users size={18} />
          <span>Users</span>
        </div>

        <div 
          className={getLinkClass('subscriptions')} 
          onClick={() => setActiveAdminTab('subscriptions')}
          style={styles.linkWrapper}
        >
          <CreditCard size={18} />
          <span>Subscriptions</span>
        </div>
        
        <div 
          className={getLinkClass('health')} 
          onClick={() => setActiveAdminTab('overview')}
          style={styles.linkWrapper}
        >
          <Activity size={18} />
          <span>System Health</span>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <div 
            className="sidebar-link"
            onClick={logout}
            style={{ ...styles.linkWrapper, color: '#f87171' }}
          >
            <LogOut size={18} />
            <span>Log Out</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  sidebar: {
    width: 'var(--sidebar-width)',
    height: '100vh',
    backgroundColor: 'hsl(var(--bg-sidebar))',
    borderRight: '1px solid hsl(var(--border-color))',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '20px 14px',
    position: 'relative' as const,
    userSelect: 'none' as const
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  header: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    minWidth: 0,
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    backgroundColor: '#ef4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    lineHeight: 1.2
  },
  brandName: {
    fontWeight: '700',
    fontSize: '0.95rem',
    color: 'hsl(var(--text-primary))'
  },
  brandSub: {
    fontSize: '0.75rem',
    color: '#ef4444',
    fontWeight: '600'
  },
  welcomeBanner: {
    padding: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.1)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    color: 'hsl(var(--text-secondary))',
    marginBottom: '24px'
  },
  navContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1,
    overflowY: 'auto' as const
  },
  linkWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: 'hsl(var(--text-secondary))',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative' as const
  },
  groupLabel: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: 'hsl(var(--text-faint))',
    marginTop: '18px',
    marginBottom: '6px',
    paddingLeft: '12px',
    letterSpacing: '0.05em'
  }
};
