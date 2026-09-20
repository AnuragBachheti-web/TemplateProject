// ONE SLOT PER SHAPE, NEVER PER NAME — the generalisation of what `policy` already did.
//
// ============================================================================================
// THE DEFECT THIS CLOSES
// ============================================================================================
//
// slotVocabulary.js binds a slot to a canonical path, and extraction reaches that path by matching
// the reference's raw key BY NAME. So a shape needs one slot per name it arrives under, and the
// reference uses a different name almost every screen. The census measured it: of 2498 raw data
// keys across the 105 screens, 1852 are unclaimed; 354 of those are structured and carry content.
//
// Three reason panes make the point in one line. S9.11's `targets`, S10.3's `exposure` and S10.1's
// `bandRows` carry the IDENTICAL content field set — `label`, `value`, `note`. Only `targets`
// renders, and only because it is one of the seven names `policy`'s candidate list happens to
// spell out: policy, targets, rules, standards, thresholds, slas, terms. Seven names, one slot,
// one component. That pattern was right and was never generalised.
//
// ============================================================================================
// WHAT A SHAPE IS, EXACTLY
// ============================================================================================
//
// A shape is the set of values one existing component reads WHOLE — every content field consumed,
// every row named. That is not a judgement call: it is `consumedFields.js` evaluated against the
// value, which is the same instrument the Phase 5A claim gate uses. A field-name pattern alone is
// NOT a shape, and the difference is not academic — the first cut of this module grouped by field
// names only and admitted a `{detail, name, value}` row that StatListBlock cannot name, because
// its identity key is `label` and the row has none. It would have rendered as a bare ordinal.
//
// ============================================================================================
// WHY TWO FAMILIES AND NOT SEVEN (rulings R126-R129)
// ============================================================================================
//
// Seven families had an existing component. The metric that chose between them is the IGNORE-LIST
// ENTRY, not the slot (R127): a slot is one reviewed line in a vocabulary, while an ignore entry is
// a hand-written permission for data nobody has looked at — shapeLedger.js says so itself. Keys
// bought per entry written:
//
//   metricList     5.8   CLAIMED      heterogeneous  1.1   refused
//   labelledProse  2.0   CLAIMED      objectValue    0.53  refused (R129)
//                                     statefulRow    0.37  refused (R127)
//                                     timeline       0.19  refused (R127)
//   namedRich — refused (R128). 77 objects across 74 names whose commonest field set appears 3
//   times is a catch-all, not a shape; it clears every floor only because cardSet renders anything,
//   and the variant that would carry it generically is `slateCard`, parked on the R111 branch.
//   The phase's largest deferred group. It unblocks if and when R111 lands.

/**
 * THE CAP ON GENERIC LABELS (ruling R130).
 *
 * These slots cannot carry the reference's own pane heading. "What we are defending" is an eyebrow
 * in the mockup's HTML and is not in the payload — nor is the prose beneath it — so a shape slot is
 * named by `slotLabel(slotName)` and reads "Measures" or "Notes".
 *
 * That is fine once or twice on a pane and noise at four. `prop_s9_16_analyze` carries four metric
 * lists (`caseMetrics`, `critRows`, `conflict`, `lift`); rendering them as four generically-named
 * panels is worse than the reference, and shipping content an operator cannot name is not an
 * improvement. So a pane with three or more of one shape claims NONE of them. Five panes are left
 * unclaimed by this rule and are named in the phase report rather than quietly dropped.
 */
export const SHAPE_SLOT_MAX_PER_PANE = 2;

/**
 * A LABELLED METRIC LIST -> StatListBlock.
 * 64 keys, 58 names, 23 stories. `{label, value}` plus at most one of `meta`/`detail`/`note`/`pct`
 * — Metric renders one meta line, so a value carrying two would lose one and is NOT this shape
 * (that is `metricListPlus`, 10 keys, refused: it needs a component change and C1 forbids one).
 */
const METRIC_LIST_KEYS = [
  'afterRows', 'anatomy', 'armRows', 'assumptions', 'attrRows', 'bandRows', 'brandRules',
  'cmStack', 'contract', 'costOf', 'economics', 'effects', 'envelope', 'excluded', 'expRows',
  'exposure', 'fixTotals', 'floors', 'freshness', 'gate', 'gateRows', 'gri', 'guardRows',
  'headline', 'impact', 'lastYear', 'listHealth', 'liveStats', 'method', 'milestones', 'monStats',
  'net', 'offerLimits', 'onApprove', 'outcome', 'patRows', 'pos', 'posture', 'projection',
  'rbRows', 'readiness', 'recovery', 'recoveryMetrics', 'recurrence', 'risk', 'rlStats',
  'segStats', 'sources', 'spend', 'stack', 'summary', 'technical', 'thresholds', 'track',
  'troughMetrics', 'upside', 'waiting', 'writeOffs',
];

/**
 * A NAMED NOTE -> LabelValueListBlock.
 * 24 keys, 20 names, 11 stories. A name and a sentence about it, with NO figure — the shape
 * `constraints` and `verification` already render, arriving under twenty other names.
 */
const LABELLED_PROSE_KEYS = [
  'buffers', 'cadences', 'candidacy', 'contract', 'counters', 'cutoffs', 'deadlines', 'evidence',
  'expiring', 'governance', 'grants', 'guardRows', 'killSteps', 'ledger', 'rationale',
  'recurrence', 'revisit', 'rules', 'selSide', 'tasks',
];

