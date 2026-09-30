import { createContext, useCallback, useContext, useRef, useState } from 'react';
import styles from './interactions.module.css';

const InteractionContext = createContext(null);

let toastSeq = 0;

function Toaster({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className={styles.toastHost}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.type] || styles.info}`}
          onClick={() => onDismiss(t.id)}
          role="status"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null;
  return (
    <div className={styles.overlay} onClick={() => onClose(false)}>
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h3 id="confirm-title" className={styles.dialogTitle}>{dialog.title}</h3>
        {dialog.message && <p className={styles.dialogMsg}>{dialog.message}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.cancelBtn} onClick={() => onClose(false)}>
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            className={dialog.danger ? styles.dangerBtn : styles.confirmBtn}
            onClick={() => onClose(true)}
            autoFocus
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InteractionProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) { clearTimeout(timer); delete timers.current[id]; }
  }, []);

  const toast = useCallback((type, message, duration = 3800) => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, type, message }]);
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismissToast(id), duration);
    }
  }, [dismissToast]);

  const success = useCallback((m) => toast('success', m), [toast]);
  const info = useCallback((m) => toast('info', m), [toast]);
  const warn = useCallback((m) => toast('warn', m, 5200), [toast]);
  const error = useCallback((m) => toast('error', m, 6000), [toast]);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      const o = typeof opts === 'string' ? { message: opts } : opts || {};
      setDialog({
        title: (o.title ?? 'Are you sure?') + '',
        message: o.message || '',
        confirmLabel: o.confirmLabel || 'Confirm',
        cancelLabel: o.cancelLabel || 'Cancel',
        danger: !!o.danger,
        resolve,
      });
    });
  }, []);

  const closeDialog = useCallback((result) => {
    setDialog((cur) => {
      if (cur) cur.resolve(result);
      return null;
    });
  }, []);

  const api = { toast, success, info, warn, error, confirm };

  return (
    <InteractionContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog dialog={dialog} onClose={closeDialog} />
    </InteractionContext.Provider>
  );
}

export function useInteractions() {
  const ctx = useContext(InteractionContext);
  if (!ctx) throw new Error('useInteractions must be used within an InteractionProvider');
  return ctx;
}
