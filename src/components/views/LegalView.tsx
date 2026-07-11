import React, { useEffect } from 'react';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type LegalPage = 'privacy' | 'terms';

interface LegalViewProps {
  page: LegalPage;
  onBack: () => void;
}

const LAST_UPDATED = 'June 27, 2026';
const SUPPORT_EMAIL = 'support@leadqonnect.com';
const PRIVACY_EMAIL = 'privacy@leadqonnect.com';

export const LegalView: React.FC<LegalViewProps> = ({ page, onBack }) => {
  const { theme, toggleTheme } = useApp();

  // Scroll to top whenever the page changes.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return (
    <div style={styles.container}>
      <div className="aurora" style={{ position: 'fixed' }} />

      {/* Navbar */}
      <nav style={styles.navbar} className="glass-card">
        <div style={styles.logo}>
          <span style={styles.logoMark}>Q</span>
          LeadQonnect
        </div>
        <div style={styles.navRight}>
          <button
            className="theme-toggle"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button style={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={16} /> Back to home
          </button>
        </div>
      </nav>

      {/* Content */}
      <article style={styles.article} className="glass-card">
        {page === 'privacy' ? <PrivacyContent /> : <TermsContent />}
      </article>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.copyright}>© 2026 LeadQonnect Inc. All rights reserved.</div>
      </footer>
    </div>
  );
};

// --- Privacy Policy --------------------------------------------------------
const PrivacyContent: React.FC = () => (
  <>
    <h1 style={styles.title}>Privacy Policy</h1>
    <p style={styles.updated}>Last updated: {LAST_UPDATED}</p>

    <p style={styles.lead}>
      This Privacy Policy explains how LeadQonnect Inc. (“LeadQonnect”, “we”, “us”) collects, uses,
      and protects information when you use our lead-discovery and outreach platform (the “Service”).
      By using the Service you agree to the practices described here.
    </p>

    <Section title="1. Information We Collect">
      <p style={styles.p}>We collect the following categories of information:</p>
      <ul style={styles.ul}>
        <li style={styles.li}>
          <strong>Account information</strong> — your name, email address, and authentication
          credentials, provided when you sign up or sign in (including via Google).
        </li>
        <li style={styles.li}>
          <strong>Workspace &amp; team data</strong> — team members you invite, role assignments,
          internal notes, and chat messages you create within the Service.
        </li>
        <li style={styles.li}>
          <strong>Lead data</strong> — information about prospects surfaced from public sources
          (such as posts and discussions on Reddit and other public platforms), along with any
          enrichment, scoring, tags, or status you apply to those leads.
        </li>
        <li style={styles.li}>
          <strong>Outreach content</strong> — email sequences, message templates, and the contents
          of outreach you send or schedule through the Service.
        </li>
        <li style={styles.li}>
          <strong>Payment information</strong> — billing details processed by our payment provider,
          Razorpay. We do not store full card numbers on our servers.
        </li>
        <li style={styles.li}>
          <strong>Usage data</strong> — log data, device and browser information, and analytics
          about how you interact with the Service.
        </li>
      </ul>
    </Section>

    <Section title="2. How We Use Information">
      <ul style={styles.ul}>
        <li style={styles.li}>To provide, operate, and maintain the Service.</li>
        <li style={styles.li}>To scan public sources, score leads, and generate AI-assisted insights.</li>
        <li style={styles.li}>To send and track outreach you initiate.</li>
        <li style={styles.li}>To process subscriptions and payments.</li>
        <li style={styles.li}>To secure the Service, prevent abuse, and comply with legal obligations.</li>
        <li style={styles.li}>To communicate with you about your account, support requests, and product updates.</li>
      </ul>
    </Section>

    <Section title="3. AI &amp; Automated Processing">
      <p style={styles.p}>
        The Service uses automated systems and large language models to classify, score, and
        summarize leads, and to assist with drafting outreach. These outputs are intended as
        decision-support aids and may contain inaccuracies. You are responsible for reviewing
        AI-generated content before relying on or sending it.
      </p>
    </Section>

    <Section title="4. Third-Party Services">
      <p style={styles.p}>We rely on trusted third parties to deliver the Service, including:</p>
      <ul style={styles.ul}>
        <li style={styles.li}><strong>Google Firebase</strong> — authentication, database, and hosting.</li>
        <li style={styles.li}><strong>Razorpay</strong> — payment processing.</li>
        <li style={styles.li}><strong>Apify and public platform APIs</strong> — sourcing publicly available lead signals.</li>
        <li style={styles.li}><strong>AI providers</strong> — generating scores, insights, and draft content.</li>
      </ul>
      <p style={styles.p}>
        Each provider processes data under its own privacy terms. We share only what is necessary
        for these services to function.
      </p>
    </Section>

    <Section title="5. Data Sharing">
      <p style={styles.p}>
        We do not sell your personal information. We share data only with the service providers
        described above, with members of your own workspace, where required by law, or in connection
        with a merger or acquisition.
      </p>
    </Section>

    <Section title="6. Data Retention &amp; Security">
      <p style={styles.p}>
        We retain your data for as long as your account is active or as needed to provide the
        Service and meet legal obligations. We apply reasonable technical and organizational measures
        to protect your data, though no method of transmission or storage is completely secure.
      </p>
    </Section>

    <Section title="7. Your Rights">
      <p style={styles.p}>
        Depending on your jurisdiction, you may have the right to access, correct, export, or delete
        your personal data, and to object to or restrict certain processing. To exercise these rights,
        contact us at <a href={`mailto:${PRIVACY_EMAIL}`} style={styles.link}>{PRIVACY_EMAIL}</a>.
      </p>
    </Section>

    <Section title="8. Changes to This Policy">
      <p style={styles.p}>
        We may update this Privacy Policy from time to time. Material changes will be reflected by the
        “Last updated” date above, and we may notify you within the Service.
      </p>
    </Section>

    <Section title="9. Contact">
      <p style={styles.p}>
        Questions about this policy? Email us at{' '}
        <a href={`mailto:${PRIVACY_EMAIL}`} style={styles.link}>{PRIVACY_EMAIL}</a>.
      </p>
    </Section>
  </>
);