/**
 * Slot -> the names it will consider, in the reference's own alphabetical order.
 *
 * THE TWO SLOTS OF A FAMILY SHARE ONE LIST, and so do the two namespaces. That is the premise made
 * structural: the SHAPE picks the slot, so `measures` and `execution_measures` cannot drift into
 * per-stage naming without T128 failing. `secondary_*` exists only because a pane may hold two, and
 * it claims whatever the first did not — `rec.claimed` in normalizeCorpus.js is first-come, so the
 * second pick sees a strictly smaller set with no extra machinery.
 *
 * Several names here already appear in older candidate lists (`sources` and `evidence` on `inputs`,
 * `thresholds` on `policy`). That is deliberate and safe in one direction only: these picks run
 * AFTER the established ones in every assembler, so an existing claim always wins and the corpus
 * can only grow. T131 asserts exactly that.
 */
export const SHAPE_SLOT_CANDIDATES = Object.freeze({
  measures: METRIC_LIST_KEYS,
  secondary_measures: METRIC_LIST_KEYS,
  execution_measures: METRIC_LIST_KEYS,
  notes: LABELLED_PROSE_KEYS,
  execution_notes: LABELLED_PROSE_KEYS,
  execution_secondary_notes: LABELLED_PROSE_KEYS,
});

const META_KEYS = ['meta', 'detail', 'note', 'pct'];
const NAME_KEYS = ['label', 'name', 'title', 'term', 'text'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A value that a presentational KEY could plausibly hold — a CSS token, a number, a boolean.
 * Deliberately a check on the VALUE's form, not on its wording: `var(--rose-500)` is a colour by
 * construction, `"4 days"` is not, and neither judgement reads what the string says.
 */
function looksPresentational(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return true;
  return typeof v === 'string'
    && /^(var\(|color-mix\(|#|rgba?\(|transparent$|fa-|\d+(\.\d+)?(px|%)?$)/.test(v);
}

/**
 * ARE THIS VALUE'S DECORATIVE KEYS ACTUALLY DECORATIVE?
 *
 * `decorativeKeys.js` classifies a key by its NAME, once, for the whole corpus. That is right
 * almost everywhere and wrong here in a way that matters, because these slots claim by shape and a
 * closed block silently drops every key it does not read:
 *
 *   labelValueList.left    `deadlines`, `expiring`, `cutoffs` — 22 rows holding "4 days",
 *                          "31 hours", "16 days", "locked". A CSS offset by name; time remaining
 *                          in fact, and the most operator-facing field on the row.
 *   labelValueList.weight  `rationale` — "primary", "strong", "timing", "counter". A font weight by
 *                          name; the row's kind in fact. Elsewhere it genuinely is 500 or 600.
 *   statList.__raw         `troughMetrics` — the extraction sandbox's companion record, holding a
 *                          whole nested structure of names, details and values.
 *
 * IT MUST BE ASKED OF THE RAW VALUE, NOT THE CLEANED ONE, and that is the whole point. `clean()`
 * strips these keys upstream of extraction, so by the time a shape predicate sees the row the field
 * is already gone — which means the shape ledger never records it as dropped and I3 never fires.
 * The loss is invisible to the gate that exists to catch losses. On S10.3/reason `deadlines` the
 * corpus keeps `{name, detail}` and "4 days" is simply not there.
 *
 * I3 is otherwise the test that catches this, and it is a good one: every dropped field must be
 * ignore-listed with a reason from the three existing categories. There is no true reason in "extraction
 * residue", "derived geometry" or "rendered elsewhere" for a field holding "31 hours". So the value
 * is not this shape, and it stays unclaimed rather than being claimed with a false permission
 * written to make the ledger green. Eight values are excluded by this rule.
 */
export function decorativeKeysAreHonest(value, isHidden) {
  for (const row of (Array.isArray(value) ? value : [value])) {
    if (!isPlainObject(row)) continue;
    for (const [k, v] of Object.entries(row)) {
      if (isHidden(k) && !looksPresentational(v)) return false;
    }
  }
  return true;
}

/** The union of field names across a value's rows. */
function fieldsOf(value) {
  const out = new Set();
  if (!Array.isArray(value)) return out;
  for (const row of value) if (isPlainObject(row)) for (const k of Object.keys(row)) out.add(k);
  return out;
}

/**
 * Is `value` the metric-list shape?
 *
 * Reads field NAMES only — never a value, never a string's wording.
 *
 * SHAPE, NOT CONTENT. This reads field NAMES and nothing else — never a value, never a string's
 * wording. That is the line this project has had to redraw six times, most recently in 5E.
 */
export function isMetricListShape(value) {
  const f = fieldsOf(value);
  if (f.size === 0) return false;
  if (f.has('when') || f.has('state') || f.has('status')) return false; // timeline / checklist shapes
  if (!f.has('value')) return false;
  const named = NAME_KEYS.filter((k) => f.has(k));
  if (named.length === 0) return false;
  const metas = META_KEYS.filter((k) => f.has(k));
  if (metas.length > 1) return false; // Metric renders ONE meta line; two would lose one
  return true;
}

/** Is `value` the named-note shape — a name and a sentence, and no figure? */
export function isLabelledProseShape(value) {
  const f = fieldsOf(value);
  if (f.size === 0) return false;
  if (f.has('when') || f.has('state') || f.has('status')) return false;
  if (f.has('value')) return false; // a figure makes it a metric list
  const named = NAME_KEYS.filter((k) => f.has(k));
  const metas = META_KEYS.filter((k) => f.has(k));
  return named.length > 0 && metas.length > 0;
}
