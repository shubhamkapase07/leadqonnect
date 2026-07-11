import React, { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  const { plan, startFreeTrial, subscribeToPlan } = useApp();
  // null = idle; otherwise the action currently in flight (so only that button spins).
  const [loading, setLoading] = useState<null | 'trial' | 'pro' | 'agency'>(null);

  if (!isOpen) return null;

  const handleStartTrial = () => {
    setLoading('trial');
    setTimeout(() => {
      startFreeTrial();
      setLoading(null);
      onClose();
    }, 1000);
  };

  // Razorpay Checkout collects payment in its own hosted sheet; on verified success
  // subscribeToPlan resolves and the new plan streams in via the user-doc snapshot.
  const handleSubscribe = async (tier: 'pro' | 'agency') => {
    setLoading(tier);
    try {
      await subscribeToPlan(tier);
      onClose();
    } catch {
      // Errors (incl. cancellation) are surfaced as toasts inside subscribeToPlan.
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container} className="glass-card glow-card">
        <button style={modalStyles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>

        {(
          <div>
            <div style={modalStyles.header}>
              <div style={modalStyles.sparkleIcon}>
                <Sparkles size={24} />
              </div>
              <h2 style={modalStyles.title}>Unlock Premium Social Lead Gen</h2>
              <p style={modalStyles.subtitle}>
                Get real-time service requests from X (Twitter) and LinkedIn in addition to Reddit.
              </p>
            </div>

            <div style={modalStyles.plansGrid}>
              {/* Free Plan */}
              <div style={modalStyles.planCard}>
                <h3 style={modalStyles.planName}>Free Starter</h3>
                <div style={modalStyles.price}>
                  $0<span style={modalStyles.period}>/mo</span>
                </div>
                <p style={modalStyles.planDesc}>Best for trying out the platform scanning engine.</p>
                <div style={modalStyles.divider} />
                <ul style={modalStyles.featureList}>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span>Scan Reddit subreddits</span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span>3 Custom keywords tracking</span>
                  </li>
                  <li style={{ ...modalStyles.featureItem, opacity: 0.5 }}>
                    <X size={16} color="#ef4444" /> <span>X (Twitter) Social Listening</span>
                  </li>
                  <li style={{ ...modalStyles.featureItem, opacity: 0.5 }}>
                    <X size={16} color="#ef4444" /> <span>LinkedIn Job & Post Scanner</span>
                  </li>
                  <li style={{ ...modalStyles.featureItem, opacity: 0.5 }}>
                    <X size={16} color="#ef4444" /> <span>AI Pitch Writer Drafts</span>
                  </li>
                </ul>
                <button 
                  style={{ ...modalStyles.planBtn, cursor: 'not-allowed', background: 'hsl(var(--surface-1))' }} 
                  disabled
                >
                  Current Plan
                </button>
              </div>

              {/* Pro Plan */}
              <div style={{ ...modalStyles.planCard, border: '1px solid hsl(var(--primary))', background: 'rgba(var(--primary-rgb), 0.03)' }}>
                <div style={modalStyles.popularBadge}>POPULAR</div>
                <h3 style={modalStyles.planName}>Pro</h3>
                <div style={modalStyles.price}>
                  $49<span style={modalStyles.period}>/mo</span>
                </div>
                <p style={modalStyles.planDesc}>Full AI lead funnel for you and a small team.</p>
                <div style={modalStyles.divider} />
                <ul style={modalStyles.featureList}>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span>Up to 5 campaigns</span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span>Scan Reddit, X & LinkedIn</span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span>AI qualification & pitch engine</span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span><strong>Up to 3 team members</strong></span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span>Insights & real-time alerts</span>
                  </li>
                </ul>

                {plan === 'free' ? (
                  <button
                    onClick={handleStartTrial}
                    style={{ ...modalStyles.planBtn, background: 'hsl(var(--primary))', color: '#000' }}
                    className="btn-primary"
                    disabled={loading !== null}
                  >
                    {loading === 'trial' ? 'Processing...' : 'Start 7-Day Free Trial'}
                  </button>
                ) : plan === 'trial' ? (
                  <button
                    onClick={() => handleSubscribe('pro')}
                    style={{ ...modalStyles.planBtn, background: 'hsl(var(--primary))', color: '#000' }}
                    className="btn-primary"
                    disabled={loading !== null}
                  >
                    {loading === 'pro' ? 'Opening checkout…' : 'Upgrade Now — $49/mo'}
                  </button>
                ) : (
                  <button style={{ ...modalStyles.planBtn, cursor: 'not-allowed', background: 'hsl(var(--surface-1))' }} disabled>
                    {plan === 'agency' ? 'Included' : 'Current Plan'}
                  </button>
                )}
                <div style={modalStyles.trialNote}>No credit card required for trial setup.</div>
              </div>

              {/* Agency Plan */}
              <div style={modalStyles.planCard}>
                <h3 style={modalStyles.planName}>Agency</h3>
                <div style={modalStyles.price}>
                  $149<span style={modalStyles.period}>/mo</span>
                </div>
                <p style={modalStyles.planDesc}>For teams running outbound at scale.</p>
                <div style={modalStyles.divider} />
                <ul style={modalStyles.featureList}>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span>Everything in Pro</span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span><strong>Unlimited campaigns</strong></span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span><strong>Unlimited team members</strong></span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span><strong>Team chat</strong> & shared pipeline</span>
                  </li>
                  <li style={modalStyles.featureItem}>
                    <Check size={16} color="hsl(var(--primary))" /> <span>Priority support & AI</span>
                  </li>
                </ul>

                {plan === 'agency' ? (
                  <button style={{ ...modalStyles.planBtn, cursor: 'not-allowed', background: 'hsl(var(--surface-1))' }} disabled>
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe('agency')}
                    style={modalStyles.planBtn}
                    className="btn-secondary"
                    disabled={loading !== null}
                  >
                    {loading === 'agency' ? 'Opening checkout…' : 'Get Agency'}
                  </button>
                )}
              </div>
            </div>
            <div style={modalStyles.secureNote}>
              🔒 Secure recurring checkout powered by Razorpay. Cancel anytime.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px'
  },
  container: {
    maxWidth: '1000px',
    width: '100%',
    padding: '40px',
    position: 'relative' as const,
    maxHeight: '90vh',
    overflowY: 'auto' as const
  },
  closeBtn: {
    position: 'absolute' as const,
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    color: 'hsl(var(--text-secondary))',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '50%',
    transition: 'background 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '35px'
  },
  sparkleIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(var(--primary-rgb), 0.1)',
    color: 'hsl(var(--primary))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 15px auto',
    border: '1px solid rgba(var(--primary-rgb), 0.2)'
  },
  creditIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 15px auto',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'hsl(var(--text-primary))',
    marginBottom: '10px'
  },
  subtitle: {
    color: 'hsl(var(--text-secondary))',
    fontSize: '0.95rem',
    maxWidth: '500px',
    margin: '0 auto'
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '20px',
    marginTop: '10px'
  },
  planCard: {
    padding: '30px',
    borderRadius: '12px',
    background: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--surface-1))',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const
  },
  popularBadge: {
    position: 'absolute' as const,
    top: '12px',
    right: '12px',
    background: 'rgba(var(--primary-rgb), 0.15)',
    color: 'hsl(var(--primary))',
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '999px',
    letterSpacing: '0.05em'
  },
  planName: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: 'hsl(var(--text-primary))',
    marginBottom: '8px'
  },
  price: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: 'hsl(var(--text-primary))',
    marginBottom: '8px'
  },
  period: {
    fontSize: '1rem',
    color: 'hsl(var(--text-secondary))',
    fontWeight: '400'
  },
  planDesc: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))',
    marginBottom: '20px',
    minHeight: '40px'
  },
  divider: {
    height: '1px',
    background: 'hsl(var(--border-color))',
    margin: '0 0 20px 0'
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 30px 0',
    flex: 1
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))',
    marginBottom: '12px'
  },
  planBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  trialNote: {
    textAlign: 'center' as const,
    fontSize: '0.75rem',
    color: 'hsl(var(--text-muted))',
    marginTop: '10px'
  },
  secureNote: {
    textAlign: 'center' as const,
    fontSize: '0.8rem',
    color: 'hsl(var(--text-muted))',
    marginTop: '24px'
  },
  form: {
    maxWidth: '450px',
    margin: '0 auto'
  },
  formGroup: {
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column' as const
  },
  formRow: {
    display: 'flex',
    gap: '16px'
  },
  label: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))',
    fontWeight: '500',
    marginBottom: '8px'
  },
  input: {
    width: '100%'
  },
  trustBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '0.8rem',
    color: 'hsl(var(--primary))',
    background: 'rgba(var(--primary-rgb), 0.05)',
    padding: '10px',
    borderRadius: '6px',
    margin: '25px 0'
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px'
  },
  backBtn: {
    flex: 1,
    padding: '12px',
    justifyContent: 'center'
  },
  payBtn: {
    flex: 2,
    padding: '12px',
    justifyContent: 'center'
  },
  errorMessage: {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    marginBottom: '20px',
    textAlign: 'center' as const
  }
};
