/// <reference types="node" />
// Map snake_case DB rows into the camelCase shapes the frontend already expects
// (Assignment, SequenceEnrollment, TeamRosterUser, TeamChatMessage). Keeping these here
// means the client's types/subscriptions don't change.
import { parseJson } from "./turso.js";

export function toAssignment(r: any) {
  return {
    id: r.id,
    leadId: r.lead_id,
    ownerUid: r.owner_uid,
    ownerName: r.owner_name || "",
    ownerEmail: r.owner_email || "",
    assigneeEmail: r.assignee_email || "",
    assigneeUid: r.assignee_uid || "",
    assigneeName: r.assignee_name || "",
    lead: parseJson(r.lead, {}),
    status: r.status || "",
    note: r.note || "",
    assignedAt: r.assigned_at || "",
    updatedAt: r.updated_at || "",
  };
}

export function toEnrollment(r: any) {
  return {
    id: r.id,
    leadId: r.lead_id,
    leadAuthor: r.lead_author || "",
    sequenceId: r.sequence_id,
    sequenceName: r.sequence_name || "",
    channel: r.channel,
    to: r.recipient || "",
    currentStep: Number(r.current_step) || 0,
    totalSteps: Number(r.total_steps) || 0,
    status: r.status,
    nextRunAt: r.next_run_at || "",
    createdAt: r.created_at || "",
    lastError: r.last_error || undefined,
  };
}

export function toRosterUser(r: any) {
  const roleRaw = r.role;
  return {
    uid: r.uid,
    name: r.name || (r.email ? String(r.email).split("@")[0] : "Teammate"),
    email: r.email || "",
    role: roleRaw && roleRaw !== "user" && roleRaw !== "admin" ? roleRaw : undefined,
    teamRole: r.team_role || undefined,
    parentUid: r.parent_uid || undefined,
    plan: r.plan || undefined,
  };
}

export function toChatMessage(r: any) {
  return {
    id: r.id,
    senderUid: r.sender_uid || "",
    senderName: r.sender_name || "",
    text: r.text || "",
    createdAt: Number(r.created_at) || 0,
  };
}

export function toAdminUser(r: any) {
  return {
    id: r.uid,
    name: r.name || "User",
    email: r.email || "",
    plan: r.plan || "free",
    status: r.status || "active",
    joinedAt: r.joined_at || "",
    role: r.role === "admin" ? "admin" : "user",
    teamRole: r.team_role === "leader" ? "leader" : r.team_role === "member" ? "member" : (r.parent_uid ? "member" : undefined),
    parentUid: r.parent_uid || undefined,
    razorpay: r.razorpay ? parseJson(r.razorpay, undefined) : undefined,
  };
}
