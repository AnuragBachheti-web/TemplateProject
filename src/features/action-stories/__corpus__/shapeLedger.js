// THE SHAPE LEDGER — Phase 5A.
//
// One question, asked of all 105 Decision Objects: for every raw reference key the claim ledger
// gave to a canonical field, does the destination slot's blockType actually RENDER the fields that
// value carries?
//
// Until this phase nothing asked it. `extraction/normalizeCorpus.js` matched a raw key to a
// canonical field by NAME and by coarse shape — `isObjArray`, `isLabelled`, `isTabular` — and an
// array of objects satisfies every one of those whatever its fields are. So S9.11's `opportunity`
// (`{label, value, pct, meta}`, a metric list with a progress bar) was claimed into
// `proposal.trigger`, whose block is a chronology reading `{when, what}`, and rendered as four bare
// labels. Three quarters of every row was discarded, no test failed, and no warning was logged. The
// same defect, unmodified, reached 30 of the 105 objects.
//
// This module is the measurement, and the two declared lists below are what make its answer
// reviewable rather than merely computed.
//
// ============================================================================================
// THE THREE OUTCOMES A DROPPED FIELD MAY HAVE (ruling R51)
// ============================================================================================
//
//   IGNORED   the field is not business content. Exactly three reasons are admissible, and every
//             entry states which one it is: EXTRACTION RESIDUE (a mockup artefact that should never
//             have crossed the fixture boundary), DERIVED GEOMETRY (Phase 3A's R15 finding — a
//             `pct` beside a `value` is a bar width, not a measurement), or RENDERED ELSEWHERE
//             (the same fact reaches the page through a field that IS consumed).
//
//   DEFERRED  the field is real content, the row's identity and primary figure DO render, and
//             carrying the rest needs a block variant this phase is forbidden to build (I5/C1). It
//             goes to G — DEFERRED_SHAPES below — with the shape it needs. Deferred is not closed.
//
//   MISROUTED anything else. T53 requires this to be empty.
//
// A fourth outcome exists and is not a field-level one: a claim can be rejected outright, when the
// destination would drop the row's PRIMARY figure or render it with no identity at all. Those keys
// are not deferred field-by-field — the whole claim is withdrawn in normalizeCorpus.js, the key
// becomes unclaimed, and it appears in DEFERRED_SHAPES as an unrouted key. Ruling R48: a wrong
// rendering that passes a shape test is worse than an unrendered one, because nobody looks at it
// again.

// THIS MODULE IMPORTS NO CORPUS DATA, deliberately, and must not start. Two reasons, and the second
// is why the wording here avoids naming the generated files literally — normalizedDataset.test.js's
// "the ONLY runtime importer of business data" check is a plain text scan, and a comment naming
// them would read to it as an import.
//
//   1. extraction/normalizeCorpus.js reads the two declared lists below to decide which claims to
//      make, and it is the PRODUCER of the generated corpus. Importing that corpus here would hand
//      the generator a stale copy of its own last output to reason about.
//   2. `buildLedger` taking the corpus as arguments makes the ledger a pure function of its inputs
//      rather than of whatever happens to be on disk.
//
// Extensions on every import: this module is loaded by bare Node from extraction, which has no
// bundler resolution.
import { SLOT_VOCABULARY } from '../templates/slotVocabulary.js';
import { resolveTemplate } from '../templates/templateRegistry.js';
import { evaluateCondition } from '../manifests/actionCondition.js';
import { droppedFieldsOfValue, anonymousRowsOf, CONSUMED_FIELDS } from '../blocks/consumedFields.js';

/** The three admissible reasons a real field may be left unrendered without being a defect. */
export const IGNORE_CATEGORIES = Object.freeze(['extraction residue', 'derived geometry', 'rendered elsewhere']);

/**
 * THE IGNORE-LIST. `${blockType}.${field}` -> why that block never rendering it is correct.
 *
 * Every entry is a claim about the DATA, not about the block, and the arithmetic for the derived
 * ones is in the reason. Widening this list is how the ledger stops measuring anything, so an entry
 * that does not fit one of IGNORE_CATEGORIES is not an ignore — it is a deferral, and it belongs in
 * DEFERRED_SHAPES instead (R51).
 */
