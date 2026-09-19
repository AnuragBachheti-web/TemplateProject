// The bug this file exists for: every checkbox in a slate ticked at once.
//
// StagePage supplied TableBlock's `rowIdOf` as `slateItemId([row], 0)` — a one-element array and a
// literal 0. `slateItemId`'s positional fallback is `item_${index}`, so on any row without a
// business id it returned "item_0", for every row. TableBlock checks a box when
// `selectedIds.includes(idOf(row, i))`, so one tick checked the whole table — and Approve-selected
// would have posted `["item_0"]` regardless of which rows the operator actually chose.
//
// Measured on the corpus at the time of the fix: 20 proposals carry a non-empty slate and 16 of
// them have no business id on any row, so this was the normal case, not the edge case.

import { describe, it, expect } from 'vitest'
import { slateItemIdOf, slateItemId } from './slateItem'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

describe('slateItemIdOf — one row, its own index', () => {
  it('prefers the row\'s own business id, in declared key order', () => {
    expect(slateItemIdOf({ id: 'a', item_id: 'b', sku: 'c', code: 'd' }, 7)).toBe('a')
    expect(slateItemIdOf({ item_id: 'b', sku: 'c' }, 7)).toBe('b')
    expect(slateItemIdOf({ sku: 'c', code: 'd' }, 7)).toBe('c')
    expect(slateItemIdOf({ code: 'd' }, 7)).toBe('d')
  })

  it('ignores a blank or non-string id and falls back positionally', () => {
    expect(slateItemIdOf({ id: '   ' }, 3)).toBe('item_3')
    expect(slateItemIdOf({ id: 42 }, 3)).toBe('item_3')
    expect(slateItemIdOf({}, 3)).toBe('item_3')
    expect(slateItemIdOf(undefined, 3)).toBe('item_3')
  })

  it('THE REGRESSION: id-less rows get DISTINCT ids, one per position', () => {
    const slate = [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }]
    const ids = slate.map(slateItemIdOf)
    expect(ids).toEqual(['item_0', 'item_1', 'item_2', 'item_3'])
    expect(new Set(ids).size).toBe(slate.length)
  })
})

describe('slateItemId — the array form, unchanged, and the same rule underneath', () => {
  it('agrees with slateItemIdOf on every row of every slate in the corpus', () => {
    const slates = dataset
      .map((d) => d?.proposal?.slate)
      .filter((s) => Array.isArray(s) && s.length > 0)
    expect(slates.length).toBeGreaterThan(0)
    for (const slate of slates) {
      expect(slate.map((_, i) => slateItemId(slate, i))).toEqual(slate.map(slateItemIdOf))
    }
  })

  it('no slate in the corpus produces a duplicate id', () => {
    const offenders = dataset
      .filter((d) => Array.isArray(d?.proposal?.slate) && d.proposal.slate.length > 0)
      .filter((d) => new Set(d.proposal.slate.map(slateItemIdOf)).size !== d.proposal.slate.length)
      .map((d) => d.proposal_id)
    expect(offenders).toEqual([])
  })
})
