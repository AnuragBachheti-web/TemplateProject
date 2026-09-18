// HOW WIDE A BLOCK IS, AND WHICH BLOCKS SHARE A ROW — Phase 5C.
//
// THE MODULE THIS REPLACES. `layout/blockSizing.js` answered "how wide" with
// `inferSpan(blockType, value)`: it branched on the blockType and then MEASURED the content —
// `meaningfulColumnCount` for a table, average `itemTextWeight` for an itemQueue, plotted-point
// counts for a chart, key counts for an object — and picked one of four widths from the result.
//
// That is the same mistake twice removed from this codebase already: the renderer inspecting data
// to decide what it was (Phase 3B), and the claim ledger matching a key to a slot by coarse shape
// (Phase 5A). It was alive in the layout layer and unnamed until the Phase 5C survey, where it
// reached 9 rows out of 338 — never load-bearing, just quietly wrong. Ruling R58 deleted it.
//
// A span is now DECLARED, on the slot, in templates/slotVocabulary.js, beside the binding and the
// blockType. `spanOf` takes a slot name and nothing else: a function with no parameter for the data
// cannot branch on the data, which is invariant I1 expressed as a signature rather than as a rule.
//
// TWO SPANS, NOT FOUR. `blockSizing.js` had 12/8/6/4 and only 12 and 6 were ever traceable to
// anything the reference does; 8 and 4 were artefacts of its own thresholds. The reference's own
// two-column rows are `grid-template-columns:1fr 1fr` (59 of them across the 104 stage mockups) —
// halves, never thirds or two-thirds.
//
// THE PACKING RULE, in full. Within one section, walk the blocks in declared order. A block
// declaring `half` pairs with the immediately following block if that one also declares `half`; the
// pair becomes one row of two cells. Everything else — a `full` block, or a `half` whose follower is
// `full` or absent — occupies its own row at FULL width. An unpaired half is widened, never
// rendered as a half-width cell with empty space beside it. Order is never changed to improve
// packing and a pair never crosses a section boundary.
//
// THE FILTERED-NEIGHBOUR CASE falls out of this rather than needing a rule of its own: `when`
// filtering runs in StageRenderer BEFORE composition, so the packer only ever sees blocks that
// survived. If `policy` is filtered out on some object, `constraints` simply finds a different
// follower or widens to full. There is no empty cell to leave behind, on any of the 105.

import { SLOT_VOCABULARY } from '../templates/slotVocabulary.js'

/**
 * The whole width vocabulary, as columns out of 12. Adding a third value is a deliberate, reviewed
 * edit here — the same discipline the slot vocabulary itself is held to, and the thing
 * `blockSizing.js` had no way to enforce because its widths were computed rather than declared.
 */
export const SPANS = Object.freeze({ full: 12, half: 6 })

/** The default for a slot that declares nothing. Full width is the only safe silence. */
const DEFAULT_SPAN = 'full'

/**
 * @param {string} slotName
 * @returns {'full'|'half'} the slot's DECLARED span.
 *
 * One parameter, deliberately and permanently. There is no `value`, no `blockType` and no row
 * count here, because a width that can see the data is a width that will eventually be derived from
 * it — which is the defect this module exists to have removed.
 */
export function spanOf(slotName) {
  const declared = SLOT_VOCABULARY[slotName]?.span
  if (declared === undefined) return DEFAULT_SPAN
  if (SPANS[declared] === undefined) {
    throw new Error(`packRows: slot "${slotName}" declares an unknown span "${declared}" — expected one of ${Object.keys(SPANS).join('/')}`)
  }
  return declared
}

/**
 * Packs one section's blocks into rows. Pure and total (invariant II2): same input, same output,
 * every block preserved, nothing reordered, and an unrecognised span throws rather than falling
 * back to full width — a silent fallback is how a typo becomes a layout nobody can explain.
 *
 * @param {string[]} slotNames - in declared order.
 * @param {Record<string,string>} [spanOverrides] - test seam only; production reads the vocabulary.
 * @returns {Array<{slots: string[]}>} one entry per row. A row of one renders full width whatever
 *   its slot declared; a row of two is a pair of halves. Never more than two.
 */
export function packRow(slotNames, spanOverrides) {
  const read = (name) => {
    if (spanOverrides && Object.prototype.hasOwnProperty.call(spanOverrides, name)) {
      const override = spanOverrides[name]
      if (SPANS[override] === undefined) {
        throw new Error(`packRows: unknown span "${String(override)}" for slot "${name}" — expected one of ${Object.keys(SPANS).join('/')}`)
      }
      return override
    }
    return spanOf(name)
  }

  const rows = []
  for (let i = 0; i < slotNames.length; i += 1) {
    const here = slotNames[i]
    const next = slotNames[i + 1]
    if (read(here) === 'half' && next !== undefined && read(next) === 'half') {
      rows.push({ slots: [here, next] })
      i += 1
      continue
    }
    rows.push({ slots: [here] })
  }
  return rows
}