export const IGNORE_LIST = Object.freeze({
  // ---- extraction residue --------------------------------------------------------------------
  'cardSet.hasCurve': {
    category: 'extraction residue',
    reason: 'A mockup panel-presence boolean (S10.3/decide `actions`): "this card has a sparkline drawn on it". '
      + 'It describes the source HTML, not the action. The curve itself is pixel geometry the hygiene pass strips.',
  },
  'cardSet.hasDraft': {
    category: 'extraction residue',
    reason: 'The same artefact as hasCurve — "this card has a draft panel". The draft\'s own content reaches the '
      + 'payload separately; this flag only says the mockup drew a box for it.',
  },
  'scatterChart.op': {
    category: 'extraction residue',
    reason: 'SVG opacity, shortened, on S9.9/analyze\'s `ladders` plot markers. decorativeKeys.js already lists '
      + '`op` for the runtime; it survives into the payload only because extraction\'s own copy of that list is '
      + 'narrower by design (chart-shape detection still needs to see marker fields at generation time).',
  },
  // `barChart.op`, `barChart.x` and `barChart.y` were drafted here and then DELETED, which is worth
  // recording. They covered exactly one claim — S9.15/analyze's `bars`, `{x, y, h, op}` — and R55
  // withdrew that claim outright, because what survived the residue was `h`: pixel heights with no
  // label. Once the claim went, the three entries covered nothing, and the "no unused entry" test
  // below failed on them. An ignore-list entry that no claim exercises is a permission granted in
  // advance for data nobody has seen, which is how a list like this stops being reviewable.
  'waterfallChart.key': {
    category: 'extraction residue',
    reason: 'The mockup\'s own row id on S10.1/analyze\'s bridge ("baseline", "fba", "price"). It duplicates `label` '
      + 'in machine form; the label is what a reader sees and it is rendered.',
  },

  // ---- derived geometry ----------------------------------------------------------------------
  //
  // Phase 3A's R15, restated: `value / chosenAxisMax * 100` is a layout decision wearing a number's
  // clothes. Confirmed per key in the Phase 5A survey rather than assumed — the arithmetic is in
  // each reason, and where it did NOT hold the field was fixed instead of ignored.
  'barChart.pct': {
    category: 'derived geometry',
    reason: 'The bar\'s own width, beside the `value` it is drawn from, confirmed per key: expiryBars '
      + '890/4120=22, 1570/4120=38, 1180/4120=29, 480/4120=12 (exact share of total); sovBars 29/29=100, '
      + '11/29=38, 18/29=62, 12/29=41 and wasteMix 1.9/1.9=100, 1.1/1.9=58, 0.8/1.9=42, 0.5/1.9=26 (exact '
      + 'value/max); concentration value/9.8; pacing min(value,100) — 104% clamped to a 100% bar. '
      + 'ONLY ignorable where a `value` is present: where `pct` was the sole magnitude the claim was '
      + 'rejected instead (sizes, detectBars — see DEFERRED_SHAPES).',
    requires: (row) => row.value !== undefined,
  },
  'statList.pct': {
    category: 'rendered elsewhere',
    reason: 'S10.6/live `healthRows`: pct 88 is 3.5% against the 4.0% limit, and that limit reaches the page in '
      + '`detail` ("limit 4.0% · our alarm at 3.7%"), which StatListBlock renders as the row\'s meta line. The '
      + 'number the operator needs is shown; the percentage is the bar it would have been drawn as.',
    requires: (row) => row.detail !== undefined || row.note !== undefined || row.meta !== undefined,
  },
  'gauge.pct': {
    category: 'derived geometry',
    reason: 'The gauge\'s own fill width on S9.18/S9.19 decide, beside the `value` GaugeBlock plots and the '
      + '`limitPct` it plots against. Same R15 family as barChart.pct.',
    requires: (row) => row.value !== undefined,
  },
});

