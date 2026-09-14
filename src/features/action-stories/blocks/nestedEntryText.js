import { flattenDisplayValue } from './flattenDisplayValue';
import { humanizeSlotName } from './humanizeSlotName';
import { isHiddenKey } from './decorativeKeys';

// A row's magnitude can live under any of these names — same alias list
// extraction/classifyBlocks.js's CHART_MAGNITUDE_KEYS and LabelValueListBlock's own
// label/value picking use, narrowed to real numeric-ish content rather than free text.
const MAGNITUDE_KEYS = ['value', 'h', 'height', 'pct', 'amount'];

// Previously this module kept its own third independent copy of "what's decorative" (a trailing-
// suffix-only regex, the same bug the shared decorativeKeys.js word-boundary version was written to
// fix — see its own header comment) AND never excluded `__raw` at all, since that convention didn't
// exist yet when this copy was written. Every caller of flattenNestedEntry already filters *its own*
// top-level keys via the shared `isHiddenKey`; this module recurses into keys no caller ever sees
// directly (a nested object's own `tone`/`fill`/`__raw`-if-ever-nested-this-deep siblings), so it
// needs the same check too — now imported, not re-implemented a fourth time.

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Coordinate/size keys a chart's own pixel/plot math uses (x/y position, sx/sy/w/h size, r radius,
// n a bubble's own magnitude) — meaningful to a chart renderer, never to a reader as text ("X: 78,
// Y: 80, Sx: 11, Sy: 9, R: 4" describes a point on a plot, not a business fact). Confirmed leaking
// verbatim as an item's own "extra field" text — e.g. S9.1/analyze.roles' `__raw` companion
// ({name, n, x, y, sx, sy, r}), the bubble-chart geometry behind that scatter plot's Hero/Core/
// Margin Driver/... clusters — once `__raw` (not a real content field, see TableBlock.jsx's own
// `HIDDEN_COLUMN_KEYS`) reached this shared flattener the same way any other nested object would.
//
// Detected structurally — an object whose keys are almost entirely this coordinate vocabulary, with
// at most a plain `name`/`label` alongside it and nothing else — never by field name like `__raw` or
// a workflow code, so this also generalizes to any future nested geometry blob wherever it appears,
// not only extraction's own raw-record companion. An object that mixes real content in with a
// coordinate or two (a business record that happens to have its own `width` field) never matches:
// GEOMETRY_MIN_KEYS requires several coordinate keys AND nothing else but a name to fire.
const GEOMETRY_KEYS = new Set(['x', 'y', 'cx', 'cy', 'sx', 'sy', 'r', 'rx', 'ry', 'w', 'h', 'width', 'height', 'angle', 'n']);
const GEOMETRY_MIN_KEYS = 3;

function isChartGeometryObject(entry) {
  const keys = Object.keys(entry).filter((k) => !isHiddenKey(k));
  const geoKeys = keys.filter((k) => GEOMETRY_KEYS.has(k.toLowerCase()));
  const nonGeoKeys = keys.filter((k) => !GEOMETRY_KEYS.has(k.toLowerCase()));
  return geoKeys.length >= GEOMETRY_MIN_KEYS && nonGeoKeys.every((k) => k === 'name' || k === 'label');
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
 *   summarized recursively, so a nested value that's *also* an object/array isn't dropped), plus
 *   " — " and every OTHER remaining non-decorative sibling field, joined with " · " — not just
 *   `value`; see this branch's own inline comment for the real data this used to silently drop
 *   (a waterfall row's own `pct`/`detail`, a diagnostic row's own `note`)
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

  // Chart/plot coordinates, not content — see isChartGeometryObject's own doc comment. Returns ''
  // (nothing to show) rather than trying to salvage the object's own `name`/`label`: whatever this
  // geometry is describing already has its own real headline/label rendered by the caller (that's
  // how a reader identified it as "Hero" or "Core" in the first place) — this object's job was only
  // ever to tell a chart where to draw the point, never to restate the name a second time as text.
  if (isChartGeometryObject(entry)) return '';

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

    // Every OTHER sibling field beyond label/value is real content too — previously silently
    // dropped here, since this branch only ever looked for a field literally named "value".
    // Confirmed hiding S9.6/analyze.sel.waterfall's own `pct`/`detail` entirely (that shape has no
    // `value` at all, so it rendered as a bare label with NO figure — "Price competitiveness", never
    // "46%") and .diag's own `note` (silently dropped even though `value` itself did show). Shape-
    // based, not a hardcoded name list — whatever's left after label/value/decorative/internal keys
    // are set aside is appended, so a real API's own vocabulary for the same idea (a different key
    // name entirely) is picked up automatically, not just this corpus's own `pct`/`note`/`detail`.
    // A plain {label, value} pair (the common case, and every existing test's own expectation) is
    // completely unaffected: no extra fields means no suffix, same "label value" output as before.
    const extra = Object.entries(entry)
      .filter(([key, v]) => key !== 'label' && key !== 'value' && !isHiddenKey(key) && v !== null && v !== undefined)
      .map(([, v]) => flattenNestedEntry(v, depth + 1))
      .filter(Boolean);
    const suffix = extra.length > 0 ? ` — ${extra.join(' · ')}` : '';

    return `${flattenDisplayValue(entry.label)}${value}${suffix}`;
  }

  const magnitudeKey = MAGNITUDE_KEYS.find((k) => entry[k] !== undefined);
  const hasNestedSibling = Object.entries(entry).some(
    ([k, v]) => k !== magnitudeKey && !isHiddenKey(k) && v !== null && typeof v === 'object',
  );
  if (magnitudeKey !== undefined && !hasNestedSibling) {
    return flattenDisplayValue(entry[magnitudeKey]);
  }

  const joined = Object.entries(entry)
    .filter(([key]) => !isHiddenKey(key))
    .map(([key, value]) => {
      const text = flattenNestedEntry(value, depth + 1);
      return text ? `${humanizeSlotName(key)}: ${text}` : '';
    })
    .filter(Boolean)
    .join(', ');
  return joined;
}
