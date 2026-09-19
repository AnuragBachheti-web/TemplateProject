// WHAT NAMES A THING, AT EACH OF THE THREE LEVELS A PANE HAS.
//
// ============================================================================================
// THE DIAGNOSIS (Phase 7, rulings R102 and R109)
// ============================================================================================
//
// Measured on S9.1/decide before this phase — FOUR treatments across three levels, and the two that
// mattered were indistinguishable:
//
//     "Guardrails" / "Slate" / "Alternatives"   h2, h3   12 / 600 / upper / #475467
//     "Recommendation Metrics"                  p        12 / 600 / upper / #667085
//     "Recommendation Identity"                 span     15 / 400 / none  / #475467
//     "Grow 18 SKUs with proven headroom"       h4       15 / 400 / none  / #111827
//
// Two things are wrong there and they are different problems.
//
// ONE TREATMENT WEARING TWO ELEMENTS AND TWO COLOURS. The section eyebrow is the same 12/600/upper
// everywhere, but it is an `h2` in one place and a bare `p` in another, and it is #475467 in one
// and #667085 in the other. That is how a fourth pattern starts: not by anyone deciding to add one,
// but by a copy drifting a shade.
//
// AND TWO LEVELS DRAWN IDENTICALLY. A block's title and a card's title are both 15/400 and differ
// only in colour. Colour alone is not a hierarchy — at a glance they are the same thing, which is
// why a pane full of them reads flat however carefully the blocks are arranged. R109: step BOTH
// size and weight, so the levels separate without being inspected.
//
// ============================================================================================
// THE THREE LEVELS
// ============================================================================================
//
//     section     12 / 600 / upper   the part of the pane a block sits in    ("Guardrails")
//     blockTitle  13 / 600 / none    the block's own name                    ("Recommendation Identity")
//     cardTitle   15 / 600 / none    a row or card inside a block            ("Grow 18 SKUs...")
//
// Size steps 12 -> 13 -> 15 and weight is 600 throughout, against prose at 400. A title is heavier
// than the text under it and larger than the label over it, which is the whole of the hierarchy.
//
// WHY THIS IS NOT typeRole. A role says how big a thing is; a LEVEL says what job it does, and the
// two are not the same question — `section` and `blockTitle` are both small text, and what
// distinguishes them is where they sit in the pane. This module maps the second onto the first, so
// a component names a job and never a size. Same relationship statusTone has to the colour tokens.

import { typeRole } from './typeRole'

/**
 * @typedef {object} LabelLevelSpec
 * @property {number} px        - the rendered size, so a test can assert the steps.
 * @property {number} weight    - the rendered weight, likewise.
 * @property {string} role      - the type role that carries it.
 * @property {string} className - role classes plus this level's own colour and case.
 * @property {string} rule      - the rule in words.
 */

/** @type {Record<'section'|'blockTitle'|'cardTitle', LabelLevelSpec>} */
export const LABEL_LEVELS = Object.freeze({
  section: {
    px: 12,
    weight: 600,
    role: 'label',
    className: `${typeRole('label').className} text-rf-text-tertiary`,
    rule: 'THE PART OF THE PANE. Names the region a block sits in — Guardrails, Slate, Basis. One '
      + 'colour, and always this treatment, whatever tag the markup needs it to be.',
  },
  blockTitle: {
    px: 13,
    weight: 600,
    role: 'small',
    className: `${typeRole('small').className} font-semibold text-rf-text-primary`,
    rule: 'THE BLOCK\'S OWN NAME. What this card is: Recommendation Identity, Coverage, Inputs. A '
      + 'step above the section label and a step below the things inside it.',
  },
  cardTitle: {
    px: 15,
    weight: 600,
    role: 'body',
    className: `${typeRole('body').className} font-semibold text-rf-text-primary`,
    rule: 'A ROW OR CARD INSIDE A BLOCK — a slate option, an alternative, a route. The largest of '
      + 'the three, because it is the thing an operator is actually choosing between.',
  },
})

export const LABEL_LEVEL_NAMES = Object.freeze(Object.keys(LABEL_LEVELS))

/**
 * The props a label of this level needs.
 *
 * @param {'section'|'blockTitle'|'cardTitle'} level
 * @param {string} [extra] - spacing and layout. Not a size, weight, colour or case.
 * @returns {{className: string}}
 */
export function labelLevel(level, extra = '') {
  const spec = LABEL_LEVELS[level]
  if (spec === undefined) {
    throw new Error(`labelLevel: unknown level "${level}" — expected one of ${LABEL_LEVEL_NAMES.join('/')}`)
  }
  return { className: `${spec.className}${extra ? ` ${extra}` : ''}` }
}