/**
 * G — THE 5B INPUT LIST, grouped by the SHAPE the content needs rather than by key name (R52).
 *
 * This is the deliverable 5B is scoped from, so it is data rather than prose: if twelve keys all
 * need "label + value + bar + sub-line", that is one variant serving twelve, and the grouping is
 * what makes that sentence checkable. `kind` answers the single question 5B needs answered first —
 * whether this is a VARIANT of a block that already exists, or a genuinely new block (R57).
 *
 * `fields` are deferred field-by-field: the claim stands and the row's identity and primary figure
 * render today. `unroutedKeys` are whole claims that were WITHDRAWN — those keys render nothing at
 * all right now, deliberately (R48). `anonymousClaims` are claims whose rows render with a bare
 * ordinal for a headline: every value reaches the page, but the field that names the row is being
 * drawn somewhere other than the headline.
 *
 * WHY ANONYMOUS ROWS ARE SOMETIMES DEFERRED AND SOMETIMES WITHDRAWN. R55 withdrew S9.15's `bars`
 * because what survived was pixel heights — the claim rendered geometry as business figures. The
 * line is what the row is MADE OF, not whether it has a headline: where the surviving values are
 * geometry the claim is withdrawn, and where they are real content in the wrong position it is
 * deferred, because withdrawing it would delete a scenario switcher an operator uses.
 */