// --- Terms of Service ------------------------------------------------------
const TermsContent: React.FC = () => (
  <>
    <h1 style={styles.title}>Terms of Service</h1>
    <p style={styles.updated}>Last updated: {LAST_UPDATED}</p>

    <p style={styles.lead}>
      These Terms of Service (“Terms”) govern your access to and use of the LeadQonnect platform
      operated by LeadQonnect Inc. (“LeadQonnect”, “we”, “us”). By creating an account or using the
      Service, you agree to these Terms.
    </p>

    <Section title="1. Eligibility &amp; Accounts">
      <p style={styles.p}>
        You must be at least 18 years old and able to form a binding contract to use the Service. You
        are responsible for the accuracy of your account information and for keeping your credentials
        secure. You are responsible for all activity that occurs under your account.
      </p>
    </Section>

    <Section title="2. Acceptable Use">
      <p style={styles.p}>You agree not to:</p>
      <ul style={styles.ul}>
        <li style={styles.li}>Use the Service for unlawful, deceptive, or harmful purposes.</li>
        <li style={styles.li}>Send spam or outreach that violates anti-spam laws (such as CAN-SPAM, GDPR, or local regulations).</li>
        <li style={styles.li}>Scrape, harvest, or process data in violation of third-party terms or applicable law.</li>
        <li style={styles.li}>Attempt to disrupt, reverse-engineer, or gain unauthorized access to the Service.</li>
        <li style={styles.li}>Resell or sublicense the Service without our written permission.</li>
      </ul>
    </Section>

    <Section title="3. Outreach &amp; Compliance">
      <p style={styles.p}>
        You are solely responsible for the content of outreach you send through the Service and for
        complying with all applicable laws governing electronic communications and the processing of
        personal data of your prospects, including obtaining any required consents and honoring
        opt-out requests.
      </p>
    </Section>

    <Section title="4. Subscriptions &amp; Payments">
      <p style={styles.p}>
        Paid plans are billed in advance on a recurring basis through our payment provider, Razorpay.
        Fees are non-refundable except where required by law. Plan limits, features, and pricing may
        change; we will provide notice of material changes. You may cancel at any time, and your plan
        will remain active through the end of the current billing period.
      </p>
    </Section>

    <Section title="5. Your Content &amp; Data">
      <p style={styles.p}>
        You retain ownership of the content and data you submit. You grant LeadQonnect a limited
        license to host and process that content solely to provide the Service. Our handling of
        personal data is described in our Privacy Policy.
      </p>
    </Section>

    <Section title="6. AI-Generated Output">
      <p style={styles.p}>
        The Service uses automated and AI systems to score leads and assist with drafting outreach.
        These outputs may be inaccurate or incomplete and are provided “as is.” You are responsible
        for reviewing and verifying any AI-generated content before use.
      </p>
    </Section>

    <Section title="7. Intellectual Property">
      <p style={styles.p}>
        The Service, including its software, design, and branding, is owned by LeadQonnect and
        protected by intellectual property laws. These Terms do not grant you any rights to our
        trademarks or other proprietary materials.
      </p>
    </Section>

    <Section title="8. Disclaimers">
      <p style={styles.p}>
        The Service is provided “as is” and “as available” without warranties of any kind, whether
        express or implied. We do not guarantee that leads surfaced through the Service will result in
        sales or that the Service will be uninterrupted or error-free.
      </p>
    </Section>

    <Section title="9. Limitation of Liability">
      <p style={styles.p}>
        To the maximum extent permitted by law, LeadQonnect will not be liable for any indirect,
        incidental, or consequential damages, or for lost profits or revenue. Our total liability for
        any claim relating to the Service will not exceed the amount you paid us in the twelve months
        preceding the claim.
      </p>
    </Section>

    <Section title="10. Termination">
      <p style={styles.p}>
        You may stop using the Service at any time. We may suspend or terminate your access if you
        violate these Terms or use the Service in a way that may cause harm or legal liability.
      </p>
    </Section>

    <Section title="11. Changes to These Terms">
      <p style={styles.p}>
        We may update these Terms from time to time. Continued use of the Service after changes take
        effect constitutes acceptance of the revised Terms.
      </p>
    </Section>

    <Section title="12. Contact">
      <p style={styles.p}>
        Questions about these Terms? Email us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={styles.link}>{SUPPORT_EMAIL}</a>.
      </p>
    </Section>
  </>
);

