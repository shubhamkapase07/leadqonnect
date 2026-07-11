// Outreach helpers — build personalized messages and per-platform deep links.
//
// What can actually be automated from a browser-only app:
//  • Email   → mailto: link opens the user's mail client with subject + body PRE-FILLED.
//  • Reddit  → compose URL pre-fills subject + message (or a real DM via a connected account).
//  • Twitter → X does NOT allow pre-filling DM text by handle, so we copy the message and
//              open the profile; the user pastes (one keystroke).
//  • LinkedIn→ LinkedIn's messaging API is partner-only and it ignores URL message params, so
//              there is NO way to send or pre-fill a DM programmatically. Same copy + open flow.
import type { Lead } from '../context/AppContext';

export type OutreachChannel = 'email' | 'reddit' | 'twitter' | 'linkedin';

const enc = encodeURIComponent;

export function leadEmail(lead: Lead): string {
  return (lead.contactDetails?.email || lead.decisionMakers?.find(d => d.email)?.email || '').trim();
}

export function firstName(lead: Lead): string {
  return (lead.author || 'there').trim().split(/\s+/)[0] || 'there';
}

export function redditUsername(lead: Lead): string {
  return (lead.handle || lead.author || '').replace(/^\/?(u\/|user\/)?/i, '').replace(/^@/, '').trim();
}

export function twitterHandle(lead: Lead): string {
  return (lead.handle || lead.author || '')
    .replace(/^https?:\/\/(x|twitter)\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .trim();
}

export function linkedinUrl(lead: Lead): string {
  const cand = (lead.handle || '').trim();
  if (/linkedin\.com/i.test(cand)) return cand.startsWith('http') ? cand : `https://${cand}`;
  if (lead.companyLinkedin && /linkedin\.com/i.test(lead.companyLinkedin)) {
    return lead.companyLinkedin.startsWith('http') ? lead.companyLinkedin : `https://${lead.companyLinkedin}`;
  }
  // No profile URL on file — drop the user onto a people search for the lead's name.
  return `https://www.linkedin.com/search/results/people/?keywords=${enc(lead.author || '')}`;
}

// How to address the person in the message body, per platform (@handle where it's meaningful).
export function mentionFor(lead: Lead): string {
  switch (lead.platform) {
    case 'reddit': { const u = redditUsername(lead); return u ? `u/${u}` : firstName(lead); }
    case 'twitter': { const h = twitterHandle(lead); return h ? `@${h}` : firstName(lead); }
    default: return firstName(lead);
  }
}

export interface TemplateCtx { mention: string; keyword: string; company: string }

export interface OutreachTemplate {
  id: string;
  label: string;
  build: (ctx: TemplateCtx) => string;
}

// Predefined, personalized starting points. The user edits before sending.
export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'intro', label: 'Intro',
    build: ({ mention, keyword }) =>
      `Hey ${mention}, saw your post about ${keyword}. I work on exactly this and have shipped a few similar projects recently — would you be open to a quick chat to see if I can help?`,
  },
  {
    id: 'value', label: 'Value-first',
    build: ({ mention, keyword }) =>
      `Hi ${mention} — quick thought on your ${keyword} question: the fastest win is usually nailing the first version of the workflow before scaling it. Happy to share a short breakdown of how we'd approach it for you. Want me to send it over?`,
  },
  {
    id: 'proof', label: 'Social proof',
    build: ({ mention, keyword, company }) =>
      `Hi ${mention}, we recently helped a team like ${company} with ${keyword} and cut their turnaround time significantly. I'd love to share the case study and see if a similar approach fits what you're building. Open to it?`,
  },
  {
    id: 'short', label: 'One-liner',
    build: ({ mention, keyword }) =>
      `Hey ${mention}! Saw you need help with ${keyword} — mind if I send over a couple of relevant examples?`,
  },
  {
    id: 'followup', label: 'Follow-up',
    build: ({ mention }) =>
      `Hi ${mention}, just following up on my note — happy to share more details whenever works for you. No rush!`,
  },
];

export function emailSubject(keyword: string): string {
  return `Quick note about ${keyword}`;
}

export interface ChannelAction {
  channel: OutreachChannel;
  url: string;
  prefilled: boolean;   // true → the message lands in the destination automatically
  available: boolean;   // false → we lack the info needed (e.g. no email on file)
  hint?: string;        // shown when unavailable, or to explain the copy + paste flow
}

// Build the deep link + behaviour for a given channel and message.
export function buildChannelAction(lead: Lead, channel: OutreachChannel, body: string, subject: string): ChannelAction {
  switch (channel) {
    case 'email': {
      const email = leadEmail(lead);
      return {
        channel, available: !!email, prefilled: true,
        url: `mailto:${email}?subject=${enc(subject)}&body=${enc(body)}`,
        hint: email ? undefined : 'No email on file — run AI Qualification to find one.',
      };
    }
    case 'reddit': {
      const u = redditUsername(lead);
      return {
        channel, available: !!u, prefilled: true,
        url: `https://www.reddit.com/message/compose/?to=${enc(u)}&subject=${enc(subject)}&message=${enc(body)}`,
      };
    }
    case 'twitter': {
      const h = twitterHandle(lead);
      return {
        channel, available: !!h, prefilled: false,
        url: `https://x.com/${enc(h)}`,
        hint: 'X blocks pre-filled DMs — your message is copied, just paste it.',
      };
    }
    case 'linkedin': {
      return {
        channel, available: true, prefilled: false,
        url: linkedinUrl(lead),
        hint: 'LinkedIn blocks pre-filled messages — your message is copied, just paste it.',
      };
    }
  }
}

export const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  email: 'Email', reddit: 'Reddit DM', twitter: 'X / Twitter', linkedin: 'LinkedIn',
};

// The native messaging channel for a lead's platform, plus email when we have an address.
export function channelsForLead(lead: Lead): OutreachChannel[] {
  const list: OutreachChannel[] = [];
  if (lead.platform === 'reddit' || lead.platform === 'twitter' || lead.platform === 'linkedin') {
    list.push(lead.platform);
  }
  list.push('email');
  return list;
}
