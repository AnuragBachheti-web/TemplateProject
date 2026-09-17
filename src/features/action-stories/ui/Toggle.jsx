import { useId } from 'react';

// A REAL `<input type="checkbox" role="switch">` under the hood (visually hidden via `sr-only`,
// never `display:none`), same reasoning as Checkbox.jsx: a screen reader announces "on"/"off" and
// the keyboard gets Space-to-toggle for free. Visuals are driven directly from the `checked` PROP,
// not CSS `peer-checked:` — the moving thumb sits nested a level inside the track the same way
// Checkbox's check glyph sits nested inside its box, and `peer-checked:` only ever reaches a DIRECT
// sibling of the input, never that nested descendant (see Checkbox.jsx's own doc comment for the
// same trap). Policy on/off switches (PolicyPanel's "Locked constraints", Decide's guardrail
// toggles) are the reference's own use for this — Checkbox is for selection, Toggle is for state.
/**
 * @param {boolean} checked
 * @param {(next: boolean) => void} [onChange]
 * @param {React.ReactNode} [label]
 * @param {boolean} [disabled]
 */
export default function Toggle({ checked = false, onChange, label, hideLabel = false, disabled = false, className = '' }) {
  const id = useId();
  const trackTone = checked ? 'bg-rf-brand-blue-500' : 'bg-rf-border-strong';

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2.5 text-[13px] text-rf-text-primary ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rf-brand-focus-ring ${trackTone}`}
      >
        <span
          className={`absolute h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[16px]' : 'translate-x-[2px]'}`}
        />
      </span>
      {label && <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>}
    </label>
  );
}