// --- Shared section wrapper ------------------------------------------------
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={styles.section}>
    <h2 style={styles.h2} dangerouslySetInnerHTML={{ __html: title }} />
    {children}
  </section>
);

const styles: Record<string, React.CSSProperties> = {
  container: { position: 'relative', height: '100vh', overflowY: 'auto', background: 'hsl(var(--bg-main))' },
  navbar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    margin: '16px auto',
    maxWidth: '1100px',
    borderRadius: '16px',
  },
  logo: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, fontSize: '1.15rem', color: 'hsl(var(--text-primary))' },
  logoMark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '9px',
    background: 'hsl(var(--primary))',
    color: '#fff',
    fontWeight: 800,
  },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '9px',
    border: '1px solid hsl(var(--border-color))',
    background: 'transparent',
    color: 'hsl(var(--text-primary))',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  article: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '820px',
    margin: '8px auto 48px',
    padding: 'clamp(28px, 5vw, 56px)',
    borderRadius: '20px',
  },
  title: { fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.025em', color: 'hsl(var(--text-primary))', marginBottom: '8px' },
  updated: { color: 'hsl(var(--text-muted))', fontSize: '0.88rem', marginBottom: '28px' },
  lead: { color: 'hsl(var(--text-secondary))', fontSize: '1.02rem', lineHeight: 1.7, marginBottom: '8px' },
  section: { marginTop: '32px' },
  h2: { fontSize: '1.2rem', fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '12px', letterSpacing: '-0.01em' },
  p: { color: 'hsl(var(--text-secondary))', fontSize: '0.98rem', lineHeight: 1.7, marginBottom: '10px' },
  ul: { margin: '0 0 10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  li: { color: 'hsl(var(--text-secondary))', fontSize: '0.98rem', lineHeight: 1.6 },
  link: { color: 'hsl(var(--primary))', textDecoration: 'none' },
  footer: {
    position: 'relative',
    zIndex: 1,
    padding: '24px',
    textAlign: 'center',
    borderTop: '1px solid hsl(var(--border-color))',
  },
  copyright: { color: 'hsl(var(--text-muted))', fontSize: '0.85rem' },
};
