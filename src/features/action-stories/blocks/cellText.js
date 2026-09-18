// HOW TEXT BEHAVES INSIDE A CELL — one module, three roles, every block.
//
// THE DEFECT THIS CLOSES. Phase 5D measured, in real Chrome at 1440 and 1280 across all 105
// objects, 1001 clipped text elements on 87 of them. Every one came from a `truncate` written
// inside a block component — nine files, each having independently decided how its own text
// behaves, and four of the five owners offering no way to read what had been cut. A policy cell
// lost 297 characters of a covenant; `basis` rows on the decide screen lost the end of every label
// with no tooltip; S9.8's policy cell stopped at "DTC 110 · Amazon 70 · $19.6K re".
//
// A silently cut value on a decision surface is a wrong value (invariant I4). An operator reading
// "$19.6K re" cannot tell whether the rest said "recovered" or "remaining", and nothing on the
// screen admits that anything is missing.
//
// WHY THIS IS ONE MODULE AND NOT NINE DECISIONS. Ruling R63 lifted the no-block-edits invariant for
// text only, on the condition that the rules live here. That condition is the whole point: nine
// files each choosing is the per-screen accident this project has already removed three times — from
// the renderer (3B), from the claim ledger (5A) and from the layout layer (5C). Moving it into a
// block would be the fourth. A block now says WHICH ROLE a cell plays; it does not say what that
// means.
//
// THE THREE ROLES, and why three is the whole vocabulary:
//
//   identifier  what a row IS — its label, its name, a column header. Short by nature, and the one
//               place a bounded height is worth more than the last few words, because an identifier
//               that wraps to six lines destroys the row rhythm that makes a table readable. So it
//               clamps at two lines AND always carries its full text as a `title`. The clamp is the
//               only truncation left anywhere in the app, and it is the only one with an affordance
//               attached at the same call site — which is deliberate: they cannot drift apart.
//
//   figure      a measured value — money, a percentage, a count, a ratio. NEVER wraps and NEVER
//               truncates; the column flexes to fit it instead. "$19.6K re" is not a shortened
//               number, it is a different number, and no affordance makes that acceptable on a
//               screen an operator approves from.
//
//   prose       everything else — a note, a definition, a rationale, a description. Wraps freely,
//               no maximum width, no truncation. A cell that grows taller is the correct outcome:
//               the reference's own cards grow to fit their prose rather than cutting it.
//
// WHY `break-words` AND NOT `overflow-wrap: anywhere`. Both break a word too long for its line; only
// `anywhere` also shrinks the element's MIN-CONTENT width, which lets a table column collapse to one
// character wide. The first draft used it and the policy table's headers rendered as "Labe/l" and
// "Unit/s" — every measurement still in tolerance, and the table plainly wrong to look at. Found by
// opening a screenshot, which is the second thing in this phase that only a picture caught.

/**
 * @typedef {object} CellRole
 * @property {string} className  - the utility classes that implement the rule.
 * @property {boolean} truncates - whether this role may cut text. Only `identifier` may, and only
 *   because `cellText` attaches the affordance in the same call.
 * @property {string} rule       - the rule in words, so a reader here never has to infer it from
 *   the class list.
 */

/** @type {Record<'identifier'|'figure'|'prose', CellRole>} */
export const CELL_ROLES = Object.freeze({
  identifier: {
    className: 'min-w-0 break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden',
    truncates: true,
    rule: 'Wraps, then clamps at two lines. Always carries its full text as a title, so nothing it '
      + 'cuts is unreachable — the only truncation in the app, and the only one with an affordance.',
  },
  figure: {
    className: 'whitespace-nowrap',
    truncates: false,
    rule: 'Never wraps and never truncates; the column flexes to fit. A cut number is a wrong '
      + 'number, and no tooltip makes that safe on a surface an operator approves from.',
  },
  prose: {
    className: 'min-w-0 whitespace-normal break-words',
    truncates: false,
    rule: 'Wraps freely with no maximum width and no truncation. A taller cell is the correct '
      + 'outcome; the reference\'s own cards grow to fit their prose rather than cutting it.',
  },
})

export const CELL_ROLE_NAMES = Object.freeze(Object.keys(CELL_ROLES))

/**
 * The props a cell of this role needs — its classes, and its affordance where the role truncates.
 *
 * RETURNS PROPS, NOT A CLASS STRING, and that is what makes I4 structural rather than a convention.
 * `identifier` is the one role that may cut text, and the same call that gives it the clamp gives
 * it the `title` carrying the full value. A caller cannot take the truncation and forget the
 * affordance, because it is not possible to ask for one without the other.
 *
 * @param {'identifier'|'figure'|'prose'} role
 * @param {string} [text]   the cell's full text, used as the affordance where the role truncates.
 * @param {string} [extra]  block-specific classes that are NOT text behaviour — colour, size,
 *   alignment, font. Those stay the block's business; only wrap/clip/overflow moved here.
 * @returns {{className: string, title?: string}}
 */
export function cellText(role, text, extra = '') {
  const spec = CELL_ROLES[role]
  if (spec === undefined) {
    throw new Error(`cellText: unknown role "${role}" — expected one of ${CELL_ROLE_NAMES.join('/')}`)
  }
  const className = `${spec.className}${extra ? ` ${extra}` : ''}`
  if (!spec.truncates) return { className }
  const full = typeof text === 'string' ? text.trim() : ''
  return full === '' ? { className } : { className, title: full }
}
