import React, { useEffect } from 'react';
import { Bell, ShieldCheck, Mail } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { notify } from '../Toaster';

export const AlertsView: React.FC = () => {
  const { alerts, clearAlerts, markAlertsAsRead, alertSettings, updateAlertSettings } = useApp();
  const { email: emailAlerts, browser: browserAlerts } = alertSettings;

  // If the OS already granted notification permission in a past session, reflect that on load.
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && browserAlerts) {
      updateAlertSettings({ browser: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      notify('This browser does not support desktop notifications.', 'error');
      return;
    }
    if (browserAlerts) {
      updateAlertSettings({ browser: false });
      notify('Browser notifications turned off.', 'info');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      updateAlertSettings({ browser: true });
      new Notification('LeadQonnect Alerts', { body: 'Browser notifications enabled!' });
    } else {
      notify('Notification permission was denied in the browser.', 'error');
    }
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header">
        <div className="view-title">
          <h1>Real-time Lead Alerts</h1>
          <p>Deliver hot leads directly to your email or browser.</p>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Toggle Configuration */}
        <div className="glass-card" style={styles.configCard}>
          <h3 style={styles.cardTitle}>Alert Integrations</h3>
          <p style={styles.cardSubtitle}>Configure how and where you receive notifications.</p>

          <div style={styles.optionRow}>
            <div style={styles.optionHeader}>
              <Mail size={18} color="#3b82f6" />
              <div>
                <h4 style={styles.optionTitle}>Email Dispatch</h4>
                <p style={styles.optionDesc}>Receive a daily digest of all matched leads.</p>
              </div>
            </div>
            <label className="switch" style={styles.switch}>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={() => updateAlertSettings({ email: !emailAlerts })}
              />
              <span className="slider round" />
            </label>
          </div>

          <div style={styles.optionRow}>
            <div style={styles.optionHeader}>
              <Bell size={18} color="hsl(var(--primary))" />
              <div>
                <h4 style={styles.optionTitle}>Browser Notifications</h4>
                <p style={styles.optionDesc}>Pushes desktop alert immediately on matching.</p>
              </div>
            </div>
            <button
              onClick={requestBrowserPermission}
              className="btn-secondary"
              style={{ ...styles.permBtn, borderColor: browserAlerts ? 'hsl(var(--primary))' : 'hsl(var(--border-color))' }}
            >
              {browserAlerts ? 'Enabled' : 'Request Access'}
            </button>
          </div>
        </div>

        {/* Real-time Activity Logs */}
        <div className="glass-card" style={styles.logsCard}>
          <div style={styles.logsHeader}>
            <h3 style={styles.cardTitle}>Recent Alerts Log</h3>
            <div style={styles.logsActions}>
              <button onClick={markAlertsAsRead} className="btn-secondary" style={styles.logBtn}>
                Mark Read
              </button>
              <button onClick={clearAlerts} className="btn-danger" style={styles.logBtn}>
                Clear
              </button>
            </div>
          </div>
          <p style={styles.cardSubtitle}>Audit trail of recent crawlers alerts.</p>

          <div style={styles.logsList}>
            {alerts.length === 0 ? (
              <div style={styles.emptyLogs}>
                <ShieldCheck size={36} color="hsl(var(--text-faint))" />
                <p style={{ marginTop: '10px' }}>No active notifications.</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div 
                  key={alert.id}
                  style={{
                    ...styles.logRow,
                    borderLeftColor: alert.read ? 'transparent' : 'hsl(var(--primary))',
                    background: alert.read ? 'transparent' : 'rgba(var(--primary-rgb), 0.02)'
                  }}
                >
                  <div style={styles.logMain}>
                    <p style={{ ...styles.logMessage, color: alert.read ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-primary))' }}>
                      {alert.message}
                    </p>
                    <span style={styles.logTime}>{alert.timestamp}</span>
                  </div>
                  {!alert.read && <span style={styles.unreadDot} />}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '25px'
  },
  configCard: {
    padding: '24px',
    borderRadius: '12px'
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'hsl(var(--text-primary))',
    marginBottom: '6px'
  },
  cardSubtitle: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-secondary))',
    marginBottom: '20px'
  },
  optionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 0',
    borderBottom: '1px solid hsl(var(--surface-1))',
    '&:last-child': {
      borderBottom: 'none'
    }
  },
  optionHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start'
  },
  optionTitle: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'hsl(var(--text-primary))',
    marginBottom: '4px'
  },
  optionDesc: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-muted))',
    maxWidth: '280px',
    lineHeight: '1.4'
  },
  permBtn: {
    padding: '6px 12px',
    fontSize: '0.8rem'
  },
  logsCard: {
    padding: '24px',
    borderRadius: '12px'
  },
  logsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logsActions: {
    display: 'flex',
    gap: '10px'
  },
  logBtn: {
    padding: '4px 10px',
    fontSize: '0.75rem'
  },
  logsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginTop: '20px',
    maxHeight: '340px',
    overflowY: 'auto' as const
  },
  emptyLogs: {
    textAlign: 'center' as const,
    padding: '50px 20px',
    color: 'hsl(var(--text-muted))'
  },
  logRow: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid hsl(var(--surface-1))',
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logMain: {
    flex: 1
  },
  logMessage: {
    fontSize: '0.85rem',
    lineHeight: '1.4',
    marginBottom: '4px'
  },
  logTime: {
    fontSize: '0.75rem',
    color: 'hsl(var(--text-faint))'
  },
  unreadDot: {
    width: '6px',
    height: '6px',
    backgroundColor: 'hsl(var(--primary))',
    borderRadius: '50%',
    boxShadow: '0 0 6px hsl(var(--primary))'
  },
  switch: {
    position: 'relative' as const,
    display: 'inline-block',
    width: '40px',
    height: '20px'
  }
};

// Add standard switch styling elements dynamically
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: hsl(var(--border-color));
      transition: .3s;
      border-radius: 20px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background-color: hsl(var(--text-primary));
      transition: .3s;
      border-radius: 50%;
    }
    .switch input:checked + .slider {
      background-color: hsl(var(--primary));
    }
    .switch input:checked + .slider:before {
      transform: translateX(20px);
    }
  `;
  document.head.appendChild(styleEl);
}
export default AlertsView;
