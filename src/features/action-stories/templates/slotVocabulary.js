// The canonical slot vocabulary.
//
// The corpus this replaces carried 835 distinct slotNames across 1,719 blocks, 667 of them used
// exactly once, with `footStatus` (39 uses) and `footerStatus` (22) naming the same concept. That
// is not a vocabulary; it is a per-screen naming accident, and it is the reason 105 manifests could
// never be anything but 105 instances.
//
// This module is the guard against that returning. Every slot a canonical template declares must
// appear here, bound to the same Decision Object path, and templateVocabulary.test.js enforces it.
// Adding a slot is a deliberate, reviewed edit to this file — not a side effect of authoring a
// screen.
//
// Tiers follow the audit's own consolidation rule, measured against the corpus:
//   core        - present in >=80% of the family's corpus members; the template always renders it.
//   conditional - 20-80%; the template declares it with a `when` so it is OMITTED, not emptied.
// Slots below 20% were folded into `narrative` or dropped, per the same rule.
//
// NOTHING HERE IS A PRESENTATION CONCEPT. There is no slot for a colour, a tone, a width, an
// offset, an SVG path or a visibility flag. Every binding below resolves to a business value on the
// Decision Object; layout is decided by the template's own sections/layout metadata and by
// composeSections, which is exactly where it already lived.

/**
 * @typedef {object} SlotSpec
 * @property {string} binding   - the canonical Decision Object path this slot always reads.
 * @property {string} blockType - must exist in manifests/blockTypes.js's BLOCK_TYPES.
 * @property {'core'|'conditional'} tier
 * @property {'full'|'half'} [span] - how wide this slot's block is, out of a 12-column row. Absent
 *   means `full`. Phase 5C: this is the ONLY source of a block's width. It replaced
 *   layout/blockSizing.js, which inferred a width by branching on blockType and measuring the
 *   content — the shape-guessing defect removed from the renderer in 3B and from the claim ledger
 *   in 5A, found alive in the layout layer. A span is declared here, per slot, with the reference
 *   evidence for it in the note; layout/packRows.js is the only reader.
 *
 *   NO SLOT DECLARES `half` TODAY, AND THAT IS THE RULE, NOT AN OVERSIGHT.
 *
 *   Six did: `policy`, `constraints`, `roles`, `entities`, `secondary_rows`, `plan`. The evidence
 *   for them was real — the reference's own stage rows are `grid-template-columns:1fr 1fr`, 59 of
 *   them across the 104 mockups. What the reference never did was put a TABLE in one. Across all
 *   114 mockups there is not a single `<table>` (blocks/tableColumns.js); its cards are stacked
 *   records, not column grids. So the source measured what a two-column row costs for CARDS and
 *   nothing ever measured what it costs for the tables this app renders into them.
 *
 *   Measured in Chrome at 1440, on all 105 objects. A half cell is 410px inside an 836px main
 *   column. `policy` overflowed on 12 screens (up to 349px, worst a 759px table in 410px);
 *   `roles` overflowed on 4 (up to 490px) as soon as it stopped being the unpaired third and
 *   started pairing. The remaining three never paired at all — `entities` and `secondary_rows`
 *   have a `full` neighbour between them, `plan`'s follower is `full` — so their declaration had
 *   been inert since it was written, and only luck kept them out of the same failure.
 *
 *   ONE RULE, APPLIED EVERYWHERE, rather than a per-slot exemption list: a block in the main region
 *   gets the full column. That is what removes the class instead of the three instances of it that
 *   happened to be visible. Corpus-wide it takes horizontally-scrolling blocks from 40 to 28, and
 *   every one of the 28 left is a table that overflows at FULL width too — a content problem, not
 *   a packing one.
 *
 *   THE MECHANISM IS UNTOUCHED AND STILL TESTED. layout/packRows.js keeps the span vocabulary and
 *   the pairing rule; nothing opts in. Re-enabling a half is adding `span: 'half'` to two adjacent
 *   slots here and nothing else, which is why the rule is left standing rather than deleted.
 * @property {string} [variant] - which of its blockType's declared variants this slot renders, from
 *   blocks/variants.js. Absent means the block's default shape. Phase 5B: this is the ONLY source of
 *   a variant — a block never chooses one, exactly as it never chooses its own width (5C) or its own
 *   block type (3B). Every variant cites the reference markup that earned it.
 * @property {string} [label]   - the heading a block prints for this slot, when the reference's own
 *   heading is not what humanizing the slot name produces. Absent means humanizeSlotName, which is
 *   right for most slots (`inputs` -> "Inputs", `rollback` -> "Rollback", `ledger` -> "Ledger" are
 *   all the reference's own words already). This is declared HERE, per slot, for the same reason
 *   `span` (5C) and `variant` (5B) are: a block never chooses its own heading any more than it
 *   chooses its own width — otherwise the copy for one concept drifts across the blocks that
 *   render it, which is the per-screen accident this whole file exists to prevent. Read only by
 *   blocks/slotLabel.js.
 * @property {string} note      - what the slot means, and which corpus concepts it consolidates.
 */

