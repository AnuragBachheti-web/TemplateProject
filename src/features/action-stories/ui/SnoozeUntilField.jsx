/**
 * The one new control the six operator actions required (row selection was the other, and it went
 * into TableBlock as an optional column rather than a new component).
 *
 * A single `datetime-local` input with a floor of "now" and a handful of one-tap presets. Not a date
 * picker library, not a generic form field, not a scheduling framework — Snooze needs one future
 * instant and nothing else.
 *
 * The local-wall-clock <-> ISO conversion lives in ./snoozeTime.js, which this imports.
 */
import { toLocalInputValue } from './snoozeTime';

import { typeRole } from '../blocks/typeRole';
const PRESETS = [
  { label: 'In 4 hours', hours: 4 },
  { label: 'Tomorrow', hours: 24 },
  { label: 'Next week', hours: 24 * 7 },
];

/**
 * @param {string} value - the current `datetime-local` string (NOT the ISO instant).
 * @param {(next: string) => void} onChange
 * @param {string|null} error - shown beneath the field; the caller owns validation so the same rule
 *   (contract/actionTypes.js's `isFutureTimestamp`) governs the field and the dispatch gate.
 * @param {Date} [now] - injectable so tests never depend on the wall clock.
 */
export default function SnoozeUntilField({ value, onChange, error, now = new Date() }) {
  const min = toLocalInputValue(new Date(now.getTime() + 60_000)); // at least a minute out

  return (
    <div className="mt-4">
      <label {...typeRole('body', 'block text-rf-text-secondary')}>
        Snooze until
        <input
          type="datetime-local"
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          {...typeRole('body', 'mt-1.5 w-full rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-2.5 text-rf-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring')}
        />
      </label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(toLocalInputValue(new Date(now.getTime() + preset.hours * 3_600_000)))}
            {...typeRole('body', 'rounded-full border border-rf-border-subtle px-2.5 py-1 text-rf-text-secondary transition-colors hover:bg-rf-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring')}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {error && <span {...typeRole('body', 'mt-1 block text-rf-status-critical-text')}>{error}</span>}
    </div>
  );
}