export const DEFERRED_SHAPES = Object.freeze([
  {
    id: 'statList-second-figure',
    kind: 'variant',
    of: 'statList',
    // R57 asked whether Phase 5A's Shape 1 (heroMetrics.range) and Shape 2 (opportunity's bar) are
    // one variant. They are. Both rows are "label, a primary figure, and MORE THAN ONE secondary
    // element", and StatListBlock's limit is exactly that it renders one: `meta ?? detail ?? note
    // ?? pct` picks a single winner and discards the rest. A variant that renders an OPTIONAL
    // proportional bar from `pct` plus the remaining meta-class fields as stacked sub-lines serves
    // heroMetrics (value + range + note, no bar), `opportunity` (value + bar + meta) and
    // healthRows (value + bar + detail) with one component. Two variants here would be two
    // components differing only in whether the bar is drawn.
    shape: 'A statList row rendering label, its primary value, an OPTIONAL proportional bar from `pct`, '
      + 'and the remaining meta-class fields (`range`, `meta`, `note`, `detail`) as stacked sub-lines '
      + 'instead of one winner.',
    fields: ['statList.range', 'statList.delta'],
    unroutedKeys: ['opportunity'],
    objects: 3,
    rows: 10,
    evidence: '`range` is the P10-P90 interval — "+$17K to +$66K" beside "+$41K" — on prop_s9_1_decide, 3 rows, '
      + 'and `delta` is its sibling on prop_s9_18_decide, 3 more. referenceFidelity.test.js asserts `range` is '
      + 'present in the DATA while nothing renders it (ruling R47/R53: DEFERRED, not closed). '
      + 'COUNT CORRECTION: the Phase 5A proposal reported this as 9 objects / 39 rows. That was the union of '
      + 'field NAMES across the 9 objects claiming `heroMetrics`, not per-object presence — 9 objects claim the '
      + 'key, 2 of them carry a range or a delta. The defect is unchanged (a passing data test guards an '
      + 'unrendered field); its reach is 2 objects, not 9. '
      + '`opportunity` is S9.11/reason\'s 4-row breakdown, withdrawn from `proposal.trigger` by R48 and rendered '
      + 'nowhere until this variant exists.',
  },
  {
    id: 'barChart-row-note',
    kind: 'variant',
    of: 'barChart',
    shape: 'A bar row carrying its own explanatory line under the bar: `{label, value, note}`.',
    fields: ['barChart.note'],
    unroutedKeys: [],
    objects: 3,
    rows: 10,
    evidence: 'S9.16/analyze `launchCosts` ("Connector integration · $22.0K · existing connector, catalogue '
      + 'mapping"), S10.1/analyze `recon` ("Residual · +$130 · 1.0% of the move · target under 5%") and '
      + 'S10.2/analyze `scenarios` ("P50 trough · $89K · $31K under buffer · 4 days"), which joined this group '
      + 'when the gate withdrew `cccTrend` and the next candidate in the same list was taken. The note is what '
      + 'makes the figure readable, and BarChartBlock renders label and magnitude only.',
  },
  {
    id: 'barChart-labelled-from-own-vocabulary',
    kind: 'variant',
    of: 'barChart',
    shape: 'A bar chart whose label and magnitude arrive under the reference\'s own key names rather than '
      + '`label`/`value` — `{size, rate}`, `{label, count}` — with the derived `pct` ignored rather than plotted.',
    fields: [],
    unroutedKeys: ['sizes', 'detectBars'],
    objects: 2,
    rows: 10,
    evidence: 'S9.12/analyze `sizes` = `{size, rate, pct}`: BarChartBlock found no `label`, numbered the bars 1-6, '
      + 'and plotted `pct` (30/52/100/85/43/28) while `size` (the category) and `rate` (the real return rate, '
      + '9.1%-28.4%) were dropped — pct is rate/max, confirmed. S10.5/analyze `detectBars` = `{label, count, pct}` '
      + 'printed "under 4h: 29" where the truth is 4 (pct is share-of-count). Both claims withdrawn (R48).',
  },
  {
    id: 'gauge-prose-limit',
    kind: 'variant',
    of: 'gauge',
    shape: 'A gauge row that states its own limit in words — `{label, value, note}` where `note` carries '
      + '"floor 95% · scale 90-98%" — because the typed limit does not exist and R2 forbids parsing it out.',
    fields: ['gauge.note'],
    unroutedKeys: [],
    objects: 2,
    rows: 7,
    evidence: 'S9.18/S9.19 decide `bars`. Beyond the dropped note there is a second defect for 5B to resolve: '
      + 'GaugeBlock plots `value` (95.6%) against `limitPct` (63), which are on different scales — the same-scale '
      + 'pair is `pct`/`limitPct`, and the real floor is the prose in `note`. The claim is kept because the label '
      + 'and the real figure do render; the comparison drawn between them is 5B\'s to correct.',
  },
  {
    id: 'heatmapGrid-row-figures',
    kind: 'variant',
    of: 'heatmapGrid',
    shape: 'A heatmap row header carrying its own figures beside the grid: `{label, volume, optimal, note, cells}`.',
    fields: ['heatmapGrid.volume', 'heatmapGrid.optimal', 'heatmapGrid.note'],
    unroutedKeys: [],
    objects: 2,
    rows: 11, // S9.18 7 zones (volume + optimal), S9.13 4 deciles (note)
    evidence: 'S9.18/analyze `heatRows` carries "3,300 orders" and "99% optimal" per zone; S9.13/analyze `rfmGrid` '
      + 'carries "$310 median" per decile. HeatmapGridBlock reads `label` and `cells` and nothing else, so the row '
      + 'header states the zone and withholds its size.',
  },
  {
    id: 'cardSet-nested-and-footer',
    kind: 'variant',
    of: 'cardSet',
    shape: 'A card that can carry a nested list under ANY key (not only rows/items/changes/candidates), a footer '
      + 'prose line, and a short gate chip: `{name, sub, …figures, rules|attachments, foot, gate}`.',
    fields: ['cardSet.rules', 'cardSet.attachments', 'cardSet.gate', 'cardSet.foot'],
    unroutedKeys: [],
    objects: 3,
    rows: 8, // S9.18 4 rules, S10.3 2 attachments + 1 gate, S10.4 2 foots
    evidence: 'S9.18/decide `groups[].rules` is four named rules with a paragraph each — the substance of the '
      + 'group, dropped whole because `rules` is in CardSetBlock\'s NOT_A_FIGURE set and not in its NESTED_KEYS. '
      + 'S10.3/decide `actions[].attachments` lists the filing evidence and `gate` states who must act '
      + '("counsel files"). S10.4/decide `groups[].foot` is the paragraph explaining why the group is ordered first.',
  },
  {
    id: 'cardSet-headline-from-own-vocabulary',
    kind: 'variant',
    of: 'cardSet',
    shape: 'A card that takes its headline from the reference\'s own naming key when none of '
      + 'name/title/label is present — `{n, tag}` should head the card "tight", not "Option 1".',
    fields: [],
    unroutedKeys: [],
    anonymousClaims: ['caps@prop_s9_14_decide'],
    objects: 1,
    rows: 3,
    evidence: 'S9.14/decide `caps` = `[{n:"4",tag:"tight"},{n:"8",tag:"planned"},{n:"12",tag:"stretch"}] — the '
      + 'promo-depth scenarios the operator switches between. Found by the identity check, not by counting '
      + 'drops: nothing is dropped (CardSetBlock renders `tag` as a chip and `n` as a figure), but the headline '
      + 'falls through to "Option 1/2/3" because `tag` is read as a qualifier rather than as the name. '
      + 'NOT withdrawn, unlike the S9.15/S10.2 strips: `tight`/`planned`/`stretch` and 4/8/12 are real business '
      + 'values in the wrong position, not geometry, and CONSTRAINT_KEYS\' own comment already records the prior '
      + 'ruling that `caps` means a scenario switcher here.',
  },
  {
    id: 'cardSet-inline-histogram',
    kind: 'variant',
    of: 'cardSet',
    shape: 'A card carrying a small inline distribution — `hist: [{label, n}]` drawn as a sparkline inside the card.',
    fields: ['cardSet.hist'],
    unroutedKeys: [],
    objects: 1,
    rows: 5,
    evidence: 'S9.7/decide `groups[].hist` is the markdown-depth distribution per group (−45%: 4, −30%: 9, '
      + '−20%: 14, −10%: 11, 0: 4). It is a chart inside a card, which no block in the vocabulary composes.',
  },
  {
    id: 'timeline-with-axis-position',
    kind: 'variant',
    of: 'timeline',
    shape: 'A chronology whose entries also carry a position on a shared axis: `{label, when, pct}` drawn as '
      + 'events on a time bar rather than as a stacked list.',
    fields: [],
    // OBJECT-QUALIFIED, and the qualifier is load-bearing: `timeline` is a raw key name two
    // different screens use for two different things. S10.1/analyze's `timeline` is its entity list
    // and is correctly claimed as `proposal.entities`; only S10.6/analyze's is unrouted. An
    // unqualified entry here would assert the name is dead corpus-wide, which is false.
    unroutedKeys: ['timeline@prop_s10_6_analyze'],
    objects: 1,
    rows: 5,
    evidence: 'S10.6/analyze `timeline` = the Prime Fall cutoffs ("FBA cutoff · Aug 20 23:59"). It was claimed as '
      + '`proposal.comparison` and drawn as bars of 6/26/48/70/94 — those are x-positions on a date axis, and '
      + '`when`, the fact itself, was dropped. Claim withdrawn (R48).',
  },
  {
    id: 'scenario-ladder',
    kind: 'variant',
    of: 'statList',
    shape: 'A ladder of named scenarios, each with several parallel money figures: '
      + '`{label, svc, outlay, lost, head}` — five columns, read across as well as down.',
    fields: [],
    unroutedKeys: ['ladder'],
    objects: 1,
    rows: 5,
    evidence: 'S9.2/decide `ladder` — Lean/Trim/Policy/Guarded/Max, each with a service level, a book outlay, '
      + 'lost CM and headroom. Claimed as `proposal.basis` (statList), which renders a label and ONE figure, so '
      + 'five rows rendered as five bare words. A table would carry it losslessly but the reference reads it as a '
      + 'ladder; claim withdrawn (R48) rather than landed on a block that would mark it resolved.',
  },
  {
    id: 'anonymous-magnitude-strip',
    kind: 'neither — this content should not cross the boundary at all',
    of: null,
    shape: 'None. The surviving fields are pixel heights with no identity; the business values they were drawn '
      + 'from exist nowhere in the fixture.',
    fields: [],
    unroutedKeys: ['bars@prop_s9_15_analyze', 'cccTrend@prop_s10_2_analyze'],
    objects: 2,
    rows: 20,
    evidence: 'S9.15/analyze `bars` = `{x, y, h, op}` — eight bars with no label, `h` between "22.5" and "41.3". '
      + 'Ruling R55: `h` is geometry by the same arithmetic as `pct`, and validateBarChart\'s blessing of '
      + '"a real unlabeled bar chart" ruled on the SHAPE — that a bar chart may lack labels — not on whether these '
      + 'particular values are data. Phase 3A\'s geometry finding postdates that validator. '
      + 'S10.2/analyze `cccTrend` is the same thing and was NOT in the hand survey: after hygiene strips `fill` '
      + 'it is twelve rows of `{h}` and nothing else — a cash-conversion-cycle sparkline claimed as "the magnitude '
      + 'comparison". The identity check found it, which is the argument for having a rule rather than a list. '
      + 'Both claims withdrawn; the entry is recorded here so 5B does not go looking for a variant to render them.',
  },
]);

