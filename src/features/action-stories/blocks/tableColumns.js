// WHICH FIELDS OF A RECORD SET ARE COLUMNS, AND WHICH ARE PER-ROW DETAIL.
//
// THE DEFECT THIS CLOSES (Phase 5E, ruling R74). TableBlock took the UNION of every row's keys as
// its column set. On `prop_s10_1_decide`'s slate that turned four records carrying 4-7 fields each
// into a fifteen-column grid: the table came out 1248px wide inside an 834px region, the `body`
// column got 106px, a 213-character paragraph wrapped over FORTY-FOUR lines, and eight columns read
// "—" on almost every row. Measured in Chrome at 1440 by counting line boxes with a Range, not
// inferred and not eyeballed. After the rule: 2 columns plus Select, a worst cell of 6 lines, and a
// table 834px wide in an 834px region.
//
// It was never a text problem. The pre-5D rule (`max-w-xs truncate`) gave the same table a 320px
// body column over two lines with most of the paragraph CLIPPED; 5D's `prose` rule replaced the
// clipping with the ribbon. Both phases' gates were blind to it for the same reason — one measures
// clipping and finds none in a ribbon, the other measures heights and widths and a wrong SHAPE is
// in tolerance on both. The constant was always fifteen columns in 834px.
//
// ============================================================================================
// THE RULE, AND WHERE THE NUMBER COMES FROM
// ============================================================================================
//
// A column is a shared attribute of the record TYPE. A field most records lack is an annotation on
// the few that carry it. So: A FIELD IS A COLUMN WHEN MORE THAN HALF THE ROWS WOULD SHOW SOMETHING
// IN IT.
//
// "WOULD SHOW SOMETHING", NOT "HAS THE KEY" — AND THAT CORRECTION CAME FROM THE BROWSER.
// The first version of this rule tested the DATA: a field counted if its value was not undefined,
// null, empty string or empty array. Every unit test passed. Then T93 ran in Chrome and failed on
// 22 tables the rule had left alone, each of them spending a column on a field that was present on
// every row and rendered "—" in every cell:
//
//     prop_s9_16_execute · plan   "Items"       empty on 4 of 4 rows
//     prop_s9_17_decide  · slate  "Candidates"  empty on 4 of 4 rows
//     prop_s9_9_decide   · slate  "Ladder"      empty on 4 of 4 rows        (18 more)
//
// Their values are arrays of objects — [{title, chip, detail}], [{name, initials}] — and
// flattenDisplayValue returns '' for a plain object it does not recognise. The field was there; the
// column was empty. A rule about what a column LOOKS LIKE that asks the data instead of the
// renderer is the adjacency failure T79 is about, committed inside the phase whose whole subject is
// T79, and caught only because R65 put the gate in a real browser.
//
// So `rendersValue` below is TableBlock's own `isMissing` test inverted, plus the nested-control
// case, and `isNestedControlColumn` moved into this module so the two cannot drift apart again.
//
// The threshold is a majority because "most records share it" is what makes an attribute columnar,
// and the corpus confirms that shape rather than supplying the number. Fill rates across all 710
// table columns in the 105 objects, measured through the renderer:
//
//     100%    filled  648 columns   91.3%
//     80-89%            3
//     70-79%            4
//     60-69%            3
//     50-59%            6
//     40-49%            2
//     30-39%            5
//     20-29%           17
//     10-19%            4
//     0%               18          <- shows nothing on any row (the correction above)
//     90-99%            0          <- the distribution is bimodal, and this is the gap
//
// A real column shows a value on EVERY row, 648 times out of 710. The rest is a thin tail. At >50%
// the rule moves 52 columns (7.3%) across 26 objects: 93% of all columns are untouched, which is
// the test R75 asks for — a threshold picked to make one screen look right would fire on that
// screen and almost nowhere else, and one picked to narrow every table would fire on most of them.
//
// ============================================================================================
// NOTHING IS DROPPED (ruling R75)
// ============================================================================================
//
// A below-threshold field is not removed. Its value moves to that row's own detail line, beneath
// the row, where it is read as `label: value`. Every string that was on the page before is still on
// the page — it changes POSITION, not existence, which is what makes this safe to do under an
// invariant that forbids changing rendered text. The T13 baseline moves for exactly that reason and
// every moved string is accounted for.
//
// THE SENTENCE THAT USED TO BE HERE SAID: "there is deliberately no empty-on-every-row special
// case — unioning cannot produce one, so every column has at least one value, and corpus-wide the
// count of all-empty columns is 0." That was measured, and it was wrong in the way this whole file
// is about. It counted VALUES. Eighteen columns hold a value on every row and display nothing on
// any of them. They are gone now, and the rule removes them by the same majority test as everything
// else rather than by a special case — which is the point of measuring displayability instead of
// presence: the exception stopped needing to exist.
//
// ============================================================================================
// WHAT THIS DOES NOT FIX — PHASE 6 INPUT (ruling R76)
// ============================================================================================
//
// S10.1/decide is repaired and measured in Chrome at 1440: 15 columns to 3 (Select/Title/Body), a
// worst cell of 44 wrapped lines to 6, and a table that was 1248px inside an 834px region to one
// that fits it exactly, with 4 detail lines carrying the moved fields. THE CLASS IS NOT REPAIRED.
// Eighteen tables still render more than 8 columns, and every one of them does so legitimately —
// their records really do share that many fields, so no threshold reaches them without deleting
// data. They are:
//
//     slate            12   worst prop_s9_17_decide, 15 columns x 4 rows, table ~1.8k px in 834px
//     detail_rows       3
//     plan              2
//     secondary_rows    1
//
// prop_s9_17_decide's worst cell still wraps 25 lines. The host scrolls horizontally (overflow-x:
// auto), so nothing is unreachable and T75/T76/T93 are all green on it — it is legible and wrong.
//
// THE REFERENCE NEVER BUILT A TABLE. Across all 114 mockups in source-mockups/ there is not one
// <table>, <tr>, <td> or <th>. The data these slates carry is drawn as a STACK OF CARDS — one card
// per record, its fields laid out inside the card rather than aligned across records. S10.1's is at
// source-mockups/S10.1-3-decide.dc.html:212-248: a flex column of bordered cards, each with a
// checkbox, a title row with an optional badge, and the body beneath. A column grid was this
// template's own invention, and the fifteen-column ribbon was that invention meeting a record with
// fifteen fields.
//
// WHAT A FOURTH cardSet VARIANT WOULD COST, stated so Phase 6 prices it rather than discovers it:
//
//   1. It is not a variant change, it is a ROUTING change. These slots (`slate`, `plan`,
//      `detail_rows`, `secondary_rows`) declare blockType `table` in slotVocabulary.js. Drawing
//      them as cards means changing blockType — the axis 5A, 5B and 5E were each explicitly
//      forbidden to touch — for 18 objects across 4 slots.
//   2. It breaks 5B's cap. MAX_VARIANTS_PER_BLOCK is 3 and `cardSet` is already at it
//      (groupCard/routeCard/scenarioCard). A fourth needs that invariant re-ruled, not edited.
//   3. The blocks are not interchangeable. TableBlock carries sort, pagination, row selection and
//      the segmented row control; CardSetBlock carries none of them. S10.1's slate is SELECTABLE,
//      and the reference's card has the checkbox drawn into it — so the work is a card that
//      selects, not an existing card reused.
//   4. The column rule in this file would still be needed underneath it: a card that prints every
//      field a record happens to carry has the same union problem in a narrower shape.

