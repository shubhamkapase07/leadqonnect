import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, db, functions } from '../lib/firebase';
import { logError } from '../lib/logger';
import { searchApifyPosts, type ApifyPlatform, type RawPost } from '../lib/apify';
import { scoreLead } from '../lib/scoring';
import { loadWorkspace, syncCollection, buildSyncMap, createEnrollment, stopEnrollment as stopEnrollmentDb, subscribeEnrollments, type SequenceEnrollment } from '../lib/db';
import { loadRazorpay, openRazorpayCheckout } from '../lib/razorpay';
import {
  type Assignment, assignmentDocId, normEmail,
  upsertAssignment, deleteAssignment, updateAssignmentStatus,
  subscribeAssignmentsForAssignee, subscribeAssignmentsForAssigneeUid, subscribeAssignmentsForOwner,
  createTeamMemberAccount, deleteTeamMemberAccount,
  type TeamRosterUser, subscribeUserDoc, subscribeTeamRoster,
} from '../lib/db';
import { notify } from '../components/Toaster';
import { openEmail, buildAssignmentEmail } from '../lib/email';

export interface Lead {
  id: string;
  platform: 'reddit' | 'hackernews' | 'twitter' | 'linkedin';
  author: string;
  handle: string;
  avatar?: string;
  title?: string;
  content: string;
  timestamp: string;
  sentiment: 'high' | 'medium' | 'low';
  keywords: string[];
  subreddit?: string;
  status: 'potential' | 'selected' | 'qualified' | 'contacted' | 'replied' | 'meeting' | 'proposal' | 'won' | 'lost' | 'archived';
  aiPitch?: string;
  campaignId?: string;
  postUrl?: string;
  createdUtc?: number;   // original post time (unix seconds) — for time-series analytics

  // Step 3 metrics
  intentScore: number;
  leadQualityScore: number;
  industryMatchScore: number;
  geography: string;

  // Step 5 qualification details
  companyName?: string;
  companyWebsite?: string;
  companyLinkedin?: string;
  employeeCount?: number;
  companyIndustry?: string;
  fundingInfo?: string;
  decisionMakers?: { name: string; title: string; email?: string }[];
  contactDetails?: { email?: string; phone?: string };
  buyingIntentScore?: number;
  budgetPotential?: string;
  responseProbability?: number;
  overallOpportunityScore?: number;
  assignedTo?: string;
  aiSummary?: string;       // one-line qualification rationale
  recommendedAction?: string;
  createdAt?: string;       // ISO timestamp of when the lead was scanned (for analytics)
}

export interface Campaign {
  id: string;
  name: string;
  keywords: string[];
  platforms: ('reddit' | 'twitter' | 'linkedin')[];
  status: 'active' | 'paused';
  createdAt: string;
  leadsCount: number;
  industry: string;
  serviceOffered: string;
  geography: string;
  autoScan?: boolean;          // when true, the backend scans this campaign daily on a schedule
  autoScanTimeframe?: 'day' | 'week' | 'month';
  lastAutoScanAt?: string;     // ISO timestamp of the last successful scheduled scan
}

// --- Outreach sequences (multi-step follow-up cadences) ---
export interface SequenceStep {
  delayDays: number;           // days to wait after the previous step before sending this one
  subject?: string;            // used for email/reddit DM; supports {{name}} {{keyword}} tokens
  body: string;
}
export interface Sequence {
  id: string;
  name: string;
  channel: 'email' | 'reddit';
  steps: SequenceStep[];
  createdAt: string;
}
export type { SequenceEnrollment };

export interface Message {
  id: string;
  sender: 'user' | 'lead';
  content: string;
  timestamp: string;
}

export interface Conversation {
  leadId: string;
  lead: Lead;
  messages: Message[];
  lastUpdated: string;
}

// Human-readable wall-clock time for message/conversation timestamps (e.g. "2:45 PM").
export const formatClockTime = (): string =>
  new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export interface CompetitorMention {
  id: string;
  competitor: string;
  platform: 'reddit' | 'hackernews' | 'twitter' | 'linkedin';
  author: string;
  content: string;
  timestamp: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  postUrl?: string;
}

export interface AlertLog {
  id: string;
  timestamp: string;
  type: 'lead_found' | 'competitor_mention' | 'keyword_spike';
  message: string;
  read: boolean;
}

export interface AlertSettings {
  email: boolean;
  browser: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;      // accent hex used for the member's avatar
  experience?: string; // free text, e.g. "5 yrs · SaaS sales"
  phone?: string;
  resumeName?: string; // original file name (when a CV is attached)
  resumeUrl?: string;  // external link OR a data: URL for an uploaded CV
  uid?: string;        // the teammate's real account uid (set when their child account is created)
  createdAt: string;
}

// Palette cycled through when a new member is added without an explicit color.
export const MEMBER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4',
  '#8b5cf6', '#ef4444', '#0ea5e9', '#84cc16', '#f97316',
];

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'trial' | 'premium' | 'agency';
  status: 'active' | 'suspended';
  joinedAt: string;
  role: 'user' | 'admin';
  teamRole?: 'leader' | 'member';  // team designation set by an admin
  parentUid?: string;              // the leader this member reports to
  razorpay?: { status?: string; tier?: string; activatedAt?: string }; // live billing state, if any
}

// A team = a leader plus everyone whose parentUid points at that leader.
export interface MyTeam {
  leaderUid: string | null;
  leader: TeamRosterUser | null;
  members: TeamRosterUser[];       // includes the signed-in user when they're on the team
}

export interface PlanCapabilities {
  maxCampaigns: number;        // Infinity on Pro
  maxLeadsPerMonth: number;    // Infinity on Pro
  platforms: ('reddit' | 'twitter' | 'linkedin')[];
  ai: boolean;                 // Claude AI qualification
  engagement: boolean;         // reply/comment/DM from the user's own account
  team: boolean;               // team workspace, member logins, lead assignment
  maxTeamMembers: number;      // how many teammates can be added (0 = none, Infinity = unlimited)
  insights: boolean;           // analytics dashboard
  alerts: boolean;             // real-time alerts
  referral: boolean;           // affiliate / referral program
}

interface AppContextType {
  plan: 'free' | 'trial' | 'premium' | 'agency';
  isPro: boolean;
  capabilities: PlanCapabilities;
  leadsUsedThisMonth: number;
  upgradeModalOpen: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  keywords: string[];
  addKeyword: (kw: string) => void;
  removeKeyword: (kw: string) => void;
  leads: Lead[];
  updateLeadStatus: (leadId: string, status: Lead['status']) => void;
  deleteLead: (leadId: string) => void;
  deleteLeads: (leadIds: string[]) => void;
  generatePitch: (lead: Lead) => string;
  sendPitch: (leadId: string, pitchContent: string) => void;
  startFreeTrial: () => void;
  // Razorpay recurring checkout for a paid tier ('pro' → premium, 'agency'). Resolves
  // once payment is verified server-side; the new plan arrives via the user-doc snapshot.
  subscribeToPlan: (tier: 'pro' | 'agency') => Promise<void>;
  conversations: Conversation[];
  addMessageToConversation: (leadId: string, sender: 'user' | 'lead', content: string) => void;
  competitors: string[];
  addCompetitor: (name: string) => void;
  removeCompetitor: (name: string) => void;
  competitorMentions: CompetitorMention[];
  alerts: AlertLog[];
  clearAlerts: () => void;
  markAlertsAsRead: () => void;
  alertSettings: AlertSettings;
  updateAlertSettings: (patch: Partial<AlertSettings>) => void;
  isScanning: boolean;
  scanCount: number;
  connectedPlatforms: string[];
  togglePlatformConnection: (platform: string) => void;
  // Campaigns
  campaigns: Campaign[];
  addCampaign: (name: string, keywords: string[], platforms: Campaign['platforms'], industry: string, serviceOffered: string, geography: string) => void;
  deleteCampaign: (campaignId: string) => void;
  toggleCampaignStatus: (campaignId: string) => void;
  setCampaignAutoScan: (campaignId: string, enabled: boolean) => void;
  triggerScanLeads: (campaignId: string, timeframe?: 'day' | 'week' | 'month') => Promise<void>;
  // Outreach sequences
  sequences: Sequence[];
  enrollments: SequenceEnrollment[];
  createSequence: (name: string, channel: 'email' | 'reddit', steps: SequenceStep[]) => void;
  updateSequence: (id: string, patch: Partial<Omit<Sequence, 'id' | 'createdAt'>>) => void;
  deleteSequence: (id: string) => void;
  enrollLeadInSequence: (leadId: string, sequenceId: string, emailTo?: string) => Promise<void>;
  cancelEnrollment: (enrollmentId: string) => Promise<void>;
  // AI helpers
  suggestKeywords: (serviceOffered: string) => Record<string, string[]>;
  qualifyLead: (leadId: string) => Promise<void>;
  assignLead: (leadId: string, member: string) => void;
  // Team workspace (parent provisions child accounts)
  teamMembers: TeamMember[];
  addTeamMember: (member: { name: string; email?: string; role?: string; color?: string; experience?: string; phone?: string; resumeName?: string; resumeUrl?: string }) => Promise<{ tempPassword?: string; email?: string; error?: string }>;
  updateTeamMember: (id: string, patch: Partial<Omit<TeamMember, 'id' | 'createdAt'>>) => void;
  removeTeamMember: (id: string) => void;
  emailNotifyOnAssign: boolean;
  setEmailNotifyOnAssign: (val: boolean) => void;
  // Leads assigned to the signed-in user from another account (shared via Firestore)
  assignedToMe: Assignment[];
  updateMyAssignmentStatus: (assignmentId: string, status: Lead['status'], note?: string) => void;
  // Auth state
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  firebaseUser: FirebaseUser | null;
  userProfile: { name: string; email: string; photoURL?: string } | null;
  userStatus: 'active' | 'suspended';
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAdminMode: boolean;
  allUsers: AdminUser[];
  updateUserPlan: (userId: string, newPlan: AdminUser['plan']) => void;
  deleteUser: (userId: string) => void;
  suspendUser: (userId: string) => void;
  promoteToAdmin: (userId: string) => void;
  demoteFromAdmin: (userId: string) => void;
  // Team leader/member designation (admin-managed)
  setUserTeamRole: (userId: string, value: 'leader' | 'member' | 'none', leaderUid?: string) => void;
  // The signed-in user's own team (their leader + fellow members)
  myTeamRole: 'leader' | 'member' | null;
  myTeam: MyTeam;
  teamChatEnabled: boolean;
  strictIntentFilter: boolean;
  setStrictIntentFilter: (val: boolean) => void;
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (t: 'light' | 'dark') => void;
  // Reddit account connection (OAuth) — post/reply/DM from the user's own account
  redditAccount: RedditAccount | null;
  redditConnecting: boolean;
  connectReddit: () => Promise<void>;
  disconnectReddit: () => Promise<void>;
  postRedditComment: (thingId: string, text: string) => Promise<{ ok: boolean; permalink?: string }>;
  sendRedditDm: (to: string, subject: string, text: string) => Promise<{ ok: boolean }>;
  // Gmail account connection (OAuth) — send email from the user's own address
  gmailAccount: GmailAccount | null;
  gmailConnecting: boolean;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => Promise<void>;
  sendGmail: (to: string, subject: string, text: string, html?: string) => Promise<{ ok: boolean; id?: string }>;
}

