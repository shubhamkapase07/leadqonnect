import React, { useEffect, useRef, useState } from 'react';
import { Send, MessagesSquare, Lock, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { subscribeTeamChat, sendTeamChatMessage, type TeamChatMessage } from '../../lib/db';
import { notify } from '../Toaster';

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#0ea5e9'];
const colorFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const initials = (name: string) => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const TeamChatView: React.FC = () => {
  const { myTeam, myTeamRole, teamChatEnabled, firebaseUser, userProfile, openUpgradeModal, isAuthenticated } = useApp();
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const teamId = myTeam.leaderUid;
  const myUid = firebaseUser?.uid;

  // Live-subscribe to the team channel when chat is available.
  useEffect(() => {
    if (!teamId || !teamChatEnabled) { setMessages([]); return; }
    const unsub = subscribeTeamChat(teamId, setMessages);
    return unsub;
  }, [teamId, teamChatEnabled]);

  // Keep the view pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !teamId || !myUid) return;
    setSending(true);
    try {
      await sendTeamChatMessage(teamId, { senderUid: myUid, senderName: userProfile?.name || 'Me', text });
      setDraft('');
    } catch (err) {
      console.error('send chat failed:', err);
      notify('Could not send your message. Try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const Header = (
    <div className="view-header"><div className="view-title">
      <h1>Team Chat</h1>
      <p>Message everyone on your team in one place.</p>
    </div></div>
  );

  if (!isAuthenticated) {
    return <div className="view-container">{Header}<Empty icon={<Users size={34} />} text="Sign in with your own account to use team chat." /></div>;
  }
  if (!teamId || !myTeamRole) {
    return <div className="view-container">{Header}<Empty icon={<Users size={34} />} text="You're not part of a team yet. An administrator can add you to one." /></div>;
  }
  if (!teamChatEnabled) {
    return (
      <div className="view-container">{Header}
        <div className="glass-card" style={styles.empty}>
          <div style={styles.lockIcon}><Lock size={26} /></div>
          <h3 style={{ margin: '4px 0 0', color: 'hsl(var(--text-primary))' }}>Team chat is an Agency feature</h3>
          <p style={{ margin: '8px 0 0', maxWidth: 380 }}>
            {myTeamRole === 'leader'
              ? 'Upgrade your workspace to the Agency plan to chat with your whole team in real time.'
              : 'Ask your team admin to upgrade to the Agency plan to unlock team chat.'}
          </p>
          {myTeamRole === 'leader' && (
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={openUpgradeModal}>Upgrade to Agency</button>
          )}
        </div>
      </div>
    );
  }

  const memberCount = myTeam.members.length;

  return (
    <div className="view-container">
      <div className="view-header" style={{ alignItems: 'center' }}>
        <div className="view-title">
          <h1>Team Chat</h1>
          <p>{memberCount} {memberCount === 1 ? 'person' : 'people'} on this channel</p>
        </div>
      </div>

      <div className="glass-card" style={styles.chatCard}>
        <div ref={scrollRef} style={styles.messages}>
          {messages.length === 0 ? (
            <div style={styles.emptyThread}>
              <MessagesSquare size={30} color="hsl(var(--text-faint))" />
              <p style={{ margin: '8px 0 0' }}>No messages yet — say hello to your team 👋</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.senderUid === myUid;
              const prev = messages[i - 1];
              const showMeta = !prev || prev.senderUid !== m.senderUid;
              return (
                <div key={m.id} style={{ ...styles.row, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  {!mine && (
                    <div style={{ ...styles.avatar, background: colorFor(m.senderUid), visibility: showMeta ? 'visible' : 'hidden' }}>
                      {initials(m.senderName)}
                    </div>
                  )}
                  <div style={{ maxWidth: '68%' }}>
                    {showMeta && (
                      <div style={{ ...styles.meta, textAlign: mine ? 'right' : 'left' }}>
                        {mine ? 'You' : m.senderName} · {clockTime(m.createdAt)}
                      </div>
                    )}
                    <div style={{ ...styles.bubble, ...(mine ? styles.bubbleMine : styles.bubbleOther) }}>{m.text}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={styles.inputBar}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message…  (Enter to send, Shift+Enter for a new line)"
            className="form-input"
            style={styles.input}
            rows={1}
          />
          <button className="btn-primary" style={styles.sendBtn} onClick={send} disabled={sending || !draft.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Empty: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="glass-card" style={styles.empty}>
    <span style={{ color: 'hsl(var(--text-faint))' }}>{icon}</span>
    <p style={{ marginTop: 10 }}>{text}</p>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  chatCard: { display: 'flex', flexDirection: 'column', padding: 0, height: 'calc(100vh - 190px)', minHeight: 420, overflow: 'hidden' },
  messages: { flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 },
  meta: { fontSize: '0.7rem', color: 'hsl(var(--text-muted))', margin: '6px 4px 3px' },
  bubble: { padding: '9px 13px', borderRadius: 14, fontSize: '0.88rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  bubbleMine: { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-contrast))', borderBottomRightRadius: 4 },
  bubbleOther: { background: 'hsl(var(--surface-1))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-color))', borderBottomLeftRadius: 4 },
  inputBar: { display: 'flex', alignItems: 'flex-end', gap: 10, padding: 14, borderTop: '1px solid hsl(var(--border-color))', background: 'hsl(var(--bg-card))' },
  input: { flex: 1, resize: 'none', maxHeight: 120, fontSize: '0.9rem', padding: '10px 12px' },
  sendBtn: { width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emptyThread: { margin: 'auto', textAlign: 'center', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  empty: { padding: '46px 20px', borderRadius: 14, textAlign: 'center', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 460 },
  lockIcon: { width: 54, height: 54, borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.1)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
};

export default TeamChatView;
