// WHICH VARIANT A BLOCK RENDERS — declared per slot, capped per block, chosen by nobody.
//
// A VARIANT IS A SECOND SHAPE FOR THE SAME CONCEPT, not a second block. `item_groups` and
// `alternatives` are both `cardSet` because both are named choices with supporting figures; the
// reference draws them differently, and that difference is presentation. Where the difference is
// semantic, the answer is a different slot or a different block — both of which this phase is
// forbidden to add (C1), which is the constraint that keeps this list honest.
//
// WHERE IT COMES FROM, AND WHY IT CANNOT COME FROM ANYWHERE ELSE (I1). `variantOf` takes a slot
// name. It has no parameter for the value, the row count or the blockType, so it cannot branch on
// any of them. That is the same signature discipline `packRows.js`'s `spanOf` got in Phase 5C,
// after `blockSizing.js` was deleted for choosing a width by measuring content — and the same
// defect the renderer had in 3B (inspecting data to decide what a block was) and the claim ledger
// had in 5A (matching a key to a slot by coarse shape). Three removals; it does not return as
// styling.
//
// CAPPED AT THREE PER BLOCK (I2). A fourth is a new block wearing a variant's name, and needs a
// ruling rather than a line here. `cardSet` sits exactly at the cap — and only because variants are
// keyed by SLOT: Phase 5A's shape list split `item_groups` across two entries (nested rules/footer,
// and the inline histogram), which are one variant of one slot, not two.
//
// TEN SHAPES BECAME FIVE. Four of 5A's ten were scoped for keys 5A itself withdrew — `sizes`,
// `detectBars`, `timeline`@S10.6, `ladder` and `opportunity` are unclaimed, C1 forbids re-claiming
// them, and a variant for them would render nothing at all. A fifth, `barChart row note`, was
// dropped because its evidence did not survive a second look: all three sources render as stacked
// metric grids in the reference, not as bars with notes (R69).

import { SLOT_VOCABULARY } from '../templates/slotVocabulary.js'

/** No block may declare more than this many. */
export const MAX_VARIANTS_PER_BLOCK = 3

/**
 * blockType -> its declared variants. Every entry cites the reference markup that earned it (I5);
 * a variant with no reference evidence is not built, however much better it might look.
 */
export const BLOCK_VARIANTS = Object.freeze({
  // S9.1-3-decide.dc.html:220-227 — label / value / range / note as FOUR stacked lines. The block's
  // default renders three, because `Metric` takes one meta line and `range` loses the `??` chain to
  // `note`. That is the field a passing data test guarded for three phases while nothing drew it.
  // S10.1-2-analyze.dc.html:286-288 — the reconciliation's terms sit on ONE line, read across as a
  // single account (baseline, what was attributed, what was left, where it landed). The default is a
  // 3-up sized for the rail, so a four-term reconciliation wrapped after three and the last term
  // dropped to a second line on its own. Same three sources R69 surveyed when it dropped the
  // `barChart row note` variant for rendering "as stacked metric grids in the reference" — this is
  // the grid it meant, now that `reconciliation` gives those rows a slot to land on.
  statList: ['metricGrid', 'reconStrip'],

  // S9.18-3-decide.dc.html:311-323 — label+value on a row, a bar filled from `pct` with a tick at
  // `limitPct`, and `note` on a mono line beneath. The default plots `value` against `limitPct`,
  // which are on different scales; 5A recorded that mis-scaling as this phase's to correct.
  gauge: ['meteredRow'],

  // S9.18-2-analyze.dc.html:305-317 — `grid-template-columns:52px 1fr 62px`: label with `volume`
  // stacked beneath it, the split bar, and `optimal` right-aligned. The default renders the label
  // and the cells and drops the row's own figures.
  heatmapGrid: ['zoneRow'],

  cardSet: [
    // S9.18-3-decide:235-239 (a nested `rules` list), S10.4-3-decide:305-307 (a `foot` paragraph),
    // S9.7-3-decide:267-277 (an inline `hist` column chart inside the card).
    'groupCard',
    // S10.3-3-decide:393-397 (`attachments` as pill chips), :321-325 (the `gate` chip).
    'routeCard',
    // S9.14-3-decide:227-230 — the headline is `n` at 15px with `tag` as an 8px uppercase
    // sub-label. The default finds none of name/title/label and heads these cards "Option 1/2/3".
    'scenarioCard',
  ],
})

/**
 * @param {string} slotName
 * @returns {string|undefined} the slot's DECLARED variant, or undefined for the block's default.
 *
 * ONE PARAMETER, permanently. See this module's header: a resolver that can see the data is a
 * resolver that will eventually be asked to read it.
 */
export function variantOf(slotName) {
  return SLOT_VOCABULARY[slotName]?.variant
}

/**
 * Throws unless `variant` is one this block declares. `undefined` is always legal — it means the
 * block's default shape.
 *
 * REJECTS RATHER THAN FALLING BACK, the same choice `packRow` makes for an unknown span: a silent
 * fallback turns a typo into a layout nobody can explain, and the block would render its default
 * while the slot believed it had asked for something else.
 */
export function assertVariant(blockType, variant) {
  if (variant === undefined) return
  const declared = BLOCK_VARIANTS[blockType] ?? []
  if (!declared.includes(variant)) {
    throw new Error(
      `variants: "${blockType}" does not declare a variant "${variant}" — `
      + `declared: ${declared.length ? declared.join('/') : '(none)'}`,
    )
  }
}
