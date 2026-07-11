// Firestore persistence for the per-user workspace (leads, campaigns, conversations).
// Source of truth is Firestore under users/{uid}/<collection>; the app mirrors its in-memory
// state to it via diff-syncs (only changed/removed docs are written). localStorage stays as an
// offline cache.

import {
  collection, doc,
  setDoc, deleteDoc, updateDoc, onSnapshot, query, where, orderBy,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { apiGet, apiPost } from './api';

export type SyncCollectionName = 'leads' | 'campaigns' | 'conversations' | 'sequences';
const COLLECTIONS: SyncCollectionName[] = ['leads', 'campaigns', 'conversations', 'sequences'];

// Firestore doc IDs can't contain '/', be '.'/'..', or match __.*__. Lead IDs occasionally
// fall back to a URL, so sanitize defensively.
function safeDocId(raw: string): string {
  const cleaned = String(raw).replace(/[/\\.#$[\]]/g, '_').slice(0, 1400);
  return cleaned && cleaned !== '__' ? cleaned : 'doc_' + Math.abs(hash(raw));
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// Strip undefined (Firestore rejects it) and any non-JSON values.
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Load all workspace collections for the signed-in user (uid comes from the token). */
export async function loadWorkspace(_uid: string): Promise<Record<SyncCollectionName, any[]>> {
  const data = await apiGet<Record<SyncCollectionName, any[]>>('/api/workspace/load');
  return {
    leads: data.leads || [],
    campaigns: data.campaigns || [],
    conversations: data.conversations || [],
    sequences: data.sequences || [],
  };
}

/**
 * Diff-sync an array of items to the backend. Only sends docs whose JSON changed since the
 * last sync, and deletes docs that disappeared. `lastMap` (id -> JSON) is the caller-held
 * memory of what's already persisted — seed it from loadWorkspace(). Same signature as before.
 */
export async function syncCollection(
  _uid: string,
  name: SyncCollectionName,
  items: any[],
  idKey: string,
  lastMap: Map<string, string>,
): Promise<void> {
  const sets: Array<{ id: string; item: any }> = [];
  const currentIds = new Set<string>();

  for (const item of items) {
    const id = item?.[idKey] != null ? String(item[idKey]) : '';
    if (!id) continue;
    currentIds.add(id);
    const json = JSON.stringify(item);
    if (lastMap.get(id) !== json) {
      sets.push({ id, item: clean(item) });
      lastMap.set(id, json);
    }
  }

  const deletes: string[] = [];
  for (const id of [...lastMap.keys()]) {
    if (!currentIds.has(id)) {
      deletes.push(id);
      lastMap.delete(id);
    }
  }

  if (sets.length || deletes.length) {
    await apiPost('/api/workspace/sync', { collection: name, sets, deletes });
  }
}

/** Build a fresh id->JSON map from loaded items (to seed lastMap without re-uploading). */
export function buildSyncMap(items: any[], idKey: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const item of items) {
    const id = item?.[idKey] != null ? String(item[idKey]) : '';
    if (id) m.set(id, JSON.stringify(item));
  }
  return m;
}

// --- Shared lead assignments (cross-account) -------------------------------------------------
// A leader assigns a lead to a teammate by email. The record lives in a top-level `assignments`
// collection so the assignee can read it from their OWN account (see firestore.rules).

export interface Assignment {
  id: string;          // `${ownerUid}__${leadId}`
  leadId: string;
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  assigneeEmail: string;   // lowercased
  assigneeUid: string;     // the assignee's real account uid once they've accepted the invite ('' otherwise)
  assigneeName: string;
  lead: any;               // snapshot of the lead the assignee needs to work it
  status: string;          // workflow status (assignee can update)
  note: string;            // optional note from the assignee
  assignedAt: string;
  updatedAt: string;
}

export const assignmentDocId = (ownerUid: string, leadId: string) => safeDocId(`${ownerUid}__${leadId}`);
export const normEmail = (email: string) => (email || '').trim().toLowerCase();

/** Create or update the shared assignment record for a lead. */
export async function upsertAssignment(a: Assignment): Promise<void> {
  await setDoc(doc(db, 'assignments', a.id), clean(a));
}

/** Remove a lead's shared assignment (on unassign or lead deletion). */
export async function deleteAssignment(ownerUid: string, leadId: string): Promise<void> {
  await deleteDoc(doc(db, 'assignments', assignmentDocId(ownerUid, leadId)));
}

/** Assignee-side: update only the workflow status / note. */
export async function updateAssignmentStatus(id: string, status: string, note?: string): Promise<void> {
  const patch: Record<string, unknown> = { status, updatedAt: new Date().toISOString() };
  if (note !== undefined) patch.note = note;
  await updateDoc(doc(db, 'assignments', id), patch);
}

/** Live subscription to leads assigned TO me by email (covers invites not yet accepted). */
export function subscribeAssignmentsForAssignee(email: string, cb: (rows: Assignment[]) => void) {
  const q = query(collection(db, 'assignments'), where('assigneeEmail', '==', normEmail(email)));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data() as Assignment)), err => console.error('assignments(email) sub failed:', err));
}

/** Live subscription to leads assigned TO me by uid (bulletproof once the invite is accepted). */
export function subscribeAssignmentsForAssigneeUid(uid: string, cb: (rows: Assignment[]) => void) {
  const q = query(collection(db, 'assignments'), where('assigneeUid', '==', uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data() as Assignment)), err => console.error('assignments(uid) sub failed:', err));
}

/** Live subscription to the assignments I created (as owner) — to see assignees' progress. */
export function subscribeAssignmentsForOwner(uid: string, cb: (rows: Assignment[]) => void) {
  const q = query(collection(db, 'assignments'), where('ownerUid', '==', uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data() as Assignment)), err => console.error('assignments(owner) sub failed:', err));
}

