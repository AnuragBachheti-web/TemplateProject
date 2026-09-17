// The one shared status pill — before this, FlagBlock hand-rolled its own yes/no pill and every
// future verdict/state label (Pinned, Approved, Blocked, a severity word) would have invented a
// fourth or fifth near-identical `rounded-full ... uppercase` span rather than reuse one, the same
// one-off-per-block drift Button.jsx already fixed for buttons (see its own doc comment).
//
// Tones reuse the same `rf-status-*`/`rf-brand-*` design tokens Alert.jsx and severityTone.js
// already use — never a new hardcoded palette. `neutral` is the default: a label that isn't a
// verdict at all (e.g. "Pinned", a stage name), so it gets the same ink/border tokens every other
// neutral UI element uses instead of being forced into a semantic color it doesn't have.
const TONE = {
  neutral: 'bg-rf-surface-sunken text-rf-text-secondary',
  brand: 'bg-rf-brand-tint-08 text-rf-brand-blue-500',
  info: 'bg-rf-brand-blue-500/10 text-rf-brand-blue-500',
  success: 'bg-rf-status-success/10 text-rf-status-success',
  warning: 'bg-rf-status-warning/10 text-rf-status-warning',
  critical: 'bg-rf-status-critical/10 text-rf-status-critical',
};

/**
 * @param {'neutral'|'brand'|'info'|'success'|'warning'|'critical'} [tone]
 * @param {string} [icon] - a Font Awesome class string, rendered before `children`.
 * @param {React.ReactNode} children
 */
export default function Badge({ tone = 'neutral', icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] ${TONE[tone] ?? TONE.neutral} ${className}`}
    >
      {icon && <i className={`${icon} text-[8.5px]`} aria-hidden="true" />}
      {children}
    </span>
  );
}
