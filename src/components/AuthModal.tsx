import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
  onLegal?: (page: 'privacy' | 'terms') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login', onLegal }) => {
  const { login, signup, loginWithGoogle, authError, clearAuthError } = useApp();
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!isOpen) return null;

  const handleSwitchTab = (t: 'login' | 'signup') => {
    setTab(t);
    clearAuthError();
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      onClose();
    } catch {
      // authError is set inside context, just stop loading
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch {
      // error shown via authError
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.modal} className="glass-card">
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          <X size={20} color="hsl(var(--text-muted))" />
        </button>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>
            <div style={styles.logoDot} />
            LeadQonnect
          </div>
          <h2 style={styles.title}>{tab === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
          <p style={styles.subtitle}>
            {tab === 'login'
              ? 'Sign in to access your lead dashboard.'
              : 'Start finding high-intent leads on autopilot.'}
          </p>
        </div>

        {/* Tab switcher */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tabBtn, ...(tab === 'login' ? styles.activeTab : {}) }}
            onClick={() => handleSwitchTab('login')}
            type="button"
          >
            Login
          </button>
          <button
            style={{ ...styles.tabBtn, ...(tab === 'signup' ? styles.activeTab : {}) }}
            onClick={() => handleSwitchTab('signup')}
            type="button"
          >
            Sign Up
          </button>
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          style={styles.googleBtn}
          type="button"
        >
          {googleLoading ? (
            <Loader2 size={18} className="spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
          )}
          <span>{googleLoading ? 'Signing in...' : 'Continue with Google'}</span>
        </button>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Error banner */}
        {authError && (
          <div style={styles.errorBanner}>
            {authError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {tab === 'signup' && (
            <div style={styles.inputGroup}>
              <User size={16} color="hsl(var(--text-muted))" style={styles.inputIcon} />
              <input
                type="text"
                placeholder="Full Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <Mail size={16} color="hsl(var(--text-muted))" style={styles.inputIcon} />
            <input
              type="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <Lock size={16} color="hsl(var(--text-muted))" style={styles.inputIcon} />
            <input
              type="password"
              placeholder="Password (min. 6 characters)"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={styles.submitBtn}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <>
                <span>{tab === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p style={styles.footerText}>
          By continuing, you agree to our{' '}
          <span style={{ color: 'hsl(var(--primary))', cursor: 'pointer' }} onClick={() => onLegal?.('terms')}>Terms</span> and{' '}
          <span style={{ color: 'hsl(var(--primary))', cursor: 'pointer' }} onClick={() => onLegal?.('privacy')}>Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8, 10, 28, 0.55)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 0.2s ease-out'
  },
  modal: {
    width: '100%',
    maxWidth: '440px',
    padding: '32px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    boxShadow: 'var(--shadow-lg)',
    margin: '16px'
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px'
  },
  header: {
    textAlign: 'center'
  },
  logo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '1.2rem',
    fontWeight: '800',
    color: 'hsl(var(--text-primary))',
    marginBottom: '20px'
  },
  logoDot: {
    width: '12px',
    height: '12px',
    background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent-3)))',
    borderRadius: '50%',
    boxShadow: '0 0 12px hsl(var(--primary) / 0.6)'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'hsl(var(--text-primary))',
    marginBottom: '8px'
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'hsl(var(--text-secondary))',
    lineHeight: '1.5'
  },
  tabs: {
    display: 'flex',
    backgroundColor: 'hsl(var(--surface-1))',
    borderRadius: '10px',
    padding: '4px'
  },
  tabBtn: {
    flex: 1,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    color: 'hsl(var(--text-secondary))',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    borderRadius: '7px',
    transition: 'all 0.2s'
  },
  activeTab: {
    backgroundColor: 'hsl(var(--bg-card))',
    color: 'hsl(var(--primary))',
    boxShadow: 'var(--shadow-sm)'
  },
  googleBtn: {
    width: '100%',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    backgroundColor: '#fff',
    border: '1px solid hsl(var(--border-strong))',
    borderRadius: '10px',
    color: '#1e293b',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: 'var(--shadow-sm)'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'hsl(var(--border-color))'
  },
  dividerText: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-muted))',
    fontWeight: '500'
  },
  errorBanner: {
    padding: '10px 14px',
    backgroundColor: 'hsl(var(--danger) / 0.1)',
    border: '1px solid hsl(var(--danger) / 0.28)',
    borderRadius: '10px',
    color: 'hsl(var(--danger))',
    fontSize: '0.875rem',
    lineHeight: '1.4'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  inputGroup: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: '14px'
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 40px',
    backgroundColor: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--border-strong))',
    borderRadius: '10px',
    color: 'hsl(var(--text-primary))',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  adminHint: {
    fontSize: '0.8rem',
    color: 'hsl(var(--primary))',
    backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
    border: '1px solid rgba(var(--primary-rgb), 0.25)',
    padding: '8px 12px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  submitBtn: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    padding: '13px',
    marginTop: '4px',
    fontSize: '1rem'
  },
  footerText: {
    fontSize: '0.75rem',
    color: 'hsl(var(--text-muted))',
    textAlign: 'center'
  }
};
