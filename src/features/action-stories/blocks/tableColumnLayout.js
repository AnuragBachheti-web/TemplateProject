// WHAT A COLUMN IS LIKE — asked once, per column, for the header and the cells together.
//
// tableColumns.js answers WHICH fields are columns. This answers what each one then looks like, and
// it exists because both defects below have the same cause: a property that belongs to a COLUMN was
// being decided per CELL, so the header and its data could disagree with each other and with
// themselves.
//
// ============================================================================================
// DEFECT 1 — THE HEADER DID NOT SIT OVER ITS OWN DATA
// ============================================================================================
//
// Every `th` was `text-left`, unconditionally. Every `td` was `text-right` when isFigureText(value)
// said the CELL was a figure. So on a numeric column the header sat hard left and the figures sat
// hard right, an entire column-width apart:
//
//     Label        Date          In H     Out H    Net Label      <- all left
//              W1        Aug 25   65.6      53.3        $236      <- all right
//
// Reading which column a figure belongs to means tracking a heading that is nowhere near it. The
// header is not a separate decision from the cells: ALIGNMENT IS THE COLUMN'S, and asking it once
// here is what makes the two incapable of disagreeing.
//
// A column is a figure column when every cell that shows anything is a figure, and at least one
// does. All-or-nothing, for the same reason isControlColumn is: a column with one prose cell is not
// a numeric column, and right-aligning its sentences to line up with its numbers reads worse than
// left-aligning the lot. Typography and tone stay per-cell (R87/R88, figureShape.js) — a figure
// still renders mono and still carries the colour of its own sign wherever it lands. This module
// decides only where the column's contents sit, which is the one thing the header must agree with.
//
// ============================================================================================
// DEFECT 2 — A PROSE COLUMN COULD COLLAPSE TO A RIBBON
// ============================================================================================
//
// `prose` cells carry `min-w-0` (cellText.js), which lets a table column shrink to its longest
// WORD. On a wide table the auto layout does exactly that: S9.2/analyze's `Consequence` column came
// out around one word per line, wrapping a 330-character paragraph into a column tall enough to
// push every other row off the screen, while the table was already scrolling horizontally.
//
// That last part is the whole argument. The cost of a wider column here is horizontal scroll, and
// THE TABLE IS ALREADY SCROLLING — the space was being saved into a scrollbar that exists anyway.
// So a prose column declares the narrowest it may be, computed from its own longest value and a
// target line count, and the auto layout may still make it wider.
//
// WHY NOT A FIXED WIDTH. Columns differ by an order of magnitude — "S9.2 replenishment" is 18
// characters and a consequence paragraph is 330. One number is either too wide for the short column
// or still a ribbon for the long one. Deriving it from the content is what makes one rule fit both.
//
// THIS IS THE QUESTION T93 DEFERRED. scripts/smoke.mjs's T93 explains why it does not gate on "no
// cell wraps past N lines": that threshold would have to clear S9.17/decide, whose sixteen columns
// are each genuinely filled and whose worst cell wraps 25 lines, and it names narrowing those as
// Phase 6's question. This answers it with width rather than with the cardSet routing
// tableColumns.js priced — no blockType moves, no variant cap is broken, and it reaches every wide
// table at once instead of the one on screen.

import { flattenDisplayValue } from './flattenDisplayValue'
import { isFigureText } from './figureShape'

/** The wrap a prose column is sized for. Its longest value should land in about this many lines. */
export const TARGET_WRAP_LINES = 5

/** Never narrower than this: below it even short prose breaks mid-phrase on every line. */
export const MIN_PROSE_CH = 16

/** Never wider than this. A very long cell takes a few more lines rather than a column of its own. */
export const MAX_PROSE_CH = 52

/**
 * Whether the whole column reads as figures, and therefore right-aligns — header included.
 *
 * @param {object[]} rows
 * @param {string} key
 * @returns {boolean}
 */
export function isFigureColumn(rows, key) {
  let shown = 0
  for (const row of rows) {
    const value = row?.[key]
    if (flattenDisplayValue(value) === '') continue // a missing cell is a dash; it votes on nothing
    if (!isFigureText(value)) return false
    shown += 1
  }
  return shown > 0
}

/**
 * The narrowest a prose column may be, in `ch`, derived from its own longest value.
 *
 * Measured in characters rather than pixels deliberately: the thing being bounded is how many
 * characters fit on a line before it wraps, and `ch` is that unit in whatever font the cell ends up
 * rendering in. A px value would have to be re-derived every time the type scale moved.
 *
 * @param {object[]} rows
 * @param {string} key
 * @param {string} [headerText] - the column's own heading, which must also fit on a line.
 * @returns {number} a `ch` count, clamped to [MIN_PROSE_CH, MAX_PROSE_CH].
 */
export function proseColumnMinCh(rows, key, headerText = '') {
  let longest = headerText.length * TARGET_WRAP_LINES // so the heading alone never sets a wide column
  for (const row of rows) {
    const len = flattenDisplayValue(row?.[key]).length
    if (len > longest) longest = len
  }
  const wanted = Math.ceil(longest / TARGET_WRAP_LINES)
  return Math.min(MAX_PROSE_CH, Math.max(MIN_PROSE_CH, wanted))
}