/**
 * EVERY ROUTING CHANGE PHASE 5A MAKES, declared so the corpus diff can be pinned by CONTENT.
 *
 * This replaces the `git diff --name-only` freeze pins Phase 3B (T31) and Phase 3C (T37) carried.
 * Those said "this phase changes no corpus file", which was true of them and is false of this one —
 * and worse, they only ever failed on an uncommitted tree, so once a phase was committed they
 * passed whatever the corpus said. A pin that goes quiet at exactly the moment the work lands is
 * the failure mode R54 names, so the freeze is retired with the phase it belonged to and what
 * replaces it survives a commit: the seven claims that move, named, with the key each lands on now.
 *
 * `to: null` is a WITHDRAWAL — the canonical field is omitted, the template's `when` omits the slot,
 * and the raw key is carried in DEFERRED_SHAPES above. A non-null `to` is the gate rejecting the
 * first candidate and the NEXT one in the same list being accepted: no key was re-pointed by hand.
 */
export const PHASE_5A_ROUTING_CHANGES = Object.freeze([
  { proposalId: 'prop_s9_11_reason', path: 'proposal.trigger', from: 'opportunity', to: null,
    why: 'timeline reads {when, what}; the value is {label, value, pct, meta}. R48.' },
  { proposalId: 'prop_s9_2_decide', path: 'proposal.basis', from: 'ladder', to: null,
    why: 'statList renders a label and ONE figure; every row carries four (svc/outlay/lost/head).' },
  { proposalId: 'prop_s9_12_analyze', path: 'proposal.comparison', from: 'sizes', to: 'owners',
    why: '`sizes` is {size, rate, pct} — no `label`, so the bars were numbered 1-6 and plotted the WIDTH. '
      + '`owners` is the attribution split, already labelled and already carrying its own money figures.' },
  { proposalId: 'prop_s9_15_analyze', path: 'proposal.comparison', from: 'bars', to: 'valueSplit',
    why: '`bars` is {x, y, h, op} — eight anonymous pixel heights (R55). `valueSplit` is $ by search intent.' },
  { proposalId: 'prop_s10_2_analyze', path: 'proposal.comparison', from: 'cccTrend', to: 'scenarios',
    why: '`cccTrend` is twelve rows of {h} after hygiene. `scenarios` is the P50/P10 cash trough with its note.' },
  { proposalId: 'prop_s10_5_analyze', path: 'proposal.comparison', from: 'detectBars', to: null,
    why: '`detectBars` printed "under 4h: 29" where the truth is 4 — pct is share-of-count. '
      + 'No other barChart-classified key survives on this screen, so the slot is omitted.' },
  { proposalId: 'prop_s10_6_analyze', path: 'proposal.comparison', from: 'timeline', to: 'forecast',
    why: '`timeline` is {label, when, pct} — a chronology whose `pct` is an x-position on a date axis. '
      + '`forecast` is the P10/P50/P90 revenue band, which is what a magnitude comparison means.' },
])

