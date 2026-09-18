// WHAT EACH BLOCK ACTUALLY RENDERS — one module, derived from the components, not from the notes.
//
// Phase 5A, invariant I1. The claim ledger in extraction/normalizeCorpus.js matches a raw reference
// key to a canonical field by NAME and by coarse shape (`isObjArray`, `isLabelled`, `isTabular`).
// Nothing anywhere verified that the claimed value's FIELDS are fields the destination slot's
// blockType reads. An array of objects satisfies both `trigger` (timeline) and `inputs` (statList),
// so S9.11's `opportunity` — `{label, value, pct, meta}`, a metric list — was claimed into
// `proposal.trigger`, rendered by TimelineBlock as four bare labels, and three quarters of every row
// was discarded with no warning anywhere in the pipeline.
//
// This module is the missing check. For every blockType it declares, in the component's own terms,
// which of a row's keys that component READS. `droppedFields(blockType, row)` is then the exact
// answer to "what did this block silently throw away", and __corpus__/shapeLedger.test.js (T53/T54)
// runs it over all 105 objects.
//
// THE RULE FOR EDITING THIS FILE. Every entry below is a transcription of a component, and the only
// correct reason to change one is that the component changed. It is deliberately NOT a schema, not a
// wish, and not the slot note's description of the concept: a block that reads `row.meta` and
// ignores `row.pct` is recorded here as reading `meta` and ignoring `pct`, however wrong that is.
// Making the ledger agree with the component by loosening the ledger is the one edit that turns this
// module back into decoration.
//
// THREE RENDER MODES, because the vocabulary genuinely has three:
//
//   scalar  the block's data is not a row set at all (text, number, flag). There are no fields to
//           drop; the value either renders or the slot is omitted.
//   open    the block renders EVERY key the row carries, generically — TableBlock unions all row
//           keys into columns, LabelValueListBlock promotes one and lists the rest, ItemQueueBlock
//           surfaces every leftover as an extra field or a nested list. These blocks drop nothing
//           except keys `decorativeKeys.js` already classifies as presentation, which the hygiene
//           pass should have removed upstream anyway.
//   closed  the block reads a FIXED, declared key list and ignores everything else. Every one of the
//           routing defects this phase exists to fix lands on a closed block.

// Imported WITH their extensions, and both dependencies are extension-clean themselves: this module
// is read by extraction/normalizeCorpus.js under bare Node, which has no bundler resolution. Same
// convention contract/deriveEligibility.js already follows for exactly the same reason.
import { isHiddenKey } from './decorativeKeys.js';
import { ROW_LABEL_KEYS } from '../manifests/blockTypes.js';

export const RENDER_MODES = Object.freeze(['scalar', 'open', 'closed']);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** A string the component would actually print — the `!== ''`/`trim()` guard every block applies. */
function isShownString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/** The `??` chain every block uses: null and undefined fall through, anything else wins. */
function firstPresentKey(row, keys) {
  return keys.find((k) => row[k] !== undefined && row[k] !== null);
}

/** The stricter variant — CardSetBlock's `firstOf` and TimelineBlock's BODY_KEYS both require text. */
function firstStringKey(row, keys) {
  return keys.find((k) => isShownString(row[k]));
}

// ---- the per-block transcriptions ---------------------------------------------------------------
//
// `reads(row)` returns the keys of THAT row the component would read. It takes the row rather than
// returning a flat list because four of these blocks choose between alternates (`meta ?? detail ??
// note ?? pct`, `label ?? text`, `role ?? stance`) — the alternate that loses is genuinely dropped,
// and a flat key list would report it as consumed and hide exactly the loss this module measures.
//
// WHAT COUNTS AS CONSUMED, exactly. A key is consumed when the component reads it AND understands
// the kind of value it is holding. `RosterBlock` reads `row.lead === true` and draws nothing for
// `false` — it read the flag and the flag said no, which is rendering, not loss. `TimelineBlock`
// reads `row.when` only as a string, so a `when` holding a number is read past and genuinely lost.
// The line is TYPE COMPATIBILITY, not truthiness; drawing it at truthiness would report every
// honest "no" as a defect and bury the real ones.

/** blocks/TimelineBlock.jsx. `[{when, what|rule, action}]`. */
function timelineReads(row) {
  const keys = [];
  if (typeof row.when === 'string') keys.push('when');
  const body = firstStringKey(row, ['what', 'rule']) ?? ROW_LABEL_KEYS.find((k) => isShownString(row[k]));
  if (body !== undefined) keys.push(body);
  if (typeof row.action === 'string') keys.push('action');
  return keys;
}

