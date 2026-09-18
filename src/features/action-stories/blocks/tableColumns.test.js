// Phase 5E Part 1, T93: a table renders as a table.
//
// The geometric half of T93 — real column widths in a real browser — lives in `npm run smoke`'s
// layout gate, because jsdom has no layout engine and this is the phase where that mattered most:
// every gate was green while S10.1/decide's slate rendered as a vertical ribbon. What is asserted
// here is the RULE that produces the shape, on the real corpus.

import { describe, it, expect } from 'vitest'
import { splitColumns, COLUMN_FILL_THRESHOLD, rendersValue, isControlColumn } from './tableColumns'
import { isHiddenKey } from './decorativeKeys'
import { SLOT_VOCABULARY } from '../templates/slotVocabulary'
import dataset from '../__corpus__/normalized/dataset.json'

const at = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
const TABLE_SLOTS = Object.entries(SLOT_VOCABULARY).filter(([, s]) => s.blockType === 'table')

/** Every table the corpus actually renders, as {id, slot, rows}. */
const TABLES = []
for (const d of dataset) {
  for (const [slot, spec] of TABLE_SLOTS) {
    const rows = at(d, spec.binding)
    if (Array.isArray(rows) && rows.length > 0) TABLES.push({ id: d.proposal_id, slot, rows })
  }
}