/**
 * THE T61 REGISTRY (ruling R54).
 *
 * Field paths a corpus DATA test asserts are present. Each must be consumed by its slot's blockType
 * or carry a required shape in DEFERRED_SHAPES — because a green test standing guard over a field
 * no operator can see grows confidence while the gap grows with it, and that is the failure mode
 * that made this whole phase necessary.
 *
 * `recommendation_metrics.range` is the seed and the proof: referenceFidelity.test.js:421 asserts it
 * byte-for-byte, it has passed since Phase 2, and StatListBlock has never rendered it.
 */
export const DATA_TEST_ASSERTED_FIELDS = Object.freeze([
  { slot: 'recommendation_metrics', field: 'range', assertedBy: 'referenceFidelity.test.js — "renders all six on the reference screen the audit traced (S9.1 decide)"' },
  { slot: 'recommendation_metrics', field: 'note', assertedBy: 'referenceFidelity.test.js — same case, `.note` toBeTruthy' },
  { slot: 'recommendation_metrics', field: 'label', assertedBy: 'referenceFidelity.test.js — same case, toMatchObject({label})' },
  { slot: 'composition', field: 'label', assertedBy: 'referenceFidelity.test.js — the composition bar toEqual([{label, value}])' },
  { slot: 'composition', field: 'value', assertedBy: 'referenceFidelity.test.js — same case' },
  { slot: 'item_groups', field: 'tag', assertedBy: 'referenceFidelity.test.js — "renders the reference item groups and their drill-down"' },
  { slot: 'focus_rows', field: 'name', assertedBy: 'referenceFidelity.test.js — same case' },
  { slot: 'threshold_control', field: 'min', assertedBy: 'claimedThresholds.test.js T17/T19 — the R14 numeric claim' },
  { slot: 'threshold_control', field: 'max', assertedBy: 'claimedThresholds.test.js T17/T19' },
  { slot: 'threshold_control', field: 'step', assertedBy: 'claimedThresholds.test.js T17/T19' },
  { slot: 'threshold_control', field: 'value', assertedBy: 'claimedThresholds.test.js T17/T19' },
  { slot: 'matrix', field: 'cells', assertedBy: 'claimedThresholds.test.js T18 — heatRows.eastPct/westPct -> cells[].share' },
  { slot: 'guardrail_checks', field: 'status', assertedBy: 'contractExtension.test.js — the per-row guardrail enum' },
]);