/** blocks/StatListBlock.jsx -> children/Metric.jsx. `[{label, value?, meta?|detail?|note?|pct?}]`. */
function statListReads(row) {
  const keys = [];
  if (row.label !== undefined && row.label !== null && row.label !== '') keys.push('label');
  if (row.value !== undefined && row.value !== null) keys.push('value');
  // Metric takes ONE meta line. `meta ?? detail ?? note ?? pct` — the three that lose are dropped.
  const meta = firstPresentKey(row, ['meta', 'detail', 'note', 'pct']);
  if (meta !== undefined) keys.push(meta);
  return keys;
}

/** blocks/ChecklistBlock.jsx. `[{status, label|text, value?, pct?, note?}]`. */
function checklistReads(row) {
  const keys = [];
  if (row.status !== undefined) keys.push('status');
  const identity = firstPresentKey(row, ['label', 'text']);
  if (identity !== undefined) keys.push(identity);
  const hasValue = row.value !== undefined && row.value !== null && row.value !== '';
  if (hasValue) {
    keys.push('value');
    // `pct` renders INSIDE the value branch, so a value-less row drops its percentage.
    if (typeof row.pct === 'number') keys.push('pct');
  }
  if (row.note !== undefined && row.note !== null && row.note !== '') keys.push('note');
  return keys;
}

/** blocks/RosterBlock.jsx -> children/Initials.jsx. `[{name, initials?, role?|stance?, lead?}]`. */
function rosterReads(row) {
  const keys = [];
  if (row.name !== undefined) keys.push('name');
  if (row.initials !== undefined) keys.push('initials');
  // Read as a boolean: `lead: false` is the reference saying this agent did not lead, and the
  // component drawing no badge for it is that answer rendered.
  if (typeof row.lead === 'boolean') keys.push('lead');
  const role = firstPresentKey(row, ['role', 'stance']);
  if (role !== undefined) keys.push(role);
  return keys;
}

// blocks/CardSetBlock.jsx's own four key lists, restated verbatim.
const CARD_HEADLINE_KEYS = ['name', 'title', 'label'];
const CARD_BODY_KEYS = ['sub', 'detail', 'note', 'body', 'blurb'];
const CARD_CHIP_KEYS = ['flag', 'tag', 'kind', 'chip', 'badge', 'effectLabel', 'toggleLabel'];
const CARD_NESTED_KEYS = ['rows', 'items', 'changes', 'candidates'];
const CARD_NOT_A_FIGURE = new Set([
  ...CARD_HEADLINE_KEYS, ...CARD_BODY_KEYS, ...CARD_CHIP_KEYS, ...CARD_NESTED_KEYS,
  'isFocus', 'foot', 'hist', 'rules', 'gate',
]);

/** blocks/CardSetBlock.jsx. Headline, body, chips, nested rows, and every remaining SCALAR. */
function cardSetReads(row) {
  const keys = [];
  const headline = firstStringKey(row, CARD_HEADLINE_KEYS);
  if (headline !== undefined) keys.push(headline);
  const body = firstStringKey(row, CARD_BODY_KEYS);
  if (body !== undefined) keys.push(body);
  keys.push(...CARD_CHIP_KEYS.filter((k) => typeof row[k] === 'string'));
  // Same rule as RosterBlock's `lead`: read as a boolean, and `false` is an answer, not a loss.
  if (typeof row.isFocus === 'boolean') keys.push('isFocus');
  const nested = CARD_NESTED_KEYS.find((k) => Array.isArray(row[k]));
  if (nested !== undefined) keys.push(nested);
  // Figures are the declared complement: every leftover scalar. A leftover OBJECT or ARRAY is not a
  // figure and is genuinely lost — which is why `foot`/`hist`/`rules`/`gate` are named above.
  for (const [k, v] of Object.entries(row)) {
    if (CARD_NOT_A_FIGURE.has(k)) continue;
    if ((typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '') keys.push(k);
  }
  return [...new Set(keys)];
}

// blocks/GaugeBlock.jsx and blocks/BarChartBlock.jsx share this magnitude list.
const MAGNITUDE_KEYS = ['value', 'h', 'height', 'pct', 'amount'];
const THRESHOLD_KEYS = ['threshold', 'limit', 'limitPct', 'ceiling', 'floor', 'target', 'cap'];

/** Mirrors blocks/chartGeometry.js's parseMagnitude closely enough to say whether a key is usable. */
function parseable(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v !== 'string') return false;
  const digits = v.replace(/[^\d.]/g, '');
  return digits !== '' && Number.isFinite(Number(digits));
}

