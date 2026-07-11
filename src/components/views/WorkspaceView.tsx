import React, { useMemo, useRef, useState } from 'react';
import {
  UsersRound, Plus, Pencil, Trash2, X, Mail, Briefcase,
  UserPlus, LayoutGrid, Inbox, Check, GripVertical,
  Phone, FileText, Paperclip, Award, Clock3, KeyRound, Copy,
} from 'lucide-react';
import { useApp, MEMBER_COLORS } from '../../context/AppContext';
import type { Lead, TeamMember } from '../../context/AppContext';
import { notify, confirmDialog } from '../Toaster';

const MAX_RESUME_BYTES = 2 * 1024 * 1024; // 2 MB cap for an inline (data URL) CV

const PLATFORM_COLORS: Record<string, string> = {
  reddit: '#ff4500', twitter: '#1da1f2', linkedin: '#0a66c2', hackernews: '#ff6600',
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

const isUnassigned = (l: Lead) => !l.assignedTo || l.assignedTo === 'Unassigned';

// Avatar with the member's accent colour and initials.
const Avatar: React.FC<{ name: string; color: string; size?: number }> = ({ name, color, size = 40 }) => (
  <div
    style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, color: '#fff', fontWeight: 700, fontSize: size * 0.36,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 2px 8px ${color}55`,
    }}
  >
    {initials(name)}
  </div>
);

interface DraftMember {
  name: string; email: string; role: string; color: string;
  experience: string; phone: string; resumeName: string; resumeUrl: string;
}

const emptyDraft = (): DraftMember => ({
  name: '', email: '', role: '', color: MEMBER_COLORS[0],
  experience: '', phone: '', resumeName: '', resumeUrl: '',
});

export const WorkspaceView: React.FC = () => {
  const {
    teamMembers, addTeamMember, updateTeamMember, removeTeamMember, leads, assignLead, setActiveTab,
    emailNotifyOnAssign, setEmailNotifyOnAssign,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftMember>(emptyDraft());
  const [saving, setSaving] = useState(false);
  // Holds the one-time login to show the parent after a teammate account is created.
  const [createdCreds, setCreatedCreds] = useState<{ name: string; email: string; tempPassword: string } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editingMember = editingId ? teamMembers.find(m => m.id === editingId) : undefined;

  // Leads relevant to the team (everything except archived).
  const boardLeads = useMemo(() => leads.filter(l => l.status !== 'archived'), [leads]);

  const countFor = (memberName: string) => boardLeads.filter(l => l.assignedTo === memberName).length;
  const unassignedCount = boardLeads.filter(isUnassigned).length;
  const assignedCount = boardLeads.length - unassignedCount;
  const coverage = boardLeads.length ? Math.round((assignedCount / boardLeads.length) * 100) : 0;

  const openAdd = () => { setEditingId(null); setDraft(emptyDraft()); setModalOpen(true); };
  const openEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setDraft({
      name: m.name, email: m.email, role: m.role, color: m.color,
      experience: m.experience || '', phone: m.phone || '',
      resumeName: m.resumeName || '', resumeUrl: m.resumeUrl || '',
    });
    setModalOpen(true);
  };

  const handleResumeFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_RESUME_BYTES) {
      notify('Resume is too large (max 2 MB). Paste a link instead.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraft(d => ({ ...d, resumeUrl: String(reader.result), resumeName: file.name }));
    reader.onerror = () => notify('Could not read that file.', 'error');
    reader.readAsDataURL(file);
  };

  const saveMember = async () => {
    if (!draft.name.trim()) { notify('Member name is required.', 'error'); return; }
    const payload = {
      name: draft.name, email: draft.email, role: draft.role, color: draft.color,
      experience: draft.experience, phone: draft.phone,
      resumeName: draft.resumeName || undefined, resumeUrl: draft.resumeUrl || undefined,
    };
    if (editingId) {
      updateTeamMember(editingId, payload);
      notify('Team member updated.', 'success');
      setModalOpen(false);
      return;
    }
    setSaving(true);
    const res = await addTeamMember(payload);
    setSaving(false);
    if (res.error) return; // addTeamMember already surfaced the error
    setModalOpen(false);
    if (res.tempPassword && res.email) {
      // Reveal the one-time login so the parent can share it with the teammate.
      setCreatedCreds({ name: draft.name.trim(), email: res.email, tempPassword: res.tempPassword });
    } else {
      notify(`${draft.name.trim()} added to the workspace.`, 'success');
    }
  };

  const deleteMember = async (m: TeamMember) => {
    const ok = await confirmDialog({
      title: 'Remove team member',
      message: `Remove ${m.name}? Any leads assigned to them will be moved back to Unassigned.`,
      confirmLabel: 'Remove', danger: true,
    });
    if (ok) { removeTeamMember(m.id); notify(`${m.name} removed.`, 'info'); }
  };

  // --- Drag & drop assignment ---
  const onDrop = (targetName: string | null) => {
    if (!draggingId) return;
    const lead = boardLeads.find(l => l.id === draggingId);
    setDragOverKey(null);
    setDraggingId(null);
    if (!lead) return;
    const current = isUnassigned(lead) ? null : lead.assignedTo;
    if (current === targetName) return;
    assignLead(lead.id, targetName ?? '');
    notify(targetName ? `Assigned to ${targetName}.` : 'Moved to Unassigned.', 'success', 2200);
  };

  // Build the board columns: Unassigned first, then one per member.
  const columns: { key: string; name: string | null; label: string; color: string; leads: Lead[] }[] = [
    { key: '__unassigned', name: null, label: 'Unassigned', color: 'hsl(var(--text-muted))', leads: boardLeads.filter(isUnassigned) },
    ...teamMembers.map(m => ({
      key: m.id, name: m.name, label: m.name, color: m.color,
      leads: boardLeads.filter(l => l.assignedTo === m.name),
    })),
  ];

  return (
    <div className="view-container">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div className="view-title">
          <h1>Workspace</h1>
          <p>Manage your team and assign leads to the right person — drag a lead onto a teammate to hand it off.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <label style={styles.notifyToggle} title="Email the assignee whenever a lead is assigned to them">
            <input
              type="checkbox"
              checked={emailNotifyOnAssign}
              onChange={e => setEmailNotifyOnAssign(e.target.checked)}
            />
            <Mail size={14} /> Email on assign
          </label>
          <button className="btn-primary" onClick={openAdd} style={styles.addBtn}>
            <Plus size={16} /> Add Member
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={styles.statRow}>
        <StatCard icon={<UsersRound size={18} />} label="Team Members" value={teamMembers.length} accent="hsl(var(--primary))" />
        <StatCard icon={<Check size={18} />} label="Assigned Leads" value={assignedCount} accent="#10b981" />
        <StatCard icon={<Inbox size={18} />} label="Unassigned" value={unassignedCount} accent="#f59e0b" />
        <StatCard icon={<LayoutGrid size={18} />} label="Coverage" value={`${coverage}%`} accent="#8b5cf6" />
      </div>

      {/* Team members */}
      <h3 style={styles.sectionTitle}>Team Members</h3>
      {teamMembers.length === 0 ? (
        <div className="glass-card" style={styles.empty}>
          <UsersRound size={34} color="hsl(var(--text-faint))" />
          <p style={{ margin: '10px 0 0' }}>No members yet. Add your first teammate to start assigning leads.</p>
        </div>
      ) : (
        <div style={styles.memberGrid}>
          {teamMembers.map(m => (
            <div key={m.id} className="glass-card" style={styles.memberCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={m.name} color={m.color} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={styles.memberName}>{m.name}</div>
                  <div style={styles.roleBadge}><Briefcase size={11} /> {m.role || 'Member'}</div>
                  {m.email && (
                    m.uid
                      ? <span style={{ ...styles.linkChip, color: '#10b981', background: '#10b98118' }}><Check size={10} /> Account active</span>
                      : <span style={{ ...styles.linkChip, color: 'hsl(var(--text-muted))', background: 'hsl(var(--surface-1))' }}><Clock3 size={10} /> Local only</span>
                  )}
                </div>
                <div style={styles.cardActions}>
                  <button title="Edit" onClick={() => openEdit(m)} style={styles.iconBtn}><Pencil size={14} /></button>
                  <button title="Remove" onClick={() => deleteMember(m)} style={{ ...styles.iconBtn, color: 'hsl(var(--danger))' }}><Trash2 size={14} /></button>
                </div>
              </div>
              {m.experience && (
                <div style={styles.memberDetail}><Award size={12} /> {m.experience}</div>
              )}
              {m.email && (
                <a href={`mailto:${m.email}`} style={{ ...styles.memberDetail, textDecoration: 'none' }}><Mail size={12} /> {m.email}</a>
              )}
              {m.phone && (
                <div style={styles.memberDetail}><Phone size={12} /> {m.phone}</div>
              )}
              {m.resumeUrl && (
                <a href={m.resumeUrl} target="_blank" rel="noopener noreferrer" download={m.resumeName || undefined}
                  style={{ ...styles.memberDetail, color: 'hsl(var(--primary))', textDecoration: 'none' }}>
                  <FileText size={12} /> {m.resumeName || 'View résumé / CV'}
                </a>
              )}
              <div style={styles.memberFooter}>
                <span style={{ color: m.color, fontWeight: 700 }}>{countFor(m.name)}</span>
                <span style={{ color: 'hsl(var(--text-muted))', flex: 1 }}>active lead{countFor(m.name) !== 1 ? 's' : ''}</span>
                {m.email && (
                  <a href={`mailto:${m.email}`} className="btn-secondary" style={styles.emailBtn}>
                    <Mail size={12} /> Email
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assignment board */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 34, marginBottom: 14 }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Lead Assignments</h3>
        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Drag cards between columns to reassign</span>
      </div>

      {boardLeads.length === 0 ? (
        <div className="glass-card" style={styles.empty}>
          <Inbox size={34} color="hsl(var(--text-faint))" />
          <p style={{ margin: '10px 0 4px' }}>No active leads to assign yet.</p>
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setActiveTab('leads')}>Go to Leads</button>
        </div>
      ) : (
        <div style={styles.board}>
          {columns.map(col => (
            <div
              key={col.key}
              onDragOver={e => { e.preventDefault(); setDragOverKey(col.key); }}
              onDragLeave={() => setDragOverKey(prev => (prev === col.key ? null : prev))}
              onDrop={() => onDrop(col.name)}
              style={{
                ...styles.column,
                outline: dragOverKey === col.key ? `2px dashed ${col.color}` : '2px dashed transparent',
                background: dragOverKey === col.key ? `${col.color}10` : 'hsl(var(--surface-1))',
              }}
            >
              <div style={styles.colHeader}>
                {col.name === null
                  ? <span style={{ ...styles.colDot, background: col.color }} />
                  : <Avatar name={col.label} color={col.color} size={22} />}
                <span style={styles.colTitle}>{col.label}</span>
                <span style={styles.colCount}>{col.leads.length}</span>
              </div>

              <div style={styles.colBody}>
                {col.leads.length === 0 ? (
                  <div style={styles.colEmpty}>Drop leads here</div>
                ) : col.leads.map(lead => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDraggingId(lead.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverKey(null); }}
                    style={{
                      ...styles.leadCard,
                      opacity: draggingId === lead.id ? 0.5 : 1,
                      borderLeft: `3px solid ${PLATFORM_COLORS[lead.platform] || 'hsl(var(--primary))'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GripVertical size={13} color="hsl(var(--text-faint))" style={{ flexShrink: 0, cursor: 'grab' }} />
                      <span style={styles.leadAuthor}>{lead.author}</span>
                      <span style={styles.statusPill}>{lead.status}</span>
                    </div>
                    <p style={styles.leadSnippet}>{lead.title || lead.content}</p>
                    <div style={styles.leadMeta}>
                      <span style={{ color: PLATFORM_COLORS[lead.platform] || 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'capitalize' }}>{lead.platform}</span>
                      {typeof lead.intentScore === 'number' && <span style={{ color: 'hsl(var(--text-muted))' }}>Intent {lead.intentScore}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div style={styles.overlay} onClick={() => setModalOpen(false)}>
          <div className="glass-card" style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem' }}>
                <UserPlus size={18} color="hsl(var(--primary))" /> {editingId ? 'Edit Member' : 'Add Team Member'}
              </h3>
              <button style={styles.iconBtn} onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 18px' }}>
              <Avatar name={draft.name || '?'} color={draft.color} size={46} />
              <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))' }}>Preview</div>
            </div>

            <label style={styles.label}>Full Name *</label>
            <input className="form-input" style={styles.input} value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Sarah Chen" autoFocus />

            <label style={styles.label}>Email {editingId ? '' : '(creates their login)'}</label>
            <input className="form-input" style={styles.input} value={draft.email}
              onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
              placeholder="sarah@company.com"
              disabled={!!editingMember?.uid} />
            {!editingId && (
              <p style={styles.hint}>We'll create a login for this email and give you a temporary password to share.</p>
            )}
            {editingMember?.uid && (
              <p style={styles.hint}>Login email is fixed once an account exists.</p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Role</label>
                <input className="form-input" style={styles.input} value={draft.role}
                  onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} placeholder="e.g. Sales Rep" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Phone</label>
                <input className="form-input" style={styles.input} value={draft.phone}
                  onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} placeholder="+1 555 123 4567" />
              </div>
            </div>

            <label style={styles.label}>Experience</label>
            <input className="form-input" style={styles.input} value={draft.experience}
              onChange={e => setDraft(d => ({ ...d, experience: e.target.value }))} placeholder="e.g. 5 yrs · B2B SaaS sales" />

            <label style={styles.label}>Résumé / CV</label>
            <div style={styles.resumeRow}>
              <input className="form-input" style={{ ...styles.input, flex: 1 }} value={draft.resumeName ? '' : draft.resumeUrl}
                onChange={e => setDraft(d => ({ ...d, resumeUrl: e.target.value, resumeName: '' }))}
                placeholder="Paste a link (Drive, LinkedIn, …)" disabled={!!draft.resumeName} />
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                onChange={e => handleResumeFile(e.target.files?.[0])} />
              <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                onClick={() => fileRef.current?.click()}>
                <Paperclip size={13} /> Upload
              </button>
            </div>
            {(draft.resumeName || draft.resumeUrl) && (
              <div style={styles.resumeChip}>
                <FileText size={12} /> <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.resumeName || draft.resumeUrl}</span>
                <button type="button" style={styles.iconBtn} onClick={() => setDraft(d => ({ ...d, resumeName: '', resumeUrl: '' }))}><X size={13} /></button>
              </div>
            )}

            <label style={styles.label}>Avatar Color</label>
            <div style={styles.swatchRow}>
              {MEMBER_COLORS.map(c => (
                <button key={c} onClick={() => setDraft(d => ({ ...d, color: c }))}
                  style={{
                    ...styles.swatch, background: c,
                    outline: draft.color === c ? '2px solid hsl(var(--text-primary))' : '2px solid transparent',
                  }}>
                  {draft.color === c && <Check size={12} color="#fff" />}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', opacity: saving ? 0.7 : 1 }} onClick={saveMember} disabled={saving}>
                {saving ? 'Creating…' : editingId ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-time credentials reveal after creating a teammate's login. */}
      {createdCreds && (
        <div style={styles.overlay} onClick={() => setCreatedCreds(null)}>
          <div className="glass-card" style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem' }}>
                <KeyRound size={18} color="hsl(var(--primary))" /> {createdCreds.name}'s login
              </h3>
              <button style={styles.iconBtn} onClick={() => setCreatedCreds(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'hsl(var(--text-secondary))', margin: '4px 0 16px', lineHeight: 1.5 }}>
              Share these with {createdCreds.name}. They log in at this app and can change the password later. <strong>This password is shown only once.</strong>
            </p>
            <div style={styles.credRow}><span style={styles.credLabel}>Email</span><code style={styles.credValue}>{createdCreds.email}</code></div>
            <div style={styles.credRow}><span style={styles.credLabel}>Temp password</span><code style={styles.credValue}>{createdCreds.tempPassword}</code></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => { navigator.clipboard.writeText(`Email: ${createdCreds.email}\nTemporary password: ${createdCreds.tempPassword}`); notify('Login copied to clipboard.', 'success'); }}>
                <Copy size={14} /> Copy login
              </button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCreatedCreds(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent: string }> = ({ icon, label, value, accent }) => (
  <div className="glass-card" style={styles.statCard}>
    <div style={{ ...styles.statIcon, background: `${accent}1a`, color: accent }}>{icon}</div>
    <div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 30 },
  statCard: { padding: '18px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 },
  statIcon: { width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue: { fontSize: '1.5rem', fontWeight: 800, color: 'hsl(var(--text-primary))', lineHeight: 1.1 },
  statLabel: { fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginTop: 2 },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 14px' },
  memberGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  memberCard: { padding: 18, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 12 },
  memberName: { fontWeight: 700, fontSize: '0.95rem', color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  roleBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: 3 },
  linkChip: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, marginTop: 5 },
  hint: { fontSize: '0.72rem', color: 'hsl(var(--text-muted))', margin: '5px 0 0', lineHeight: 1.4 },
  credRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'hsl(var(--surface-1))', marginBottom: 8 },
  credLabel: { fontSize: '0.72rem', color: 'hsl(var(--text-muted))', width: 110, flexShrink: 0 },
  credValue: { fontSize: '0.84rem', color: 'hsl(var(--text-primary))', fontWeight: 700, wordBreak: 'break-all' },
  cardActions: { display: 'flex', gap: 4, flexShrink: 0 },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  memberDetail: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memberFooter: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', borderTop: '1px solid hsl(var(--surface-1))', paddingTop: 10 },
  emailBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', padding: '4px 10px', textDecoration: 'none', flexShrink: 0 },
  notifyToggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' },
  resumeRow: { display: 'flex', gap: 8, alignItems: 'center' },
  resumeChip: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'hsl(var(--surface-1))', fontSize: '0.76rem', color: 'hsl(var(--text-secondary))' },
  empty: { padding: '40px 20px', borderRadius: 14, textAlign: 'center', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  board: { display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' },
  column: { width: 270, flexShrink: 0, borderRadius: 14, padding: 12, transition: 'background 0.15s, outline 0.15s', maxHeight: 560, display: 'flex', flexDirection: 'column' },
  colHeader: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, marginBottom: 8, borderBottom: '1px solid hsl(var(--border-color))' },
  colDot: { width: 14, height: 14, borderRadius: '50%', flexShrink: 0 },
  colTitle: { fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 },
  colCount: { fontSize: '0.72rem', fontWeight: 700, color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-card))', borderRadius: 20, padding: '1px 8px' },
  colBody: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 },
  colEmpty: { fontSize: '0.76rem', color: 'hsl(var(--text-faint))', textAlign: 'center', padding: '18px 6px', border: '1px dashed hsl(var(--border-color))', borderRadius: 10 },
  leadCard: { background: 'hsl(var(--bg-card))', borderRadius: 10, padding: '10px 12px', cursor: 'grab', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 6 },
  leadAuthor: { fontSize: '0.82rem', fontWeight: 700, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 },
  statusPill: { fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--text-muted))', background: 'hsl(var(--surface-1))', borderRadius: 6, padding: '2px 6px', flexShrink: 0 },
  leadSnippet: { fontSize: '0.76rem', color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  leadMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { width: 'min(440px, 100%)', padding: 24, borderRadius: 16, maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', margin: '12px 0 5px' },
  input: { width: '100%', fontSize: '0.85rem' },
  swatchRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default WorkspaceView;
