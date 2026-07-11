import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, DollarSign, Activity, TrendingUp } from 'lucide-react';

// Monthly price per paid tier (USD). Source of truth for MRR math.
const TIER_PRICE: Record<string, number> = { premium: 49, agency: 149 };

export const AdminOverview: React.FC = () => {
  const { allUsers } = useApp();

  const totalUsers = allUsers.length;
  const activeUsers = allUsers.filter(u => u.status === 'active').length;
  const premiumUsers = allUsers.filter(u => u.plan === 'premium').length;
  const agencyUsers = allUsers.filter(u => u.plan === 'agency').length;
  const paidUsers = premiumUsers + agencyUsers;

  // Real MRR: sum the monthly price of every currently-paid user.
  const mrr = premiumUsers * TIER_PRICE.premium + agencyUsers * TIER_PRICE.agency;

  // Real revenue chart: cumulative MRR over the last 7 months, built from each paid
  // user's activation/join date. A user contributes their tier price to every month
  // from when they joined onward, so the series reflects actual paid-account growth.
  const revenueSeries = useMemo(() => {
    const months: { label: string; start: Date }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), start: d });
    }
    return months.map(({ label, start }) => {
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
      let value = 0;
      for (const u of allUsers) {
        const price = TIER_PRICE[u.plan];
        if (!price) continue;
        const joined = new Date(u.razorpay?.activatedAt || u.joinedAt || '');
        // Count the user toward this month if they were paid on or before month end.
        if (isNaN(joined.getTime()) || joined <= monthEnd) value += price;
      }
      return { label, value };
    });
  }, [allUsers]);

  const maxRevenue = Math.max(1, ...revenueSeries.map(m => m.value));

  return (
    <div className="view-container">
      <header className="view-header">
        <div>
          <h1 className="view-title">System Overview</h1>
          <p className="view-subtitle">High-level metrics for LeadQonnect.</p>
        </div>
      </header>

      <div style={styles.metricsGrid}>
        <MetricCard
          title="Total MRR"
          value={`$${mrr.toLocaleString()}`}
          trend={`${paidUsers} paying ${paidUsers === 1 ? 'account' : 'accounts'}`}
          icon={<DollarSign size={24} color="hsl(var(--primary))" />}
        />
        <MetricCard
          title="Total Users"
          value={totalUsers}
          trend={`${premiumUsers} Pro · ${agencyUsers} Agency`}
          icon={<Users size={24} color="#3b82f6" />}
        />
        <MetricCard
          title="Active Users"
          value={activeUsers}
          trend={`${totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0}% of users`}
          icon={<Activity size={24} color="#f59e0b" />}
        />
        <MetricCard
          title="Paid Conversion"
          value={`${totalUsers ? Math.round((paidUsers / totalUsers) * 100) : 0}%`}
          trend={`${paidUsers}/${totalUsers} on a paid plan`}
          icon={<TrendingUp size={24} color="hsl(var(--primary))" />}
        />
      </div>

      <div style={styles.chartSection} className="glass-card">
        <h3 style={styles.chartTitle}>MRR Growth (last 7 months)</h3>
        {mrr === 0 ? (
          <div style={styles.chartEmpty}>No paid accounts yet — revenue will appear here once users upgrade.</div>
        ) : (
          <div style={styles.chartMock}>
            {revenueSeries.map((m, i) => (
              <div key={i} style={styles.chartCol}>
                <div style={styles.chartColValue}>{m.value ? `$${m.value}` : ''}</div>
                <div style={{ ...styles.chartBar, height: `${Math.max(2, (m.value / maxRevenue) * 100)}%` }} />
                <div style={styles.chartColLabel}>{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, trend, icon }: any) => (
  <div className="glass-card" style={styles.metricCard}>
    <div style={styles.metricHeader}>
      <span style={styles.metricTitle}>{title}</span>
      <div style={styles.metricIcon}>{icon}</div>
    </div>
    <div style={styles.metricValue}>{value}</div>
    <div style={styles.metricTrend}>{trend}</div>
  </div>
);

const styles = {
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  metricCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  metricTitle: {
    fontSize: '0.9rem',
    color: 'hsl(var(--text-secondary))',
    fontWeight: '500'
  },
  metricIcon: {
    padding: '8px',
    backgroundColor: 'hsl(var(--surface-1))',
    borderRadius: '8px'
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'hsl(var(--text-primary))'
  },
  metricTrend: {
    fontSize: '0.8rem',
    color: 'hsl(var(--primary))',
    fontWeight: '600'
  },
  chartSection: {
    padding: '24px',
    height: '300px',
    display: 'flex',
    flexDirection: 'column' as const
  },
  chartTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'hsl(var(--text-primary))',
    marginBottom: '20px'
  },
  chartMock: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: '20px',
    gap: '10px'
  },
  chartCol: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px'
  },
  chartColValue: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'hsl(var(--text-secondary))'
  },
  chartColLabel: {
    fontSize: '0.72rem',
    color: 'hsl(var(--text-muted))'
  },
  chartEmpty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'hsl(var(--text-muted))',
    fontSize: '0.85rem',
    textAlign: 'center' as const
  },
  chartBar: {
    width: '70%',
    backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
    borderTopLeftRadius: '4px',
    borderTopRightRadius: '4px',
    borderTop: '2px solid hsl(var(--primary))',
    transition: 'height 0.5s ease'
  }
};
