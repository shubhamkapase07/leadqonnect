import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, ShieldBan, Trash2, ShieldCheck, ShieldMinus } from 'lucide-react';

export const UsersManagement: React.FC = () => {
  const { allUsers, suspendUser, deleteUser, promoteToAdmin, demoteFromAdmin, setUserTeamRole } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Users designated as team leaders — the pool a member can be assigned to.
  const leaders = allUsers.filter(u => u.teamRole === 'leader');
  const leaderName = (uid?: string) => allUsers.find(u => u.id === uid)?.name || 'leader';

  const teamValue = (u: typeof allUsers[number]) =>
    u.teamRole === 'leader' ? 'leader' : u.parentUid ? `member:${u.parentUid}` : 'none';

  const handleTeamChange = (userId: string, value: string) => {
    if (value === 'leader') setUserTeamRole(userId, 'leader');
    else if (value === 'none') setUserTeamRole(userId, 'none');
    else if (value.startsWith('member:')) setUserTeamRole(userId, 'member', value.slice('member:'.length));
  };

  return (
    <div className="view-container">
      <header className="view-header">
        <div>
          <h1 className="view-title">User Management</h1>
          <p className="view-subtitle">Manage all accounts registered on LeadQonnect.</p>
        </div>
        <div style={styles.searchBox}>
          <Search size={16} color="hsl(var(--text-muted))" />
          <input 
            type="text" 
            placeholder="Search users..." 
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="glass-card" style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Plan</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Team</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Joined</th>
              <th style={{...styles.th, textAlign: 'right'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{user.name}</div>
                </td>
                <td style={styles.td}>{user.email}</td>
                <td style={styles.td}>
                  <span style={styles.planBadge(user.plan)}>
                    {user.plan.toUpperCase()}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.roleBadge(user.role)}>
                    {user.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </td>
                <td style={styles.td}>
                  <select
                    value={teamValue(user)}
                    onChange={(e) => handleTeamChange(user.id, e.target.value)}
                    style={styles.teamSelect}
                    title={user.teamRole === 'member' ? `Member · reports to ${leaderName(user.parentUid)}` : undefined}
                  >
                    <option value="none">No team</option>
                    <option value="leader">★ Team Leader</option>
                    {leaders.filter(l => l.id !== user.id).map(l => (
                      <option key={l.id} value={`member:${l.id}`}>Member · {l.name}</option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <span style={styles.statusBadge(user.status)}>
                    {user.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td style={styles.td}>{user.joinedAt}</td>
                <td style={{...styles.td, textAlign: 'right'}}>
                  <div style={styles.actionButtons}>
                    {user.role === 'admin' ? (
                      <button
                        style={styles.iconBtn}
                        onClick={() => demoteFromAdmin(user.id)}
                        title="Remove admin access"
                      >
                        <ShieldMinus size={16} color="#f59e0b" />
                      </button>
                    ) : (
                      <button
                        style={styles.iconBtn}
                        onClick={() => promoteToAdmin(user.id)}
                        title="Make admin"
                      >
                        <ShieldCheck size={16} color="hsl(var(--primary))" />
                      </button>
                    )}
                    <button
                      style={styles.iconBtn}
                      onClick={() => suspendUser(user.id)}
                      title={user.status === 'active' ? "Suspend User" : "Activate User"}
                    >
                      <ShieldBan size={16} color={user.status === 'active' ? '#f59e0b' : 'hsl(var(--primary))'} />
                    </button>
                    <button
                      style={styles.iconBtn}
                      onClick={() => deleteUser(user.id)}
                      title="Delete User"
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  No users found matching "{searchTerm}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const styles = {
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '8px',
    padding: '8px 12px',
    width: '250px'
  },
  searchInput: {
    background: 'none',
    border: 'none',
    color: 'hsl(var(--text-primary))',
    outline: 'none',
    width: '100%',
    fontSize: '0.9rem'
  },
  tableCard: {
    padding: '0',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const
  },
  th: {
    padding: '16px 24px',
    borderBottom: '1px solid hsl(var(--surface-1))',
    color: 'hsl(var(--text-secondary))',
    fontSize: '0.85rem',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  tr: {
    borderBottom: '1px solid hsl(var(--surface-1))',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '16px 24px',
    color: 'hsl(var(--text-secondary))',
    fontSize: '0.9rem'
  },
  planBadge: (plan: string) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: plan === 'agency' ? 'rgba(168, 85, 247, 0.12)' :
                     plan === 'premium' ? 'rgba(var(--primary-rgb), 0.1)' :
                     plan === 'trial' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.1)',
    color: plan === 'agency' ? '#a855f7' :
           plan === 'premium' ? 'hsl(var(--primary))' :
           plan === 'trial' ? '#3b82f6' : 'hsl(var(--text-secondary))'
  }),
  teamSelect: {
    background: 'hsl(var(--surface-1))',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '6px',
    color: 'hsl(var(--text-primary))',
    fontSize: '0.8rem',
    padding: '5px 8px',
    cursor: 'pointer',
    outline: 'none',
    maxWidth: '160px',
  },
  roleBadge: (role: string) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: role === 'admin' ? 'rgba(var(--primary-rgb), 0.12)' : 'hsl(var(--surface-2))',
    color: role === 'admin' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))',
    border: role === 'admin' ? '1px solid rgba(var(--primary-rgb), 0.3)' : '1px solid hsl(var(--border-color))'
  }),
  statusBadge: (status: string) => ({
    padding: '4px 8px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
    backgroundColor: status === 'active' ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(239, 68, 68, 0.05)',
    color: status === 'active' ? 'hsl(var(--primary))' : '#ef4444',
    border: `1px solid ${status === 'active' ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(239,68,68,0.2)'}`
  }),
  actionButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    padding: '6px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'hsl(var(--surface-1))',
    transition: 'background-color 0.2s'
  }
};