describe('T93 — a table is a grid of shared attributes, not a union of every key', () => {
  it('measures a real corpus, so this cannot pass vacuously', () => {
    expect(TABLES.length).toBeGreaterThan(100)
  })

  it('the threshold is a majority, and it is stated as one', () => {
    expect(COLUMN_FILL_THRESHOLD).toBe(0.5)
  })

  it('no table renders a column its records do not mostly share', () => {
    // WHAT THIS RULE FIXES, stated precisely so it is not mistaken for something larger. It removes
    // UNIONING — a column that exists because one row of four happened to carry the key. It does
    // NOT narrow a record that genuinely has sixteen shared fields, and it must not pretend to:
    // 18 tables are still over 8 columns afterwards, every one of them because its records really
    // do share that many. `prop_s9_17_decide`'s slate carries 16.5 fields per row across 4 rows.
    //
    // That residual is Phase 6's question (R76): the reference renders those as stacked cards, and
    // there is not one <table>, <tr>, <td> or <th> in any of the 114 mockups. It is scoped in this
    // module's header rather than reached for here — a threshold tuned until every table looked
    // narrow would be the layout-lever failure R75 names, arriving from the other direction.
    const offenders = []
    for (const t of TABLES) {
      const { columns } = splitColumns(t.rows, isHiddenKey)
      for (const col of columns) {
        // A control column draws a segmented control from the row's own options; flattenDisplayValue
        // returns '' for it, so it is exempt from the text-fill test by construction, not by favour.
        if (isControlColumn(t.rows, col)) continue
        const filled = t.rows.filter((r) => rendersValue(r?.[col])).length
        if (filled / t.rows.length <= 0.5) offenders.push(`${t.id} · ${t.slot}: "${col}" on ${filled}/${t.rows.length} rows`)
      }
    }
    expect(offenders, 'a minority field is still rendering as a column').toEqual([])
  })

  it('records how many tables remain wide for a REAL reason, so Phase 6 is scoped', () => {
    const wide = TABLES.filter((t) => splitColumns(t.rows, isHiddenKey).columns.length > 8)
    expect(wide.length, 'the residual changed — re-measure before moving this number').toBe(18)
    const worst = Math.max(...TABLES.map((t) => splitColumns(t.rows, isHiddenKey).columns.length))
    expect(worst, 'the widest table after the rule').toBe(15)
  })

  it('every field is either a column or row detail — nothing is dropped (R75)', () => {
    const lost = []
    for (const t of TABLES) {
      const all = [...new Set(t.rows.flatMap((r) => Object.keys(r ?? {})))].filter((k) => !isHiddenKey(k))
      const { columns, detail } = splitColumns(t.rows, isHiddenKey)
      const kept = new Set([...columns, ...detail])
      for (const key of all) if (!kept.has(key)) lost.push(`${t.id} · ${t.slot}: "${key}" vanished`)
    }
    expect(lost, 'a field is neither a column nor reachable as detail').toEqual([])
  })

  it('a field every row carries is always a column', () => {
    const demoted = []
    for (const t of TABLES) {
      const { detail } = splitColumns(t.rows, isHiddenKey)
      for (const key of detail) {
        const filled = t.rows.filter((r) => rendersValue(r?.[key])).length
        if (filled === t.rows.length) demoted.push(`${t.id} · ${t.slot}: "${key}" shows on every row but is not a column`)
      }
    }
    expect(demoted).toEqual([])
  })

  it('the rule is a minority-case handler, not a layout lever (R75)', () => {
    // If this reshaped most of the corpus it would be taste rather than a correction. The honest
    // measure is COLUMNS, not tables: a table counts as "affected" if even one of its fifteen
    // fields moved, so the per-table figure (26 of 116) says how many tables were touched, not how
    // much was done to them. 52 of 710 columns move. 93% of every column in the corpus is left
    // exactly where it was.
    const columns = TABLES.reduce((n, t) => n + splitColumns(t.rows, isHiddenKey).columns.length, 0)
    const moved = TABLES.reduce((n, t) => n + splitColumns(t.rows, isHiddenKey).detail.length, 0)
    expect(moved / (columns + moved), 'the rule is moving most of the corpus').toBeLessThan(0.1)
    expect(moved, 'the rule moves nothing — it is not doing its job').toBeGreaterThan(20)
    const affected = TABLES.filter((t) => splitColumns(t.rows, isHiddenKey).detail.length > 0)
    expect(affected.length, 'the count of tables touched — measured, not a limit').toBe(27)
  })

  it('S10.1/decide keeps the fields its records share and moves the rest to detail', () => {
    const t = TABLES.find((x) => x.id === 'prop_s10_1_decide' && x.slot === 'slate')
    const { columns, detail } = splitColumns(t.rows, isHiddenKey)
    expect(columns).toEqual(['title', 'body'])
    // Everything else stays reachable, including the red `metric` figure.
    expect(detail).toContain('metric')
    expect(detail).toContain('hasCards')
    expect(columns.length + detail.length).toBe(14)
  })

  it('preserves the reference\'s own field order and never sorts', () => {
    const rows = [{ b: 1, a: 1 }, { b: 2, a: 2 }]
    expect(splitColumns(rows, () => false).columns).toEqual(['b', 'a'])
  })

  it('a column that would render nothing on any row is not a column (the browser found this)', () => {
    // THE CORRECTION T93's BROWSER HALF FORCED, pinned so it cannot regress to a data-shape test.
    // Every row carries `items`; every cell would read "—", because flattenDisplayValue returns ''
    // for an array of plain objects it does not recognise. The first version of this rule counted
    // the key as present and kept the column. See this module's header.
    const rows = [
      { name: 'A', items: [{ sku: 'X' }, { sku: 'Y' }] },
      { name: 'B', items: [{ sku: 'Z' }] },
    ]
    const { columns, detail } = splitColumns(rows, () => false)
    expect(columns).toEqual(['name'])
    expect(detail).toEqual(['items'])
  })

  it('a nested option array IS displayable — TableBlock draws it as a control', () => {
    // The other side of the same predicate. `rendersValue` must not demote a column the renderer
    // can in fact draw, which is why isNestedControlColumn lives beside it rather than in the block.
    const rows = [
      { name: 'A', modes: [{ label: 'Roll' }, { label: 'Test' }] },
      { name: 'B', modes: [{ label: 'Roll' }, { label: 'Test' }] },
    ]
    expect(splitColumns(rows, () => false).columns).toEqual(['name', 'modes'])
  })

  it('falls back to every field when nothing reaches the threshold', () => {
    const rows = [{ a: 1 }, { b: 2 }, { c: 3 }]
    const { columns, detail } = splitColumns(rows, () => false)
    expect(columns).toEqual(['a', 'b', 'c'])
    expect(detail).toEqual([])
  })
})
