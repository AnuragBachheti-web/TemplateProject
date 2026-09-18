// THE LENS ACCENT. One hue per lens, on the pane eyebrow, and nowhere else.
//
// ============================================================================================
// WHAT A LENS IS, AND WHY THIS IS AN ACCENT (ruling R86)
// ============================================================================================
//
// Every one of the 105 Decision Objects carries a `lens` — sales, inventory, ads, margin or cash —
// and before this phase the template rendered it NOWHERE. So this adds a signal rather than
// re-tinting an existing one, which is what makes accent-only the right shape: a lens tinting a
// whole pane would make five visual languages out of one, and the operator would be reading colour
// for two different things at once.
//
// The hues are the design system's own module hues (05-color.html's "Module Hues · Wayfinding
// across product surfaces"), not colours picked to look right. Four of the five map onto their
// namesake module exactly. `sales` has no module hue in the DS at all — it takes --mod-intel, the
// brand graphite, so the LARGEST lens (49 of 105 objects) wears the QUIETEST colour. A wayfinding
// hint that shouts on half the corpus is not a hint.
//
// ============================================================================================
// THE TWO COLLISIONS, AND THE CONSTRAINT THAT MAKES THEM SURVIVABLE
// ============================================================================================
//
// --mod-cash is #e11d48, which is byte-identical to rose-500 — what `rf-status-critical` wears.
// --mod-inventory is #7c3aed, identical to violet-500 — what `rf-status-purple` wears.
//
// That is the DS's own doing and not something this module can fix. It means a cash-lens object
// wears the same colour as "critical", which is tolerable ONLY while the two can never appear on
// the same element. If they ever do, a wayfinding hint starts reading as a verdict about the data,
// and one careless slot declaration turns this file into an integrity hazard.
//
// R86 required that constraint to be ENFORCEABLE rather than a note, so it is asserted: T96b
// renders all 105 objects and fails if any single element carries both an `rf-lens-*` and an
// `rf-status-*` class. A promise in a comment would not have survived the next phase.

/**
 * @typedef {object} LensAccent
 * @property {string} mod           - the DS module-hue custom property this accent IS.
 * @property {string} className     - the token class that paints it.
 * @property {string|null} collidesWith - the NAME of the status tone sharing this exact value,
 *   if any. A name rather than a class literal, deliberately: a status class inside a lens module
 *   reads to T86 (Phase 5B) as a block deciding a tone, and it would not be wrong to say so.
 */

/** @type {Record<'sales'|'inventory'|'ads'|'margin'|'cash', LensAccent>} */
export const LENS_ACCENTS = Object.freeze({
  sales: {
    mod: '--mod-intel',
    className: 'bg-rf-lens-sales',
    collidesWith: null,
  },
  inventory: {
    mod: '--mod-inventory',
    className: 'bg-rf-lens-inventory',
    collidesWith: 'purple',
  },
  ads: {
    mod: '--mod-ads',
    className: 'bg-rf-lens-ads',
    collidesWith: null,
  },
  margin: {
    mod: '--mod-margin',
    className: 'bg-rf-lens-margin',
    collidesWith: null,
  },
  cash: {
    mod: '--mod-cash',
    className: 'bg-rf-lens-cash',
    collidesWith: 'critical',
  },
})

export const LENS_NAMES = Object.freeze(Object.keys(LENS_ACCENTS))

/**
 * The accent for a lens.
 *
 * THROWS on a lens it does not know rather than falling back to a neutral. A silent fallback would
 * mean a sixth lens added upstream renders as "no lens" forever and nobody finds out — the same
 * shape of failure as a slot quietly dropping a field, which this project has now fixed twice.
 *
 * @param {string} lens
 * @returns {LensAccent}
 */
export function lensAccent(lens) {
  const accent = LENS_ACCENTS[lens]
  if (accent === undefined) {
    throw new Error(`lensAccent: unknown lens "${lens}" — expected one of ${LENS_NAMES.join('/')}`)
  }
  return accent
}
