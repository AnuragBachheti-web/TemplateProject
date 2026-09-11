import { flattenDisplayValue } from './flattenDisplayValue';
import { humanizeSlotName } from './humanizeSlotName';

// A row's magnitude can live under any of these names — same alias list
// extraction/classifyBlocks.js's CHART_MAGNITUDE_KEYS and LabelValueListBlock's own
// label/value picking use, narrowed to real numeric-ish content rather than free text.
const MAGNITUDE_KEYS = ['value', 'h', 'height', 'pct', 'amount'];

// Same rule extraction/classifyBlocks.js uses to decide a key is styling, not content — kept as
// its own local copy, matching every other runtime file's convention (see e.g. TableBlock.jsx's
// identical comment). Every caller of flattenNestedEntry already filters *its own* top-level keys
// this way before calling in; this module needs its own copy too because it recurses into keys no
// caller ever sees directly (a nested object's own `tone`/`fill`/etc. siblings).
const DECORATIVE_KEY_SUFFIX_RE = /(Bg|Fg|Tone|Tint|Border|Cursor|Icon|Glow|Edge|Dot|Shadow|Opacity|Mark|Hue|Fill|Stroke)$/;
const DECORATIVE_EXACT_KEYS = new Set([
  'icon', 'tone', 'tint', 'bg', 'fg', 'border', 'mark', 'hue', 'fill', 'stroke', 'cursor', 'shadow', 'opacity', 'edge', 'glow', 'weight',
]);
function isDecorativeKey(key) {
  return DECORATIVE_EXACT_KEYS.has(key) || DECORATIVE_KEY_SUFFIX_RE.test(key);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isReactDescriptor(v) {
  return isPlainObject(v) && 'type' in v && isPlainObject(v.props);
}

// A real nested structure in this dataset is at most a few levels deep (a group's items, each
// carrying its own before/after pair; a matrix cell's own sub-fields) — this cap exists purely as
// a safety backstop against a malformed or (in principle, since these ultimately trace back to
// JSON, never truly circular) pathological structure, not because legitimate data needs to go
// this deep. Past it, a short "…" tells a reader there's more here than fits, instead of either
// hanging or silently showing nothing.
const MAX_DEPTH = 6;

/**
 * Summarizes one item of a nested array/object into a short, meaningful line, instead of dumping
 * every field of every item (e.g. a chart's own pixel-position bookkeeping — x/y/w/h/cx/nx/linkY —
 * alongside its one real label+value) or — the bug this recursion fixes — silently rendering
 * nothing at all once a nested value stops being a flat primitive. Shared by ItemQueueBlock (its
 * own sub-lists), LabelValueListBlock, and ObjectBlock (their "extra fields"/"extra entries"/nested
 * descriptor passes) so all three summarize nested data the same way instead of each guessing
 * independently, and so a fix here (like this one) benefits all three at once.
 *
 * Recognizes, in order:
 * - a JSX/DOM-node descriptor (`{type, props}`, captured verbatim by the extraction pipeline's
 *   React stub) -> its own inner text, via flattenDisplayValue
 * - `{ field, before, after }` (a diff row) -> "field: before → after"
 * - anything with a `label` -> "label" (plus " value" if a `value` is also present — itself
 *   summarized recursively, so a nested value that's *also* an object/array isn't dropped)
 * - a magnitude-only descriptor with no label (e.g. a sparkline point `{h: "12", fill: "..."}`) ->
 *   just that magnitude, rather than nothing
 * - a plain array -> each entry recursively summarized and joined ("a, b, c")
 * - any other plain object -> "key: value, key: value" for every field that itself produces text,
 *   recursing one level at a time (this is the actual fix: previously this case fell straight to
 *   flattenDisplayValue, which returns '' for any plain object it doesn't recognize — a nested
 *   object inside an array item, or an array inside an object, vanished with no visual trace;
 *   AUDIT_REPORT.md §9/§19 P1 #2, extraction/audit-report.md's A.3 "classified-but-incomplete"
 *   findings)
 * - otherwise, whatever flattenDisplayValue can make of it (a plain string/number/boolean)
 *
 * Bounded to MAX_DEPTH levels — see its own comment — so a pathological structure degrades to a
 * short "…" instead of recursing forever; null/undefined at any depth render as '' (nothing to
 * show), matching every block's existing "empty means invisible, not broken" convention.
 */
export function flattenNestedEntry(entry, depth = 0) {
  if (entry === null || entry === undefined) return '';
  if (typeof entry !== 'object') return flattenDisplayValue(entry);
  if (depth >= MAX_DEPTH) return '…';

  if (isReactDescriptor(entry)) return flattenDisplayValue(entry);

  if (Array.isArray(entry)) {
    return entry
      .map((item) => flattenNestedEntry(item, depth + 1))
      .filter(Boolean)
      .join(', ');
  }

  if ('field' in entry && 'before' in entry && 'after' in entry) {
    return `${flattenDisplayValue(entry.field)}: ${flattenDisplayValue(entry.before)} → ${flattenDisplayValue(entry.after)}`;
  }

  if ('label' in entry) {
    const value = entry.value !== undefined ? ` ${flattenNestedEntry(entry.value, depth + 1)}`.trimEnd() : '';
    return `${flattenDisplayValue(entry.label)}${value}`;
  }

  const magnitudeKey = MAGNITUDE_KEYS.find((k) => entry[k] !== undefined);
  const hasNestedSibling = Object.entries(entry).some(
    ([k, v]) => k !== magnitudeKey && !isDecorativeKey(k) && v !== null && typeof v === 'object',
  );
  if (magnitudeKey !== undefined && !hasNestedSibling) {
    return flattenDisplayValue(entry[magnitudeKey]);
  }

  const joined = Object.entries(entry)
    .filter(([key]) => !isDecorativeKey(key))
    .map(([key, value]) => {
      const text = flattenNestedEntry(value, depth + 1);
      return text ? `${humanizeSlotName(key)}: ${text}` : '';
    })
    .filter(Boolean)
    .join(', ');
  return joined;
}
