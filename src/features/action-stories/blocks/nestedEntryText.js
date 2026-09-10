import { flattenDisplayValue } from './flattenDisplayValue';

/**
 * Summarizes one item of a nested array into a short, meaningful line, instead of dumping every
 * field of every item (e.g. a chart's own pixel-position bookkeeping — x/y/w/h/cx/nx/linkY —
 * alongside its one real label+value). Shared by ItemQueueBlock (its own sub-lists),
 * LabelValueListBlock, and ObjectBlock (their "extra fields"/"extra entries" passes) so all three
 * summarize a nested rich item the same way instead of each guessing independently.
 *
 * - `{ field, before, after }` (a diff row) -> "field: before → after"
 * - anything with a `label` -> "label" (plus " value" if a `value` is also present)
 * - otherwise, whatever flattenDisplayValue can make of it (a plain string/number, or a
 *   JSX-descriptor's own text) — never every field of a many-key object.
 */
export function flattenNestedEntry(entry) {
  if (entry === null || entry === undefined) return '';
  if (typeof entry !== 'object') return flattenDisplayValue(entry);
  if ('field' in entry && 'before' in entry && 'after' in entry) {
    return `${flattenDisplayValue(entry.field)}: ${flattenDisplayValue(entry.before)} → ${flattenDisplayValue(entry.after)}`;
  }
  if ('label' in entry) {
    const value = entry.value !== undefined ? ` ${flattenDisplayValue(entry.value)}` : '';
    return `${flattenDisplayValue(entry.label)}${value}`;
  }
  return flattenDisplayValue(entry);
}
