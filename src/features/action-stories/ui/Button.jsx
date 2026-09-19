import { forwardRef } from 'react';
import { typeRole } from '../blocks/typeRole';

import { surfaceTier } from '../blocks/surfaceTier';
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

// A button's LABEL is body text; only its box changes with size. The two sizes used to differ in
// font-size as well (12px / 13.5px), which made `sm` a seventh type role in disguise.
const SIZE = {
  sm: 'h-8 px-3 gap-1.5',
  md: 'h-10 px-[18px] gap-2',
};

const VARIANT = {
  primary: 'bg-rf-brand-blue-500 text-white hover:bg-rf-brand-blue-600',
  secondary:
    `${surfaceTier('card').className} text-rf-text-primary hover:bg-rf-brand-tint-08`,
  ghost: 'bg-transparent text-rf-text-secondary hover:bg-rf-brand-tint-08',
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
      // A BUTTON'S LABEL NEEDS A ROLE. It had none — the size was whatever the surrounding text
      // happened to be, which is how the pane's forward action ended up rendering at heading size.
      // `small` is the chrome size: a button is scanned, not read.
      className={`${typeRole('small').className} inline-flex items-center justify-center rounded-lg transition-colors duration-fast ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring disabled:cursor-not-allowed disabled:opacity-60 ${SIZE[size] ?? SIZE.md} ${VARIANT[variant] ?? VARIANT.primary} ${className}`}
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