export interface RedditAccount {
  username: string;
  avatar?: string | null;
  scope?: string;
  connectedAt?: string;
}

export interface GmailAccount {
  email: string;
  name?: string | null;
  avatar?: string | null;
  scope?: string;
  connectedAt?: string;
}

// Build keyword sets from whatever the user typed, when no curated domain matches.
// Extracts the core phrase from their description and wraps it in intent templates,
// so "resume" yields resume keywords (not a hardcoded default).
const KW_STOPWORDS = new Set([
  'we', 'i', 'offer', 'offering', 'provide', 'providing', 'build', 'building', 'make', 'making',
  'do', 'doing', 'help', 'helping', 'professional', 'premium', 'quality', 'best', 'expert', 'experts',
  'service', 'services', 'solution', 'solutions', 'company', 'agency', 'agencies', 'freelance',
  'freelancer', 'for', 'to', 'the', 'a', 'an', 'and', 'with', 'your', 'my', 'our', 'that', 'of',
  'in', 'on', 'is', 'are', 'people', 'clients', 'businesses', 'business',
]);

const genericKeywordSets = (raw: string): Record<string, string[]> => {
  const words = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !KW_STOPWORDS.has(w));
  const core = (words.slice(0, 3).join(' ') || raw.trim().toLowerCase() || 'services').trim();
  const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
  return {
    'Primary Keywords': uniq([core, `${core} service`, `${core} expert`, `freelance ${core}`]),
    'Intent Keywords': uniq([`looking for ${core}`, `need ${core}`, `hire ${core} expert`, `recommend ${core} service`, `who can do ${core}`]),
    'Problem Keywords': uniq([`${core} help`, `improve my ${core}`, `${core} not working`, `redo my ${core}`]),
    'Competitor Keywords': uniq([`best ${core} service`, `${core} alternatives`, `top ${core} freelancer`]),
    'Long-tail Keywords': uniq([`looking for freelance ${core}`, `need ${core} for my business`, `where to find ${core} expert`]),
  };
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const ADMIN_EMAIL = 'admin@leadqonnect.com';

