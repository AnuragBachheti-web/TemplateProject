// WHAT A BLOCK CALLS ITS SLOT — one resolver, every heading.
//
// THE DEFECT THIS CLOSES. Every block printed its own heading as `humanizeSlotName(slotName)`, so
// the heading was a mechanical restatement of an internal key. That is correct for most slots —
// `inputs` really is titled "Inputs" in the reference, `rollback` "Rollback", `ledger` "Ledger" —
// and wrong wherever the reference names the concept rather than the field. `trigger` is the one
// that surfaced: 11 of the 14 reference stories that carry it title the card "What raised this",
// slotVocabulary's own note has quoted that string since Phase 3, TimelineBlock's header comment
// cites the markup it comes from, and the screen still said "Trigger".
//
// WHY THE LABEL LIVES ON THE SLOT AND NOT IN THE BLOCK. A slot is rendered by one block today and
// could be rendered by another tomorrow (`comparison`/`reconciliation` already split that way), and
// several blocks render many slots. Put the copy in the block and one concept gets two headings;
// put it on the slot and there is one. Same argument as `span` in 5C and `variant` in 5B: the block
// asks what it is rendering, it does not decide.
//
// WHY THIS IS NOT humanizeSlotName ITSELF. That function is also called on DATA keys — a table's
// column names, a nested entry's fields, an object's own properties. Those are record fields that
// happen to be strings, not slots, and a column named `policy` must not inherit a slot's heading
// because the two names collided. The split is the point: `slotLabel` for a slot,
// `humanizeSlotName` for a key.

import { SLOT_VOCABULARY } from '../templates/slotVocabulary.js'
import { humanizeSlotName } from './humanizeSlotName'

/**
 * The heading for a slot. Falls back to humanizing the name, which is what every slot without a
 * declared `label` wants and what all of them did before this module existed — so adding it changed
 * exactly one heading, and adding the next one is an edit to slotVocabulary.js, not to a block.
 *
 * @param {string} slotName
 * @returns {string}
 */
export function slotLabel(slotName) {
  const declared = SLOT_VOCABULARY[slotName]?.label
  return typeof declared === 'string' && declared.trim() !== '' ? declared : humanizeSlotName(slotName)
}
