// HOW BIG AN ICON IS. Not a type role — see the note below, which is the whole reason this exists.
//
// ============================================================================================
// WHY AN ICON IS NOT TEXT (Phase 5E Part 2, ruling R89)
// ============================================================================================
//
// A Font Awesome icon is a glyph in an icon FONT, positioned with `font-size`. That makes it look
// like text to every regex, every sweep and every reviewer — and it is not. Applying a type role to
// one sets `font-family` to JetBrains Mono or Inter, the glyph's codepoint is looked up in a font
// that has never heard of it, and the browser draws .notdef: a tofu box.
//
// That is not hypothetical. This phase's type sweep did exactly that to the breadcrumb chevrons and
// to the compact Alert's warning icon, and the second one survived a round of review because it
// reached the element through a variable (`t.icon`) rather than as a literal class on the line, so
// the line-based icon exemption did not see it. 478 tofu boxes on the first, 58 on the second.
//
// A TOFU BOX PASSES EVERY OTHER GATE THERE IS. It is not clipped, it does not overflow, its
// contrast ratio is fine, and its element is exactly the size the layout expects. Only T101 — which
// draws the glyph on a canvas and compares it against the same font's .notdef — can see it.
//
// So icon sizes live here, in one module, for the same reason `-text` and `-icon` became two token
// names in this same phase: the distinction that matters must be visible at the call site, not
// inferred from context by whoever reads it next.
//
// THESE ARE NOT TYPE ROLES AND MUST NOT GROW INTO ONE. If a value needs a size, it needs a role
// (typeRole.js). Nothing here may be used on anything but a glyph.

/** The sizes the icons in this app actually use. Literal class strings, so Tailwind can see them. */
const GLYPH_SIZES = Object.freeze({
  7: 'text-[7px]',
  9: 'text-[9px]',
  10: 'text-[10px]',
  11: 'text-[11px]',
  12: 'text-[12px]',
  13: 'text-[13px]',
  14: 'text-[14px]',
})

export const GLYPH_PX = Object.freeze(Object.keys(GLYPH_SIZES).map(Number))

/**
 * The size class for an icon glyph.
 *
 * @param {number} px - one of GLYPH_PX.
 * @returns {string} the Tailwind class.
 */
export function glyph(px) {
  const cls = GLYPH_SIZES[px]
  if (cls === undefined) {
    throw new Error(`glyph: no icon size ${px}px — expected one of ${GLYPH_PX.join('/')}`)
  }
  return cls
}
