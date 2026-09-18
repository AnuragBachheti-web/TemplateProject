// THE TYPE SYSTEM. Every size, face, weight and tracking in this feature is declared here.
//
// ============================================================================================
// PHASE 6 — THE SOURCE CHANGED, SO THE VALUES CHANGED. HOW ROLES WORK DID NOT.
// ============================================================================================
//
// Phase 5E resolved these roles against docs/design-system/06-typography.html: Fraunces at 28 for
// titles, JetBrains Mono for every label, figure and annotation, sizes taken from that document's
// scale. The application was faithful. THE SOURCE WAS NOT THIS PRODUCT — it describes a serif,
// mono-dominant system this application does not ship — and the result read, in the operator's
// words, zoomed in. The shipping product is Inter throughout at a tighter scale.
//
// So this is a re-point, not a rebuild. `typeRole(role, extra)` is unchanged, every call site is
// unchanged, and what changes is what a role RESOLVES TO.
//
// ============================================================================================
// MONO IS FIGURES ONLY — THIS REVERSES R84, DELIBERATELY (invariant I3)
// ============================================================================================
//
// Ruling R84 made mono the face for `label`, `figure` and `micro`, on the evidence that the 114
// reference mockups use var(--font-mono) 5,399 times against 578 sans. That evidence was real and
// the reading was reasonable — OF THE OLD SOURCE. Those mockups belong to the same superseded
// system as the Fraunces display. Carrying R84 forward would mean keeping the strongest visual
// signature of a design system this product does not use.
//
// MONO NOW MEANS EXACTLY ONE THING: THIS IS A QUANTITY. A number, an identifier, a timestamp. When
// every label was mono, mono said nothing — 59 of 135 call sites wore it. Six do now.
//
// R84's other half STANDS, and it is why this reversal is safe to state so plainly: a face is
// chosen by a ROLE and never by a component, so reversing the decision is one edit in one file
// rather than a sweep anyone could get partly wrong.
//
// ============================================================================================
// TWO SIZES FOR TEXT, BECAUSE THIS APP IS TWO KINDS OF SURFACE (ruling R95)
// ============================================================================================
//
// The product's hierarchy has a body row at 15-16 and a small row at 13-14. Both belong here, for
// a reason particular to this application: a narrative is READ and a fifteen-column slate is
// SCANNED, and Phase 5E Part 1 exists because that slate once ran fifteen columns into 834px.
// Taking the reading size to every table cell would cost density on the surfaces with least to
// spare, and the product's own data-dense screens use the small row.
//
// R95 binds the choice to the SLOT'S NATURE rather than to a component's taste, the way `span` and
// `variant` already are:
//
//     body   the reading size, 15px — a narrative, a card's prose, a dialog's description
//     small  the scanning size, 13px — table cells, list rows, grid labels, chrome
//
// A COMPONENT MAY NOT CHOOSE BETWEEN THEM. phase6.test.jsx's T103 asserts it per file: a scanning
// surface may not use `body`, a reading surface may not use `small`. That is what makes this a
// boundary rather than a rule a component interprets — it is checked, not trusted.
//
// THAT MAKES SEVEN ROLES, NOT SIX, AND IT IS THE ONE STRUCTURAL ADDITION THIS PHASE MAKES. The
// brief asked for six; R95's split needs a seventh, because `micro` stays an 11px extension and
// cannot double as the 13px scanning size without losing the dense annotation surfaces Phase 5B
// built. Said here rather than absorbed quietly.

/**
 * @typedef {object} TypeRoleSpec
 * @property {'sans'|'mono'} face     - Inter, or JetBrains Mono for figures.
 * @property {number} px              - the rendered size, so a test can reason about it.
 * @property {string} className       - the utilities that implement the role.
 * @property {string|null} productRow - the product hierarchy row this implements, or null.
 * @property {string} [extension]     - stated reason this role has no product row.
 * @property {string} rule            - the rule in words, so a reader never infers it from classes.
 */

