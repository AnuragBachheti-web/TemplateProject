import { typeRole } from '../blocks/typeRole';
import { glyph } from '../blocks/glyphSize';
// A PERSISTENT, in-place notice — distinct from Toast.jsx's transient, auto-dismissing one.
// StageActionBar's own error indicator was already exactly this (a hand-rolled
// `role="alert"` pill with an icon + message), just never pulled out into something a second
// call site could reuse — the same one-off-per-block drift Button.jsx/severityTone.js/chartPalette.js
// already fixed for buttons and status color. `compact` is the same convention every other block in
// this app already follows (BlockCard, LabelValueListBlock, ItemQueueBlock, ...): true renders the
// tight inline pill a status bar needs, false renders a full block-level banner (title + body +
// optional dismiss) for a page-level warning ("9 SKUs blocked by MAP", "Auto-revert not armed" —
// the reference mockups' own persistent-warning pattern, not yet backed by a real manifest field to
// bind one automatically, but ready for the day one exists).
const TONE = {
  info: { icon: 'fa-solid fa-circle-info', text: 'text-rf-brand-blue-500', iconTone: 'text-rf-brand-blue-500', border: 'border-rf-brand-blue-500/30', bg: 'bg-rf-brand-blue-500/10' },
  success: { icon: 'fa-solid fa-circle-check', text: 'text-rf-status-success-text', iconTone: 'text-rf-status-success-icon', border: 'border-rf-status-success/30', bg: 'bg-rf-status-success/10' },
  warning: { icon: 'fa-solid fa-triangle-exclamation', text: 'text-rf-status-warning-text', iconTone: 'text-rf-status-warning-icon', border: 'border-rf-status-warning/30', bg: 'bg-rf-status-warning/10' },
  critical: { icon: 'fa-solid fa-triangle-exclamation', text: 'text-rf-status-critical-text', iconTone: 'text-rf-status-critical-icon', border: 'border-rf-status-critical/30', bg: 'bg-rf-status-critical/10' },
};

/**
 * @param {'info'|'success'|'warning'|'critical'} [tone]
 * @param {string} [title] - full-banner mode only; a compact pill has no room for a separate title.
 * @param {React.ReactNode} children - the message.
 * @param {() => void} [onDismiss] - shows a dismiss (×) button when provided.
 * @param {boolean} [compact] - true: a tight inline pill (a status bar's own error/success line);
 *   false (default): a full block-level banner.
 */
export default function Alert({ tone = 'info', title, children, onDismiss, compact = false, className = '' }) {
  const t = TONE[tone] ?? TONE.info;
  const role = tone === 'critical' || tone === 'warning' ? 'alert' : 'status';

  if (compact) {
    return (
      <span
        role={role}
        className={`${typeRole('body').className} inline-flex items-center gap-2 rounded-full px-3 py-1 ${t.bg} ${t.text} ${className}`}
      >
        {/* AN ICON TAKES NO TYPE ROLE (R89): a role may carry a font-family, and a family that is
            not Font Awesome turns the glyph into a tofu box — this exact line was rendering one on
            58 panes. The size is a GLYPH size; see T95's icon exemption and T101's gate. */}
        <i className={`${glyph(10)} ${t.icon}`} aria-hidden="true" />
        {children}
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-0.5 opacity-70 hover:opacity-100">
            <i className={`fa-solid fa-xmark ${glyph(9)}`} aria-hidden="true" />
          </button>
        )}
      </span>
    );
  }

  return (
    <div role={role} className={`${typeRole('body').className} flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${t.border} ${t.bg} ${className}`}>
      <i className={`${glyph(13)} ${t.icon} mt-[1px] ${t.iconTone}`} aria-hidden="true" />
      <div className="flex-1">
        {title && <p className="text-rf-text-primary"><strong>{title}</strong></p>}
        <div className={title ? 'mt-0.5 text-rf-text-secondary' : 'text-rf-text-primary'}>{children}</div>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-rf-text-tertiary hover:text-rf-text-primary">
          <i className={`fa-solid fa-xmark ${glyph(11)}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
