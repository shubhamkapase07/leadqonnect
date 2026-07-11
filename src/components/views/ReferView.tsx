import React, { useEffect, useState } from 'react';
import { Gift, Award, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

interface ReferralDashboard {
  code: string;
  clicks: number;
  signups: number;
  conversions: number;
  monthlyCommissionCents: number;
}

const PAYOUT_THRESHOLD_CENTS = 10000; // $100
const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const ReferView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpsCallable(functions, 'getReferralDashboard')();
      setData(res.data as ReferralDashboard);
    } catch (err) {
      console.error('getReferralDashboard failed:', err);
      setError('Couldn’t load your referral dashboard. Make sure the Cloud Functions are deployed, then retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const referralLink = data
    ? `${window.location.origin}/?ref=${data.code}`
    : '';

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header">
        <div className="view-title">
          <h1>Refer & Earn Program</h1>
          <p>Share LeadQonnect with your community and earn 30% lifetime recurring commissions.</p>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Sharing options */}
        <div className="glass-card" style={styles.shareCard}>
          <div style={styles.cardHeaderWithIcon}>
            <Gift size={20} color="hsl(var(--primary))" />
            <h3 style={{ ...styles.cardTitle, margin: 0 }}>Affiliate Dashboard</h3>
          </div>
          <p style={styles.cardSubtitle}>Get rewarded when other service providers sign up.</p>

          <div style={styles.linkContainer}>
            <label style={styles.label}>Your Referral Link</label>
            <div style={styles.inputGroup}>
              <input
                type="text"
                value={loading ? 'Loading your link…' : (referralLink || 'Unavailable')}
                readOnly
                className="form-input"
                style={styles.refInput}
              />
              <button onClick={handleCopy} className="btn-primary" style={styles.copyBtn} disabled={!referralLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div style={styles.promoSteps}>
            <h4 style={styles.stepsHeading}>How it works</h4>
            <div style={styles.step}>
              <div style={styles.stepNum}>1</div>
              <div>
                <h5 style={styles.stepTitle}>Share Link</h5>
                <p style={styles.stepDesc}>Post your referral link on Twitter, LinkedIn, or blogs.</p>
              </div>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNum}>2</div>
              <div>
                <h5 style={styles.stepTitle}>Users Sign Up</h5>
                <p style={styles.stepDesc}>Prospects start a free trial or upgrade to the Growth plan.</p>
              </div>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNum}>3</div>
              <div>
                <h5 style={styles.stepTitle}>Earn Commission</h5>
                <p style={styles.stepDesc}>Earn 30% recurring payout for every active monthly subscription.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div className="glass-card" style={styles.statsCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={styles.cardTitle}>Your Referral Performance</h3>
            <button
              onClick={load}
              title="Refresh"
              disabled={loading}
              style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'hsl(var(--text-muted))', padding: 4, display: 'flex' }}
            >
              <RefreshCw size={15} className={loading ? 'spin' : undefined} />
            </button>
          </div>
          <p style={styles.cardSubtitle}>Live metrics, updated from your real referrals.</p>

          {error ? (
            <div style={{ ...styles.payoutStatus, color: '#ef4444', cursor: 'pointer' }} className="glass-card" onClick={load}>
              <span>{error}</span>
            </div>
          ) : loading && !data ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-muted))', padding: '20px 0' }}>
              <Loader2 size={16} className="spin" /> Loading your performance…
            </div>
          ) : (
            <>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Referrals Clicked</span>
                  <span style={styles.statValue}>{data?.clicks ?? 0}</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Signed Up Triers</span>
                  <span style={styles.statValue}>{data?.signups ?? 0}</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Converted Paid Users</span>
                  <span style={styles.statValue}>{data?.conversions ?? 0}</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Commission / mo</span>
                  <span style={{ ...styles.statValue, color: 'hsl(var(--primary))' }}>{fmtUsd(data?.monthlyCommissionCents ?? 0)}</span>
                </div>
              </div>

              <div style={styles.payoutStatus} className="glass-card">
                <Award size={16} color="#c084fc" />
                <span>
                  {(data?.monthlyCommissionCents ?? 0) >= PAYOUT_THRESHOLD_CENTS
                    ? <>You’ve reached the <strong>{fmtUsd(PAYOUT_THRESHOLD_CENTS)}</strong> payout threshold — paid via PayPal/Stripe.</>
                    : <>Next auto-payout at <strong>{fmtUsd(PAYOUT_THRESHOLD_CENTS)}</strong> ({fmtUsd(PAYOUT_THRESHOLD_CENTS - (data?.monthlyCommissionCents ?? 0))} to go).</>}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px'
  },
  shareCard: {
    padding: '24px',
    borderRadius: '12px'
  },
  statsCard: {
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
  cardHeaderWithIcon: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  linkContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '25px'
  },
  label: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-muted))',
    fontWeight: '600'
  },
  inputGroup: {
    display: 'flex',
    gap: '10px'
  },
  refInput: {
    flex: 1,
    fontSize: '0.85rem'
  },
  copyBtn: {
    padding: '0 16px'
  },
  promoSteps: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  stepsHeading: {
    fontSize: '0.85rem',
    textTransform: 'uppercase' as const,
    color: 'hsl(var(--text-muted))',
    letterSpacing: '0.05em',
    marginBottom: '6px'
  },
  step: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start'
  },
  stepNum: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
    color: 'hsl(var(--primary))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: '700',
    border: '1px solid rgba(var(--primary-rgb), 0.2)'
  },
  stepTitle: {
    fontSize: '0.88rem',
    fontWeight: '700',
    color: 'hsl(var(--text-primary))',
    marginBottom: '4px'
  },
  stepDesc: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-muted))',
    lineHeight: '1.4'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px'
  },
  statCard: {
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--surface-1))',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  statLabel: {
    fontSize: '0.78rem',
    color: 'hsl(var(--text-muted))',
    fontWeight: '500'
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'hsl(var(--text-primary))'
  },
  payoutStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px',
    fontSize: '0.8rem',
    color: 'hsl(var(--text-secondary))',
    borderRadius: '8px'
  }
};
export default ReferView;
