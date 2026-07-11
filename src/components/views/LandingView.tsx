import React, { useState } from 'react';
import {
  ArrowRight, Bot, Sun, Moon, Sparkles, Check, Radar, Brain, Send, Users,
  BarChart3, Bell, Target,
} from 'lucide-react';
import { AuthModal } from '../AuthModal';
import { LegalView } from './LegalView';
import { useApp } from '../../context/AppContext';

export const LandingView: React.FC = () => {
  const { theme, toggleTheme } = useApp();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'signup'>('signup');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [legalPage, setLegalPage] = useState<'privacy' | 'terms' | null>(null);

  if (legalPage) {
    return <LegalView page={legalPage} onBack={() => setLegalPage(null)} />;
  }

  const openAuth = (tab: 'login' | 'signup') => {
    setAuthDefaultTab(tab);
    setAuthModalOpen(true);
  };

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={styles.landingContainer}>
      <div className="aurora" style={{ position: 'fixed' }} />

      {/* Navbar */}
      <nav style={styles.navbar} className="glass-card">
        <div style={styles.logo}>
          <span style={styles.logoMark}>Q</span>
          LeadQonnect
        </div>
        <div style={styles.navCenter}>
          <a href="#how" style={styles.navLink} onClick={scrollTo('how')}>How it works</a>
          <a href="#features" style={styles.navLink} onClick={scrollTo('features')}>Features</a>
          <a href="#pricing" style={styles.navLink} onClick={scrollTo('pricing')}>Pricing</a>
          <a href="#faq" style={styles.navLink} onClick={scrollTo('faq')}>FAQ</a>
        </div>
        <div style={styles.navLinks}>
          <button
            className="theme-toggle"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button style={styles.loginBtn} onClick={() => openAuth('login')}>Log In</button>
          <button className="btn-primary" onClick={() => openAuth('signup')}>
            Get Started <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={styles.heroSection}>
        <div style={styles.heroContent}>
          <div className="badge badge-new" style={{ marginBottom: '24px' }}>
            <Sparkles size={13} /> AI-qualified leads from Reddit, X &amp; LinkedIn
          </div>
          <h1 style={styles.heroTitle}>
            Find people who are<br />
            <span style={styles.heroHighlight}>ready to buy</span> — right now
          </h1>
          <p style={styles.heroSubtitle}>
            LeadQonnect scans Reddit, X, and LinkedIn for prospects actively looking for your
            service, scores their buying intent with AI, and lets you reply, comment, and DM
            them from your own accounts — all from one pipeline.
          </p>
          <div style={styles.heroActions}>
            <button className="btn-primary" style={styles.mainCta} onClick={() => openAuth('signup')}>
              Start Free <ArrowRight size={18} />
            </button>
            <button className="btn-secondary" style={styles.secondaryCta} onClick={() => openAuth('login')}>
              Sign In
            </button>
          </div>
          <div style={styles.trustRow}>
            {['No credit card', 'Setup in 2 minutes', 'Cancel anytime'].map(t => (
              <span key={t} style={styles.trustItem}>
                <Check size={15} style={{ color: 'hsl(var(--primary))' }} /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Floating product mock */}
        <div style={styles.heroGraphicWrapper} className="animate-float">
          <div style={styles.heroGraphic} className="glass-card">
            <div style={styles.mockHeader}>
              <div style={styles.mockDots}>
                <div style={{ ...styles.mockDot, backgroundColor: '#ef4444' }} />
                <div style={{ ...styles.mockDot, backgroundColor: '#f59e0b' }} />
                <div style={{ ...styles.mockDot, backgroundColor: '#22c55e' }} />
              </div>
              <div style={styles.mockSearch}>Scanning r/SaaS for "React developer"…</div>
            </div>
            <div style={styles.mockBody}>
              <div style={styles.mockCard}>
                <div style={styles.mockCardHeader}>
                  <div style={styles.mockAvatar} />
                  <div>
                    <div style={styles.mockName}>u/tech_founder</div>
                    <div style={styles.mockTime}>Just now • High Intent</div>
                  </div>
                  <div style={styles.mockMatch}>98% Match</div>
                </div>
                <div style={styles.mockTextLine} />
                <div style={{ ...styles.mockTextLine, width: '80%' }} />
                <div style={{ ...styles.mockTextLine, width: '55%' }} />
                <div style={styles.mockScores}>
                  {[['Intent', 96], ['Quality', 88], ['Match', 98]].map(([l, v]) => (
                    <div key={l as string} style={styles.scorePill}>
                      <span style={styles.scoreLabel}>{l}</span>
                      <span style={styles.scoreValue}>{v as number}</span>
                    </div>
                  ))}
                </div>
                <div style={styles.mockReplyBox}>
                  <Bot size={15} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
                  <span>AI Pitch Drafted: "Hey, I saw you need a React dev…"</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section style={styles.statsStrip}>
        {[
          { value: '3', label: 'Platforms scanned' },
          { value: '0–100', label: 'AI intent scoring' },
          { value: '1-click', label: 'Reply from your account' },
          { value: '24/7', label: 'Always-on monitoring' },
        ].map(s => (
          <div key={s.label} style={styles.statItem}>
            <div style={styles.statValue}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="how" style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.eyebrow}>HOW IT WORKS</span>
          <h2 style={styles.sectionTitle}>From a stranger's post to a booked call</h2>
          <p style={styles.sectionSubtitle}>
            Four steps, fully automated up to the moment you decide to reach out.
          </p>
        </div>
        <div style={styles.stepsGrid}>
          {[
            { n: '01', icon: <Radar size={20} />, tint: 'var(--primary)', title: 'Listen', desc: 'Set your keywords, platforms, industry, and geography. We continuously scan Reddit, X, and LinkedIn for matching conversations.' },
            { n: '02', icon: <Target size={20} />, tint: 'var(--accent-2)', title: 'Score', desc: 'Every post is instantly scored on intent, quality, and fit (0–100), so real buyers rise to the top and noise is filtered out.' },
            { n: '03', icon: <Brain size={20} />, tint: 'var(--accent-3)', title: 'Qualify', desc: 'One click sends a lead to Claude for calibrated scoring, inferred budget and industry, and a recommended next step.' },
            { n: '04', icon: <Send size={20} />, tint: 'var(--success)', title: 'Engage', desc: 'Connect your own Reddit account and reply, comment, or DM the prospect — with an AI-drafted pitch — without leaving the app.' },
          ].map(s => (
            <div key={s.n} className="glass-card glow-card" style={styles.stepCard}>
              <div style={styles.stepTop}>
                <div style={{ ...styles.featureIcon, background: `hsl(${s.tint} / 0.12)`, border: `1px solid hsl(${s.tint} / 0.28)`, color: `hsl(${s.tint})` }}>
                  {s.icon}
                </div>
                <span style={styles.stepNumber}>{s.n}</span>
              </div>
              <h3 style={styles.featureTitle}>{s.title}</h3>
              <p style={styles.featureDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.eyebrow}>WHY LEADQONNECT</span>
          <h2 style={styles.sectionTitle}>Everything you need to turn intent into revenue</h2>
          <p style={styles.sectionSubtitle}>
            One workspace for finding, qualifying, contacting, and tracking your warmest leads.
          </p>
        </div>

        <div style={styles.featuresGrid}>
          <FeatureCard
            icon={<Radar size={22} />} tint="var(--primary)"
            title="Multi-platform scanning"
            desc="Monitor Reddit, X, and LinkedIn for your exact buyer keywords across the communities, industries, and timeframes you choose."
          />
          <FeatureCard
            icon={<Brain size={22} />} tint="var(--accent-3)"
            title="AI lead qualification"
            desc="Claude scores buying intent, response probability, and opportunity — and infers company, industry, and budget from each post."
          />
          <FeatureCard
            icon={<Send size={22} />} tint="var(--success)"
            title="Engage from your own account"
            desc="Connect Reddit via secure OAuth and reply, comment, or DM prospects directly — with AI-drafted, context-aware pitches."
          />
          <FeatureCard
            icon={<Users size={22} />} tint="var(--accent-2)"
            title="Team pipeline & assignment"
            desc="Provision teammate logins, assign leads, and track status as they move from potential to won — synced live across the team."
          />
          <FeatureCard
            icon={<BarChart3 size={22} />} tint="var(--warning)"
            title="Insights & demand gaps"
            desc="See leads over time, top keywords, the best target communities, platform performance, and where demand is heating up."
          />
          <FeatureCard
            icon={<Bell size={22} />} tint="var(--accent-purple)"
            title="Real-time alerts"
            desc="Get notified the moment a high-intent lead lands — via in-app alerts and browser notifications, so you never miss a hot prospect."
          />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.eyebrow}>PRICING</span>
          <h2 style={styles.sectionTitle}>Simple plans that scale with you</h2>
          <p style={styles.sectionSubtitle}>
            Start free. Upgrade when you're ready to qualify with AI and engage at scale.
          </p>
          <div style={styles.billingToggle}>
            <button
              style={{ ...styles.billingOption, ...(billing === 'monthly' ? styles.billingActive : {}) }}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              style={{ ...styles.billingOption, ...(billing === 'annual' ? styles.billingActive : {}) }}
              onClick={() => setBilling('annual')}
            >
              Annual <span style={styles.saveTag}>save 20%</span>
            </button>
          </div>
        </div>

        <div style={styles.pricingGrid}>
          {PLANS.map(plan => {
            const price = billing === 'annual' ? plan.annual : plan.monthly;
            const featured = plan.featured;
            return (
              <div
                key={plan.name}
                className="glass-card glow-card"
                style={{ ...styles.priceCard, ...(featured ? styles.priceCardFeatured : {}) }}
              >
                <div style={styles.priceHeader}>
                  <h3 style={styles.priceName}>{plan.name}</h3>
                  {featured && (
                    <span style={styles.popularBadge}>
                      <Sparkles size={11} /> Popular
                    </span>
                  )}
                </div>
                <p style={styles.priceTagline}>{plan.tagline}</p>
                <div style={styles.priceRow}>
                  {typeof price === 'number' ? (
                    <>
                      <span style={styles.priceAmount}>${price}</span>
                      <span style={styles.pricePeriod}>/mo</span>
                    </>
                  ) : (
                    <span style={styles.priceAmount}>{price}</span>
                  )}
                </div>
                <div style={styles.priceSubnote}>
                  {typeof price === 'number' && price > 0
                    ? billing === 'annual' ? 'billed annually' : 'billed monthly'
                    : plan.subnote}
                </div>
                <button
                  className={featured ? 'btn-primary' : 'btn-secondary'}
                  style={styles.priceCta}
                  onClick={() => openAuth('signup')}
                >
                  {plan.cta}
                </button>
                <ul style={styles.featureList}>
                  {plan.features.map(f => (
                    <li key={f} style={styles.priceFeature}>
                      <Check size={16} style={{ color: 'hsl(var(--primary))', flexShrink: 0, marginTop: 2 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p style={styles.pricingFootnote}>
          AI qualification uses pay-as-you-go credits — you only spend on the leads you choose
          to qualify. Need more seats or volume? <span style={styles.inlineLink} onClick={() => openAuth('signup')}>Talk to us</span>.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.eyebrow}>FAQ</span>
          <h2 style={styles.sectionTitle}>Questions, answered</h2>
        </div>
        <div style={styles.faqGrid}>
          {FAQS.map(f => (
            <div key={f.q} className="glass-card" style={styles.faqCard}>
              <h3 style={styles.faqQ}>{f.q}</h3>
              <p style={styles.faqA}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section style={styles.ctaBand}>
        <div style={styles.ctaCard} className="glass-card glow-card">
          <div className="aurora" />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={styles.ctaTitle}>Your next customer is posting right now</h2>
            <p style={styles.ctaDesc}>Start finding ready-to-buy prospects today — free, no card required.</p>
            <button className="btn-primary" style={styles.mainCta} onClick={() => openAuth('signup')}>
              Get Started Free <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.logo}>
          <span style={styles.logoMark}>Q</span>
          LeadQonnect
        </div>
        <div style={styles.footerLinks}>
          <span onClick={scrollTo('how')}>How it works</span>
          <span onClick={scrollTo('features')}>Features</span>
          <span onClick={scrollTo('pricing')}>Pricing</span>
          <span onClick={() => setLegalPage('privacy')}>Privacy</span>
          <span onClick={() => setLegalPage('terms')}>Terms</span>
        </div>
        <div style={styles.copyright}>© 2026 LeadQonnect Inc. All rights reserved.</div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authDefaultTab}
        onLegal={(p) => {
          setAuthModalOpen(false);
          setLegalPage(p);
        }}
      />
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, tint }: { icon: React.ReactNode; title: string; desc: string; tint: string }) => (
  <div className="glass-card glow-card" style={styles.featureCard}>
    <div style={{ ...styles.featureIcon, background: `hsl(${tint} / 0.12)`, border: `1px solid hsl(${tint} / 0.28)`, color: `hsl(${tint})` }}>
      {icon}
    </div>
    <h3 style={styles.featureTitle}>{title}</h3>
    <p style={styles.featureDesc}>{desc}</p>
  </div>
);

// --- Pricing data ----------------------------------------------------------
interface Plan {
  name: string;
  tagline: string;
  monthly: number | string;
  annual: number | string;
  subnote: string;
  cta: string;
  featured?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    tagline: 'Try the scanning engine.',
    monthly: 0,
    annual: 0,
    subnote: 'free forever',
    cta: 'Start Free',
    features: [
      '1 active campaign',
      'Reddit scanning',
      'Deterministic intent scoring',
      'Up to 20 leads / month',
      'Manual outreach & pitch drafts',
    ],
  },
  {
    name: 'Pro',
    tagline: 'For freelancers, founders & small teams.',
    monthly: 49,
    annual: 39,
    subnote: 'billed monthly',
    cta: 'Start 7-Day Free Trial',
    featured: true,
    features: [
      'Up to 5 campaigns',
      'Reddit, X & LinkedIn scanning',
      'AI qualification with Claude',
      'Reply, comment & DM from your account',
      'Up to 3 team members',
      'Real-time alerts (in-app + browser)',
      'Insights & analytics dashboard',
      'Affiliate / referral program',
    ],
  },
  {
    name: 'Agency',
    tagline: 'For teams running outbound at scale.',
    monthly: 149,
    annual: 119,
    subnote: 'billed monthly',
    cta: 'Start Free Trial',
    features: [
      'Everything in Pro',
      'Unlimited campaigns',
      'Unlimited team members',
      'Team chat & shared pipeline',
      'Higher scan volume & priority AI',
      'Priority support',
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Which platforms does LeadQonnect scan?',
    a: 'Reddit, X (Twitter), and LinkedIn. You pick which platforms each campaign monitors, plus the keywords, industry, and geography to target.',
  },
  {
    q: 'How is "buying intent" measured?',
    a: 'Every lead is scored instantly on intent, quality, and fit using an explainable engine, then you can one-click qualify it with Claude for calibrated scores, inferred budget, and a recommended next step.',
  },
  {
    q: 'Can I message prospects from my own account?',
    a: 'Yes. Connect your Reddit account via secure OAuth and reply, comment, or DM directly from LeadQonnect — your tokens stay private and server-side.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free plan needs no credit card — sign up and start finding leads in about two minutes.',
  },
  {
    q: 'How does team collaboration work?',
    a: 'On Agency, you provision login accounts for teammates, assign leads to them, and track status across a shared pipeline — updates sync live in both directions.',
  },
  {
    q: 'What does AI qualification cost?',
    a: 'AI runs on pay-as-you-go credits and only fires on leads you choose to qualify — typically a few cents each — so you stay in full control of spend.',
  },
];

const styles: Record<string, React.CSSProperties> = {
  landingContainer: {
    height: '100vh',
    overflowY: 'auto',
    position: 'relative',
    backgroundColor: 'hsl(var(--bg-main))',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 24px',
    position: 'sticky',
    top: '16px',
    zIndex: 20,
    margin: '16px auto 0',
    maxWidth: '1180px',
    width: 'calc(100% - 32px)',
    borderRadius: '16px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'hsl(var(--text-primary))',
    letterSpacing: '-0.02em',
  },
  logoMark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '9px',
    background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent-3)))',
    color: '#fff',
    fontWeight: 800,
    fontSize: '1rem',
    boxShadow: '0 4px 14px -4px hsl(var(--primary) / 0.6)',
  },
  navCenter: { display: 'flex', alignItems: 'center', gap: '6px' },
  navLink: {
    background: 'none',
    border: 'none',
    color: 'hsl(var(--text-secondary))',
    fontSize: '0.92rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: '8px',
    textDecoration: 'none',
  },
  navLinks: { display: 'flex', alignItems: 'center', gap: '12px' },
  loginBtn: {
    background: 'none',
    border: 'none',
    color: 'hsl(var(--text-secondary))',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '8px 10px',
  },
  heroSection: {
    position: 'relative',
    zIndex: 1,
    padding: '80px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  heroContent: { maxWidth: '820px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  heroTitle: {
    fontSize: 'clamp(2.6rem, 6vw, 4.4rem)',
    fontWeight: 800,
    lineHeight: 1.08,
    color: 'hsl(var(--text-primary))',
    marginBottom: '22px',
    letterSpacing: '-0.03em',
  },
  heroHighlight: {
    background: 'linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent-3)) 60%, hsl(var(--accent-2)))',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '1.18rem',
    color: 'hsl(var(--text-secondary))',
    lineHeight: 1.6,
    marginBottom: '36px',
    maxWidth: '660px',
  },
  heroActions: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' },
  mainCta: { padding: '15px 30px', fontSize: '1.05rem', borderRadius: '12px' },
  secondaryCta: { padding: '15px 30px', fontSize: '1.05rem', borderRadius: '12px' },
  trustRow: { display: 'flex', gap: '22px', marginTop: '28px', flexWrap: 'wrap', justifyContent: 'center' },
  trustItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    fontSize: '0.9rem',
    color: 'hsl(var(--text-muted))',
    fontWeight: 500,
  },
  heroGraphicWrapper: {
    marginTop: '64px',
    width: '100%',
    maxWidth: '880px',
    position: 'relative',
    zIndex: 1,
    perspective: '1200px',
  },
  heroGraphic: {
    width: '100%',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: '18px',
    transform: 'rotateX(6deg)',
    transformOrigin: 'top center',
  },
  mockHeader: {
    height: '44px',
    borderBottom: '1px solid hsl(var(--border-color))',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: '16px',
    background: 'hsl(var(--surface-1))',
  },
  mockDots: { display: 'flex', gap: '6px' },
  mockDot: { width: '10px', height: '10px', borderRadius: '50%' },
  mockSearch: {
    fontSize: '0.78rem',
    color: 'hsl(var(--text-muted))',
    background: 'hsl(var(--surface-2))',
    padding: '5px 12px',
    borderRadius: '6px',
    flex: 1,
    textAlign: 'center',
  },
  mockBody: { flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  mockCard: {
    background: 'hsl(var(--bg-card))',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: 'var(--shadow-sm)',
  },
  mockCardHeader: { display: 'flex', alignItems: 'center', gap: '12px' },
  mockAvatar: { width: '38px', height: '38px', borderRadius: '50%', background: '#ff4500', flexShrink: 0 },
  mockName: { fontSize: '0.9rem', color: 'hsl(var(--text-primary))', fontWeight: 600 },
  mockTime: { fontSize: '0.75rem', color: 'hsl(var(--text-muted))' },
  mockMatch: {
    marginLeft: 'auto',
    background: 'rgba(var(--primary-rgb), 0.14)',
    color: 'hsl(var(--primary))',
    padding: '5px 11px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  mockTextLine: { height: '9px', background: 'hsl(var(--surface-2))', borderRadius: '5px', width: '100%' },
  mockScores: { display: 'flex', gap: '8px', marginTop: '4px' },
  scorePill: {
    flex: 1,
    background: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '10px',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  scoreLabel: { fontSize: '0.68rem', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  scoreValue: { fontSize: '1.15rem', fontWeight: 800, color: 'hsl(var(--primary))' },
  mockReplyBox: {
    marginTop: '6px',
    background: 'rgba(var(--primary-rgb), 0.08)',
    border: '1px solid rgba(var(--primary-rgb), 0.25)',
    padding: '12px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'hsl(var(--primary))',
    fontSize: '0.85rem',
    fontWeight: 500,
    textAlign: 'left',
  },
  statsStrip: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '20px',
    maxWidth: '1000px',
    margin: '40px auto',
    padding: '0 24px',
  },
  statItem: { textAlign: 'center' },
  statValue: {
    fontSize: '2.2rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, hsl(var(--text-primary)), hsl(var(--primary)))',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  statLabel: { fontSize: '0.88rem', color: 'hsl(var(--text-muted))', marginTop: '4px' },
  section: { position: 'relative', zIndex: 1, padding: '70px 24px', maxWidth: '1200px', margin: '0 auto' },
  sectionHeader: { textAlign: 'center', marginBottom: '52px' },
  eyebrow: {
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'hsl(var(--primary))',
  },
  sectionTitle: {
    fontSize: 'clamp(1.9rem, 4vw, 2.6rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'hsl(var(--text-primary))',
    margin: '12px 0 14px',
  },
  sectionSubtitle: { fontSize: '1.08rem', color: 'hsl(var(--text-secondary))', maxWidth: '620px', margin: '0 auto' },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '22px',
  },
  stepCard: { padding: '28px 26px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  stepTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '18px' },
  stepNumber: { fontSize: '1.4rem', fontWeight: 800, color: 'hsl(var(--text-faint))', letterSpacing: '-0.02em' },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '22px',
  },
  featureCard: { padding: '30px 26px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  featureIcon: {
    width: '50px',
    height: '50px',
    borderRadius: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  featureTitle: { fontSize: '1.15rem', fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '10px' },
  featureDesc: { fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 },
  // Pricing
  billingToggle: {
    display: 'inline-flex',
    gap: '4px',
    padding: '5px',
    marginTop: '28px',
    background: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '12px',
  },
  billingOption: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '9px 20px',
    borderRadius: '9px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'hsl(var(--text-secondary))',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  billingActive: {
    background: 'hsl(var(--bg-card))',
    color: 'hsl(var(--text-primary))',
    boxShadow: 'var(--shadow-sm)',
  },
  saveTag: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'hsl(var(--success))',
    background: 'hsl(var(--success) / 0.14)',
    padding: '2px 7px',
    borderRadius: '20px',
  },
  pricingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '22px',
    alignItems: 'start',
    maxWidth: '1080px',
    margin: '0 auto',
  },
  priceCard: { padding: '32px 28px', display: 'flex', flexDirection: 'column', position: 'relative' },
  priceCardFeatured: {
    border: '1.5px solid hsl(var(--primary))',
    boxShadow: '0 24px 60px -24px hsl(var(--primary) / 0.45)',
  },
  priceHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  popularBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    background: 'rgba(var(--primary-rgb), 0.12)',
    color: 'hsl(var(--primary))',
    border: '1px solid rgba(var(--primary-rgb), 0.28)',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    padding: '5px 11px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
  },
  priceName: { fontSize: '1.3rem', fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' },
  priceTagline: { fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginTop: '6px', minHeight: '40px' },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' },
  priceAmount: {
    fontSize: '2.8rem',
    fontWeight: 800,
    color: 'hsl(var(--text-primary))',
    letterSpacing: '-0.03em',
  },
  pricePeriod: { fontSize: '1rem', color: 'hsl(var(--text-muted))', fontWeight: 600 },
  priceSubnote: { fontSize: '0.82rem', color: 'hsl(var(--text-muted))', marginTop: '2px', marginBottom: '22px' },
  priceCta: { width: '100%', justifyContent: 'center', padding: '13px', fontSize: '0.98rem', borderRadius: '11px' },
  featureList: { listStyle: 'none', padding: 0, margin: '26px 0 0', display: 'flex', flexDirection: 'column', gap: '13px' },
  priceFeature: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '0.92rem',
    color: 'hsl(var(--text-secondary))',
    lineHeight: 1.45,
  },
  pricingFootnote: {
    textAlign: 'center',
    fontSize: '0.92rem',
    color: 'hsl(var(--text-muted))',
    marginTop: '32px',
    maxWidth: '640px',
    marginInline: 'auto',
  },
  inlineLink: { color: 'hsl(var(--primary))', fontWeight: 600, cursor: 'pointer' },
  // FAQ
  faqGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '18px',
  },
  faqCard: { padding: '24px 26px' },
  faqQ: { fontSize: '1.02rem', fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '10px' },
  faqA: { fontSize: '0.92rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6, margin: 0 },
  ctaBand: { position: 'relative', zIndex: 1, padding: '40px 24px 90px', maxWidth: '1100px', margin: '0 auto' },
  ctaCard: { position: 'relative', overflow: 'hidden', borderRadius: '24px', padding: '64px 32px', textAlign: 'center' },
  ctaTitle: {
    fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'hsl(var(--text-primary))',
    marginBottom: '14px',
  },
  ctaDesc: { fontSize: '1.08rem', color: 'hsl(var(--text-secondary))', marginBottom: '30px', maxWidth: '520px', marginInline: 'auto' },
  footer: {
    position: 'relative',
    zIndex: 1,
    padding: '40px 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '22px',
    borderTop: '1px solid hsl(var(--border-color))',
  },
  footerLinks: { display: 'flex', gap: '24px', color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', cursor: 'pointer', flexWrap: 'wrap', justifyContent: 'center' },
  copyright: { color: 'hsl(var(--text-muted))', fontSize: '0.85rem' },
};