// --- Team (parent → child) account provisioning ----------------------------------------------
// A parent creates real login accounts for teammates via Cloud Functions (Admin SDK). The child
// logs in with the temp password and only sees leads assigned to them.

export interface CreatedMember { ok: boolean; uid: string; email: string; tempPassword: string }

/** Create a child teammate account. Returns the new uid + a temp password to share with them. */
export async function createTeamMemberAccount(input: { name: string; email: string; role: string }): Promise<CreatedMember> {
  const res = await httpsCallable(functions, 'createTeamMember')(input);
  return res.data as CreatedMember;
}

/** Delete a child teammate account (auth user + user doc). */
export async function deleteTeamMemberAccount(uid: string): Promise<void> {
  await httpsCallable(functions, 'deleteTeamMember')({ uid });
}

/** Reset a child's password; returns a fresh temp password to share. */
export async function resetTeamMemberPassword(uid: string): Promise<{ ok: boolean; tempPassword: string }> {
  const res = await httpsCallable(functions, 'resetTeamMemberPassword')({ uid });
  return res.data as { ok: boolean; tempPassword: string };
}

// --- Team roster (leader + members), driven by users/{uid}.parentUid -------------------------
// A team is a leader plus everyone whose parentUid points at that leader. Admins assign these
// links; teammates can read their leader's and fellow members' docs (see firestore.rules).

export interface TeamRosterUser {
  uid: string;
  name: string;
  email: string;
  role?: string;        // free-text job role on the user doc, if any
  teamRole?: 'leader' | 'member';
  parentUid?: string;
  plan?: string;        // the user's subscription tier (used to gate team chat by the leader's plan)
}

function toRosterUser(uid: string, data: any): TeamRosterUser {
  return {
    uid,
    name: data?.name || data?.email?.split('@')?.[0] || 'Teammate',
    email: data?.email || '',
    role: data?.role && data.role !== 'user' && data.role !== 'admin' ? data.role : undefined,
    teamRole: data?.teamRole,
    parentUid: data?.parentUid,
    plan: data?.plan,
  };
}

/** Live subscription to a single user doc (used to watch the team leader). */
export function subscribeUserDoc(uid: string, cb: (user: TeamRosterUser | null) => void) {
  return onSnapshot(
    doc(db, 'users', uid),
    snap => cb(snap.exists() ? toRosterUser(snap.id, snap.data()) : null),
    err => console.error('user doc sub failed:', err),
  );
}

/** Live subscription to all members under a leader (everyone with parentUid == leaderUid). */
export function subscribeTeamRoster(leaderUid: string, cb: (rows: TeamRosterUser[]) => void) {
  const q = query(collection(db, 'users'), where('parentUid', '==', leaderUid));
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => toRosterUser(d.id, d.data()))),
    err => console.error('team roster sub failed:', err),
  );
}

// --- Team chat (Agency) ----------------------------------------------------------------------
// A single group channel per team, keyed by the leader's uid. Everyone on the team (leader +
// members) reads/writes; security rules restrict it to the team and to Agency-plan teams.

export interface TeamChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: number;   // ms epoch, used for ordering
}

/** Live subscription to a team's chat messages, oldest first. */
export function subscribeTeamChat(teamId: string, cb: (msgs: TeamChatMessage[]) => void) {
  const q = query(collection(db, 'teamChats', teamId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<TeamChatMessage, 'id'>) }))),
    err => console.error('team chat sub failed:', err),
  );
}

/** Post a message to a team's chat channel. */
export async function sendTeamChatMessage(
  teamId: string,
  msg: { senderUid: string; senderName: string; text: string },
): Promise<void> {
  const id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  await setDoc(doc(db, 'teamChats', teamId, 'messages', id), { ...msg, createdAt: Date.now() });
}

// --- Outreach sequence enrollments -----------------------------------------------------------
// A sequence is a cadence of messages (defined in users/{uid}/sequences). Enrolling a lead
// creates an enrollment doc the SERVER then drives forward (the processSequences scheduled
// function sends each step on time). The client creates + cancels enrollments and subscribes
// to watch progress, but never advances them itself — the backend is the source of truth.

export interface SequenceEnrollment {
  id: string;              // `${leadId}__${sequenceId}`
  leadId: string;
  leadAuthor: string;
  sequenceId: string;
  sequenceName: string;
  channel: 'email' | 'reddit';
  to: string;              // recipient (email address or reddit username)
  currentStep: number;     // 0-based index of the next step to send
  totalSteps: number;
  status: 'active' | 'completed' | 'stopped' | 'failed';
  nextRunAt: string;       // ISO time the next step is due
  createdAt: string;
  lastError?: string;
}

const enrollmentId = (leadId: string, sequenceId: string) => safeDocId(`${leadId}__${sequenceId}`);

/** Enroll a lead into a sequence (creates the server-driven enrollment doc). */
export async function createEnrollment(uid: string, e: SequenceEnrollment): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'sequenceEnrollments', enrollmentId(e.leadId, e.sequenceId)), clean(e));
}

/** Stop an active enrollment (client-initiated cancel). */
export async function stopEnrollment(uid: string, id: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'sequenceEnrollments', safeDocId(id)), {
    status: 'stopped', updatedAt: new Date().toISOString(),
  });
}

/** Live subscription to all of a user's sequence enrollments. */
export function subscribeEnrollments(uid: string, cb: (rows: SequenceEnrollment[]) => void) {
  return onSnapshot(
    collection(db, 'users', uid, 'sequenceEnrollments'),
    snap => cb(snap.docs.map(d => d.data() as SequenceEnrollment)),
    err => console.error('enrollments sub failed:', err),
  );
}