// ---- the ledger ---------------------------------------------------------------------------------

/**
 * Binding -> the slots that read it. This was a one-to-one Map, which was true of the vocabulary
 * until `reconciliation` joined `comparison` on `proposal.comparison`: a Map silently kept whichever
 * was declared LAST and attributed all 12 objects to it, so the 9 that really render a barChart were
 * audited as a statList and `barChart.pct` stopped being exercised at all. A binding read by two
 * slots is now a list, resolved per object below.
 */
const SLOTS_BY_BINDING = new Map();
for (const [name, spec] of Object.entries(SLOT_VOCABULARY)) {
  const slots = SLOTS_BY_BINDING.get(spec.binding) ?? [];
  slots.push({ slotName: name, ...spec });
  SLOTS_BY_BINDING.set(spec.binding, slots);
}

/**
 * Which slot actually reads `canonicalPath` on THIS object. One candidate is the overwhelming case
 * and resolves exactly as the old Map did. Where two slots share a binding the template's own `when`
 * is what chooses between them, so this asks it the same question StageRenderer asks before a block
 * reaches layout — the ledger audits what renders, so it must not guess at a shared binding.
 */
function slotFor(canonicalPath, decision) {
  const candidates = SLOTS_BY_BINDING.get(canonicalPath);
  if (candidates === undefined) return undefined;
  if (candidates.length === 1) return candidates[0];

  const names = new Set(candidates.map((c) => c.slotName));
  const blocks = resolveTemplate(decision)?.manifest?.blocks ?? [];
  const chosen = blocks.find((b) => names.has(b.slotName) && evaluateCondition(b.when, decision));
  return chosen === undefined ? undefined : candidates.find((c) => c.slotName === chosen.slotName);
}

const at = (obj, dottedPath) => dottedPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Every row of a claimed value that carries `field`, so an ignore-list `requires` can be checked. */
function rowsCarrying(value, field) {
  const rows = Array.isArray(value) ? value : isPlainObject(value) ? [value] : [];
  return rows.filter((r) => isPlainObject(r) && r[field] !== undefined);
}

/**
 * Classifies one dropped field.
 * @returns {{outcome: 'IGNORED'|'DEFERRED'|'MISROUTED', category?: string, reason?: string, shape?: string}}
 */
