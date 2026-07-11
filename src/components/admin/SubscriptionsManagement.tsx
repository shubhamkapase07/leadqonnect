import React from 'react';
import { useApp } from '../../context/AppContext';
import { CreditCard, Crown, Star, Building2 } from 'lucide-react';

export const SubscriptionsManagement: React.FC = () => {
  const { allUsers, updateUserPlan } = useApp();

  return (
    <div className="view-container">
      <header className="view-header">
        <div>
          <h1 className="view-title">Subscriptions Management</h1>
          <p className="view-subtitle">Manage billing and subscription tiers for your users.</p>
        </div>
      </header>

      <div style={styles.grid}>
        {allUsers.map(user => (
          <div key={user.id} className="glass-card" style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.userName}>{user.name}</h3>
                <p style={styles.userEmail}>{user.email}</p>
              </div>
              <div style={styles.planIcon(user.plan)}>
                {user.plan === 'agency' ? <Building2 size={20} /> :
                 user.plan === 'premium' ? <Crown size={20} /> :
                 user.plan === 'trial' ? <Star size={20} /> :
                 <CreditCard size={20} />}
              </div>
            </div>

            <div style={styles.currentPlan(user.plan)}>
              Current Plan: <strong>{user.plan.toUpperCase()}</strong>
            </div>

            <div style={styles.actions}>
              <select
                style={styles.select}
                value={user.plan}
                onChange={(e) => updateUserPlan(user.id, e.target.value as any)}
              >
                <option value="free">Free Plan</option>
                <option value="trial">Pro Trial (7 Days)</option>
                <option value="premium">Pro ($49/mo)</option>
                <option value="agency">Agency ($149/mo)</option>
              </select>
            </div>
            <p style={styles.billingNote}>
              {(user as any).razorpay?.status
                ? `Razorpay: ${(user as any).razorpay.status}`
                : 'Billing managed manually'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  card: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  userName: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'hsl(var(--text-primary))',
    marginBottom: '4px'
  },
  userEmail: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))'
  },
  planIcon: (plan: string) => ({
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: plan === 'premium' ? 'rgba(var(--primary-rgb), 0.1)' : 
                     plan === 'trial' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.1)',
    color: plan === 'premium' ? 'hsl(var(--primary))' : 
           plan === 'trial' ? '#3b82f6' : 'hsl(var(--text-secondary))'
  }),
  currentPlan: (plan: string) => ({
    padding: '10px 14px',
    backgroundColor: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--surface-1))',
    borderRadius: '8px',
    fontSize: '0.85rem',
    color: plan === 'premium' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))'
  }),
  actions: {
    display: 'flex',
    gap: '10px'
  },
  select: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '6px',
    color: 'hsl(var(--text-primary))',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer'
  },
  billingNote: {
    fontSize: '0.75rem',
    color: 'hsl(var(--text-muted))',
    margin: 0
  }
};