/** @type {Record<'display'|'heading'|'body'|'small'|'label'|'figure'|'micro', TypeRoleSpec>} */
export const TYPE_ROLES = Object.freeze({
  display: {
    face: 'sans',
    px: 24,
    productRow: 'H3 20-24 semibold — the top of the range',
    className: 'text-[24px] font-semibold leading-[1.25] tracking-[-0.02em]',
    rule: 'The one title on a screen: a pane title, a story title, a dialog title. It sits at the '
      + 'top of the product H3 range rather than above it, so a pane title and a section heading '
      + 'differ in SIZE and not only in weight — weight alone is a hierarchy readers miss (R96).',
  },
  heading: {
    face: 'sans',
    px: 20,
    productRow: 'H3 20-24 semibold',
    className: 'text-[20px] font-semibold leading-7',
    rule: 'A section heading inside a pane. Four points below the pane title, which is the whole '
      + 'difference between "this screen is about X" and "this part of it is about Y".',
  },
  body: {
    face: 'sans',
    px: 15,
    productRow: 'body 15-16 regular',
    className: 'text-[15px] font-normal leading-6',
    rule: 'THE READING SIZE. Sentences an operator reads through: a narrative, a card\'s prose, a '
      + 'dialog description, an alert message. Never for anything laid out in a grid.',
  },
  small: {
    face: 'sans',
    px: 13,
    productRow: 'small 13-14',
    className: 'text-[13px] font-normal leading-5',
    rule: 'THE SCANNING SIZE. Everything laid out to be compared rather than read: table cells, '
      + 'list rows, grid labels, and the application chrome around them.',
  },
  label: {
    face: 'sans',
    px: 12,
    productRow: 'labels / metadata 12-13 medium-semibold',
    className: 'text-[12px] font-semibold uppercase tracking-[0.04em]',
    rule: 'The small line naming what sits beneath it — a block caption, a breadcrumb, a section '
      + 'name, a column header. Inter now rather than mono, and the tracking is under a third of '
      + 'what the old source asked for: it is a label, not an announcement.',
  },
  figure: {
    face: 'mono',
    px: 13,
    productRow: 'small 13-14, set in the data face',
    className: 'font-mono text-[13px] font-medium leading-5 tabular-nums',
    rule: 'THE ONLY MONO ROLE (I3). A quantity an operator reads or compares: a delta, a price, a '
      + 'count, a percentage, an identifier, a timestamp. Tabular, so a column of them lines up. '
      + 'What counts as a figure is figureShape.js; its colour is deltaTone\'s, never a caller\'s.',
  },
  micro: {
    face: 'sans',
    px: 11,
    productRow: null,
    extension: 'OUTSIDE THE PRODUCT SCALE, DELIBERATELY AND ON THE RECORD — the standing ruling R81 '
      + 'gave it in Phase 5E, renewed by R95 here. The product\'s smallest row is 12. Around thirty '
      + 'sites sit below it: bar labels, grid cell figures, sub-row annotations, almost all of them '
      + 'the dense surfaces Phase 5B built. Raising them would change layout on the densest '
      + 'surfaces in the app, which invariant I8 forbids dressing up as compliance. Raise it with '
      + 'whoever owns the product scale; do not wait for them.',
    className: 'text-[11px] font-normal leading-4',
    rule: 'Dense annotation read by scanning rather than reading: a bar label, a grid figure, a '
      + 'caption under a chart. If an operator must READ it, it is not this.',
  },
})

export const TYPE_ROLE_NAMES = Object.freeze(Object.keys(TYPE_ROLES))

/** The roles that wear mono. One of them (I3). T103 asserts this agrees with every spec's `face`. */
export const MONO_ROLES = Object.freeze(['figure'])

/**
 * The props an element of this role needs.
 *
 * @param {'display'|'heading'|'body'|'small'|'label'|'figure'|'micro'} role
 * @param {string} [extra] - classes that are NOT type: colour, spacing, alignment, layout. A size,
 *   a face, a weight or a tracking value passed here is the defect this module exists to remove,
 *   and T103 fails the build on one.
 * @returns {{className: string}}
 */
export function typeRole(role, extra = '') {
  const spec = TYPE_ROLES[role]
  if (spec === undefined) {
    throw new Error(`typeRole: unknown role "${role}" — expected one of ${TYPE_ROLE_NAMES.join('/')}`)
  }
  return { className: `${spec.className}${extra ? ` ${extra}` : ''}` }
}
