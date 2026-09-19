// @vitest-environment jsdom
//
// Two defects, one cause: a COLUMN property decided per CELL. See tableColumnLayout.js.
//
// WHAT THIS FILE CAN AND CANNOT SEE. jsdom has no layout engine, so it cannot tell you a column is
// 108px wide or that a cell wrapped to 25 lines — that is measured in real Chrome by
// scripts/smoke.mjs, and the numbers behind this change were taken there. What IS checkable here is
// the rule and the contract it puts in the DOM: that every header declares the same alignment as
// the cells beneath it, and that a prose column carries a floor at all. Structure here, behaviour
// there, and neither pretending to be the other (paneLayout.test.jsx's T79).

import { describe, it, expect } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import TableBlock from './TableBlock'
import { isFigureColumn, proseColumnMinCh, MIN_PROSE_CH, MAX_PROSE_CH, TARGET_WRAP_LINES } from './tableColumnLayout'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function mount(element) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  act(() => createRoot(container).render(element))
  return container
}

/** `text-right` / `text-left` as the element actually declares it — jsdom computes no cascade. */
const alignOf = (el) => (/\btext-right\b/.test(el.className) ? 'right' : /\btext-left\b/.test(el.className) ? 'left' : null)

describe('isFigureColumn — all or nothing, and missing cells do not vote', () => {
  it('is true when every cell that shows something is a figure', () => {
    expect(isFigureColumn([{ n: '65.6' }, { n: '−$2,210' }, { n: 12 }], 'n')).toBe(true)
  })

  it('is false as soon as one cell is prose', () => {
    expect(isFigureColumn([{ n: '65.6' }, { n: 'Cover drops to 24 days' }], 'n')).toBe(false)
  })

  it('ignores missing cells rather than letting them decide', () => {
    expect(isFigureColumn([{ n: '65.6' }, { n: null }, { n: '' }, {}], 'n')).toBe(true)
  })

  it('is false for a column that shows nothing at all — there is no alignment to infer', () => {
    expect(isFigureColumn([{ n: null }, {}], 'n')).toBe(false)
  })
})

describe('proseColumnMinCh — derived from the column\'s own longest value', () => {
  it('sizes the floor so the longest value lands in about the target line count', () => {
    const long = 'x'.repeat(150)
    expect(proseColumnMinCh([{ c: long }], 'c')).toBe(150 / TARGET_WRAP_LINES)
  })

  it('clamps at both ends, so one rule fits an 18-character chip and a 330-character paragraph', () => {
    expect(proseColumnMinCh([{ c: 'S9.2 replenishment' }], 'c')).toBe(MIN_PROSE_CH)
    expect(proseColumnMinCh([{ c: 'x'.repeat(2000) }], 'c')).toBe(MAX_PROSE_CH)
  })

  it('never lets the heading alone widen a column of short values', () => {
    const withHeading = proseColumnMinCh([{ c: 'ok' }], 'c', 'Days payable outstanding')
    expect(withHeading).toBeLessThanOrEqual(MAX_PROSE_CH)
    expect(withHeading).toBe(Math.ceil('Days payable outstanding'.length * TARGET_WRAP_LINES / TARGET_WRAP_LINES))
  })
})

describe('TableBlock — a header sits over its own data', () => {
  it('right-aligns BOTH the header and the cells of a figure column', () => {
    const container = mount(
      <TableBlock slotName="detail_rows" data={[{ label: 'W1', days: '74' }, { label: 'W2', days: '11' }]} />,
    )
    const ths = [...container.querySelectorAll('thead th')]
    const tds = [...container.querySelectorAll('tbody tr:first-child td')]
    expect(ths).toHaveLength(2)
    // Both columns read as figures here ("W1" is a figure by shape), so both sides go right.
    expect(ths.map(alignOf)).toEqual(['right', 'right'])
    expect(tds.map(alignOf)).toEqual(['right', 'right'])
  })

  it('left-aligns both sides of a prose column, even where individual cells are figures', () => {
    const container = mount(
      <TableBlock slotName="rows" data={[{ note: 'DIO · stock held before sale' }, { note: '74' }]} />,
    )
    expect(alignOf(container.querySelector('thead th'))).toBe('left')
    for (const td of container.querySelectorAll('tbody td')) expect(alignOf(td)).toBe('left')
  })

  it('THE INVARIANT, over every table in the corpus: no header disagrees with its column', () => {
    const offenders = []
    for (const d of dataset) {
      for (const [slot, value] of Object.entries(d.proposal ?? {})) {
        if (!Array.isArray(value) || value.length === 0) continue
        if (!value.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))) continue

        const container = mount(<TableBlock slotName={slot} data={value} />)
        const ths = [...container.querySelectorAll('thead th')]
        const firstRow = [...container.querySelectorAll('tbody tr:first-child > td')]
        if (ths.length === 0 || ths.length !== firstRow.length) continue
        ths.forEach((th, i) => {
          const head = alignOf(th)
          const cell = alignOf(firstRow[i])
          // A control column (a segmented control) declares neither; it is not text.
          if (head === null && cell === null) return
          if (head !== cell) offenders.push(`${d.proposal_id} · ${slot}[${i}]: head=${head} cells=${cell}`)
        })
        container.remove()
      }
    }
    expect(offenders.slice(0, 20)).toEqual([])
  })
})

describe('TableBlock — a prose column declares a floor, a figure column does not', () => {
  it('puts a ch-based minWidth on prose cells and leaves figure cells to size themselves', () => {
    const container = mount(
      <TableBlock
        slotName="slate"
        data={[{ body: 'Two of the six week-7 POs are for Core SKUs at 31 and 34 days of cover.', relief: '+$26K' }]}
      />,
    )
    const [bodyTh, reliefTh] = container.querySelectorAll('thead th')
    expect(bodyTh.style.minWidth).toMatch(/^\d+ch$/)
    expect(reliefTh.style.minWidth).toBe('')

    const [bodyTd, reliefTd] = container.querySelectorAll('tbody tr:first-child > td')
    expect(bodyTd.style.minWidth).toBe(bodyTh.style.minWidth)
    expect(reliefTd.style.minWidth).toBe('')
  })

  it('the floor a column declares is the same on its header and on every one of its cells', () => {
    // A header narrower than its own column would reintroduce the ribbon one row at a time.
    const container = mount(
      <TableBlock slotName="slate" data={[{ c: 'x'.repeat(200) }, { c: 'short' }, { c: 'x'.repeat(90) }]} />,
    )
    const declared = container.querySelector('thead th').style.minWidth
    expect(declared).toBe(`${MAX_PROSE_CH >= 40 ? 40 : MAX_PROSE_CH}ch`)
    for (const td of container.querySelectorAll('tbody td')) expect(td.style.minWidth).toBe(declared)
  })
})