import { flattenDisplayValue } from './flattenDisplayValue'

/** More than half. A field carried by exactly half the rows is an annotation, not a column. */
export const COLUMN_FILL_THRESHOLD = 0.5

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * A nested small array of `{label, ...}` options, which TableBlock draws as a segmented control.
 * It lives HERE rather than in TableBlock because it is half of the question this module answers —
 * whether a column can put anything on the screen — and the first version of this rule got that
 * wrong by not asking it. TableBlock imports it back for the render.
 */
export function isNestedControlColumn(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 6 &&
    value.every((opt) => isPlainObject(opt) && typeof opt.label === 'string' && opt.label.trim() !== '')
  )
}

/**
 * THE CELL WOULD SHOW SOMETHING. Not "the field is present" — see the header's second correction.
 * This is TableBlock's own `isMissing` test, inverted, and nothing else.
 */
export function rendersValue(v) {
  return flattenDisplayValue(v) !== ''
}

/**
 * The whole column draws as segmented controls. TableBlock's rule is all-or-nothing per column —
 * one row with a single option and the column is not a control, so EVERY cell in it falls back to
 * flattenDisplayValue and renders "—". So this is asked per COLUMN, not per value: asking it per
 * value kept `prop_s9_19_decide`'s `channels` (nested on 4 of its 6 rows, single-option on the
 * other two), and all six cells then rendered a dash. The browser found that too. TableBlock
 * imports this same function to build its own control-column set, so there is one computation.
 */
export function isControlColumn(rows, key) {
  return rows.length > 0 && rows.every((row) => isNestedControlColumn(row?.[key]))
}

/**
 * Splits a record set's fields into columns and per-row detail.
 *
 * @param {object[]} rows            the table's rows, already filtered to plain objects.
 * @param {(key: string) => boolean} isHidden  the caller's hidden-key test (decorativeKeys).
 * @returns {{columns: string[], detail: string[]}} both in first-seen row order, which is the
 *   reference's own field order and the only ordering authority here — this function never sorts,
 *   never ranks and never promotes a field for being "more interesting".
 */
export function splitColumns(rows, isHidden) {
  const order = []
  const seen = new Set()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key) || isHidden(key)) continue
      seen.add(key)
      order.push(key)
    }
  }
  if (rows.length === 0) return { columns: order, detail: [] }

  const columns = []
  const detail = []
  for (const key of order) {
    if (isControlColumn(rows, key)) {
      columns.push(key)
      continue
    }
    const filled = rows.filter((row) => rendersValue(row?.[key])).length
    ;(filled / rows.length > COLUMN_FILL_THRESHOLD ? columns : detail).push(key)
  }

  // A record set where no field reaches the threshold is not a table, but it is also not this
  // function's problem to solve by emptying it. Falling back to the full set keeps every value in
  // its old place rather than moving an entire record into a detail line.
  if (columns.length === 0) return { columns: order, detail: [] }
  return { columns, detail }
}