// Capabilities per plan tier, mirroring the landing-page pricing plans:
//  • Free  — solo, limited, no team.
//  • Pro   ('trial'/'premium') — full features + up to 3 team members.
//  • Agency — everything in Pro + unlimited team members.
const FREE_CAPABILITIES: PlanCapabilities = {
  maxCampaigns: 1,
  maxLeadsPerMonth: 20,
  platforms: ['reddit'],
  ai: false,
  engagement: false,
  team: false,
  maxTeamMembers: 0,
  insights: false,
  alerts: false,
  referral: false,
};
const PRO_CAPABILITIES: PlanCapabilities = {
  maxCampaigns: 5,
  maxLeadsPerMonth: Infinity,
  platforms: ['reddit', 'twitter', 'linkedin'],
  ai: true,
  engagement: true,
  team: true,
  maxTeamMembers: 3,
  insights: true,
  alerts: true,
  referral: true,
};
const AGENCY_CAPABILITIES: PlanCapabilities = {
  ...PRO_CAPABILITIES,
  maxCampaigns: Infinity,
  maxTeamMembers: Infinity,
};


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plan, setPlan] = useState<'free' | 'trial' | 'premium' | 'agency'>(() => {
    const saved = localStorage.getItem('lq_plan');
    return (saved as 'free' | 'trial' | 'premium' | 'agency') || 'free';
  });

  const [activeTab, setActiveTab] = useState('dashboard');

  const [keywords, setKeywords] = useState<string[]>(() => {
    // Migrate away from old mock data on first run of this version
    const DATA_VERSION = 'v2_clean';
    if (localStorage.getItem('lq_data_version') !== DATA_VERSION) {
      localStorage.removeItem('lq_leads');
      localStorage.removeItem('lq_campaigns');
      localStorage.removeItem('lq_keywords');
      localStorage.setItem('lq_data_version', DATA_VERSION);
    }
    const saved = localStorage.getItem('lq_keywords');
    return saved ? JSON.parse(saved) : [];
  });

  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('lq_leads');
    return saved ? JSON.parse(saved) : [];
  });

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('lq_conversations');
    return saved ? JSON.parse(saved) : [];
  });

  // Outreach sequences (client-owned cadence definitions, synced to Firestore) and the
  // server-driven enrollments (live subscription — the backend advances them).
  const [sequences, setSequences] = useState<Sequence[]>(() => {
    const saved = localStorage.getItem('lq_sequences');
    return saved ? JSON.parse(saved) : [];
  });
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);

  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorMentions] = useState<CompetitorMention[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>(() => {
    const saved = localStorage.getItem('lq_alerts');
    return saved ? JSON.parse(saved) : [];
  });
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() => {
    const saved = localStorage.getItem('lq_alert_settings');
    const defaults: AlertSettings = { email: true, browser: false };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });
  // Mirror settings in a ref so async/timeout alert dispatchers read the latest values, not stale closures.
  const alertSettingsRef = useRef(alertSettings);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const saved = localStorage.getItem('lq_team_members');
    return saved ? JSON.parse(saved) : [];
  });

  const [emailNotifyOnAssign, setEmailNotifyOnAssign] = useState<boolean>(() => {
    const saved = localStorage.getItem('lq_team_email_notify');
    return saved === null ? true : saved === 'true';
  });

  // Leads assigned to me from another account (live from Firestore `assignments`).
  // Matched two ways — by uid (bulletproof once the invite is accepted) and by email
  // (covers assignments made before acceptance) — then merged/deduped by doc id.
  const [assignedByEmail, setAssignedByEmail] = useState<Assignment[]>([]);
  const [assignedByUid, setAssignedByUid] = useState<Assignment[]>([]);
  // Assignments I created as owner, keyed by leadId — lets status sync both ways without loops.
  const ownerAssignmentsRef = useRef<Map<string, Assignment>>(new Map());
  const assignedToMe = useMemo(() => {
    const m = new Map<string, Assignment>();
    [...assignedByUid, ...assignedByEmail].forEach(a => m.set(a.id, a));
    return [...m.values()];
  }, [assignedByEmail, assignedByUid]);

  const [isScanning] = useState(true);
  const [scanCount, setScanCount] = useState(0);

  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>(() => {
    const saved = localStorage.getItem('lq_connected_platforms');
    return saved ? JSON.parse(saved) : ['reddit'];
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem('lq_campaigns');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Firestore persistence (per-user DB for leads/campaigns/conversations) ---
  const [dataLoaded, setDataLoaded] = useState(false);
  const syncMaps = useRef({
    leads: new Map<string, string>(),
    campaigns: new Map<string, string>(),
    conversations: new Map<string, string>(),
    sequences: new Map<string, string>(),
  });

  const [strictIntentFilter, setStrictIntentFilterState] = useState<boolean>(() => {
    const saved = localStorage.getItem('lq_strict_intent_filter');
    return saved === null ? true : saved === 'true';
  });

  const setStrictIntentFilter = (val: boolean) => {
    setStrictIntentFilterState(val);
    localStorage.setItem('lq_strict_intent_filter', String(val));
  };

  // --- Plan capabilities (gating) ---
  // Any paid tier (trial / premium / agency) unlocks the Pro feature set; Agency adds unlimited seats.
  const isPro = plan === 'trial' || plan === 'premium' || plan === 'agency';
  const capabilities = plan === 'agency' ? AGENCY_CAPABILITIES : isPro ? PRO_CAPABILITIES : FREE_CAPABILITIES;

  // Leads created in the current calendar month (drives the Free monthly cap).
  const leadsUsedThisMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return leads.filter(l => {
      if (!l.createdAt) return false;
      const d = new Date(l.createdAt);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [leads]);

  // Global upgrade modal — any gated action can prompt the user to upgrade.
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const openUpgradeModal = () => setUpgradeModalOpen(true);
  const closeUpgradeModal = () => setUpgradeModalOpen(false);

  // --- Reddit account connection (OAuth via Cloud Functions) ---
  const [redditAccount, setRedditAccount] = useState<RedditAccount | null>(null);
  const [redditConnecting, setRedditConnecting] = useState(false);
  const [gmailAccount, setGmailAccount] = useState<GmailAccount | null>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);

  // --- Theme (light default; persisted) ---
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lq_theme');
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lq_theme', theme);
  }, [theme]);

  const setTheme = (t: 'light' | 'dark') => setThemeState(t);
  const toggleTheme = () => setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));

  // --- Firebase Auth State ---
  // (declared early so the Reddit helpers below can read firebaseUser)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin state
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [userStatus, setUserStatus] = useState<'active' | 'suspended'>('active');
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');

  // Team membership for the signed-in user (set by an admin via parentUid / teamRole).
  const [myTeamRole, setMyTeamRole] = useState<'leader' | 'member' | null>(null);
  const [myParentUid, setMyParentUid] = useState<string | null>(null);
  const [teamLeaderDoc, setTeamLeaderDoc] = useState<TeamRosterUser | null>(null);
  const [teamRoster, setTeamRoster] = useState<TeamRosterUser[]>([]);

  // Derived state (moved up for safe lexical references)
  const isAuthenticated = !!firebaseUser;
  // Admin = a user whose Firestore role is 'admin', OR the permanent bootstrap admin email
  // (kept so there's always at least one admin who can promote/demote others).
  const isAdminMode = !!(firebaseUser && (userRole === 'admin' || firebaseUser.email === ADMIN_EMAIL));
  const userProfile = firebaseUser
    ? {
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || undefined
      }
    : null;

  // Helper to sync user profile in Firestore
  const syncUserProfile = async (user: FirebaseUser, defaultName?: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          id: user.uid,
          name: user.displayName || defaultName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          plan: 'free',
          status: 'active',
          role: user.email === ADMIN_EMAIL ? 'admin' : 'user',
          joinedAt: new Date().toISOString().split('T')[0]
        });
        // Attribute this new signup to the referrer whose link they arrived with.
        try {
          const refCode = typeof localStorage !== 'undefined' ? localStorage.getItem('pendingReferral') : null;
          if (refCode) {
            await httpsCallable(functions, 'claimReferral')({ code: refCode });
            localStorage.removeItem('pendingReferral');
          }
        } catch (e) {
          console.warn('referral claim failed (continuing):', e);
        }
      } else {
        const data = userSnap.data();
        if (!data.name || data.name === 'User') {
          await updateDoc(userRef, {
            name: user.displayName || defaultName || user.email?.split('@')[0] || 'User'
          });
        }
      }
    } catch (err) {
      console.error("Error syncing user profile:", err);
    }
  };

  // Subscribe to Firebase auth state changes and sync user info real-time
  useEffect(() => {
    let unsubDoc: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Sync profile to database
        await syncUserProfile(user);

        // Listen to changes on the user's document
        const userRef = doc(db, 'users', user.uid);
        unsubDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPlan(data.plan || 'free');
            setUserStatus(data.status || 'active');
            setUserRole(data.role === 'admin' ? 'admin' : 'user');
            setRedditAccount((data.reddit as RedditAccount) || null);
            setGmailAccount((data.gmail as GmailAccount) || null);
            setMyTeamRole(data.teamRole === 'leader' ? 'leader' : data.teamRole === 'member' ? 'member' : (data.parentUid ? 'member' : null));
            setMyParentUid((data.parentUid as string) || null);
          }
          setIsAuthLoading(false);
        }, (err) => {
          console.error("Error listening to user doc:", err);
          setIsAuthLoading(false);
        });
      } else {
        setPlan('free');
        setUserStatus('active');
        setUserRole('user');
        setRedditAccount(null);
        setGmailAccount(null);
        setMyTeamRole(null);
        setMyParentUid(null);
        setIsAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  // --- Reddit OAuth helpers ---
  const connectReddit = async () => {
    if (!firebaseUser) return;
    // Engaging from your own account (reply/comment/DM) is a Pro feature.
    if (!capabilities.engagement) {
      notify('Connecting your Reddit account to reply & DM leads is a Pro feature.', 'info', 6000);
      openUpgradeModal();
      return;
    }
    const clientId = import.meta.env.VITE_REDDIT_CLIENT_ID as string | undefined;
    const redirectUri = import.meta.env.VITE_REDDIT_REDIRECT_URI as string | undefined;
    if (!clientId || !redirectUri || clientId.includes('PASTE_')) {
      notify('Reddit connection isn’t configured yet. Add your VITE_REDDIT_CLIENT_ID and deploy the Cloud Functions (see SETUP.md).', 'error', 7000);
      return;
    }
    setRedditConnecting(true);
    try {
      // Store a one-time nonce on the user doc; the callback function verifies it (CSRF guard).
      const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await updateDoc(doc(db, 'users', firebaseUser.uid), { redditOauthNonce: nonce });
      const state = btoa(JSON.stringify({ uid: firebaseUser.uid, nonce }));
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        state,
        redirect_uri: redirectUri,
        duration: 'permanent',
        scope: 'identity submit privatemessages read',
      });
      window.location.href = `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
    } catch (err) {
      console.error('connectReddit failed:', err);
      setRedditConnecting(false);
    }
  };

  const disconnectReddit = async () => {
    setRedditConnecting(true);
    try {
      await httpsCallable(functions, 'redditDisconnect')();
      setRedditAccount(null);
    } catch (err) {
      console.error('disconnectReddit failed:', err);
    } finally {
      setRedditConnecting(false);
    }
  };

  const postRedditComment = async (thingId: string, text: string) => {
    if (!capabilities.engagement) {
      openUpgradeModal();
      throw new Error('Replying from your account is a Pro feature. Upgrade to Pro to engage leads.');
    }
    const res = await httpsCallable(functions, 'redditPostComment')({ thingId, text });
    return res.data as { ok: boolean; permalink?: string };
  };

  const sendRedditDm = async (to: string, subject: string, text: string) => {
    if (!capabilities.engagement) {
      openUpgradeModal();
      throw new Error('Sending DMs from your account is a Pro feature. Upgrade to Pro to engage leads.');
    }
    const res = await httpsCallable(functions, 'redditSendMessage')({ to, subject, text });
    return res.data as { ok: boolean };
  };

  // --- Gmail OAuth helpers ---
  const connectGmail = async () => {
    if (!firebaseUser) return;
    // Sending email from your own account is a Pro feature (same gate as Reddit engagement).
    if (!capabilities.engagement) {
      notify('Connecting Gmail to email leads from your own address is a Pro feature.', 'info', 6000);
      openUpgradeModal();
      return;
    }
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI as string | undefined;
    if (!clientId || !redirectUri || clientId.includes('your_google')) {
      notify('Gmail connection isn’t configured yet. Add your VITE_GOOGLE_CLIENT_ID and deploy the Cloud Functions (see SETUP.md).', 'error', 7000);
      return;
    }
    setGmailConnecting(true);
    try {
      // One-time nonce on the user doc; the callback function verifies it (CSRF guard).
      const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await updateDoc(doc(db, 'users', firebaseUser.uid), { gmailOauthNonce: nonce });
      const state = btoa(JSON.stringify({ uid: firebaseUser.uid, nonce }));
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        state,
        scope: 'openid email https://www.googleapis.com/auth/gmail.send',
        access_type: 'offline',   // request a refresh token...
        prompt: 'consent',        // ...and force the consent screen so we always get one
        include_granted_scopes: 'true',
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } catch (err) {
      console.error('connectGmail failed:', err);
      setGmailConnecting(false);
    }
  };

  const disconnectGmail = async () => {
    setGmailConnecting(true);
    try {
      await httpsCallable(functions, 'gmailDisconnect')();
      setGmailAccount(null);
    } catch (err) {
      console.error('disconnectGmail failed:', err);
    } finally {
      setGmailConnecting(false);
    }
  };

  const sendGmail = async (to: string, subject: string, text: string, html?: string) => {
    if (!capabilities.engagement) {
      openUpgradeModal();
      throw new Error('Emailing leads from your account is a Pro feature. Upgrade to Pro to engage leads.');
    }
    const res = await httpsCallable(functions, 'gmailSendEmail')({ to, subject, text, html });
    return res.data as { ok: boolean; id?: string };
  };

  // Surface the OAuth round-trip result (?reddit=connected|denied|error) as an alert, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('reddit');
    if (!status) return;
    const messages: Record<string, string> = {
      connected: 'Reddit account connected — you can now reply and DM from your account.',
      denied: 'Reddit connection was cancelled.',
      error: 'Reddit connection failed. Please try again.',
    };
    const msg = messages[status] || `Reddit: ${status}`;
    setRedditConnecting(false);
    notify(msg, status === 'connected' ? 'success' : status === 'denied' ? 'info' : 'error', 6000);
    pushAlert('lead_found', msg);
    params.delete('reddit');
    const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', clean);
  }, []);

  // Surface the Gmail OAuth round-trip result (?gmail=connected|denied|error), then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('gmail');
    if (!status) return;
    const messages: Record<string, string> = {
      connected: 'Gmail connected — you can now email leads from your own address.',
      denied: 'Gmail connection was cancelled.',
      error: 'Gmail connection failed. Please try again.',
    };
    const msg = messages[status] || `Gmail: ${status}`;
    setGmailConnecting(false);
    notify(msg, status === 'connected' ? 'success' : status === 'denied' ? 'info' : 'error', 6000);
    pushAlert('lead_found', msg);
    params.delete('gmail');
    const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', clean);
  }, []);

  // Capture an incoming referral (?ref=CODE): remember it for signup attribution and
  // count the click once per code per browser, then strip it from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('ref') || '').trim().toLowerCase();
    if (!code) return;
    try {
      localStorage.setItem('pendingReferral', code);
      const seenKey = `refClick_${code}`;
      if (!localStorage.getItem(seenKey)) {
        httpsCallable(functions, 'trackReferralClick')({ code }).catch(() => undefined);
        localStorage.setItem(seenKey, '1');
      }
    } catch { /* localStorage unavailable — skip */ }
    params.delete('ref');
    const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', clean);
  }, []);

  // Listen to all users if current user is admin (real-time subscription)
  useEffect(() => {
    if (!isAdminMode) {
      setAllUsers([]);
      return;
    }
    const usersCol = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const usersList: AdminUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email !== ADMIN_EMAIL) {
          usersList.push({
            id: doc.id,
            name: data.name || 'User',
            email: data.email || '',
            plan: data.plan || 'free',
            status: data.status || 'active',
            joinedAt: data.joinedAt || '',
            role: data.role === 'admin' ? 'admin' : 'user',
            teamRole: data.teamRole === 'leader' ? 'leader' : data.teamRole === 'member' ? 'member' : (data.parentUid ? 'member' : undefined),
            parentUid: (data.parentUid as string) || undefined,
            razorpay: data.razorpay || undefined,
          });
        }
      });
      setAllUsers(usersList);
    }, (err) => {
      console.error("Error listening to all users:", err);
    });
    return unsubscribe;
  }, [isAdminMode]);

  // Sync plan per user in local storage as backup
  useEffect(() => {
    if (firebaseUser) {
      localStorage.setItem(`lq_plan_${firebaseUser.uid}`, plan);
    }
  }, [plan, firebaseUser]);

  useEffect(() => {
    localStorage.setItem('lq_connected_platforms', JSON.stringify(connectedPlatforms));
  }, [connectedPlatforms]);

  useEffect(() => {
    localStorage.setItem('lq_keywords', JSON.stringify(keywords));
  }, [keywords]);

  useEffect(() => {
    localStorage.setItem('lq_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('lq_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('lq_sequences', JSON.stringify(sequences));
  }, [sequences]);

  useEffect(() => {
    localStorage.setItem('lq_campaigns', JSON.stringify(campaigns));
  }, [campaigns]);

  // Keep only the most recent 50 alerts in storage so the log doesn't grow unbounded.
  useEffect(() => {
    localStorage.setItem('lq_alerts', JSON.stringify(alerts.slice(0, 50)));
  }, [alerts]);

  useEffect(() => {
    alertSettingsRef.current = alertSettings;
    localStorage.setItem('lq_alert_settings', JSON.stringify(alertSettings));
  }, [alertSettings]);

  useEffect(() => {
    try {
      localStorage.setItem('lq_team_members', JSON.stringify(teamMembers));
    } catch {
      // Most likely the storage quota was exceeded by large inline résumé files.
      notify('Could not save team data — a résumé file may be too large. Use a link instead.', 'error', 6000);
    }
  }, [teamMembers]);

  useEffect(() => {
    localStorage.setItem('lq_team_email_notify', String(emailNotifyOnAssign));
  }, [emailNotifyOnAssign]);

  // --- Live "my team" roster (leader + fellow members), driven by parentUid ---
  // A leader's team is keyed by their own uid; a member's by their leader's uid.
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) { setTeamLeaderDoc(null); setTeamRoster([]); return; }
    const leaderUid = myTeamRole === 'leader' ? uid : myParentUid;
    if (!leaderUid) { setTeamLeaderDoc(null); setTeamRoster([]); return; }
    const unsubLeader = subscribeUserDoc(leaderUid, doc => setTeamLeaderDoc(doc));
    const unsubRoster = subscribeTeamRoster(leaderUid, rows => setTeamRoster(rows));
    return () => { unsubLeader(); unsubRoster(); };
  }, [firebaseUser?.uid, myTeamRole, myParentUid]);

  const myTeam = useMemo<MyTeam>(() => {
    const leaderUid = myTeamRole === 'leader' ? (firebaseUser?.uid || null) : myParentUid;
    return { leaderUid, leader: teamLeaderDoc, members: teamRoster };
  }, [myTeamRole, myParentUid, firebaseUser?.uid, teamLeaderDoc, teamRoster]);

  // Team chat is an Agency feature, gated by the team LEADER's plan (members are typically free).
  const teamChatEnabled = useMemo(() => {
    if (!myTeam.leaderUid) return false;
    if (myTeamRole === 'leader') return plan === 'agency';
    return teamLeaderDoc?.plan === 'agency';
  }, [myTeam.leaderUid, myTeamRole, plan, teamLeaderDoc]);

  // --- Live shared-assignment subscriptions (cross-account lead sharing) ---
  useEffect(() => {
    const email = firebaseUser?.email;
    const uid = firebaseUser?.uid;
    if (!email || !uid) {
      setAssignedByEmail([]); setAssignedByUid([]);
      ownerAssignmentsRef.current = new Map();
      return;
    }
    // Leads assigned TO me — by uid (children created with a real account) and by email (fallback).
    const unsubByEmail = subscribeAssignmentsForAssignee(email, rows => setAssignedByEmail(rows));
    const unsubByUid = subscribeAssignmentsForAssigneeUid(uid, rows => setAssignedByUid(rows));

    // Assignments I made — keep a leadId→record map and reflect assignee status changes locally.
    const unsubOwner = subscribeAssignmentsForOwner(uid, rows => {
      const map = new Map<string, Assignment>();
      rows.forEach(r => map.set(r.leadId, r));
      ownerAssignmentsRef.current = map;
      setLeads(prev => {
        let changed = false;
        const next = prev.map(l => {
          const a = map.get(l.id);
          if (a && a.status && a.status !== l.status) { changed = true; return { ...l, status: a.status as Lead['status'] }; }
          return l;
        });
        return changed ? next : prev;
      });
    });

    return () => { unsubByEmail(); unsubByUid(); unsubOwner(); };
  }, [firebaseUser?.uid, firebaseUser?.email]);

  // --- Load the per-user workspace from Firestore on login (real DB, cross-device) ---
  // Signed-out state stays on localStorage only.
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) {
      setDataLoaded(false);
      return;
    }
    let cancelled = false;
    setDataLoaded(false);
    (async () => {
      try {
        const ws = await loadWorkspace(uid);
        if (cancelled) return;
        const hasRemote = ws.leads.length || ws.campaigns.length || ws.conversations.length || ws.sequences.length;
        if (hasRemote) {
          // Firestore is the source of truth — adopt it and seed the diff maps so we don't re-upload.
          setLeads(ws.leads as Lead[]);
          setCampaigns(ws.campaigns as Campaign[]);
          setConversations(ws.conversations as Conversation[]);
          setSequences(ws.sequences as Sequence[]);
          syncMaps.current.leads = buildSyncMap(ws.leads, 'id');
          syncMaps.current.campaigns = buildSyncMap(ws.campaigns, 'id');
          syncMaps.current.conversations = buildSyncMap(ws.conversations, 'leadId');
          syncMaps.current.sequences = buildSyncMap(ws.sequences, 'id');
        } else {
          // First run on this account — empty maps so existing local data migrates up on first sync.
          syncMaps.current.leads = new Map();
          syncMaps.current.campaigns = new Map();
          syncMaps.current.conversations = new Map();
          syncMaps.current.sequences = new Map();
        }
      } catch (err) {
        console.error('Failed to load workspace from Firestore:', err);
      } finally {
        if (!cancelled) setDataLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);

  // --- Mirror state changes to Firestore (diff-sync; only changed/removed docs are written) ---
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !dataLoaded) return;
    syncCollection(uid, 'leads', leads, 'id', syncMaps.current.leads).catch(err => console.error('lead sync failed:', err));
  }, [leads, dataLoaded, firebaseUser?.uid]);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !dataLoaded) return;
    syncCollection(uid, 'campaigns', campaigns, 'id', syncMaps.current.campaigns).catch(err => console.error('campaign sync failed:', err));
  }, [campaigns, dataLoaded, firebaseUser?.uid]);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !dataLoaded) return;
    syncCollection(uid, 'conversations', conversations, 'leadId', syncMaps.current.conversations).catch(err => console.error('conversation sync failed:', err));
  }, [conversations, dataLoaded, firebaseUser?.uid]);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !dataLoaded) return;
    syncCollection(uid, 'sequences', sequences, 'id', syncMaps.current.sequences).catch(err => logError('sequenceSync', err));
  }, [sequences, dataLoaded, firebaseUser?.uid]);

  // Live subscription to server-driven sequence enrollments.
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) { setEnrollments([]); return; }
    return subscribeEnrollments(uid, setEnrollments);
  }, [firebaseUser?.uid]);


  // --- Auth functions (Firebase) ---
  const login = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      // If admin account doesn't exist yet, auto-create it on first use
      if (
        email === ADMIN_EMAIL &&
        (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')
      ) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: 'Admin' });
          await syncUserProfile(cred.user, 'Admin');
          return; // success — onAuthStateChanged will fire
        } catch (createErr: any) {
          const msg = friendlyAuthError(createErr.code);
          setAuthError(msg);
          throw new Error(msg);
        }
      }
      const msg = friendlyAuthError(err.code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await syncUserProfile(cred.user, name);
      // Force refresh so displayName is picked up immediately
      setFirebaseUser({ ...cred.user, displayName: name } as FirebaseUser);
    } catch (err: any) {
      const msg = friendlyAuthError(err.code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') return;
      const msg = friendlyAuthError(err.code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const clearAuthError = () => setAuthError(null);

  // --- App functions ---
  const addKeyword = (kw: string) => {
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };

  // True only for a real, signed-in (non-demo) account that can read/write Firestore.
  const canShareAssignments = () => !!firebaseUser;

  const updateLeadStatus = (leadId: string, status: Lead['status']) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    if (status === 'archived') {
      setConversations(prev => prev.filter(c => c.leadId !== leadId));
    }
    // If this lead is shared with a teammate, push the new status to their copy.
    if (canShareAssignments()) {
      const existing = ownerAssignmentsRef.current.get(leadId);
      if (existing && existing.status !== status) {
        updateAssignmentStatus(existing.id, status).catch(err => console.error('assignment status push failed:', err));
      }
    }
  };

  // Permanently remove one or more leads (and any conversations / shared assignments tied to them).
  const deleteLeads = (leadIds: string[]) => {
    const ids = new Set(leadIds);
    setLeads(prev => prev.filter(l => !ids.has(l.id)));
    setConversations(prev => prev.filter(c => !ids.has(c.leadId)));
    if (canShareAssignments()) {
      leadIds.forEach(id => {
        if (ownerAssignmentsRef.current.has(id)) {
          deleteAssignment(firebaseUser!.uid, id).catch(err => console.error('assignment delete failed:', err));
        }
      });
    }
  };
  const deleteLead = (leadId: string) => deleteLeads([leadId]);

  const generatePitch = (lead: Lead): string => {
    const service = lead.keywords[0] || 'services';
    const isReddit = lead.platform === 'reddit';
    const greet = isReddit ? `Hey ${lead.handle}!` : `Hi ${lead.author},`;
    return `${greet} I saw your post looking for help with ${service}. I specialize in this exact area and have successfully completed several similar projects.\n\nI would love to help you out with this. You can view some of my recent work in my profile.\n\nWould you be open to a quick 10-minute chat or DM to discuss what you need built and how we can implement it? Let me know!`;
  };

  const sendPitch = (leadId: string, pitchContent: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    updateLeadStatus(leadId, 'contacted');

    const newConv: Conversation = {
      leadId,
      lead: { ...lead, status: 'contacted', aiPitch: pitchContent },
      messages: [
        {
          id: 'm_' + Date.now() + '_1',
          sender: 'user',
          content: pitchContent,
          timestamp: formatClockTime()
        }
      ],
      lastUpdated: formatClockTime()
    };

    setConversations(prev => {
      const exists = prev.some(c => c.leadId === leadId);
      if (exists) return prev;
      return [newConv, ...prev];
    });

    setTimeout(() => {
      addMessageToConversation(
        leadId,
        'lead',
        `Thanks for reaching out! Your portfolio looks really neat and fits what we're looking for. Are you free to hop on a call tomorrow at 2 PM EST?`
      );
      pushAlert('lead_found', `Prospect ${lead.author} replied to your pitch!`);
    }, 20000);
  };

  const addMessageToConversation = (leadId: string, sender: 'user' | 'lead', content: string) => {
    const stamp = formatClockTime();
    setConversations(prev => prev.map(conv => {
      if (conv.leadId === leadId) {
        return {
          ...conv,
          messages: [...conv.messages, { id: 'msg_' + Date.now() + '_' + Math.round(Math.random() * 1000), sender, content, timestamp: stamp }],
          lastUpdated: stamp
        };
      }
      return conv;
    }));
  };

  const startFreeTrial = () => setPlan('trial');

  // Real recurring billing via Razorpay. Creates a subscription server-side, opens
  // Checkout, then verifies the signed result — which flips `plan` on the user doc
  // (so the change streams back through the auth-doc snapshot; we don't setPlan here).
  const subscribeToPlan = async (tier: 'pro' | 'agency') => {
    if (!firebaseUser) {
      notify('Please sign in before upgrading.', 'error', 5000);
      throw new Error('Not signed in.');
    }
    try {
      await loadRazorpay();

      const create = httpsCallable(functions, 'createRazorpaySubscription');
      const created: any = await create({ tier });
      const { subscriptionId, keyId } = (created.data || {}) as { subscriptionId?: string; keyId?: string };
      if (!subscriptionId || !keyId) {
        throw new Error('Could not start checkout. Billing may not be configured yet.');
      }

      const result = await openRazorpayCheckout({
        key: keyId,
        subscription_id: subscriptionId,
        name: 'LeadQonnect',
        description: tier === 'agency' ? 'Agency plan — $149/mo' : 'Pro plan — $49/mo',
        theme: { color: '#10b981' },
        prefill: {
          name: firebaseUser.displayName || undefined,
          email: firebaseUser.email || undefined,
        },
        notes: { tier },
      });

      const verify = httpsCallable(functions, 'verifyRazorpaySubscription');
      await verify({
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_subscription_id: result.razorpay_subscription_id,
        razorpay_signature: result.razorpay_signature,
      });

      notify(
        tier === 'agency' ? 'Welcome to Agency! Your plan is active.' : 'Welcome to Pro! Your plan is active.',
        'success',
        5000
      );
    } catch (err: any) {
      const code = err?.code as string | undefined;
      const detail = (err?.message || '').toString();
      let msg = detail || 'Payment could not be completed.';
      if (detail === 'Payment cancelled.') {
        // User closed the sheet — stay quiet, just surface a gentle note.
        notify('Checkout cancelled — no charge was made.', 'info', 4000);
        throw err;
      }
      if (code === 'functions/not-found') {
        msg = "Billing isn't deployed yet. Run: firebase deploy --only functions";
      } else if (code === 'functions/failed-precondition') {
        msg = 'Billing is not configured yet. Add your Razorpay keys & plan ids (see SETUP.md).';
      } else if (code === 'functions/unauthenticated') {
        msg = 'Please sign in again, then retry.';
      }
      logError('subscribeToPlan', err, { tier, code });
      notify(msg, 'error', 7000);
      throw err;
    }
  };

  const addCompetitor = (name: string) => {
    if (name && !competitors.includes(name)) {
      setCompetitors(prev => [...prev, name]);
    }
  };

  const removeCompetitor = (name: string) => {
    setCompetitors(prev => prev.filter(n => n !== name));
  };

  const clearAlerts = () => setAlerts([]);
  const markAlertsAsRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));

  const updateAlertSettings = (patch: Partial<AlertSettings>) => {
    setAlertSettings(prev => {
      const next = { ...prev, ...patch };
      alertSettingsRef.current = next;
      return next;
    });
  };

  // Single entry point for raising an alert: records it and fans out to the enabled channels.
  const pushAlert = (type: AlertLog['type'], message: string) => {
    const alert: AlertLog = { id: 'a_' + Date.now() + '_' + Math.round(performance.now()), timestamp: 'Just now', type, message, read: false };
    setAlerts(prev => [alert, ...prev]);

    const s = alertSettingsRef.current;
    if (s.browser && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('LeadQonnect', { body: message }); } catch { /* ignore */ }
    }
  };

  const togglePlatformConnection = (platform: string) => {
    setConnectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  // --- Campaign functions ---
  const addCampaign = (name: string, keywords: string[], platforms: Campaign['platforms'], industry: string, serviceOffered: string, geography: string) => {
    // Free plan: capped number of campaigns.
    if (campaigns.length >= capabilities.maxCampaigns) {
      notify(`Your plan includes ${capabilities.maxCampaigns} campaign${capabilities.maxCampaigns === 1 ? '' : 's'}. Upgrade ${isPro ? 'to Agency for unlimited campaigns' : 'to Pro for more'}.`, 'info', 6000);
      openUpgradeModal();
      return;
    }
    // Free plan: only the platforms the plan permits (extra ones are dropped).
    const allowedPlatforms = platforms.filter(p => capabilities.platforms.includes(p));
    const finalPlatforms = (allowedPlatforms.length ? allowedPlatforms : ['reddit']) as Campaign['platforms'];
    const newCampaign: Campaign = {
      id: 'c_' + Date.now(),
      name, keywords, platforms: finalPlatforms,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      leadsCount: 0,
      industry,
      serviceOffered,
      geography
    };
    setCampaigns(prev => [newCampaign, ...prev]);
  };

  const deleteCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
  };

  const toggleCampaignStatus = (campaignId: string) => {
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId ? { ...c, status: c.status === 'active' ? 'paused' : 'active' } : c
    ));
  };

  // Enable/disable backend scheduled scanning for a campaign. Auto-scan is a paid feature
  // (the scheduled Cloud Function only runs it for premium/agency users), so free users are
  // nudged to upgrade instead.
  const setCampaignAutoScan = (campaignId: string, enabled: boolean) => {
    if (enabled && !capabilities.ai) {
      openUpgradeModal();
      return;
    }
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId
        ? { ...c, autoScan: enabled, autoScanTimeframe: c.autoScanTimeframe || 'week' }
        : c
    ));
    notify(
      enabled ? 'Auto-scan on — this campaign will scan automatically every day.' : 'Auto-scan turned off.',
      enabled ? 'success' : 'info',
    );
  };

  // --- Outreach sequences ---
  const createSequence = (name: string, channel: 'email' | 'reddit', steps: SequenceStep[]) => {
    if (!capabilities.ai) { openUpgradeModal(); return; }
    const seq: Sequence = {
      id: 'seq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: name.trim() || 'Untitled sequence',
      channel,
      steps: steps.length ? steps : [{ delayDays: 0, subject: '', body: '' }],
      createdAt: new Date().toISOString(),
    };
    setSequences(prev => [seq, ...prev]);
    notify('Sequence created.', 'success');
  };

  const updateSequence = (id: string, patch: Partial<Omit<Sequence, 'id' | 'createdAt'>>) => {
    setSequences(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const deleteSequence = (id: string) => {
    setSequences(prev => prev.filter(s => s.id !== id));
  };

  // Enroll a lead into a sequence. The backend (processSequences) then sends each step on
  // schedule from the user's connected Gmail/Reddit account.
  const enrollLeadInSequence = async (leadId: string, sequenceId: string, emailTo?: string): Promise<void> => {
    const uid = firebaseUser?.uid;
    if (!uid) { notify('Please sign in to use sequences.', 'error'); return; }
    const seq = sequences.find(s => s.id === sequenceId);
    const lead = leads.find(l => l.id === leadId);
    if (!seq || !lead) { notify('Could not find that lead or sequence.', 'error'); return; }

    let to = '';
    if (seq.channel === 'reddit') {
      if (lead.platform !== 'reddit') { notify('Reddit sequences can only be used on Reddit leads.', 'error'); return; }
      if (!redditAccount) { notify('Connect your Reddit account first (Settings) to run Reddit sequences.', 'error'); return; }
      to = (lead.handle || lead.author || '').replace(/^\/?u\//, '');
    } else {
      to = (emailTo || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { notify('Enter a valid email address to enroll this lead.', 'error'); return; }
      if (!gmailAccount) { notify('Connect your Gmail account first (Settings) to run email sequences.', 'error'); return; }
    }
    if (!to) { notify('No recipient available for this lead.', 'error'); return; }

    const firstDelay = Number(seq.steps[0]?.delayDays) || 0;
    const enrollment: SequenceEnrollment = {
      id: `${leadId}__${sequenceId}`,
      leadId,
      leadAuthor: lead.author || lead.handle || 'lead',
      sequenceId,
      sequenceName: seq.name,
      channel: seq.channel,
      to,
      currentStep: 0,
      totalSteps: seq.steps.length,
      status: 'active',
      nextRunAt: new Date(Date.now() + firstDelay * 86_400_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    try {
      await createEnrollment(uid, enrollment);
      notify(`${lead.author || 'Lead'} enrolled in "${seq.name}".`, 'success');
    } catch (err) {
      logError('enrollLeadInSequence', err, { leadId, sequenceId });
      notify('Could not enroll the lead — try again.', 'error');
    }
  };

  const cancelEnrollment = async (enrollmentId: string): Promise<void> => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    try {
      await stopEnrollmentDb(uid, enrollmentId);
      notify('Sequence stopped for this lead.', 'info');
    } catch (err) {
      logError('cancelEnrollment', err, { enrollmentId });
    }
  };

  const getRelativeTime = (createdUtc: number): string => {
    const diff = Math.floor(Date.now() / 1000 - createdUtc);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const triggerScanLeads = async (campaignId: string, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<void> => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    const newLeads: Lead[] = [];
    let totalFetched = 0;

    try {
      // Loop over the campaign's active platforms. Each platform is scraped with REAL data
      // via the server-side `scrapeLeads` Cloud Function (Apify). See src/lib/apify.ts.
      // If scanning is unconfigured or a run returns nothing, that platform simply yields
      // no leads — we never fabricate data.
      // Only scan platforms the current plan permits (Free = Reddit only).
      const scanPlatforms = campaign.platforms.filter(p => capabilities.platforms.includes(p));
      for (const platform of scanPlatforms) {
        // Fetch every keyword for this platform in parallel.
        const platformResults = await Promise.all(
          campaign.keywords.map(kw => searchApifyPosts(platform as ApifyPlatform, kw, timeframe))
        );

        platformResults.forEach((posts: RawPost[], kwIndex) => {
          const keyword = campaign.keywords[kwIndex];
          const safePosts = Array.isArray(posts) ? posts : [];
          totalFetched += safePosts.length;

          safePosts.forEach((post: RawPost) => {
            const id = `l_${platform}_${post.id}`;
            if (newLeads.some(n => n.id === id)) return;
            if (leads.some(existing => existing.id === id)) return;

            const title = post.title || '';
            const content = post.text || post.title || '';

            // Precise, deterministic scoring from the post text vs the campaign target.
            const scores = scoreLead(`${title}\n${content}`, {
              keywords: campaign.keywords,
              serviceOffered: campaign.serviceOffered,
              industry: campaign.industry,
              geography: campaign.geography,
            });
            const sentiment = scores.sentiment;

            // Apply strict filtering or low filtering
            if (strictIntentFilter && sentiment !== 'high') return;
            if (!strictIntentFilter && sentiment === 'low') return;

            const lead: Lead = {
              id,
              platform: platform as Lead['platform'],
              author: post.author,
              handle: post.author,
              title,
              content,
              timestamp: getRelativeTime(post.createdUtc),
              createdUtc: post.createdUtc,
              sentiment,
              keywords: [keyword],
              subreddit: post.subreddit,
              status: 'potential',
              campaignId,
              postUrl: post.postUrl,
              intentScore: scores.intentScore,
              leadQualityScore: scores.leadQualityScore,
              industryMatchScore: scores.industryMatchScore,
              geography: campaign.geography || 'Remote',
              createdAt: new Date().toISOString(),
            };
            lead.aiPitch = generatePitch(lead);
            newLeads.push(lead);
          });
        });
      }
    } catch (err) {
      logError('scanLeads', err, { campaignId, timeframe });
      notify('Scan failed — please try again in a moment.', 'error');
    }

    newLeads.sort((a, b) => {
      const order = { high: 2, medium: 1, low: 0 };
      return order[b.sentiment] - order[a.sentiment];
    });

    // Free plan: cap how many leads can be saved per calendar month.
    let admittedLeads = newLeads;
    let monthlyCapped = false;
    if (capabilities.maxLeadsPerMonth !== Infinity) {
      const remaining = Math.max(0, capabilities.maxLeadsPerMonth - leadsUsedThisMonth);
      if (newLeads.length > remaining) {
        admittedLeads = newLeads.slice(0, remaining);
        monthlyCapped = true;
      }
    }

    const countAdded = admittedLeads.length;
    if (countAdded > 0) {
      setLeads(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        return [...admittedLeads.filter(l => !existingIds.has(l.id)), ...prev];
      });
    }

    if (monthlyCapped) {
      notify(`You've reached the Free plan limit of ${capabilities.maxLeadsPerMonth} leads this month. Upgrade to Pro for unlimited leads.`, 'info', 6000);
      openUpgradeModal();
    }

    setScanCount(prev => prev + totalFetched);
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId ? { ...c, leadsCount: c.leadsCount + countAdded } : c
    ));

    const platformAlertLabels: Record<string, string> = {
      reddit: 'Reddit',
      twitter: 'Twitter',
      linkedin: 'LinkedIn'
    };

    const scannedPlatformsStr = campaign.platforms
      .map(p => platformAlertLabels[p] || p)
      .join(', ');

    pushAlert('lead_found', `Scanned "${campaign.name}" on ${scannedPlatformsStr} — ${countAdded} new lead${countAdded !== 1 ? 's' : ''} found from ${totalFetched} sources analyzed.`);
  };

  // --- AI helpers ---
  const suggestKeywords = (serviceOffered: string): Record<string, string[]> => {
    const service = serviceOffered.toLowerCase();
    const sets = (primary: string[], intent: string[], problem: string[], competitor: string[], longtail: string[]) => ({
      'Primary Keywords': primary,
      'Intent Keywords': intent,
      'Problem Keywords': problem,
      'Competitor Keywords': competitor,
      'Long-tail Keywords': longtail,
    });

    // --- Curated sets for common domains (hand-tuned, richer) ---
    if (service.includes('seo') || service.includes('marketing') || service.includes('growth') || service.includes('ads')) {
      return sets(
        ['seo agency', 'seo services', 'seo consultant', 'search optimization'],
        ['recommend seo agency', 'looking for seo', 'hire seo expert', 'need growth agency'],
        ['traffic dropped', 'not ranking on google', 'low organic growth'],
        ['ahrefs expert', 'semrush consultant', 'backlink building'],
        ['looking for local seo agency', 'need b2b saas seo expert', 'hire content marketing agency'],
      );
    }
    if (service.includes('video') || service.includes('editor') || service.includes('editing') || service.includes('youtube')) {
      return sets(
        ['video editor', 'video editing', 'youtube editing', 'tiktok editing'],
        ['looking for video editor', 'hire editor', 'recommend video editor', 'need editing help'],
        ['low retention rate', 'editing takes too long', 'need clean captions'],
        ['premiere pro editor', 'after effects expert', 'capcut editor'],
        ['searching for long term video editor', 'need short form tik tok editor', 'hire youtube editor'],
      );
    }
    if (service.includes('figma') || service.includes('design') || service.includes('ui') || service.includes('ux') || service.includes('mockup')) {
      return sets(
        ['figma designer', 'ui design', 'ux designer', 'product design'],
        ['looking for designer', 'need landing page design', 'hire figma expert', 'recommend ui agency'],
        ['bad user experience', 'onboarding dropoff', 'outdated ui dashboard'],
        ['sketch designer', 'webflow developer', 'tailwind designer'],
        ['looking for contract figma designer', 'need landing page designer in figma', 'redesign billing dashboard flow'],
      );
    }
    if (service.includes('resume') || service.includes('cv') || service.includes('cover letter') || service.includes('linkedin profile')) {
      return sets(
        ['resume writer', 'resume writing', 'cv writing', 'resume review'],
        ['looking for resume writer', 'need help with my resume', 'hire resume writer', 'recommend resume service'],
        ['resume not getting interviews', 'no callbacks from applications', 'ats rejecting my resume'],
        ['professional resume service', 'linkedin profile optimization', 'cover letter writer'],
        ['looking for tech resume writer', 'need ats friendly resume help', 'hire someone to rewrite my cv'],
      );
    }
    if (service.includes('writing') || service.includes('content') || service.includes('copywrit') || service.includes('blog') || service.includes('ghostwrit')) {
      return sets(
        ['content writer', 'copywriter', 'blog writing', 'ghostwriter'],
        ['looking for content writer', 'need a copywriter', 'hire blog writer', 'recommend writing service'],
        ['blog not converting', 'need consistent content', 'low engagement on posts'],
        ['seo content agency', 'freelance copywriter', 'newsletter writer'],
        ['looking for freelance content writer', 'need b2b copywriter', 'hire long form blog writer'],
      );
    }
    if (service.includes('web') || service.includes('software') || service.includes('app') || service.includes('developer') || service.includes('react') || service.includes('code') || service.includes('programming')) {
      return sets(
        ['web development', 'website development', 'web developer', 'react developer', 'saas development'],
        ['looking for web developer', 'need website', 'hire developer', 'recommend agency', 'need saas mvp'],
        ['website redesign', 'website not converting', 'ecommerce setup', 'build saas MVP'],
        ['shopify expert', 'wordpress developer', 'react developer', 'nextjs expert'],
        ['looking for website development company', 'need ecommerce website developer', 'searching for shopify agency', 'need freelancer to build mvp'],
      );
    }

    // --- Generic fallback: build keyword sets from what the user actually typed ---
    return genericKeywordSets(serviceOffered);
  };

  const qualifyLead = async (leadId: string): Promise<void> => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const campaign = campaigns.find(c => c.id === lead.campaignId);

    // 1) Deterministic baseline — always available, and the fallback when AI is off.
    const det = scoreLead(`${lead.title || ''}\n${lead.content || ''}`, {
      keywords: campaign?.keywords || lead.keywords,
      serviceOffered: campaign?.serviceOffered,
      industry: campaign?.industry,
      geography: campaign?.geography,
    });

    let q = {
      intentScore: det.intentScore,
      leadQualityScore: det.leadQualityScore,
      industryMatchScore: det.industryMatchScore,
      sentiment: det.sentiment as Lead['sentiment'],
      buyingIntentScore: det.intentScore,
      responseProbability: Math.round((det.intentScore + det.leadQualityScore) / 2),
      overallOpportunityScore: Math.round((det.intentScore + det.leadQualityScore + det.industryMatchScore) / 3),
      companyIndustry: campaign?.industry && campaign.industry.toLowerCase() !== 'general' ? campaign.industry : undefined as string | undefined,
      budgetPotential: undefined as string | undefined,
      companyName: lead.companyName,
      aiSummary: det.reasons.join(' · '),
      recommendedAction: undefined as string | undefined,
    };
    let usedAI = false;

    // 2) Ask Claude for precise, context-aware scoring + light enrichment.
    //    AI qualification is a Pro feature — Free stays on the deterministic engine.
    if (capabilities.ai) {
      try {
        const res: any = await httpsCallable(functions, 'qualifyLeadAI')({
          lead: { platform: lead.platform, author: lead.author, handle: lead.handle, title: lead.title, content: lead.content },
          campaign: campaign
            ? { name: campaign.name, serviceOffered: campaign.serviceOffered, industry: campaign.industry, keywords: campaign.keywords }
            : { keywords: lead.keywords },
        });
        const r = res?.data?.result;
        if (r) {
          usedAI = true;
          q = {
            intentScore: r.intentScore, leadQualityScore: r.leadQualityScore, industryMatchScore: r.industryMatchScore,
            sentiment: r.sentiment, buyingIntentScore: r.buyingIntentScore, responseProbability: r.responseProbability,
            overallOpportunityScore: r.overallOpportunityScore,
            companyIndustry: r.companyIndustry || q.companyIndustry,
            budgetPotential: r.budgetPotential || undefined,
            companyName: r.companyName || lead.companyName,
            aiSummary: r.summary || q.aiSummary,
            recommendedAction: r.recommendedAction || undefined,
          };
        }
      } catch (err) {
        logError('qualifyLeadAI', err, { leadId });
      }
    }

    setLeads(prev => prev.map(l => l.id === leadId ? {
      ...l,
      status: 'qualified',
      sentiment: q.sentiment,
      intentScore: q.intentScore,
      leadQualityScore: q.leadQualityScore,
      industryMatchScore: q.industryMatchScore,
      buyingIntentScore: q.buyingIntentScore,
      responseProbability: q.responseProbability,
      overallOpportunityScore: q.overallOpportunityScore,
      companyName: q.companyName || l.companyName,
      companyIndustry: q.companyIndustry || l.companyIndustry,
      budgetPotential: q.budgetPotential || l.budgetPotential,
      aiSummary: q.aiSummary,
      recommendedAction: q.recommendedAction,
    } : l));

    const fallbackMsg = capabilities.ai
      ? 'Lead scored. Add an Anthropic API key to enable AI qualification (see SETUP.md).'
      : 'Lead scored with our intent engine. Upgrade to Pro for AI qualification.';
    notify(
      usedAI ? 'Lead qualified by AI.' : fallbackMsg,
      usedAI ? 'success' : 'info',
      usedAI ? 4000 : 6000,
    );
  };

  const assignLead = (leadId: string, member: string) => {
    // Assigning leads to teammates is part of the Pro team workspace.
    if (member && !capabilities.team) {
      notify('Lead assignment is part of the Pro team workspace. Upgrade to assign leads.', 'info', 6000);
      openUpgradeModal();
      return;
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assignedTo: member } : l));

    const lead = leads.find(l => l.id === leadId);
    const target = member ? teamMembers.find(m => m.name === member) : undefined;

    // Mirror the assignment to the shared `assignments` collection so it shows up in the
    // teammate's own account. Unassigning (or assigning to a member with no email) removes it.
    if (canShareAssignments() && lead) {
      if (target?.email) {
        const now = new Date().toISOString();
        const prior = ownerAssignmentsRef.current.get(leadId);
        const record: Assignment = {
          id: assignmentDocId(firebaseUser!.uid, lead.id),
          leadId: lead.id,
          ownerUid: firebaseUser!.uid,
          ownerName: userProfile?.name || firebaseUser!.email || 'Workspace owner',
          ownerEmail: firebaseUser!.email || '',
          assigneeEmail: normEmail(target.email),
          assigneeUid: target.uid || '',
          assigneeName: target.name,
          lead: {
            id: lead.id, author: lead.author, handle: lead.handle, platform: lead.platform,
            title: lead.title || '', content: lead.content || '', postUrl: lead.postUrl || '',
            intentScore: lead.intentScore ?? null, keywords: lead.keywords || [],
            companyName: lead.companyName || '', campaignId: lead.campaignId || '',
          },
          status: lead.status,
          note: prior?.note || '',
          assignedAt: prior?.assignedAt || now,
          updatedAt: now,
        };
        upsertAssignment(record).catch(err => console.error('assignment upsert failed:', err));
      } else if (ownerAssignmentsRef.current.has(leadId)) {
        deleteAssignment(firebaseUser!.uid, leadId).catch(err => console.error('assignment delete failed:', err));
      }
    }

    // Notify the assignee by email (opens the user's mail client, pre-filled). Only fires
    // when assigning to a real member who has an email and the workspace setting is on.
    if (target?.email && emailNotifyOnAssign && lead) {
      openEmail(buildAssignmentEmail(target, lead));
      notify(`Assignment email drafted for ${target.name}.`, 'info', 3500);
    }
  };

  // Assignee-side: update the status of a lead shared with me (writes back to the owner).
  const updateMyAssignmentStatus = (assignmentId: string, status: Lead['status'], note?: string) => {
    updateAssignmentStatus(assignmentId, status, note)
      .then(() => notify('Updated. Your lead leader will see the change.', 'success', 2500))
      .catch(err => { console.error('assignment status update failed:', err); notify('Could not update — try again.', 'error'); });
  };

  // --- Team workspace functions ---

  // Add a teammate. With a real signed-in account + an email, this provisions a child LOGIN
  // (via Cloud Function) and returns a temp password to share. In demo/signed-out mode it just
  // creates a local contact (no real account) so the UI still works.
  const addTeamMember = async (
    member: { name: string; email?: string; role?: string; color?: string; experience?: string; phone?: string; resumeName?: string; resumeUrl?: string }
  ): Promise<{ tempPassword?: string; email?: string; error?: string }> => {
    // The team workspace (member logins + assignment) is a Pro feature.
    if (!capabilities.team) {
      notify('The team workspace is a Pro feature. Upgrade to add teammates.', 'info', 6000);
      openUpgradeModal();
      return { error: 'The team workspace is a Pro feature.' };
    }
    // Pro includes up to 3 teammates; more requires the Agency plan.
    if (teamMembers.length >= capabilities.maxTeamMembers) {
      notify(`Your plan includes up to ${capabilities.maxTeamMembers} team members. Upgrade to Agency for unlimited members.`, 'info', 6000);
      openUpgradeModal();
      return { error: `Your plan includes up to ${capabilities.maxTeamMembers} team members.` };
    }
    const name = member.name.trim();
    if (!name) return { error: 'Name is required.' };
    const id = 'tm_' + Date.now() + '_' + Math.round(Math.random() * 1000);
    const email = (member.email || '').trim();
    const role = (member.role || 'Member').trim();

    let uid: string | undefined;
    let tempPassword: string | undefined;
    if (canShareAssignments() && email) {
      try {
        const created = await createTeamMemberAccount({ name, email, role });
        uid = created.uid;
        tempPassword = created.tempPassword;
      } catch (err: any) {
        const code: string = err?.code || '';
        const detail: string = err?.message || '';
        console.error('createTeamMember failed:', code, detail, err);
        let msg: string;
        if (code === 'functions/already-exists' || detail.includes('already exists')) {
          msg = 'An account with this email already exists.';
        } else if (code === 'functions/not-found') {
          msg = "Team accounts aren't deployed yet. Run: firebase deploy --only functions";
        } else if (code === 'functions/unauthenticated') {
          msg = 'Session expired — sign in again, then retry.';
        } else if (code === 'functions/internal' && /auth\/(configuration|operation)-not-allowed/i.test(detail)) {
          msg = 'Enable Email/Password sign-in in Firebase Auth, then retry.';
        } else {
          msg = `Could not create the teammate account${detail ? `: ${detail}` : ''}`;
        }
        notify(msg, 'error', 7000);
        return { error: msg };
      }
    }

    const newMember: TeamMember = {
      id, name, email, role,
      color: member.color || MEMBER_COLORS[teamMembers.length % MEMBER_COLORS.length],
      experience: (member.experience || '').trim() || undefined,
      phone: (member.phone || '').trim() || undefined,
      resumeName: member.resumeName,
      resumeUrl: member.resumeUrl,
      uid,
      createdAt: new Date().toISOString(),
    };
    setTeamMembers(prev => [...prev, newMember]);
    return { tempPassword, email };
  };

  const updateTeamMember = (id: string, patch: Partial<Omit<TeamMember, 'id' | 'createdAt'>>) => {
    const target = teamMembers.find(m => m.id === id);
    if (!target) return;
    const nextName = patch.name?.trim();
    // Keep already-assigned leads pointing at the renamed member.
    if (nextName && nextName !== target.name) {
      setLeads(ls => ls.map(l => l.assignedTo === target.name ? { ...l, assignedTo: nextName } : l));
    }
    // Note: a child's login email is fixed at creation; we don't change the auth account here.
    setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch, ...(nextName ? { name: nextName } : {}) } : m));
  };

  const removeTeamMember = (id: string) => {
    const target = teamMembers.find(m => m.id === id);
    if (target) {
      // Unassign any leads that were assigned to the removed member.
      setLeads(ls => ls.map(l => l.assignedTo === target.name ? { ...l, assignedTo: undefined } : l));
      // Tear down their real account + shared assignments (best effort).
      if (canShareAssignments() && target.uid) {
        deleteTeamMemberAccount(target.uid).catch(err => console.error('delete teammate account failed:', err));
        leads.filter(l => l.assignedTo === target.name).forEach(l =>
          deleteAssignment(firebaseUser!.uid, l.id).catch(() => {}));
      }
    }
    setTeamMembers(prev => prev.filter(m => m.id !== id));
  };

  // --- Admin functions ---
  const updateUserPlan = async (userId: string, newPlan: AdminUser['plan']) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { plan: newPlan });
    } catch (err) {
      console.error("Error updating user plan in Firestore:", err);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
    } catch (err) {
      console.error("Error deleting user in Firestore:", err);
    }
  };

  const suspendUser = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const user = allUsers.find(u => u.id === userId);
      if (user) {
        const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
        await updateDoc(userRef, { status: nextStatus });
      }
    } catch (err) {
      console.error("Error suspending user in Firestore:", err);
    }
  };

  const promoteToAdmin = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: 'admin' });
      notify('User promoted to admin.', 'success');
    } catch (err) {
      console.error("Error promoting user:", err);
      notify('Could not promote user.', 'error');
    }
  };

  const demoteFromAdmin = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: 'user' });
      notify('Admin access removed.', 'success');
    } catch (err) {
      console.error("Error demoting user:", err);
      notify('Could not update user.', 'error');
    }
  };

  // Admin: designate a user as a team leader, a member of a leader, or unassign them.
  const setUserTeamRole = async (userId: string, value: 'leader' | 'member' | 'none', leaderUid?: string) => {
    try {
      const ref = doc(db, 'users', userId);
      if (value === 'leader') {
        await updateDoc(ref, { teamRole: 'leader', parentUid: deleteField() });
        notify('Set as team leader.', 'success');
      } else if (value === 'member') {
        if (!leaderUid) { notify('Pick a team leader for this member.', 'error'); return; }
        if (leaderUid === userId) { notify("A member can't report to themselves.", 'error'); return; }
        await updateDoc(ref, { teamRole: 'member', parentUid: leaderUid });
        notify('Added to team.', 'success');
      } else {
        await updateDoc(ref, { teamRole: deleteField(), parentUid: deleteField() });
        notify('Removed from team.', 'info');
      }
    } catch (err) {
      console.error('Error setting team role:', err);
      notify('Could not update team role.', 'error');
    }
  };

  return (
    <AppContext.Provider value={{
      plan,
      isPro,
      capabilities,
      leadsUsedThisMonth,
      upgradeModalOpen,
      openUpgradeModal,
      closeUpgradeModal,
      activeTab,
      setActiveTab,
      keywords,
      addKeyword,
      removeKeyword,
      leads,
      updateLeadStatus,
      deleteLead,
      deleteLeads,
      generatePitch,
      sendPitch,
      startFreeTrial,
      subscribeToPlan,
      conversations,
      addMessageToConversation,
      competitors,
      addCompetitor,
      removeCompetitor,
      competitorMentions,
      alerts,
      clearAlerts,
      markAlertsAsRead,
      alertSettings,
      updateAlertSettings,
      isScanning,
      scanCount,
      connectedPlatforms,
      togglePlatformConnection,
      campaigns,
      addCampaign,
      deleteCampaign,
      toggleCampaignStatus,
      setCampaignAutoScan,
      sequences,
      enrollments,
      createSequence,
      updateSequence,
      deleteSequence,
      enrollLeadInSequence,
      cancelEnrollment,
      triggerScanLeads,
      suggestKeywords,
      qualifyLead,
      assignLead,
      teamMembers,
      addTeamMember,
      updateTeamMember,
      removeTeamMember,
      emailNotifyOnAssign,
      setEmailNotifyOnAssign,
      assignedToMe,
      updateMyAssignmentStatus,
      isAuthenticated,
      isAuthLoading,
      authError,
      clearAuthError,
      firebaseUser,
      userProfile,
      userStatus,
      login,
      signup,
      loginWithGoogle,
      logout,
      isAdminMode,
      allUsers,
      updateUserPlan,
      deleteUser,
      suspendUser,
      promoteToAdmin,
      demoteFromAdmin,
      setUserTeamRole,
      myTeamRole,
      myTeam,
      teamChatEnabled,
      strictIntentFilter,
      setStrictIntentFilter,
      theme,
      toggleTheme,
      setTheme,
      redditAccount,
      redditConnecting,
      connectReddit,
      disconnectReddit,
      postRedditComment,
      sendRedditDm,
      gmailAccount,
      gmailConnecting,
      connectGmail,
      disconnectGmail,
      sendGmail
    }}>
      {children}
    </AppContext.Provider>
  );
};

function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
