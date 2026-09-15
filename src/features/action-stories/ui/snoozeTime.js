// Pure time helpers for the Snooze control. Separate from SnoozeUntilField.jsx so that file exports
// only its component (Fast Refresh requires it, and these are genuinely not presentation).
//
// `datetime-local` inputs carry a LOCAL wall-clock string ("2026-09-16T09:00") with no timezone.
// The contract carries an ISO instant. The conversion happens here, once, at that boundary — the
// alternative is every consumer downstream guessing which of the two shapes it received.

/** A `datetime-local` value string in the viewer's own timezone, floored to the minute. */
export function toLocalInputValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** `datetime-local` (local wall clock) -> an ISO instant. Returns null for an unparseable value. */
export function localInputValueToIso(value) {
  if (typeof value !== 'string' || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