/** blocks/BarChartBlock.jsx. One label and ONE magnitude — every other magnitude key is dropped. */
function barChartReads(row) {
  const keys = [];
  if (row.label !== undefined) keys.push('label');
  const magnitude = MAGNITUDE_KEYS.find((k) => row[k] !== undefined && parseable(row[k]))
    ?? MAGNITUDE_KEYS.find((k) => row[k] !== undefined);
  if (magnitude !== undefined) keys.push(magnitude);
  return keys;
}

/** blocks/GaugeBlock.jsx. A label, one parseable magnitude, and one parseable threshold. */
function gaugeReads(row) {
  const keys = [];
  if (typeof row.label === 'string') keys.push('label');
  const magnitude = MAGNITUDE_KEYS.find((k) => row[k] !== undefined && parseable(row[k]));
  if (magnitude !== undefined) keys.push(magnitude);
  const threshold = THRESHOLD_KEYS.find((k) => row[k] !== undefined && parseable(row[k]));
  if (threshold !== undefined) keys.push(threshold);
  return keys;
}

/** blocks/ScatterChartBlock.jsx. `[{x|cx, y|cy, r?, label?, hue?}]`. */
function scatterChartReads(row) {
  const keys = [];
  const x = firstPresentKey(row, ['x', 'cx']);
  if (x !== undefined) keys.push(x);
  const y = firstPresentKey(row, ['y', 'cy']);
  if (y !== undefined) keys.push(y);
  if (row.r !== undefined) keys.push('r');
  if (typeof row.label === 'string') keys.push('label');
  if (row.hue !== undefined) keys.push('hue');
  return keys;
}

/** blocks/WaterfallChartBlock.jsx. `[{label, value, anchor?, tag?, sublabel?}]`. */
function waterfallChartReads(row) {
  const keys = [];
  if (row.label !== undefined) keys.push('label');
  if (row.value !== undefined) keys.push('value');
  if (row.anchor !== undefined) keys.push('anchor');
  if (typeof row.tag === 'string') keys.push('tag');
  if (typeof row.sublabel === 'string') keys.push('sublabel');
  return keys;
}

/** blocks/LineChartBlock.jsx. A typed point, or a named series wrapping one. */
function lineChartReads(row) {
  const keys = [];
  if (Array.isArray(row.points)) {
    keys.push('points');
    const name = firstPresentKey(row, ['name', 'label']);
    if (name !== undefined) keys.push(name);
    return keys;
  }
  if (typeof row.path === 'string') {
    keys.push('path');
    const name = firstPresentKey(row, ['name', 'label']);
    if (name !== undefined) keys.push(name);
    return keys;
  }
  if (row.x !== undefined) keys.push('x');
  if (row.y !== undefined) keys.push('y');
  return keys;
}

/** blocks/HeatmapGridBlock.jsx. A row label and its cells; the cells themselves render openly. */
function heatmapGridReads(row) {
  const keys = [];
  if (row.label !== undefined) keys.push('label');
  const cells = firstPresentKey(row, ['cells', 'grid']);
  if (cells !== undefined) keys.push(cells);
  return keys;
}

/** blocks/SliderBlock.jsx. Not a row set — the whole value is one control object. */
const SLIDER_KEYS = ['min', 'max', 'value', 'step', 'unit', 'label', 'note', 'scaleLabels', 'steps'];
function sliderReads(row) {
  return SLIDER_KEYS.filter((k) => row[k] !== undefined);
}

/** An OPEN block: every key that is not already hidden by decorativeKeys.js. */
function openReads(row) {
  return Object.keys(row).filter((k) => !isHiddenKey(k));
}

/**
 * blockType -> how it renders and which fields it reads.
 *
 * `rowShape` says where the fields live: `rows` for a block whose data is an array of rows, `value`
 * for one whose data is a single object (slider), `none` for a scalar block.
 */
export const CONSUMED_FIELDS = Object.freeze({
  text: { mode: 'scalar', rowShape: 'none', reads: () => [] },
  number: { mode: 'scalar', rowShape: 'none', reads: () => [] },
  flag: { mode: 'scalar', rowShape: 'none', reads: () => [] },

  table: { mode: 'open', rowShape: 'rows', reads: openReads },
  labelValueList: { mode: 'open', rowShape: 'rows', reads: openReads },
  itemQueue: { mode: 'open', rowShape: 'rows', reads: openReads },
  object: { mode: 'open', rowShape: 'value', reads: openReads },

  timeline: { mode: 'closed', rowShape: 'rows', reads: timelineReads },
  statList: { mode: 'closed', rowShape: 'rows', reads: statListReads },
  checklist: { mode: 'closed', rowShape: 'rows', reads: checklistReads },
  roster: { mode: 'closed', rowShape: 'rows', reads: rosterReads },
  cardSet: { mode: 'closed', rowShape: 'rows', reads: cardSetReads },
  barChart: { mode: 'closed', rowShape: 'rows', reads: barChartReads },
  gauge: { mode: 'closed', rowShape: 'rows', reads: gaugeReads },
  scatterChart: { mode: 'closed', rowShape: 'rows', reads: scatterChartReads },
  waterfallChart: { mode: 'closed', rowShape: 'rows', reads: waterfallChartReads },
  lineChart: { mode: 'closed', rowShape: 'rows', reads: lineChartReads },
  heatmapGrid: { mode: 'closed', rowShape: 'rows', reads: heatmapGridReads },
  slider: { mode: 'closed', rowShape: 'value', reads: sliderReads },
});

