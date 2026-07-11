import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';

// Lightweight, app-wide notifications + confirm dialogs that match the Aurora Glass theme.
// Use anywhere (incl. non-component code) via the exported notify()/confirmDialog() helpers.

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; message: string }
interface ConfirmReq {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}

let toastListeners: ((t: Toast[]) => void)[] = [];
let confirmListener: ((c: ConfirmReq | null) => void) | null = null;
let toasts: Toast[] = [];
let seq = 1;

const emit = () => toastListeners.forEach(l => l([...toasts]));

export function notify(message: string, type: ToastType = 'info', durationMs = 4500) {
  const id = seq++;
  toasts = [...toasts, { id, type, message }];
  emit();
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); emit(); }, durationMs);
}

/** Promise-based confirm. Falls back to window.confirm if the Toaster isn't mounted. */
export function confirmDialog(opts: {
  title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean;
}): Promise<boolean> {
  return new Promise(resolve => {
    if (!confirmListener) { resolve(window.confirm(opts.message)); return; }
    confirmListener({
      title: opts.title || 'Are you sure?',
      message: opts.message,
      confirmLabel: opts.confirmLabel || 'Confirm',
      cancelLabel: opts.cancelLabel || 'Cancel',
      danger: !!opts.danger,
      resolve,
    });
  });
}

const ACCENT: Record<ToastType, string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  info: 'var(--primary)',
};

const ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
};

export const Toaster: React.FC = () => {
  const [list, setList] = useState<Toast[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null);

  useEffect(() => {
    const l = (t: Toast[]) => setList(t);
    toastListeners.push(l);
    confirmListener = (c) => setConfirmReq(c);
    return () => {
      toastListeners = toastListeners.filter(x => x !== l);
      confirmListener = null;
    };
  }, []);

  const dismiss = (id: number) => { toasts = toasts.filter(t => t.id !== id); emit(); };
  const resolveConfirm = (v: boolean) => { confirmReq?.resolve(v); setConfirmReq(null); };

  return (
    <>
      {/* Toast stack */}
      <div style={styles.toastWrap}>
        {list.map(t => (
          <div key={t.id} className="glass-card" style={{ ...styles.toast, borderLeft: `3px solid hsl(${ACCENT[t.type]})` }}>
            <span style={{ color: `hsl(${ACCENT[t.type]})`, display: 'flex', flexShrink: 0 }}>{ICON[t.type]}</span>
            <span style={styles.toastMsg}>{t.message}</span>
            <button onClick={() => dismiss(t.id)} style={styles.toastClose} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmReq && (
        <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) resolveConfirm(false); }}>
          <div className="glass-card" style={styles.dialog}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: confirmReq.danger ? 'hsl(var(--danger) / 0.12)' : 'rgba(var(--primary-rgb), 0.12)',
                color: confirmReq.danger ? 'hsl(var(--danger))' : 'hsl(var(--primary))',
              }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={styles.dialogTitle}>{confirmReq.title}</h3>
            </div>
            <p style={styles.dialogMsg}>{confirmReq.message}</p>
            <div style={styles.dialogActions}>
              <button onClick={() => resolveConfirm(false)} className="btn-secondary" style={{ padding: '9px 18px' }}>
                {confirmReq.cancelLabel}
              </button>
              <button
                onClick={() => resolveConfirm(true)}
                style={{
                  padding: '9px 18px', borderRadius: '10px', border: 'none', fontWeight: 600, cursor: 'pointer',
                  color: confirmReq.danger ? 'hsl(var(--danger))' : 'hsl(var(--primary-contrast))',
                  background: confirmReq.danger ? 'hsl(var(--danger) / 0.14)' : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-hover)))',
                  boxShadow: confirmReq.danger ? 'none' : '0 6px 18px -6px var(--glow-strong)',
                }}
              >
                {confirmReq.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toastWrap: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: 'min(380px, calc(100vw - 40px))',
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '12px',
    pointerEvents: 'auto',
    animation: 'toastIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  toastMsg: { flex: 1, fontSize: '0.85rem', color: 'hsl(var(--text-primary))', lineHeight: 1.45 },
  toastClose: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))',
    display: 'flex', padding: 0, flexShrink: 0, marginTop: '1px',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 10001,
    background: 'rgba(8, 10, 28, 0.55)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    animation: 'fadeIn 0.2s ease-out',
  },
  dialog: { width: '100%', maxWidth: '420px', padding: '24px', borderRadius: '18px', boxShadow: 'var(--shadow-lg)' },
  dialogTitle: { fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--text-primary))', margin: 0 },
  dialogMsg: { fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.55, marginBottom: '22px' },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px' },
};