/** @type {Record<string, SlotSpec>} */
export const SLOT_VOCABULARY = Object.freeze({
  // ---- shared identity and context (every template) ------------------------------------------
  narrative: { binding: 'narrative', blockType: 'text', tier: 'core', note: 'The proposal\'s own sentence. Absorbs the corpus\'s rationale/dialNote/primaryInsight/restNote copy fields.' },
  // decision_mode WAS HERE. Removed in Phase 4 Part 2: the header states the mode (StagePage.jsx's
  // `data-fact="mode"`), and a slot existed only so a rail block could state it a second time. Every
  // pane rendered "Mode suggest" above and "Suggest" beside it. The axis is unchanged and still
  // required by the contract — what is gone is the second place it was rendered, and the slot that
  // existed to render it there. enumLabel.js keeps its `decision_mode` entry: that map is keyed by
  // concept, and the mode enum still needs a display label wherever it is shown.
  // decision_lens WAS HERE. Removed in Phase 5E Part 2 (ruling R91), for the third time and by the
  // same argument as `decision_mode` in Phase 4 Part 2 and `stage_status` in 5C: one fact, one
  // place. The lens is now drawn as the accent on the pane eyebrow (PaneEyebrow.jsx, blocks/
  // lensAccent.js) on EVERY stage, including execute, which this slot never reached — so the rail
  // row was both a second rendering and an incomplete one. Axis 6 is unchanged on the Decision
  // Object and still required by the contract; enumLabel.js keeps its `lens` entry, because that
  // map is keyed by concept and the enum still needs a display label wherever it is shown.
  //
  // THE ACCENT CARRIES IT VISUALLY, SO THE ACCENT CARRIES ITS LABEL. A colour says nothing to
  // anyone who cannot see it, and the rail row is what used to say it in text. PaneEyebrow's
  // sr-only "<lens> lens" is not decoration — it is the whole of the lens for a screen-reader user
  // now, and it was already load-bearing on execute before this change.
  decision_persona: { binding: 'persona', blockType: 'text', tier: 'core', note: 'Axis 7. Consolidates the corpus\'s free-text `owner`.' },
  decision_contract_class: { binding: 'contract_class', blockType: 'text', tier: 'conditional', note: 'Axis 2. Rendered only for strategic/regulated.' },
  // stage_status WAS HERE. Removed in Phase 5C (ruling R60), for the same reason and by the same
  // argument as `decision_mode` above. It bound `status_note` — the stage's own one-line state, the
  // footer line 38 reference screens print — and rendered it as a rail block. The reference prints
  // it in exactly one place: the pinned action bar at the foot of the pane
  // (S10.1-1-reason.dc.html:392). Now that the bar exists on every stage and states it there, a rail
  // copy would be a second rendering of one fact, which is the defect Phase 4 Part 2 deleted
  // `decision_mode` for. `status_note` itself is unchanged on the Decision Object and is still
  // claimed from `footStatus`/`footerStatus` — what is gone is the second place it was shown.

  // NOT SLOTS, deliberately. `deadline`, `impact`, `confidence` and `confidence.calibrated` are all
  // rendered ONCE, by the page's own ProposalHeader (pages/StagePage.jsx), which formats them
  // correctly: a relative "Due in 2d" rather than a raw ISO instant, and "78%" rather than "0.78".
  // They previously existed here as well, so every decide screen printed each fact twice — the
  // second time unformatted (audit RB-1/RB-2). Deleting the duplicate slot IS the fix; adding a
  // date-formatting block for a value the header already formats would have been the wrong one.

  // ---- reason.v1 -----------------------------------------------------------------------------
  // The label is the reference's own card heading, verbatim: 11 of the 14 stories carrying a
  // `trigger` title that card "What raised this" (S10.2-1-reason.dc.html:324 wraps `{{ trigger }}`
  // in it; the other three say "Why this card exists"). The note below has quoted it since Phase 3
  // and TimelineBlock's own header cites it — it was documented in two places and rendered in
  // neither, so every reason screen printed "Trigger", a word the reference never uses.
  trigger: { binding: 'proposal.trigger', blockType: 'timeline', tier: 'conditional', label: 'What raised this', note: '"What raised this" — the events that queued the proposal. Reference `trigger` (14 of 26 stories).' },
  policy: { binding: 'proposal.policy', blockType: 'table', tier: 'core', note: 'The governing targets/limits. Reference `policy`/`targets`/`rules`/`standards`/`thresholds`/`slas`.' },
  constraints: { binding: 'proposal.constraints', blockType: 'labelValueList', tier: 'core', note: '"Locked — owned by another lens": what is NOT negotiable in Decide. Reference `locked` (19 of 26) — the single most frequent reason-stage concept, previously dropped whole.' },
  inputs: { binding: 'proposal.inputs', blockType: 'statList', tier: 'conditional', note: 'Data the recommendation was computed from. Reference `inputs`/`sources`/`evidence`.' },
  roles: { binding: 'proposal.roles', blockType: 'table', tier: 'conditional', note: 'The entity taxonomy this proposal reasons over. Reference `roles`/`cohorts`/`clusters` — never `agents`, which is a different concept (see `agents`).' },
  agents: { binding: 'proposal.agents', blockType: 'roster', tier: 'core', note: 'The named MODELS credited on this proposal ("Role Classifier", "GMROI Engine"). Every reference story names them; a persona is a human, an agent is a model.' },

  // ---- analyze.compare.v1 --------------------------------------------------------------------
  primary_insight: { binding: 'proposal.primary_insight', blockType: 'text', tier: 'conditional', note: 'The single finding the analysis exists to deliver. Only from a real insight field — never `pinnedSub` (the shell\'s identity strip) and never the same sentence as `narrative`.' },
  comparison: { binding: 'proposal.comparison', blockType: 'barChart', tier: 'conditional', note: 'The magnitude comparison. Typed rows; the frontend derives every coordinate. Rows carrying a prose `note` instead of a `pct` are NOT this slot — see `reconciliation`.' },
  reconciliation: { binding: 'proposal.comparison', blockType: 'statList', tier: 'conditional', variant: 'reconStrip', note: 'The same binding as `comparison`, read as the metric strip it is when its rows carry a prose `note`: the reference draws label, figure and note as a card per row (`recon`, S10.1-2-analyze.dc.html:286-288), which StatListBlock\'s header already names as what the visual comparison was asking for. WHY A SECOND SLOT AND NOT A BLOCK THAT CHOOSES. `proposal.comparison` carries two shapes across the corpus: `{label,value,pct}` on 8 objects, where `pct` is the magnitude a bar is drawn from, and `{label,value,note}` on 3 (S10.1, S10.2, S9.16), where no magnitude exists at all. On those 3, barChart\'s MAGNITUDE_KEYS fell through `pct` to `value` and recovered a bar height by stripping non-digits from a DISPLAY STRING — "−$1,970" became 1970, sign and all, which is the R2 violation those keys exist to prevent, and it plotted levels ($12,480) against deltas (+$130) on one axis. The shape is the slot\'s, so the split is declared here rather than sniffed at render: a block never chooses its own blockType (3B), exactly as it never chooses its own width (5C) or variant (5B).' },
  distribution: { binding: 'proposal.distribution', blockType: 'scatterChart', tier: 'conditional', note: 'Spread/position across two typed dimensions. Corpus `points`.' },
  trend: { binding: 'proposal.trend', blockType: 'lineChart', tier: 'conditional', note: 'Typed {x,y} series. Replaces the corpus\'s raw SVG path strings. Kept below the 20% corpus floor deliberately: most corpus trends were raw SVG paths that the hygiene pass correctly strips, and a typed time series is an explicit contract requirement.' },
  bridge: { binding: 'proposal.bridge', blockType: 'waterfallChart', tier: 'conditional', note: 'The plan-to-actual variance bridge (S10.1). Wires the already-registered WaterfallChartBlock, which the audit found unreachable.' },
  coverage: { binding: 'proposal.coverage', blockType: 'gauge', tier: 'conditional', variant: 'meteredRow', note: 'Values measured against their own limit/ceiling. Wires the already-registered GaugeBlock.' },
  matrix: { binding: 'proposal.matrix', blockType: 'heatmapGrid', tier: 'conditional', variant: 'zoneRow', note: 'A 2-D business matrix (the RFM grid). Wires the already-registered HeatmapGridBlock.' },
  detail_rows: { binding: 'proposal.detail_rows', blockType: 'table', tier: 'core', note: 'The row-level evidence board. Consolidates the reference\'s rows/gaps/cases/disposition.' },
  entities: { binding: 'proposal.entities', blockType: 'itemQueue', tier: 'conditional', note: 'The entities the analysis is about — supplier scorecards, carrier lanes, candidate SKUs, role cohorts. 15 of 26 reference analyze screens carry one.' },
  secondary_rows: { binding: 'proposal.secondary_rows', blockType: 'table', tier: 'conditional', note: 'The SECOND evidence board. A reference analyze screen routinely carries more than one (S9.2: stock-out risk, overstock, open POs); 23 of 26 carry a second board the single detail_rows slot had nowhere to put.' },

  // ---- decide.slate.v1 -----------------------------------------------------------------------
  // The Recommendation SECTION is six independently renderable semantic units, and therefore six
  // slots — not one opaque block. See docs/REFERENCE_TO_TEMPLATE_BLOCK_AUDIT.md §4.
  recommendation_identity: { binding: 'proposal.recommendation_identity', blockType: 'text', tier: 'conditional', note: '1/6. WHICH recommendation this is ("Balanced"). Reference `slateName`/`slateMeta`.' },
  recommendation: { binding: 'proposal.recommendation', blockType: 'text', tier: 'core', note: '2/6. The recommended decision, stated once. Reference `heroTitle`/`heroLine` — NEVER `approveLabel`, which is the CTA button\'s text.' },
  recommendation_detail: { binding: 'proposal.recommendation_detail', blockType: 'text', tier: 'conditional', note: '3/6. The reasoning sentence under the statement. Reference `heroSub`/`heroBody`/`tradeoff`.' },
  recommendation_metrics: { binding: 'proposal.recommendation_metrics', blockType: 'statList', tier: 'conditional', variant: 'metricGrid', note: '4/6. The figures behind the recommendation, each with its P10-P90 `range` and its caveat `note`. Reference `heroMetrics`.' },
  composition: { binding: 'proposal.composition', blockType: 'barChart', tier: 'conditional', note: '5/6. How the recommendation splits across its categories. Reference `moveBar`, normalised to {label, value} so the EXISTING BarChartBlock carries it — a bar per category is the composition, so no new block type was added.' },
  basis: { binding: 'proposal.basis', blockType: 'statList', tier: 'conditional', note: '6/6. The provenance figures behind the confidence. Fills the `provenance` section, which the audit found declared and permanently empty.' },

  alternatives: { binding: 'proposal.alternatives', blockType: 'cardSet', tier: 'conditional', variant: 'scenarioCard', note: 'The scenarios the operator may switch between ("Conservative / Balanced / Aggressive"). Reference `slates`/`modes`/`offerModes`/`slateTabs`/`caps`.' },
  item_groups: { binding: 'proposal.item_groups', blockType: 'cardSet', tier: 'conditional', variant: 'groupCard', note: 'The selectable GROUPS of items, each with its own revenue/margin/capital effect. Reference `groups`.' },
  focus_rows: { binding: 'proposal.focus_rows', blockType: 'table', tier: 'conditional', note: 'The focused group drilled down to its individual items (SKU / capital / 90d revenue / GMROI). Reference `focusRows`.' },
  slate: { binding: 'proposal.slate', blockType: 'table', tier: 'conditional', note: 'The decision slate — the items being decided on. ONLY from the reference\'s own item vocabulary; this is the slot `approve_selected` acts on, so a shape-matched stand-in here is an integrity hazard, not a cosmetic one.' },
  next_actions: { binding: 'proposal.next_actions', blockType: 'cardSet', tier: 'conditional', variant: 'routeCard', note: 'The routes out of this decision, each with the reference\'s own explanation of what it does. Reference `actions`/`routes`.' },
  totals_rows: { binding: 'totals.rows', blockType: 'statList', tier: 'conditional', note: 'The decision\'s roll-up totals. Reference `totals`/`rollup`/`summary`/`liveStats`.' },
  // Phase 5A, ruling R50. `proposal.threshold_control` was claimed in Phase 3A under R14 — the ONE
  // place in the whole corpus where the reference states a threshold as numbers rather than as a
  // formatted string (S9.12's `rlThreshold`, the 6-24 week return-lag read window) — and
  // claimedThresholds.test.js's T17/T19 have asserted it present ever since. No slot bound it, so it
  // rendered nowhere, and `slider` sat registered and unreachable in the block registry. Claiming
  // data deliberately and then rendering none of it makes the phase that claimed it a lie, which is
  // why this is the one slot 5A adds. It needs no variant and no new block: SliderBlock, its
  // `steps` override path in StageRenderer and its full-width layout rule all already exist.
  threshold_control: { binding: 'proposal.threshold_control', blockType: 'slider', tier: 'conditional', note: 'The one threshold the reference states as NUMBERS ({min, max, step, value}) rather than as display copy. Reference `rlThreshold`.' },
  guardrail_verdict: { binding: 'guardrails.verdict', blockType: 'text', tier: 'core', note: 'The real 4-value enum, never a boolean. Replaces blocked/canApprove.' },
  guardrail_checks: { binding: 'guardrails.checks', blockType: 'checklist', tier: 'conditional', note: 'The governance checklist. Reference `checks`/`guardParts` — rows identified by `label`, `name` OR `text`.' },

  // ---- execute.bridge.v1 ---------------------------------------------------------------------
  plan: { binding: 'execution.plan', blockType: 'table', tier: 'core', note: 'What will be executed, step by step. Corpus `planLine`/`stages`.' },
  progress: { binding: 'execution.progress_pct', blockType: 'number', tier: 'core', note: 'Typed percent complete. Corpus `progressPct` (14 uses).' },
  progress_rows: { binding: 'execution.progress_rows', blockType: 'statList', tier: 'conditional', note: 'Per-target execution state. Corpus `progressRows` (14 uses).' },
  verification: { binding: 'execution.verification', blockType: 'labelValueList', tier: 'core', note: 'What must hold true for the execution to be correct. Corpus `monitors`.' },
  rollback: { binding: 'execution.rollback', blockType: 'labelValueList', tier: 'core', note: 'How to undo it. Corpus `rollback` (8 uses).' },
  ledger: { binding: 'execution.ledger', blockType: 'table', tier: 'conditional', note: 'The append-only record of what actually happened. Kept below the 20% corpus floor deliberately: an audit trail is a named requirement of the Execute template, not an inferred slot.' },
  ledger_note: { binding: 'execution.ledger_note', blockType: 'text', tier: 'conditional', note: 'What the ledger entry will record. Reference `ledgerCopy` (8 of 26).' },
  execution_targets: { binding: 'execution.targets', blockType: 'itemQueue', tier: 'conditional', note: 'Systems/channels being WRITTEN TO. Reference `dests`/`tray`/`orders` — never `monitors`, which is `verification`; sourcing both from the same key rendered the same list twice on 12 of 21 execute screens.' },
  rollback_note: { binding: 'execution.rollback_note', blockType: 'text', tier: 'conditional', note: 'Whether rollback is available yet, and from when. Reference `rbCopy`/`rbHint`.' },
  flags: { binding: 'execution.flags', blockType: 'timeline', tier: 'conditional', note: 'Thresholds that raise an exception on this execution. Reference `flags` ({when, rule, action}).' },
  arming: { binding: 'execution.arming', blockType: 'text', tier: 'conditional', note: 'The armed safety on this execution ("Auto-pause on decay"). Reference `armCopy` (12 of 26).' },
  bulk_note: { binding: 'execution.bulk_note', blockType: 'text', tier: 'conditional', note: 'Why the bulk writes go out together — the envelope the batch protects. Reference `allNote` (10 of 26).' },

  // ---- locked.v1 -----------------------------------------------------------------------------
  locked_title: { binding: 'title', blockType: 'text', tier: 'core', note: 'The one identifying line a locked viewer may see.' },
  teaser_summary: { binding: 'proposal.teaser_summary', blockType: 'text', tier: 'core', note: 'Deliberately non-specific: never the real slate, figures or item count.' },
  upgrade_cta: { binding: 'proposal.upgrade_cta', blockType: 'text', tier: 'core', note: 'How to obtain access. Copy is backend-owned.' },

  // ---- PHASE 9: THE SHAPE SLOTS ----------------------------------------------------------------
  //
  // Every slot above this line is a CONCEPT — `policy`, `inputs`, `guardrail_checks`. These eight
  // are a SHAPE, and they exist because matching by name left 1852 of 2498 raw keys unreachable.
  // The reasoning, the census and the two shapes' definitions are in templates/shapeSlots.js, which
  // also holds the candidate lists; nothing here restates them.
  //
  // FOUR SHAPES, TWO NAMESPACES. `proposal` is empty on all 26 execute objects and the one live
  // object — the convention throughout is that execution-stage data lives under `execution` — so a
  // shape that appears on both sides needs a binding on both sides. It is the same shape and the
  // same component; only the path differs, and shapeSlots.js asserts the candidate lists stay
  // identical so this cannot decay into per-stage naming.
  //
  // `secondary_*` is not a second concept. A pane may hold two of one shape, and the second slot
  // claims whatever the first did not. Three or more and NONE is claimed — ruling R130, because
  // these slots are labelled "Measures" and "Notes" rather than by the reference's own pane
  // eyebrow, which is in the mockup's HTML and not in the payload.
  measures: { binding: 'proposal.measures', blockType: 'statList', tier: 'conditional', note: 'A labelled metric list — `{label, value}` with at most one meta line. 58 reference names arrive as this one shape; see shapeSlots.js.' },
  secondary_measures: { binding: 'proposal.secondary_measures', blockType: 'statList', tier: 'conditional', note: 'The second metric list on a pane that carries two. Claims what `measures` did not.' },
  notes: { binding: 'proposal.notes', blockType: 'labelValueList', tier: 'conditional', note: 'A named note — a name and a sentence, no figure. The shape `constraints` already renders, arriving under 20 other names.' },
  execution_measures: { binding: 'execution.measures', blockType: 'statList', tier: 'conditional', note: 'The metric-list shape on an execute or live pane, where `proposal` is empty by convention.' },
  execution_notes: { binding: 'execution.notes', blockType: 'labelValueList', tier: 'conditional', note: 'The named-note shape on an execute or live pane.' },
  execution_secondary_notes: { binding: 'execution.secondary_notes', blockType: 'labelValueList', tier: 'conditional', note: 'The second note list on an execute or live pane.' },
})

export const CANONICAL_SLOT_NAMES = Object.freeze(Object.keys(SLOT_VOCABULARY))

/** @returns {SlotSpec|null} */
export function getSlotSpec(slotName) {
  return SLOT_VOCABULARY[slotName] ?? null
}