// ---- row identity -------------------------------------------------------------------------------
//
// A SECOND thing a claim can get wrong, found in the Phase 5A survey and ruled on as R55. A block
// can consume a row's magnitude and consume no identity at all, because most of these components
// fall back to a bare ordinal when the identity key is missing — BarChartBlock's
// `item?.label ?? String(i + 1)`, GaugeBlock's and CardSetBlock's equivalents.
//
// S9.15/analyze's `bars` is the case: `{x, y, h, op}`, no label anywhere. It satisfied `isObjArray`,
// was claimed as `proposal.comparison`, and rendered as eight bars numbered 1-8 whose heights are
// the source mockup's pixel offsets. Nothing was "dropped" — `op`/`x`/`y` are residue and `h` was
// consumed — so a drop-counting ledger alone calls that claim CORRECT. It is not: an anonymous row
// is a figure with nothing to say what it measures.
//
// So identity is checked separately from loss, and only for the blocks where a row IS a business
// entity. `lineChart` and `scatterChart` are deliberately excluded: a plotted point is a coordinate,
// and requiring it to name itself would be requiring a scatter plot to be a table.

/** blockType -> the keys that block reads as a row's own identity, in the component's own order. */
const IDENTITY_KEYS = Object.freeze({
  timeline: ['what', 'rule', ...ROW_LABEL_KEYS],
  statList: ['label'],
  checklist: ['label', 'text'],
  roster: ['name'],
  cardSet: ['name', 'title', 'label'],
  barChart: ['label'],
  gauge: ['label'],
  waterfallChart: ['label'],
  heatmapGrid: ['label'],
});

/**
 * Blocks where a row with no identity renders as a bare ordinal. `open` blocks are absent because
 * they print every key, so nothing is anonymous; charts of plotted points are absent by design.
 */
export const IDENTITY_REQUIRED = Object.freeze(Object.keys(IDENTITY_KEYS));

/** @returns {boolean} true when `row` carries an identity `blockType` would actually print. */
export function rendersIdentity(blockType, row) {
  const keys = IDENTITY_KEYS[blockType];
  if (keys === undefined) return true; // identity is not a requirement for this block
  if (!isPlainObject(row)) return false;
  return keys.some((k) => isShownString(row[k]));
}

/**
 * @returns {number} how many rows of `value` would render as a bare ordinal under `blockType`.
 *   Non-zero is a routing defect, independent of how many fields were dropped.
 */
export function anonymousRowsOf(blockType, value) {
  if (IDENTITY_KEYS[blockType] === undefined || !Array.isArray(value)) return 0;
  return value.filter((row) => !rendersIdentity(blockType, row)).length;
}

/** @returns {string[]} the keys of `row` that `blockType`'s component reads. */
export function consumedFieldsOf(blockType, row) {
  const spec = CONSUMED_FIELDS[blockType];
  if (!spec || !isPlainObject(row)) return [];
  return spec.reads(row);
}

/**
 * THE MEASUREMENT. Every key on `row` that `blockType`'s component never reads.
 * @returns {string[]} in the row's own key order.
 */
export function droppedFieldsOf(blockType, row) {
  const spec = CONSUMED_FIELDS[blockType];
  if (!spec || spec.mode === 'scalar' || !isPlainObject(row)) return [];
  const consumed = new Set(spec.reads(row));
  return Object.keys(row).filter((k) => !consumed.has(k));
}

/**
 * The same measurement over a whole claimed value — one slot's worth of data.
 * @returns {string[]} every distinct field dropped across the value's rows, sorted.
 */
export function droppedFieldsOfValue(blockType, value) {
  const spec = CONSUMED_FIELDS[blockType];
  if (!spec || spec.mode === 'scalar') return [];
  const rows = spec.rowShape === 'value' ? (isPlainObject(value) ? [value] : []) : (Array.isArray(value) ? value : []);
  const dropped = new Set();
  for (const row of rows) {
    if (!isPlainObject(row)) continue;
    for (const key of droppedFieldsOf(blockType, row)) dropped.add(key);
  }
  return [...dropped].sort();
}
