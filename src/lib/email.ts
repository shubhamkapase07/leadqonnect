// Email notification helpers.
//
// This is a browser-only app with no mail server, so "sending" an email means building a
// fully pre-filled message and opening the user's mail client via a mailto: link. To switch
// to true server-side delivery later, replace `openEmail` with a call to a backend function
// (e.g. a Firebase Function backed by SendGrid/Resend) — the message builders below stay the same.
import type { Lead, TeamMember } from '../context/AppContext';

const enc = encodeURIComponent;

export interface EmailDraft { to: string; subject: string; body: string }

export function mailtoUrl({ to, subject, body }: EmailDraft): string {
  return `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`;
}

/** Open the user's mail client with the message pre-filled. Returns false if blocked. */
export function openEmail(draft: EmailDraft): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.open(mailtoUrl(draft), '_blank');
  return w !== null || true; // mailto often returns null while still handing off to the OS client
}

const firstName = (name: string) => (name || 'there').trim().split(/\s+/)[0] || 'there';

/** Email telling a teammate a lead has been assigned to them. */
export function buildAssignmentEmail(member: TeamMember, lead: Lead): EmailDraft {
  const lines = [
    `Hi ${firstName(member.name)},`,
    ``,
    `A new lead has been assigned to you in LeadQonnect.`,
    ``,
    `• Lead: ${lead.author}${lead.handle ? ` (${lead.handle})` : ''}`,
    `• Platform: ${lead.platform}`,
    lead.title ? `• Post: ${lead.title}` : '',
    `• Stage: ${lead.status}`,
    typeof lead.intentScore === 'number' ? `• Intent score: ${lead.intentScore}` : '',
    lead.postUrl ? `• Link: ${lead.postUrl}` : '',
    ``,
    `Context:`,
    (lead.content || '').slice(0, 400),
    ``,
    `— Sent from your LeadQonnect workspace`,
  ].filter(l => l !== '');
  return {
    to: member.email,
    subject: `New lead assigned to you: ${lead.author}`,
    body: lines.join('\n'),
  };
}

/** Email when a lead a teammate owns moves stage (won/lost/etc.). */
export function buildStatusEmail(member: TeamMember, lead: Lead, status: string): EmailDraft {
  return {
    to: member.email,
    subject: `Lead update — ${lead.author} is now "${status}"`,
    body: [
      `Hi ${firstName(member.name)},`,
      ``,
      `The lead ${lead.author} (${lead.platform}) you're handling moved to "${status}".`,
      lead.postUrl ? `Link: ${lead.postUrl}` : '',
      ``,
      `— Sent from your LeadQonnect workspace`,
    ].filter(l => l !== '').join('\n'),
  };
}
