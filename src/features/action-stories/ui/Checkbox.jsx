import { useId } from 'react';

import { typeRole } from '../blocks/typeRole';
import { glyph } from '../blocks/glyphSize';
import { surfaceTier } from '../blocks/surfaceTier';
// A REAL `<input type="checkbox">` under the hood (visually hidden via `sr-only`, never
// `display:none` — a screen reader and the keyboard still need it), not a hand-rolled
// `<div onClick>` — that gets you tabIndex, Space-to-toggle, and a screen reader announcing
// "checked"/"unchecked" for free, correctly, instead of having to reinvent all three. Checked/
// indeterminate/disabled visuals are driven directly from the `checked`/`indeterminate` PROPS in
// JS, not CSS `:checked`/`peer-checked` pseudo-classes — simpler to reason about, and it sidesteps
// a real trap: `peer-checked:` only ever applies to a DIRECT sibling of the input, never a nested
// descendant of one (the check glyph here sits one level inside the visible box), so a CSS-only
// version would have silently never shown its own check mark.
/**
 * @param {boolean} checked
 * @param {(next: boolean) => void} [onChange]
 * @param {boolean} [indeterminate] - "some, not all, of a group are checked" — a real tri-state
 *   Select does not have a `checked` value of its own; this only ever affects the glyph shown.
 * @param {React.ReactNode} [label]
 * @param {boolean} [disabled]
 */
export default function Checkbox({ checked = false, onChange, indeterminate = false, label, hideLabel = false, disabled = false, className = '' }) {
  const id = useId();
  const boxTone =
    checked || indeterminate
      ? 'border-rf-brand-blue-500 bg-rf-brand-blue-500 text-white'
      : `border-rf-border-strong ${surfaceTier('card').className} text-transparent`;

  return (
    <label
      htmlFor={id}
      className={`${typeRole('small').className} inline-flex items-center gap-2 text-rf-text-primary ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : checked}
        onChange={(e) => onChange?.(e.target.checked)}
        ref={(node) => {
          if (node) node.indeterminate = indeterminate && !checked;
        }}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rf-brand-focus-ring ${boxTone}`}
      >
        <i className={`fa-solid ${indeterminate && !checked ? 'fa-minus' : 'fa-check'} ${glyph(10)}`} aria-hidden="true" />
      </span>
      {/* `hideLabel` keeps the accessible name without occupying layout — a selection checkbox in a
          table cell still needs a name for screen readers, but must not widen the column. */}
      {label && <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>}
    </label>
  );
}
