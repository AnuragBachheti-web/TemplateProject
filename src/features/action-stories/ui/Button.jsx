import { forwardRef } from 'react';

// The one shared button — before this, StageActionBar's CTA, TableBlock's pagination controls, and
// TableBlock's own column-sort header button each hand-rolled their own independent `<button
// className="...">` with three different paddings/sizes/hover treatments. A future screen that
// needs a primary + a secondary + a plain-text action side by side (e.g. a confirm dialog's
// "Cancel"/"Confirm" pair) would otherwise invent a FOURTH style rather than reuse one.
//
// Variants map onto the same rf-status-*/rf-brand-*/rf-surface-* design tokens every other block
// already uses — never a new hardcoded palette. `destructive` is for an action with a real,
// hard-to-reverse consequence (see ConfirmDialog.jsx); every other action-bar/CTA button is
// `primary`.

const SIZE = {
  sm: 'h-8 px-3 text-[12px] gap-1.5',
  md: 'h-10 px-[18px] text-[13.5px] gap-2',
};

const VARIANT = {
  primary: 'bg-rf-brand-blue-500 text-white hover:bg-rf-brand-blue-600',
  secondary:
    'border border-rf-border-subtle bg-rf-surface-canvas text-rf-text-primary hover:bg-rf-surface-sunken',
  ghost: 'bg-transparent text-rf-text-secondary hover:bg-rf-surface-sunken',
  destructive: 'bg-rf-status-critical text-white hover:opacity-90',
};

/**
 * @param {'primary'|'secondary'|'ghost'|'destructive'} [variant]
 * @param {'sm'|'md'} [size]
 * @param {string} [icon] - a Font Awesome class string (e.g. "fa-solid fa-arrow-right"), rendered
 *   before `children`; hidden automatically while `loading` (the spinner takes its place).
 * @param {boolean} [loading] - shows a spinner and forces `disabled` — the mutation is in flight.
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon, loading = false, disabled = false, children, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring disabled:cursor-not-allowed disabled:opacity-60 ${SIZE[size] ?? SIZE.md} ${VARIANT[variant] ?? VARIANT.primary} ${className}`}
      {...rest}
    >
      {loading ? (
        <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : icon ? (
        <i className={icon} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
});

export default Button;
