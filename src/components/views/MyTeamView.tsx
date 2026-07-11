import React from 'react';
import { Crown, Users, Mail, UserCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { TeamRosterUser } from '../../lib/db';

// Deterministic accent colour per teammate (so avatars stay stable across renders).
const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#0ea5e9'];
const colorFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const initials = (name: string) => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

export const MyTeamView: React.FC = () => {
  const { myTeam, myTeamRole, firebaseUser, isAuthenticated } = useApp();
  const myUid = firebaseUser?.uid;

  if (!isAuthenticated) {
    return (
      <div className="view-container">
        <div className="view-header"><div className="view-title">
          <h1>My Team</h1>
          <p>Sign in with your own account to see your team.</p>
        </div></div>
        <div className="glass-card" style={styles.empty}>
          <Users size={34} color="hsl(var(--text-faint))" />
          <p style={{ marginTop: 10 }}>Sign in to view your team leader and teammates.</p>
        </div>
      </div>
    );
  }

  const { leader, leaderUid, members } = myTeam;
  // Fellow members excluding the leader (the leader is shown separately on top).
  const teammates = members.filter(m => m.uid !== leaderUid);
  const onATeam = !!leaderUid && (!!leader || teammates.length > 0 || myTeamRole === 'leader');

  return (
    <div className="view-container">
      <div className="view-header"><div className="view-title">
        <h1>My Team</h1>
        <p>{myTeamRole === 'leader'
          ? 'Everyone on the team you lead.'
          : 'Your team leader and the teammates you work alongside.'}</p>
      </div></div>

      {!onATeam ? (
        <div className="glass-card" style={styles.empty}>
          <Users size={34} color="hsl(var(--text-faint))" />
          <p style={{ margin: '10px 0 0' }}>You're not part of a team yet.</p>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-faint))' }}>
            An administrator can add you to a team and assign your team leader.
          </p>
        </div>
      ) : (
        <>
          {/* Team leader */}
          <h3 style={styles.sectionTitle}>Team Leader</h3>
          {leader ? (
            <MemberCard user={leader} isLeader isMe={leader.uid === myUid} />
          ) : (
            <div className="glass-card" style={styles.empty}>
              <Crown size={28} color="hsl(var(--text-faint))" />
              <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>No leader assigned yet.</p>
            </div>
          )}

          {/* Members */}
          <h3 style={{ ...styles.sectionTitle, marginTop: 28 }}>
            Team Members <span style={styles.count}>{teammates.length}</span>
          </h3>
          {teammates.length === 0 ? (
            <div className="glass-card" style={styles.empty}>
              <Users size={28} color="hsl(var(--text-faint))" />
              <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>No other members on this team yet.</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {teammates
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(m => <MemberCard key={m.uid} user={m} isMe={m.uid === myUid} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MemberCard: React.FC<{ user: TeamRosterUser; isLeader?: boolean; isMe?: boolean }> = ({ user, isLeader, isMe }) => {
  const color = colorFor(user.uid || user.email || user.name);
  return (
    <div
      className="glass-card"
      style={{ ...styles.card, ...(isLeader ? styles.leaderCard : {}) }}
    >
      <div style={{ ...styles.avatar, background: color }}>{initials(user.name)}</div>
      <div style={styles.info}>
        <div style={styles.nameRow}>
          <span style={styles.name}>{user.name}</span>
          {isLeader && <span style={styles.leaderBadge}><Crown size={11} /> Leader</span>}
          {isMe && <span style={styles.meBadge}>You</span>}
        </div>
        {user.role && <div style={styles.role}><UserCircle2 size={12} /> {user.role}</div>}
        {user.email && (
          <a href={`mailto:${user.email}`} style={styles.email}><Mail size={12} /> {user.email}</a>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sectionTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 },
  count: { fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--text-muted))', background: 'hsl(var(--surface-1))', borderRadius: 20, padding: '2px 9px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card: { padding: 18, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 },
  leaderCard: { border: '1px solid rgba(var(--primary-rgb), 0.35)', background: 'rgba(var(--primary-rgb), 0.05)', maxWidth: 460 },
  avatar: { width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0 },
  info: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontWeight: 700, fontSize: '0.95rem', color: 'hsl(var(--text-primary))' },
  leaderBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 700, color: 'hsl(var(--primary))', background: 'rgba(var(--primary-rgb), 0.12)', border: '1px solid rgba(var(--primary-rgb), 0.28)', borderRadius: 20, padding: '2px 8px' },
  meBadge: { fontSize: '0.68rem', fontWeight: 700, color: 'hsl(var(--text-muted))', background: 'hsl(var(--surface-2))', borderRadius: 20, padding: '2px 8px' },
  role: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' },
  email: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'hsl(var(--text-muted))', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty: { padding: '40px 20px', borderRadius: 14, textAlign: 'center', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 460 },
};

export default MyTeamView;
