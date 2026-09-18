// THE TYPE SYSTEM. Six roles, one module, every size and face declared here and nowhere else.
//
// ============================================================================================
// WHAT THIS REPLACES (Phase 5E Part 2)
// ============================================================================================
//
// 157 hardcoded pixel sizes across 18 distinct values in 38 files, including half-pixel steps
// (12.5, 11.5, 10.5, 9.5, 8.5) that exist for no stated reason, plus 27 hand-picked `tracking-[…]`
// values. Meanwhile `src/styles/realify-tokens.css` has carried a `--text-*` scale the whole time
// and Action Stories consumed none of it.
//
// The clearest symptom was the EYEBROW — one role, spelled 26 different ways: five sizes
// (9/9.5/10/10.5/11px), five tracking values (0.06/0.08/0.1/0.12/0.14em), three weights, three
// colours, and several of them not even mono. Nobody chose that. It is what happens when the
// decision is made 26 times instead of once.
//
// ============================================================================================
// THE FACES, AND WHY MONO IS BOUNDED (ruling R84)
// ============================================================================================
//
// The design system gives mono two rows (Label, Data/M). The REFERENCE uses it for almost
// everything: across the 114 mockups in source-mockups/, `var(--font-mono)` appears 5,399 times
// against 578 sans and 179 display. That is not a stylistic lean, it is the product's voice, and
// this template was already closer to the reference (41 `font-mono`) than to the DS.
//
// R84 follows the reference AND bounds it, because "mono is the voice" with no boundary is how a
// codebase ends up with mono paragraphs. MONO IS THE FACE FOR label, figure AND micro. Prose and
// headings are Inter. Titles are Fraunces. A component may not reach for mono outside those roles,
// and T94 asserts the two lists agree, so the rule cannot drift into a convention.
//
// Recorded as a DELIBERATE DIVERGENCE from the DS, with the counts, so the next reader sees it was
// decided rather than drifted into.
//
// ============================================================================================
// WHAT THIS MODULE DOES NOT OWN
// ============================================================================================
//
// COLOUR. A role says how big a thing is and what face it wears; what it MEANS is the call site's
// business, and semantic colour still comes from statusTone/deltaTone (I3). Pass it through `extra`.
//
// WRAPPING. That is cellText.js's (Phase 5D). The two compose: cellText decides whether a string
// may be cut, typeRole decides what it looks like. Neither answers the other's question.

/**
 * @typedef {object} TypeRoleSpec
 * @property {'serif'|'sans'|'mono'} face - Fraunces / Inter / JetBrains Mono.
 * @property {string} className          - the utilities that implement the role.
 * @property {string|null} dsRow         - the design-system row it implements, or null if it is an
 *   extension (in which case `extension` must say why).
 * @property {string} [extension]        - stated reason this role is outside the DS.
 * @property {string} rule               - the rule in words, so a reader never infers it from classes.
 */

/** @type {Record<'display'|'heading'|'body'|'label'|'figure'|'micro', TypeRoleSpec>} */
export const TYPE_ROLES = Object.freeze({
  display: {
    face: 'serif',
    dsRow: 'Heading / 2 — Fraunces 28 / 32, -1.5%',
    className: 'font-serif text-[28px] font-normal leading-[1.15] tracking-[-0.02em]',
    rule: 'The one editorial voice on the screen: a pane title, a story title, a dialog title. '
      + 'Fraunces at optical size 144. Never used for a value, however large that value is.',
  },
  heading: {
    face: 'sans',
    dsRow: 'Heading / 3 — Inter 600, 20 / 28',
    className: 'text-[20px] font-semibold leading-7',
    rule: 'A section subhead inside a pane. Inter, because a heading is interface rather than '
      + 'editorial — the reference reserves Fraunces for the top of a screen, not its parts.',
  },
  body: {
    face: 'sans',
    dsRow: 'Body / S — Inter 400, 13 / 20',
    className: 'text-[13px] font-normal leading-5',
    rule: 'Every sentence an operator reads. The default; if a string is prose, it is this.',
  },
  label: {
    face: 'mono',
    dsRow: 'Label — JB Mono 500, 11, +14%',
    className: 'font-mono text-[11px] font-medium uppercase tracking-[0.14em]',
    rule: 'THE EYEBROW. The small uppercase mono line naming what sits beneath it — a block '
      + 'caption, a breadcrumb, a section name, a panel title. One spec, so it is one thing.',
  },
  figure: {
    face: 'mono',
    dsRow: 'Data / M — JB Mono 500, 14 / 22',
    className: 'font-mono text-[14px] font-medium leading-[22px] tabular-nums',
    rule: 'A quantity an operator reads or compares: a delta, a price, a count, a percentage. '
      + 'Tabular alignment, so a column of them lines up. What IS a figure is figureShape.js.',
  },
  micro: {
    face: 'mono',
    dsRow: null,
    extension: 'OUTSIDE THE DS, DELIBERATELY AND ON THE RECORD (ruling R81). The DS scale stops at '
      + '11px and 45 usages in this template sit below it — bar labels, grid cell figures, sub-row '
      + 'annotations, almost all of them the dense surfaces Phase 5B built. Raising them to the 11px '
      + 'label step would change layout in a phase whose I6 says 5C and 5D hold, on the densest '
      + 'surfaces in the app, so it would be a layout change dressed as compliance. An honest '
      + 'documented extension is the better of the two. Raise it with the DS owner; do not wait.',
    className: 'font-mono text-[10px] leading-[14px] tabular-nums',
    rule: 'Dense annotation that is read by scanning rather than by reading: a bar label, a grid '
      + 'figure, a caption under a chart. If an operator must READ it, it is not this.',
  },
})

export const TYPE_ROLE_NAMES = Object.freeze(Object.keys(TYPE_ROLES))

/** The three roles that wear mono, per R84. T94 asserts this agrees with every spec's `face`. */
export const MONO_ROLES = Object.freeze(['label', 'figure', 'micro'])

/**
 * The props an element of this role needs.
 *
 * @param {'display'|'heading'|'body'|'label'|'figure'|'micro'} role
 * @param {string} [extra] - classes that are NOT type: colour, spacing, alignment, layout. Those
 *   stay the call site's business. A size, a face or a tracking value passed here is the defect
 *   this module exists to remove, and T95 fails the build on one.
 * @returns {{className: string}}
 */
export function typeRole(role, extra = '') {
  const spec = TYPE_ROLES[role]
  if (spec === undefined) {
    throw new Error(`typeRole: unknown role "${role}" — expected one of ${TYPE_ROLE_NAMES.join('/')}`)
  }
  return { className: `${spec.className}${extra ? ` ${extra}` : ''}` }
}