export function classifyDroppedField(blockType, field, value) {
  const key = `${blockType}.${field}`;
  const ignore = IGNORE_LIST[key];
  if (ignore !== undefined) {
    // An entry may be conditional — `barChart.pct` is geometry only where a real `value` sits beside
    // it. Where the condition fails the field is NOT ignorable, and the ledger says so.
    const rows = rowsCarrying(value, field);
    const holds = ignore.requires === undefined || (rows.length > 0 && rows.every((r) => ignore.requires(r)));
    if (holds) return { outcome: 'IGNORED', category: ignore.category, reason: ignore.reason };
  }
  const deferred = DEFERRED_SHAPES.find((s) => s.fields.includes(key));
  if (deferred !== undefined) return { outcome: 'DEFERRED', shape: deferred.id, reason: deferred.shape };
  return { outcome: 'MISROUTED' };
}

/**
 * Is this claim's anonymous-row problem already accounted for in G?
 * @param {string} rawKey @param {string} proposalId
 */
export function anonymityDeferredFor(rawKey, proposalId) {
  return DEFERRED_SHAPES.find((s) => (s.anonymousClaims ?? []).includes(`${rawKey}@${proposalId}`));
}

/**
 * THE LEDGER. One entry per (object, canonical path) claim that resolved to a real value on a slot.
 * @param {object[]} dataset   the generated corpus bundle (see this module's header on why it is a
 *   parameter and not an import)
 * @param {object} provenance  the generated canonical-field-to-reference-key map
 * @returns {Array<{proposalId, stage, rawKey, canonicalPath, slotName, blockType, fields, dropped, anonymousRows, outcome}>}
 */
export function buildLedger(dataset, provenance) {
  const entries = [];
  for (const decision of dataset) {
    const sources = provenance[decision.proposal_id] ?? {};
    for (const [canonicalPath, rawKey] of Object.entries(sources)) {
      if (rawKey === null) continue;
      const slot = slotFor(canonicalPath, decision);
      if (slot === undefined) continue; // header axes; the vocabulary excludes them by design
      const value = at(decision, canonicalPath);
      if (value === undefined) continue;

      const spec = CONSUMED_FIELDS[slot.blockType];
      const dropped = droppedFieldsOfValue(slot.blockType, value).map((field) => ({
        field,
        ...classifyDroppedField(slot.blockType, field, value),
      }));
      const anonymousRows = anonymousRowsOf(slot.blockType, value);
      const anonymityDeferred = anonymousRows > 0
        && anonymityDeferredFor(rawKey, decision.proposal_id) !== undefined;

      const fieldSet = Array.isArray(value)
        ? [...new Set(value.filter(isPlainObject).flatMap(Object.keys))]
        : isPlainObject(value) ? Object.keys(value) : [];

      entries.push({
        proposalId: decision.proposal_id,
        stage: decision.stage,
        rawKey,
        canonicalPath,
        slotName: slot.slotName,
        blockType: slot.blockType,
        renderMode: spec?.mode ?? 'unknown',
        fields: fieldSet,
        dropped,
        anonymousRows,
        anonymityDeferred,
        // A claim is MISROUTED if it loses a field nothing accounts for, OR if any row would render
        // with no identity at all and G does not already account for that (R55).
        outcome: dropped.some((d) => d.outcome === 'MISROUTED') || (anonymousRows > 0 && !anonymityDeferred)
          ? 'MISROUTED'
          : dropped.some((d) => d.outcome === 'DEFERRED') || anonymityDeferred ? 'DEFERRED' : 'CORRECT',
      });
    }
  }
  return entries;
}

/** Every raw key the ledger says is claimed somewhere, for the "is it unrouted" checks. */
export function claimedRawKeys(provenance) {
  const keys = new Set();
  for (const record of Object.values(provenance)) {
    for (const key of Object.values(record)) {
      if (typeof key === 'string' && !key.startsWith('(')) keys.add(key);
    }
  }
  return keys;
}

/** Every raw key DEFERRED_SHAPES declares unrouted, stripped of any `@object` qualifier. */
export function deferredUnroutedKeys() {
  return DEFERRED_SHAPES.flatMap((s) => s.unroutedKeys.map((k) => k.split('@')[0]));
}
