import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { LeadsView } from './components/views/LeadsView';
import { ConversationsView } from './components/views/ConversationsView';
import { SequencesView } from './components/views/SequencesView';
import { AlertsView } from './components/views/AlertsView';
import { InsightsView } from './components/views/InsightsView';
import { WorkspaceView } from './components/views/WorkspaceView';
import { AssignedView } from './components/views/AssignedView';
import { MyTeamView } from './components/views/MyTeamView';
import { TeamChatView } from './components/views/TeamChatView';
import { SettingsView } from './components/views/SettingsView';
import { ReferView } from './components/views/ReferView';
import { LandingView } from './components/views/LandingView';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminOverview } from './components/admin/AdminOverview';
import { UsersManagement } from './components/admin/UsersManagement';
import { SubscriptionsManagement } from './components/admin/SubscriptionsManagement';
import { Toaster } from './components/Toaster';
import { UpgradeModal } from './components/UpgradeModal';

// --- Admin portal layout ---
const AdminAppContent: React.FC = () => {
  const [activeAdminTab, setActiveAdminTab] = React.useState('overview');

  const renderView = () => {
    switch (activeAdminTab) {
      case 'overview': return <AdminOverview />;
      case 'users': return <UsersManagement />;
      case 'subscriptions': return <SubscriptionsManagement />;
      default: return <AdminOverview />;
    }
  };

  return (
    <div className="app-container">
      <AdminSidebar activeAdminTab={activeAdminTab} setActiveAdminTab={setActiveAdminTab} />
      <main className="main-content">{renderView()}</main>
    </div>
  );
};

// --- Standard user dashboard ---
const UserAppContent: React.FC = () => {
  const { activeTab, upgradeModalOpen, closeUpgradeModal } = useApp();

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'leads': return <LeadsView />;
      case 'conversations': return <ConversationsView />;
      case 'sequences': return <SequencesView />;
      case 'alerts': return <AlertsView />;
      case 'insights': return <InsightsView />;
      case 'workspace': return <WorkspaceView />;
      case 'assigned': return <AssignedView />;
      case 'myteam': return <MyTeamView />;
      case 'teamchat': return <TeamChatView />;
      case 'settings': return <SettingsView />;
      case 'refer': return <ReferView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">{renderView()}</main>
      <UpgradeModal isOpen={upgradeModalOpen} onClose={closeUpgradeModal} />
    </div>
  );
};

// --- Auth loading screen ---
const LoadingScreen: React.FC = () => (
  <div style={{
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'hsl(var(--bg-main))',
    gap: '16px'
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      border: '3px solid rgba(var(--primary-rgb), 0.18)',
      borderTopColor: 'hsl(var(--primary))',
      animation: 'spin 0.8s linear infinite'
    }} />
    <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.95rem' }}>Loading LeadQonnect...</p>
  </div>
);

// --- Suspended user screen ---
const SuspendedScreen: React.FC = () => {
  const { logout } = useApp();
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'hsl(var(--bg-main))',
      gap: '20px',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '3rem' }}>🚫</div>
      <h2 style={{ color: 'hsl(var(--text-primary))', fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.025em' }}>
        Account Suspended
      </h2>
      <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '420px', fontSize: '0.95rem', lineHeight: '1.6' }}>
        Your account has been suspended by the administrator. If you believe this is in error, please contact support.
      </p>
      <button 
        onClick={logout} 
        className="btn-primary" 
        style={{ 
          padding: '12px 28px', 
          fontSize: '0.95rem', 
          fontWeight: '600', 
          borderRadius: '8px',
          marginTop: '12px'
        }}
      >
        Return to Landing Page
      </button>
    </div>
  );
};

// --- Root router ---
const AppContent: React.FC = () => {
  const { isAuthenticated, isAuthLoading, isAdminMode, userStatus } = useApp();

  if (isAuthLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LandingView />;
  if (userStatus === 'suspended') return <SuspendedScreen />;
  if (isAdminMode) return <AdminAppContent />;
  return <UserAppContent />;
};

export const App: React.FC = () => (
  <AppProvider>
    <AppContent />
    <Toaster />
  </AppProvider>
);

export default App;
