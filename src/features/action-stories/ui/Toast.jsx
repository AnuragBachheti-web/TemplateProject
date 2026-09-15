import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Transient, app-wide feedback for the MOMENT an action settles — complements, never replaces, a
// persistent inline status (StageActionBar's own "Confirmed"/error indicator stays exactly where it
// was; this is what a user sees even if they've already scrolled away from the button they clicked).
// "Visibility of system status" is Nielsen Norman's own heuristic; a toast is the industry-standard
// way every SaaS dashboard (this one included, once wired up) satisfies it for a fire-and-forget
// action. Mount <ToastProvider> once, near the app root (see App.jsx) — any component below it
// calls useToast().notify(...) to raise one; nothing has to be passed down through props.
const ToastContext = createContext(null);

const TONE_ICON = {
  success: 'fa-solid fa-circle-check',
  critical: 'fa-solid fa-triangle-exclamation',
  warning: 'fa-solid fa-triangle-exclamation',
  info: 'fa-solid fa-circle-info',
};
// Only the icon and border carry the tone color — the message itself stays the normal, always
// legible rf-text-primary. Tinting an entire long message green/red (as a first draft of this did)
// reads worse the longer the message gets; every rf-status-* dashboard indicator elsewhere in this
// app (severityTone.js, deltaTone.js, StageActionBar's own badges) keeps body text neutral too.
const TONE_ICON_CLASS = {
  success: 'text-rf-status-success',
  critical: 'text-rf-status-critical',
  warning: 'text-rf-status-warning',
  info: 'text-rf-brand-blue-500',
};
const TONE_BORDER_CLASS = {
  success: 'border-rf-status-success/30',
  critical: 'border-rf-status-critical/30',
  warning: 'border-rf-status-warning/30',
  info: 'border-rf-brand-blue-500/30',
};
// A failure sits on screen longer than a plain confirmation — the user needs time to actually read
// it, not just notice a flash of red. `Infinity` (an explicit `{ duration: Infinity }` call) means
// "stays until the caller/user dismisses it" — never auto-cleared.
const DEFAULT_DURATION_MS = { success: 4000, info: 4000, warning: 5000, critical: 6000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Set());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message, { tone = 'info', duration } = {}) => {
      const id = ++nextId.current;
      setToasts((prev) => [...prev, { id, tone, message }]);
      const ms = duration ?? DEFAULT_DURATION_MS[tone] ?? DEFAULT_DURATION_MS.info;
      if (ms !== Infinity) {
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          dismiss(id);
        }, ms);
        timers.current.add(timer);
      }
      return id;
    },
    [dismiss],
  );

  // Never leaves a pending auto-dismiss timer firing into an unmounted provider (route change away
  // from the whole app shell, or — in tests — the next test's fresh render).
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end">
          {toasts.map((t) => {
            const assertive = t.tone === 'critical' || t.tone === 'warning';
            return (
              <div
                key={t.id}
                role={assertive ? 'alert' : 'status'}
                aria-live={assertive ? 'assertive' : 'polite'}
                className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-rf-surface-raised px-3.5 py-3 text-[12.5px] font-medium text-rf-text-primary shadow-lg ${TONE_BORDER_CLASS[t.tone] ?? TONE_BORDER_CLASS.info}`}
              >
                <i
                  className={`mt-[1px] text-[12px] ${TONE_ICON[t.tone] ?? TONE_ICON.info} ${TONE_ICON_CLASS[t.tone] ?? TONE_ICON_CLASS.info}`}
                  aria-hidden="true"
                />
                <span className="flex-1 text-rf-text-primary">{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="text-rf-text-tertiary hover:text-rf-text-primary"
                >
                  <i className="fa-solid fa-xmark text-[11px]" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

/** @returns {{ notify: (message: string, opts?: { tone?: 'success'|'critical'|'warning'|'info', duration?: number }) => number, dismiss: (id: number) => void }} */
// A context's provider and its own accessor hook belong in one file; splitting them to satisfy
// Fast Refresh would buy nothing but an extra import everywhere ToastProvider is used.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be called within a <ToastProvider> (see App.jsx).');
  }
  return ctx;
}
