import React, { useState } from 'react';
import { Plus, Trash2, Mail, MessageSquare, Clock, X as CloseIcon, Send, StopCircle, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Sequence, SequenceStep } from '../../context/AppContext';

const CHANNEL_META = {
  email: { label: 'Email (Gmail)', icon: Mail, color: '#ea4335' },
  reddit: { label: 'Reddit DM', icon: MessageSquare, color: '#ff4500' },
} as const;

const STATUS_COLOR: Record<string, string> = {
  active: 'var(--primary)', completed: 'var(--success)', stopped: 'var(--text-muted)', failed: 'var(--danger)',
};

const blankStep = (): SequenceStep => ({ delayDays: 0, subject: '', body: '' });

export const SequencesView: React.FC = () => {
  const { capabilities, sequences, enrollments, createSequence, updateSequence, deleteSequence, cancelEnrollment, openUpgradeModal } = useApp();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Sequence | null>(null);

  if (!capabilities.ai) {
    return (
      <div className="view-container">
        <div className="view-header"><div className="view-title"><h1>Outreach Sequences</h1><p>Automated multi-step follow-up cadences.</p></div></div>
        <div className="glass-card" style={{ padding: 50, borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Lock size={40} color="hsl(var(--text-faint))" />
          <h3 style={{ color: 'hsl(var(--text-primary))', margin: 0 }}>Sequences are a Pro feature</h3>
          <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: 440 }}>Upgrade to automatically follow up with leads over days — from your own connected Gmail or Reddit account.</p>
          <button className="btn-primary" style={{ padding: '10px 20px' }} onClick={openUpgradeModal}>Upgrade to Pro</button>
        </div>
      </div>
    );
  }

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (s: Sequence) => { setEditing(s); setEditorOpen(true); };

  const enrollmentsBySeq = (seqId: string) => enrollments.filter(e => e.sequenceId === seqId);

  return (
    <div className="view-container">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="view-title"><h1>Outreach Sequences</h1><p>Automated multi-step follow-ups sent from your connected account, on a schedule.</p></div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }} onClick={openNew}>
          <Plus size={16} /> New Sequence
        </button>
      </div>

      {sequences.length === 0 ? (
        <div className="glass-card" style={{ padding: 50, borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Send size={36} color="hsl(var(--text-faint))" />
          <h3 style={{ color: 'hsl(var(--text-primary))', margin: 0 }}>No sequences yet</h3>
          <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: 440 }}>Create a cadence (e.g. intro → wait 3 days → follow up), then enroll leads from the Leads view. The backend sends each step automatically and stops if they reply.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {sequences.map(seq => {
            const meta = CHANNEL_META[seq.channel];
            const ChIcon = meta.icon;
            const enr = enrollmentsBySeq(seq.id);
            const active = enr.filter(e => e.status === 'active').length;
            return (
              <div key={seq.id} className="glass-card" style={{ padding: 18, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{seq.name}</h3>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: '0.75rem', color: meta.color, fontWeight: 600 }}>
                      <ChIcon size={12} /> {meta.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button title="Edit" onClick={() => openEdit(seq)} style={iconBtn}>Edit</button>
                    <button title="Delete" onClick={() => deleteSequence(seq.id)} style={{ ...iconBtn, color: 'hsl(var(--danger))' }}><Trash2 size={14} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {seq.steps.map((st, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                      <span style={stepNum}>{i + 1}</span>
                      <Clock size={11} />
                      <span>{st.delayDays === 0 ? (i === 0 ? 'Immediately' : 'Same day') : `+${st.delayDays}d`}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {st.subject || st.body.slice(0, 40) || '(empty)'}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid hsl(var(--surface-1))', paddingTop: 10, fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>
                  {seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''} · {active} active enrollment{active !== 1 ? 's' : ''}
                </div>

                {enr.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {enr.slice(0, 5).map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '0.78rem' }}>
                        <span style={{ color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.leadAuthor}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: `hsl(${STATUS_COLOR[e.status] || 'var(--text-muted)'})`, fontWeight: 600 }}>
                            {e.status === 'active' ? `step ${e.currentStep + 1}/${e.totalSteps}` : e.status}
                          </span>
                          {e.status === 'active' && (
                            <button title="Stop" onClick={() => cancelEnrollment(e.id)} style={{ ...iconBtn, padding: 2 }}><StopCircle size={13} /></button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editorOpen && (
        <SequenceEditor
          initial={editing}
          onClose={() => setEditorOpen(false)}
          onSave={(name, channel, steps) => {
            if (editing) updateSequence(editing.id, { name, channel, steps });
            else createSequence(name, channel, steps);
            setEditorOpen(false);
          }}
        />
      )}
    </div>
  );
};

// ─── Editor modal ─────────────────────────────────────────────
const SequenceEditor: React.FC<{
  initial: Sequence | null;
  onClose: () => void;
  onSave: (name: string, channel: 'email' | 'reddit', steps: SequenceStep[]) => void;
}> = ({ initial, onClose, onSave }) => {
  const [name, setName] = useState(initial?.name || '');
  const [channel, setChannel] = useState<'email' | 'reddit'>(initial?.channel || 'email');
  const [steps, setSteps] = useState<SequenceStep[]>(initial?.steps?.length ? initial.steps : [blankStep()]);

  const setStep = (i: number, patch: Partial<SequenceStep>) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const addStep = () => setSteps(prev => [...prev, { ...blankStep(), delayDays: 3 }]);
  const removeStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));

  const valid = name.trim() && steps.length > 0 && steps.every(s => s.body.trim());

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{initial ? 'Edit' : 'New'} Sequence</h2>
          <button onClick={onClose} style={iconBtn}><CloseIcon size={18} /></button>
        </div>

        <label style={label}>Name</label>
        <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 3-touch intro cadence" />

        <label style={label}>Channel</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {(['email', 'reddit'] as const).map(c => {
            const meta = CHANNEL_META[c];
            const Icon = meta.icon;
            return (
              <button key={c} onClick={() => setChannel(c)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px',
                borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                border: `1px solid ${channel === c ? 'hsl(var(--primary))' : 'hsl(var(--border-color))'}`,
                background: channel === c ? 'rgba(var(--primary-rgb), 0.1)' : 'hsl(var(--surface-1))',
                color: channel === c ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
              }}>
                <Icon size={15} /> {meta.label}
              </button>
            );
          })}
        </div>

        <label style={label}>Steps <span style={{ fontWeight: 400, color: 'hsl(var(--text-muted))' }}>— use {'{{name}}'}, {'{{keyword}}'}, {'{{title}}'} tokens</span></label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ border: '1px solid hsl(var(--border-color))', borderRadius: 10, padding: 12, background: 'hsl(var(--surface-1))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'hsl(var(--text-primary))' }}>Step {i + 1}</span>
                {steps.length > 1 && <button onClick={() => removeStep(i)} style={{ ...iconBtn, color: 'hsl(var(--danger))' }}><Trash2 size={13} /></button>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Clock size={13} color="hsl(var(--text-muted))" />
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Wait</span>
                <input type="number" min={0} style={{ ...input, width: 70, marginBottom: 0 }} value={s.delayDays}
                  onChange={e => setStep(i, { delayDays: Math.max(0, Number(e.target.value) || 0) })} />
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>days {i === 0 ? 'after enrolling' : 'after previous step'}</span>
              </div>
              <input style={{ ...input, marginBottom: 8 }} value={s.subject || ''} placeholder="Subject (optional)"
                onChange={e => setStep(i, { subject: e.target.value })} />
              <textarea style={{ ...input, minHeight: 80, resize: 'vertical', marginBottom: 0 }} value={s.body} placeholder="Message body…"
                onChange={e => setStep(i, { body: e.target.value })} />
            </div>
          ))}
        </div>
        <button onClick={addStep} style={{ ...iconBtn, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
          <Plus size={14} /> Add step
        </button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...iconBtn, padding: '10px 18px' }}>Cancel</button>
          <button className="btn-primary" style={{ padding: '10px 18px', opacity: valid ? 1 : 0.5 }} disabled={!valid}
            onClick={() => onSave(name, channel, steps)}>Save Sequence</button>
        </div>
      </div>
    </div>
  );
};

const iconBtn: React.CSSProperties = {
  padding: '6px 10px', background: 'hsl(var(--surface-1))', border: '1px solid hsl(var(--border-color))',
  borderRadius: 6, color: 'hsl(var(--text-secondary))', cursor: 'pointer', fontSize: '0.8rem',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};
const stepNum: React.CSSProperties = {
  width: 18, height: 18, borderRadius: '50%', background: 'hsl(var(--surface-2))', color: 'hsl(var(--text-primary))',
  fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 1000, padding: 20,
};
const modal: React.CSSProperties = {
  background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-strong))', borderRadius: 16,
  padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', margin: '12px 0 6px',
};
const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-color))',
  background: 'hsl(var(--surface-1))', color: 'hsl(var(--text-primary))', fontSize: '0.85rem', outline: 'none',
  marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit',
};

export default SequencesView;
