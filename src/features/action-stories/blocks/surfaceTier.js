// THE SURFACE SCALE. Three tiers, and a tier is background, border and shadow TOGETHER.
//
// ============================================================================================
// WHAT THIS FIXES (Phase 7, ruling R101)
// ============================================================================================
//
// Phase 6 gave the app the product's palette and its type, and the result still read as a white
// page with blue buttons rather than a designed product. The reason was measurable: the page ground
// was #FAFBFD and a card #FFFFFF — A 3.59% LUMINANCE STEP. At that separation the two are one sheet
// of paper, and a card was legible only because of its 1px border. Every surface in the app — the
// rail, the main cards, the header, the nested strips — was the same white.
//
// Phase 6 also found the failure mode from the other direction, mid-phase: setting the raised
// surface to #F9FAFB put the rail panels two units off the ground and they dissolved into it. That
// was fixed on the spot and the system behind it was never built. This is that system.
//
// A TIER IS THREE PROPERTIES. Elevation is carried by background, border and shadow together, and
// the rail dissolving is what happens when one of them moves alone. So a component asks for a tier
// and gets all three; it cannot take the background and forget the shadow, because there is no way
// to ask for one.
//
// ============================================================================================
// THE VALUES, AND THE CONSTRAINT THAT SET THEM
// ============================================================================================
//
//     ground   #F4F6FA   the page. The product's own ink-50.
//     card     #FFFFFF   something sitting on the page.
//     nested   #F2F4F7   a well INSIDE a card — a strip, a grouped panel's row.
//
// Steps between the pairs that actually share an edge:
//
//     ground | card    7.95%   (was 3.59%)
//     card   | nested  9.71%
//
// ground|nested is not a pair: a nested surface lives inside a card and is never drawn against the
// page.
//
// WHY THE GROUND IS NOT DARKER. #F2F4F7 would have given 9.71% against the card instead of 7.95%,
// and it drops tertiary text sitting on the ground to 4.51:1 — clearing AA by one hundredth. Ruling
// R108 took the headroom: a floor you sit on is a floor you fall through the next time a tint
// moves. The trade cost 1.8 points of separation and bought a real margin.
//
// DARK IS DERIVED (Phase 5E, R85). The 5% floor T112 asserts is a LIGHT-MODE measure and is
// asserted only there. Near-black surfaces separate perceptually at absolute luminance differences
// far below 5%, so the same number would be meaningless against the dark set; light is the subject
// of the design source and dark follows it.

/**
 * @typedef {object} SurfaceTierSpec
 * @property {string} bg      - the background utility.
 * @property {string} border  - the border utility, or '' where the tier carries none.
 * @property {string} shadow  - the shadow utility, or '' where the tier carries none.
 * @property {string} rule    - the rule in words, so a reader never infers it from classes.
 */

/** @type {Record<'ground'|'card'|'nested', SurfaceTierSpec>} */
export const SURFACE_TIERS = Object.freeze({
  ground: {
    bg: 'bg-rf-surface-ground',
    border: '',
    shadow: '',
    rule: 'THE PAGE. What everything else sits on. It carries no border and no shadow, because a '
      + 'ground with an edge is not a ground — it is a very large card.',
  },
  card: {
    bg: 'bg-rf-surface-card',
    border: 'border border-rf-border-subtle',
    shadow: 'shadow-card',
    rule: 'A THING ON THE PAGE: a block, a rail panel, the header, a dialog. One treatment for all '
      + 'of them, which is what stops a pane reading as a stack of undifferentiated boxes.',
  },
  nested: {
    bg: 'bg-rf-surface-nested',
    border: '',
    shadow: '',
    rule: 'A WELL INSIDE A CARD — a strip in a grouped panel, a table header band. It is a recess, '
      + 'not an elevation, so it takes no shadow: two stacked shadows read as two cards.',
  },
})

export const TIER_NAMES = Object.freeze(Object.keys(SURFACE_TIERS))

/**
 * The minimum luminance step, in percent, between two tiers that share an edge.
 *
 * FIVE, AND THE NUMBER IS EVIDENCE-BACKED RATHER THAN CHOSEN. The pre-phase ground-to-card step was
 * 3.59% and demonstrably read as one sheet; 5% is where the boundary survives without the border
 * carrying it. Both shipped pairs clear it by 3-5 points, deliberately — see this module's header.
 */
export const MIN_TIER_STEP = 5

/**
 * The props a surface of this tier needs.
 *
 * @param {'ground'|'card'|'nested'} tier
 * @param {string} [extra] - layout, spacing, radius. NOT a background, border colour or shadow:
 *   those are the tier's, and T111 fails the build on a component that sets one.
 * @returns {{className: string}}
 */
export function surfaceTier(tier, extra = '') {
  const spec = SURFACE_TIERS[tier]
  if (spec === undefined) {
    throw new Error(`surfaceTier: unknown tier "${tier}" — expected one of ${TIER_NAMES.join('/')}`)
  }
  const parts = [spec.bg, spec.border, spec.shadow, extra].filter(Boolean)
  return { className: parts.join(' ') }
}
