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
 * @property {string} note      - what the slot means, and which corpus concepts it consolidates.
 */

/** @type {Record<string, SlotSpec>} */
export const SLOT_VOCABULARY = Object.freeze({
  // ---- shared identity and context (every template) ------------------------------------------
  narrative: { binding: 'narrative', blockType: 'text', tier: 'core', note: 'The proposal\'s own sentence. Absorbs the corpus\'s rationale/dialNote/primaryInsight/restNote copy fields.' },
  decision_mode: { binding: 'mode', blockType: 'text', tier: 'core', note: 'Axis 4. Replaces the corpus\'s execLabel, which was 104x "Suggest" and 1x "Assist".' },
  decision_lens: { binding: 'lens', blockType: 'text', tier: 'core', note: 'Axis 6.' },
  decision_persona: { binding: 'persona', blockType: 'text', tier: 'core', note: 'Axis 7. Consolidates the corpus\'s free-text `owner`.' },
  decision_contract_class: { binding: 'contract_class', blockType: 'text', tier: 'conditional', note: 'Axis 2. Rendered only for strategic/regulated.' },
  stage_status: { binding: 'status_note', blockType: 'text', tier: 'conditional', note: 'The stage\'s own one-line state ("Decide · 56 SKUs across 4 moves · balanced slate"). Every reference screen prints one in its footer; 38 carry a real value. Reference `footStatus`/`footerStatus`.' },

  // NOT SLOTS, deliberately. `deadline`, `impact`, `confidence` and `confidence.calibrated` are all
  // rendered ONCE, by the page's own ProposalHeader (pages/StagePage.jsx), which formats them
  // correctly: a relative "Due in 2d" rather than a raw ISO instant, and "78%" rather than "0.78".
  // They previously existed here as well, so every decide screen printed each fact twice — the
  // second time unformatted (audit RB-1/RB-2). Deleting the duplicate slot IS the fix; adding a
  // date-formatting block for a value the header already formats would have been the wrong one.

  // ---- reason.v1 -----------------------------------------------------------------------------
  trigger: { binding: 'proposal.trigger', blockType: 'table', tier: 'conditional', note: '"What raised this" — the events that queued the proposal. Reference `trigger` (14 of 26 stories).' },
  policy: { binding: 'proposal.policy', blockType: 'table', tier: 'core', note: 'The governing targets/limits. Reference `policy`/`targets`/`rules`/`standards`/`thresholds`/`slas`.' },
  constraints: { binding: 'proposal.constraints', blockType: 'labelValueList', tier: 'core', note: '"Locked — owned by another lens": what is NOT negotiable in Decide. Reference `locked` (19 of 26) — the single most frequent reason-stage concept, previously dropped whole.' },
  inputs: { binding: 'proposal.inputs', blockType: 'statList', tier: 'conditional', note: 'Data the recommendation was computed from. Reference `inputs`/`sources`/`evidence`.' },
  roles: { binding: 'proposal.roles', blockType: 'table', tier: 'conditional', note: 'The entity taxonomy this proposal reasons over. Reference `roles`/`cohorts`/`clusters` — never `agents`, which is a different concept (see `agents`).' },
  agents: { binding: 'proposal.agents', blockType: 'roster', tier: 'core', note: 'The named MODELS credited on this proposal ("Role Classifier", "GMROI Engine"). Every reference story names them; a persona is a human, an agent is a model.' },

  // ---- analyze.compare.v1 --------------------------------------------------------------------
  primary_insight: { binding: 'proposal.primary_insight', blockType: 'text', tier: 'conditional', note: 'The single finding the analysis exists to deliver. Only from a real insight field — never `pinnedSub` (the shell\'s identity strip) and never the same sentence as `narrative`.' },
  comparison: { binding: 'proposal.comparison', blockType: 'barChart', tier: 'conditional', note: 'The magnitude comparison. Typed rows; the frontend derives every coordinate.' },
  distribution: { binding: 'proposal.distribution', blockType: 'scatterChart', tier: 'conditional', note: 'Spread/position across two typed dimensions. Corpus `points`.' },
  trend: { binding: 'proposal.trend', blockType: 'lineChart', tier: 'conditional', note: 'Typed {x,y} series. Replaces the corpus\'s raw SVG path strings. Kept below the 20% corpus floor deliberately: most corpus trends were raw SVG paths that the hygiene pass correctly strips, and a typed time series is an explicit contract requirement.' },
  bridge: { binding: 'proposal.bridge', blockType: 'waterfallChart', tier: 'conditional', note: 'The plan-to-actual variance bridge (S10.1). Wires the already-registered WaterfallChartBlock, which the audit found unreachable.' },
  coverage: { binding: 'proposal.coverage', blockType: 'gauge', tier: 'conditional', note: 'Values measured against their own limit/ceiling. Wires the already-registered GaugeBlock.' },
  matrix: { binding: 'proposal.matrix', blockType: 'heatmapGrid', tier: 'conditional', note: 'A 2-D business matrix (the RFM grid). Wires the already-registered HeatmapGridBlock.' },
  detail_rows: { binding: 'proposal.detail_rows', blockType: 'table', tier: 'core', note: 'The row-level evidence board. Consolidates the reference\'s rows/gaps/cases/disposition.' },
  entities: { binding: 'proposal.entities', blockType: 'itemQueue', tier: 'conditional', note: 'The entities the analysis is about — supplier scorecards, carrier lanes, candidate SKUs, role cohorts. 15 of 26 reference analyze screens carry one.' },
  secondary_rows: { binding: 'proposal.secondary_rows', blockType: 'table', tier: 'conditional', note: 'The SECOND evidence board. A reference analyze screen routinely carries more than one (S9.2: stock-out risk, overstock, open POs); 23 of 26 carry a second board the single detail_rows slot had nowhere to put.' },

  // ---- decide.slate.v1 -----------------------------------------------------------------------
  // The Recommendation SECTION is six independently renderable semantic units, and therefore six
  // slots — not one opaque block. See docs/REFERENCE_TO_TEMPLATE_BLOCK_AUDIT.md §4.
  recommendation_identity: { binding: 'proposal.recommendation_identity', blockType: 'text', tier: 'conditional', note: '1/6. WHICH recommendation this is ("Balanced"). Reference `slateName`/`slateMeta`.' },
  recommendation: { binding: 'proposal.recommendation', blockType: 'text', tier: 'core', note: '2/6. The recommended decision, stated once. Reference `heroTitle`/`heroLine` — NEVER `approveLabel`, which is the CTA button\'s text.' },
  recommendation_detail: { binding: 'proposal.recommendation_detail', blockType: 'text', tier: 'conditional', note: '3/6. The reasoning sentence under the statement. Reference `heroSub`/`heroBody`/`tradeoff`.' },
  recommendation_metrics: { binding: 'proposal.recommendation_metrics', blockType: 'table', tier: 'conditional', note: '4/6. The figures behind the recommendation, each with its P10-P90 `range` and its caveat `note`. Reference `heroMetrics`.' },
  composition: { binding: 'proposal.composition', blockType: 'barChart', tier: 'conditional', note: '5/6. How the recommendation splits across its categories. Reference `moveBar`, normalised to {label, value} so the EXISTING BarChartBlock carries it — a bar per category is the composition, so no new block type was added.' },
  basis: { binding: 'proposal.basis', blockType: 'statList', tier: 'conditional', note: '6/6. The provenance figures behind the confidence. Fills the `provenance` section, which the audit found declared and permanently empty.' },

  alternatives: { binding: 'proposal.alternatives', blockType: 'cardSet', tier: 'conditional', note: 'The scenarios the operator may switch between ("Conservative / Balanced / Aggressive"). Reference `slates`/`modes`/`offerModes`/`slateTabs`/`caps`.' },
  item_groups: { binding: 'proposal.item_groups', blockType: 'cardSet', tier: 'conditional', note: 'The selectable GROUPS of items, each with its own revenue/margin/capital effect. Reference `groups`.' },
  focus_rows: { binding: 'proposal.focus_rows', blockType: 'table', tier: 'conditional', note: 'The focused group drilled down to its individual items (SKU / capital / 90d revenue / GMROI). Reference `focusRows`.' },
  slate: { binding: 'proposal.slate', blockType: 'table', tier: 'conditional', note: 'The decision slate — the items being decided on. ONLY from the reference\'s own item vocabulary; this is the slot `approve_selected` acts on, so a shape-matched stand-in here is an integrity hazard, not a cosmetic one.' },
  next_actions: { binding: 'proposal.next_actions', blockType: 'cardSet', tier: 'conditional', note: 'The routes out of this decision, each with the reference\'s own explanation of what it does. Reference `actions`/`routes`.' },
  totals_rows: { binding: 'totals.rows', blockType: 'statList', tier: 'conditional', note: 'The decision\'s roll-up totals. Reference `totals`/`rollup`/`summary`/`liveStats`.' },
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
  flags: { binding: 'execution.flags', blockType: 'table', tier: 'conditional', note: 'Thresholds that raise an exception on this execution. Reference `flags` ({when, rule, action}).' },
  arming: { binding: 'execution.arming', blockType: 'text', tier: 'conditional', note: 'The armed safety on this execution ("Auto-pause on decay"). Reference `armCopy` (12 of 26).' },
  bulk_note: { binding: 'execution.bulk_note', blockType: 'text', tier: 'conditional', note: 'Why the bulk writes go out together — the envelope the batch protects. Reference `allNote` (10 of 26).' },

  // ---- locked.v1 -----------------------------------------------------------------------------
  locked_title: { binding: 'title', blockType: 'text', tier: 'core', note: 'The one identifying line a locked viewer may see.' },
  teaser_summary: { binding: 'proposal.teaser_summary', blockType: 'text', tier: 'core', note: 'Deliberately non-specific: never the real slate, figures or item count.' },
  upgrade_cta: { binding: 'proposal.upgrade_cta', blockType: 'text', tier: 'core', note: 'How to obtain access. Copy is backend-owned.' },
})

export const CANONICAL_SLOT_NAMES = Object.freeze(Object.keys(SLOT_VOCABULARY))

/** @returns {SlotSpec|null} */
export function getSlotSpec(slotName) {
  return SLOT_VOCABULARY[slotName] ?? null
}
